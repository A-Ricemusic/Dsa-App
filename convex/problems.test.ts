import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const baseProblem = {
  name: "Two Sum",
  url: "https://leetcode.com/problems/two-sum/",
  difficulty: "easy" as const,
  categoryIds: [] as Id<"categories">[],
};

function createTestContext() {
  const t = convexTest(schema, modules);
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
});
