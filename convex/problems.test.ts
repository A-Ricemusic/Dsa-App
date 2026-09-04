import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

const baseProblem = {
  name: "Two Sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "easy" as const,
  categoryIds: [] as Id<"categories">[],
};

function createTestContext() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return {
    t,
    alice: t.withIdentity({ subject: "alice", issuer: "https://issuer.example" }),
    bob: t.withIdentity({ subject: "bob", issuer: "https://issuer.example" }),
  };
}

describe("problems and attempts", () => {
  it("requires authentication for user data", async () => {
    const { t } = createTestContext();

    await expect(t.query(api.problems.list)).rejects.toThrow("signed in");
    await expect(t.mutation(api.problems.create, baseProblem)).rejects.toThrow("signed in");
  });

  it("creates an unattempted problem and isolates it by owner", async () => {
    const { alice, bob } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);

    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        _id: problemId,
        name: "Two Sum",
        attemptCount: 0,
        latestShouldReview: false,
      },
    ]);
    await expect(alice.query(api.attempts.listForProblem, { problemId })).resolves.toEqual([]);
    await expect(bob.query(api.problems.list)).resolves.toEqual([]);
    await expect(bob.query(api.attempts.listForProblem, { problemId })).rejects.toThrow(
      "Problem not found",
    );
    await expect(alice.query(api.problems.get, { problemId })).resolves.toMatchObject({
      _id: problemId,
      categories: [],
    });
    await expect(bob.query(api.problems.get, { problemId })).resolves.toBeNull();
  });

  it("paginates problems and attempts without making deep links depend on a page", async () => {
    const { alice, bob } = createTestContext();
    const firstProblemId = await alice.mutation(api.problems.create, {
      ...baseProblem,
      name: "First problem",
    });
    await alice.mutation(api.problems.create, { ...baseProblem, name: "Second problem" });
    await alice.mutation(api.problems.create, { ...baseProblem, name: "Third problem" });

    const firstPage = await alice.query(api.problems.listPaginated, {
      paginationOpts: { cursor: null, numItems: 2 },
    });
    const secondPage = await alice.query(api.problems.listPaginated, {
      paginationOpts: { cursor: firstPage.continueCursor, numItems: 2 },
    });
    expect([...firstPage.page, ...secondPage.page]).toHaveLength(3);

    const attemptIds: Id<"attempts">[] = [];
    for (const [index, grade] of (["C", "B", "A"] as const).entries()) {
      attemptIds.push(
        await alice.mutation(api.attempts.create, {
          problemId: firstProblemId,
          attemptedAt: Date.UTC(2026, index, 1),
          grade,
          shouldReviewAgain: false,
          notes: `Attempt ${index + 1}`,
        }),
      );
    }
    const attemptPage = await alice.query(api.attempts.listForProblemPaginated, {
      problemId: firstProblemId,
      paginationOpts: { cursor: null, numItems: 2 },
    });
    expect(attemptPage.page).toHaveLength(2);
    await expect(
      alice.query(api.attempts.get, {
        problemId: firstProblemId,
        attemptId: attemptIds[0]!,
      }),
    ).resolves.toMatchObject({ notes: "Attempt 1" });
    await expect(
      bob.query(api.attempts.get, {
        problemId: firstProblemId,
        attemptId: attemptIds[0]!,
      }),
    ).resolves.toBeNull();
  });

  it("keeps an attempt beyond the previous 500-row boundary accessible", async () => {
    const { t, alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const oldestAttemptId = await t.run(async (ctx) => {
      const problem = await ctx.db.get("problems", problemId);
      if (!problem) throw new Error("Expected problem");
      let oldest: Id<"attempts"> | null = null;
      for (let index = 0; index < 501; index += 1) {
        const attemptId = await ctx.db.insert("attempts", {
          ownerId: problem.ownerId,
          problemId,
          attemptedAt: index,
          grade: "B",
          shouldReviewAgain: false,
          notes: `Attempt ${index}`,
          createdAt: index,
          updatedAt: index,
        });
        oldest ??= attemptId;
      }
      await ctx.db.patch("problems", problemId, { attemptCount: 501 });
      if (!oldest) throw new Error("Expected oldest attempt");
      return oldest;
    });

    const firstPage = await alice.query(api.attempts.listForProblemPaginated, {
      problemId,
      paginationOpts: { cursor: null, numItems: 500 },
    });
    const secondPage = await alice.query(api.attempts.listForProblemPaginated, {
      problemId,
      paginationOpts: { cursor: firstPage.continueCursor, numItems: 500 },
    });
    expect([...firstPage.page, ...secondPage.page]).toHaveLength(501);
    await expect(
      alice.query(api.attempts.get, { problemId, attemptId: oldestAttemptId }),
    ).resolves.toMatchObject({ notes: "Attempt 0" });
  });

  it("stores notes on attempts and derives the latest attempt summary", async () => {
    const { alice } = createTestContext();
    const firstAttemptAt = Date.UTC(2026, 7, 1, 12);
    const problemId = await alice.mutation(api.problems.create, {
      ...baseProblem,
      firstAttempt: {
        attemptedAt: firstAttemptAt,
        grade: "C",
        shouldReviewAgain: true,
        notes: "  Revisit the hash-map invariant.  ",
      },
    });

    await alice.mutation(api.attempts.create, {
      problemId,
      attemptedAt: Date.UTC(2026, 6, 1, 12),
      grade: "F",
      shouldReviewAgain: true,
      notes: "Older attempt",
    });
    const newestAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      attemptedAt: Date.UTC(2026, 8, 1, 12),
      grade: "A",
      shouldReviewAgain: false,
      notes: "Solved cleanly",
    });

    const attempts = await alice.query(api.attempts.listForProblem, { problemId });
    expect(attempts.map((attempt) => attempt.notes)).toEqual([
      "Solved cleanly",
      "Revisit the hash-map invariant.",
      "Older attempt",
    ]);
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 3,
        latestAttemptAt: Date.UTC(2026, 8, 1, 12),
        latestGrade: "A",
        latestShouldReview: false,
      },
    ]);

    await alice.mutation(api.attempts.remove, { attemptId: newestAttemptId });

    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 2,
        latestAttemptAt: firstAttemptAt,
        latestGrade: "C",
        latestShouldReview: true,
      },
    ]);
  });

  it("rejects another user's category and cleans up child records after deletion", async () => {
    const { t, alice, bob } = createTestContext();
    const bobCategoryId = await bob.mutation(api.categories.create, { name: "Private Category" });

    await expect(
      alice.mutation(api.problems.create, {
        ...baseProblem,
        categoryIds: [bobCategoryId],
      }),
    ).rejects.toThrow("unavailable");

    const aliceCategoryId = await alice.mutation(api.categories.create, { name: "Arrays" });
    const problemId = await alice.mutation(api.problems.create, {
      ...baseProblem,
      categoryIds: [aliceCategoryId],
      firstAttempt: {
        attemptedAt: Date.UTC(2026, 8, 1, 12),
        grade: "B",
        shouldReviewAgain: false,
        notes: "",
      },
    });

    await alice.mutation(api.problems.remove, { problemId });
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }

    const children = await t.run(async (ctx) => {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_problemId_and_attemptedAt", (query) => query.eq("problemId", problemId))
        .take(10);
      const assignments = await ctx.db
        .query("problemCategories")
        .withIndex("by_problemId", (query) => query.eq("problemId", problemId))
        .take(10);
      return { attempts, assignments };
    });

    expect(children).toEqual({ attempts: [], assignments: [] });
  });

  it("backfills and maintains exact dashboard and category totals", async () => {
    const { t, alice } = createTestContext();
    const categoryId = await alice.mutation(api.categories.create, { name: "Study plan" });
    const reviewProblemId = await alice.mutation(api.problems.create, {
      ...baseProblem,
      name: "Review problem",
      categoryIds: [categoryId],
      firstAttempt: {
        attemptedAt: Date.UTC(2026, 0, 1),
        grade: "C",
        shouldReviewAgain: true,
        notes: "Review this",
      },
    });
    const freshProblemId = await alice.mutation(api.problems.create, {
      ...baseProblem,
      name: "Fresh problem",
      categoryIds: [categoryId],
    });
    await t.run(async (ctx) => {
      const category = await ctx.db.get("categories", categoryId);
      if (!category) throw new Error("Expected category");
      const now = Date.now();
      const legacyProblemId = await ctx.db.insert("problems", {
        ownerId: category.ownerId,
        name: "Legacy problem",
        url: baseProblem.url,
        difficulty: baseProblem.difficulty,
        attemptCount: 0,
        latestShouldReview: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("problemCategories", {
        ownerId: category.ownerId,
        problemId: legacyProblemId,
        categoryId,
        createdAt: now,
      });
    });

    await alice.mutation(api.stats.ensureBackfill);
    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }

    await expect(alice.query(api.stats.get)).resolves.toEqual({
      ready: true,
      problemCount: 3,
      attemptCount: 1,
      reviewCount: 1,
      gradeCounts: { A: 0, B: 0, C: 1, D: 0, F: 0 },
    });
    const categories = await alice.query(api.categories.listPaginated, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(categories.page).toEqual([
      expect.objectContaining({ _id: categoryId, problemCount: 3 }),
    ]);

    await alice.mutation(api.attempts.create, {
      problemId: freshProblemId,
      attemptedAt: Date.UTC(2026, 1, 1),
      grade: "A",
      shouldReviewAgain: false,
      notes: "Solid",
    });
    await alice.mutation(api.problems.remove, { problemId: reviewProblemId });

    await expect(alice.query(api.stats.get)).resolves.toEqual({
      ready: true,
      problemCount: 2,
      attemptCount: 1,
      reviewCount: 0,
      gradeCounts: { A: 1, B: 0, C: 0, D: 0, F: 0 },
    });
    const categoriesAfterDelete = await alice.query(api.categories.listPaginated, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(categoriesAfterDelete.page).toEqual([
      expect.objectContaining({ _id: categoryId, problemCount: 2 }),
    ]);
  });
});
