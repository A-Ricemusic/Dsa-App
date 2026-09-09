import { convexTest } from "convex-test";
import type { PaginationResult } from "convex/server";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

async function allPages<T>(query: (cursor: string | null) => Promise<PaginationResult<T>>) {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const result = await query(cursor);
    rows.push(...result.page);
    if (result.isDone) return rows;
    expect(result.continueCursor).not.toBe(cursor);
    cursor = result.continueCursor;
  }
  throw new Error("Pagination never completed");
}

it("loads beyond all previous list caps without losing owner isolation or chronological order", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", issuer: "https://issuer.example" });
  const bob = t.withIdentity({ subject: "bob", issuer: "https://issuer.example" });
  const problemId = await alice.mutation(api.problems.create, {
    name: "Oldest problem",
    url: "https://example.com/problem",
    difficulty: "easy",
    categoryIds: [],
  });
  await t.run(async (ctx) => {
    const original = (await ctx.db.get(problemId))!;
    const ownerId = original.ownerId;
    const categoryIds = [];
    for (let index = 0; index < 251; index++) {
      categoryIds.push(
        await ctx.db.insert("categories", {
          ownerId,
          name: `Category ${index}`,
          normalizedName: `category ${index}`,
          isDefault: false,
          createdAt: index,
        }),
      );
    }
    const problemIds = [problemId];
    for (let index = 0; index < 500; index++) {
      problemIds.push(
        await ctx.db.insert("problems", {
          ownerId,
          name: `Problem ${index}`,
          url: "https://example.com/problem",
          difficulty: "medium",
          attemptCount: 0,
          latestShouldReview: false,
          createdAt: original.createdAt + index + 1,
          updatedAt: original.updatedAt + index + 1,
        }),
      );
    }
    for (const id of problemIds) {
      for (const categoryId of categoryIds.slice(0, 12)) {
        await ctx.db.insert("problemCategories", {
          ownerId,
          problemId: id,
          categoryId,
          createdAt: 1,
        });
      }
    }
    for (let index = 0; index < 501; index++) {
      await ctx.db.insert("attempts", {
        ownerId,
        problemId,
        attemptedAt: 1000 + index,
        grade: "B",
        shouldReviewAgain: false,
        notes: `Attempt ${index}`,
        createdAt: index,
        updatedAt: index,
      });
    }
    await ctx.db.patch(problemId, { attemptCount: 501, latestAttemptAt: 1500, latestGrade: "B" });
  });
  await bob.mutation(api.problems.create, {
    name: "Private Bob",
    url: "https://example.com/private",
    difficulty: "hard",
    categoryIds: [],
  });
  await bob.mutation(api.categories.create, { name: "Private category" });
  const problems = await allPages((cursor) =>
    alice.query(api.problems.listPage, { paginationOpts: paginationOpts(cursor) }),
  );
  expect(problems).toHaveLength(501);
  expect(problems.at(-1)?._id).toBe(problemId);
  expect(new Set(problems.map((problem) => problem._id)).size).toBe(501);
  const categories = await allPages((cursor) =>
    alice.query(api.categories.listPage, { paginationOpts: paginationOpts(cursor) }),
  );
  expect(categories).toHaveLength(251);
  const assignments = await allPages((cursor) =>
    alice.query(api.problems.listCategoryAssignmentsPage, {
      paginationOpts: paginationOpts(cursor),
    }),
  );
  expect(assignments).toHaveLength(6012);
  expect(new Set(assignments.map((assignment) => assignment._id)).size).toBe(6012);
  const attempts = await allPages((cursor) =>
    alice.query(api.attempts.listForProblemPage, {
      problemId,
      paginationOpts: paginationOpts(cursor),
    }),
  );
  expect(attempts).toHaveLength(501);
  expect(attempts[0]?.notes).toBe("Attempt 500");
  expect(attempts.at(-1)?.notes).toBe("Attempt 0");
  await expect(
    bob.query(api.attempts.listForProblemPage, { problemId, paginationOpts: paginationOpts(null) }),
  ).resolves.toMatchObject({ page: [], isDone: true });
  await expect(
    t.query(api.problems.listPage, { paginationOpts: paginationOpts(null) }),
  ).rejects.toThrow("signed in");
  await expect(
    t.query(api.categories.listPage, { paginationOpts: paginationOpts(null) }),
  ).rejects.toThrow("signed in");
  await expect(
    t.query(api.problems.listCategoryAssignmentsPage, { paginationOpts: paginationOpts(null) }),
  ).rejects.toThrow("signed in");
  await expect(
    t.query(api.attempts.listForProblemPage, { problemId, paginationOpts: paginationOpts(null) }),
  ).rejects.toThrow("signed in");
  await t.run(async (ctx) => {
    await ctx.db.delete(problemId);
  });
  await expect(
    alice.query(api.attempts.listForProblemPage, {
      problemId,
      paginationOpts: paginationOpts(null),
    }),
  ).resolves.toMatchObject({ page: [], isDone: true });
});

const paginationOpts = (cursor: string | null) => ({ cursor, numItems: 200 });
