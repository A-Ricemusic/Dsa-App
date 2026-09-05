import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
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

const baseAttempt = {
  attemptedAt: Date.UTC(2026, 7, 1, 12),
  grade: "C" as const,
  shouldReviewAgain: true,
  notes: "Review the hash-map invariant.",
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

describe("attempts", () => {
  it("requires authentication for every operation", async () => {
    const { t, alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const attemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
    });

    await expect(t.query(api.attempts.listForProblem, { problemId })).rejects.toThrow("signed in");
    await expect(t.mutation(api.attempts.create, { problemId, ...baseAttempt })).rejects.toThrow(
      "signed in",
    );
    await expect(t.mutation(api.attempts.update, { attemptId, ...baseAttempt })).rejects.toThrow(
      "signed in",
    );
    await expect(t.mutation(api.attempts.remove, { attemptId })).rejects.toThrow("signed in");
  });

  it("creates, cleans, and lists attempts newest first", async () => {
    const { alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const olderAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
      notes: "  Review the hash-map invariant.  ",
    });
    const newerAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      attemptedAt: Date.UTC(2026, 8, 1, 12),
      grade: "A",
      shouldReviewAgain: false,
      notes: "Solved cleanly.",
    });

    const attempts = await alice.query(api.attempts.listForProblem, { problemId });
    expect(attempts).toMatchObject([
      {
        _id: newerAttemptId,
        grade: "A",
        shouldReviewAgain: false,
        notes: "Solved cleanly.",
      },
      {
        _id: olderAttemptId,
        grade: "C",
        shouldReviewAgain: true,
        notes: "Review the hash-map invariant.",
      },
    ]);
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        _id: problemId,
        attemptCount: 2,
        latestAttemptAt: Date.UTC(2026, 8, 1, 12),
        latestGrade: "A",
        latestShouldReview: false,
      },
    ]);
  });

  it("recomputes the latest summary when an attempt date changes", async () => {
    const { alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const firstAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
    });
    const secondAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      attemptedAt: Date.UTC(2026, 8, 1, 12),
      grade: "A",
      shouldReviewAgain: false,
      notes: "Second attempt",
    });

    await expect(
      alice.mutation(api.attempts.update, {
        attemptId: firstAttemptId,
        attemptedAt: Date.UTC(2026, 9, 1, 12),
        grade: "B",
        shouldReviewAgain: true,
        notes: "  Now the newest attempt.  ",
      }),
    ).resolves.toBeNull();

    let attempts = await alice.query(api.attempts.listForProblem, { problemId });
    expect(attempts.map((attempt) => attempt._id)).toEqual([firstAttemptId, secondAttemptId]);
    expect(attempts[0]).toMatchObject({ grade: "B", notes: "Now the newest attempt." });
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 2,
        latestAttemptAt: Date.UTC(2026, 9, 1, 12),
        latestGrade: "B",
        latestShouldReview: true,
      },
    ]);

    await alice.mutation(api.attempts.update, {
      attemptId: firstAttemptId,
      attemptedAt: Date.UTC(2026, 6, 1, 12),
      grade: "D",
      shouldReviewAgain: true,
      notes: "Moved earlier",
    });

    attempts = await alice.query(api.attempts.listForProblem, { problemId });
    expect(attempts.map((attempt) => attempt._id)).toEqual([secondAttemptId, firstAttemptId]);
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 2,
        latestAttemptAt: Date.UTC(2026, 8, 1, 12),
        latestGrade: "A",
        latestShouldReview: false,
      },
    ]);
  });

  it("falls back to the previous attempt and clears the summary after removals", async () => {
    const { alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const olderAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
    });
    const newerAttemptId = await alice.mutation(api.attempts.create, {
      problemId,
      attemptedAt: Date.UTC(2026, 8, 1, 12),
      grade: "A",
      shouldReviewAgain: false,
      notes: "Newest attempt",
    });

    await expect(
      alice.mutation(api.attempts.remove, { attemptId: newerAttemptId }),
    ).resolves.toBeNull();
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 1,
        latestAttemptAt: baseAttempt.attemptedAt,
        latestGrade: "C",
        latestShouldReview: true,
      },
    ]);

    await alice.mutation(api.attempts.remove, { attemptId: olderAttemptId });

    await expect(alice.query(api.attempts.listForProblem, { problemId })).resolves.toEqual([]);
    const [problem] = await alice.query(api.problems.list);
    expect(problem).toMatchObject({ attemptCount: 0, latestShouldReview: false });
    expect(problem).not.toHaveProperty("latestAttemptAt");
    expect(problem).not.toHaveProperty("latestGrade");
  });

  it("prevents one owner from reading or changing another owner's attempts", async () => {
    const { alice, bob } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);
    const attemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
    });

    await expect(bob.query(api.attempts.listForProblem, { problemId })).rejects.toThrow(
      "Problem not found",
    );
    await expect(bob.mutation(api.attempts.create, { problemId, ...baseAttempt })).rejects.toThrow(
      "Problem not found",
    );
    await expect(
      bob.mutation(api.attempts.update, {
        attemptId,
        ...baseAttempt,
        grade: "F",
      }),
    ).rejects.toThrow("Attempt not found");
    await expect(bob.mutation(api.attempts.remove, { attemptId })).rejects.toThrow(
      "Attempt not found",
    );

    await expect(alice.query(api.attempts.listForProblem, { problemId })).resolves.toMatchObject([
      { _id: attemptId, grade: "C" },
    ]);
  });

  it("rejects invalid input without changing attempts or summary data", async () => {
    const { alice } = createTestContext();
    const problemId = await alice.mutation(api.problems.create, baseProblem);

    await expect(
      alice.mutation(api.attempts.create, {
        problemId,
        ...baseAttempt,
        attemptedAt: 0,
      }),
    ).rejects.toThrow("valid attempt date");
    await expect(
      alice.mutation(api.attempts.create, {
        problemId,
        ...baseAttempt,
        notes: "x".repeat(4001),
      }),
    ).rejects.toThrow("4,000 characters or fewer");

    await expect(alice.query(api.attempts.listForProblem, { problemId })).resolves.toEqual([]);
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      { attemptCount: 0, latestShouldReview: false },
    ]);

    const attemptId = await alice.mutation(api.attempts.create, {
      problemId,
      ...baseAttempt,
    });
    await expect(
      alice.mutation(api.attempts.update, {
        attemptId,
        ...baseAttempt,
        attemptedAt: Number.NaN,
      }),
    ).rejects.toThrow("valid attempt date");

    await expect(alice.query(api.attempts.listForProblem, { problemId })).resolves.toMatchObject([
      {
        _id: attemptId,
        attemptedAt: baseAttempt.attemptedAt,
        grade: "C",
        notes: baseAttempt.notes,
      },
    ]);
    await expect(alice.query(api.problems.list)).resolves.toMatchObject([
      {
        attemptCount: 1,
        latestAttemptAt: baseAttempt.attemptedAt,
        latestGrade: "C",
        latestShouldReview: true,
      },
    ]);
  });
});
