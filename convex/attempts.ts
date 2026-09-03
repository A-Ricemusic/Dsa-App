import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwnerId } from "./lib/auth";
import { cleanAttemptInput } from "./lib/attempts";
import { attemptInputValidator } from "./lib/validators";
import schema from "./schema";

async function requireProblem(
  ctx: MutationCtx,
  ownerId: string,
  problemId: Id<"problems">,
) {
  const problem = await ctx.db.get(problemId);
  if (!problem || problem.ownerId !== ownerId) {
    throw new ConvexError("Problem not found.");
  }
  return problem;
}

async function refreshLatestAttempt(
  ctx: MutationCtx,
  problemId: Id<"problems">,
  attemptCount: number,
) {
  const latest = await ctx.db
    .query("attempts")
    .withIndex("by_problemId_and_attemptedAt", (q) => q.eq("problemId", problemId))
    .order("desc")
    .first();
  await ctx.db.patch(problemId, {
    attemptCount: Math.max(0, attemptCount),
    latestAttemptAt: latest?.attemptedAt,
    latestGrade: latest?.grade,
    latestShouldReview: latest?.shouldReviewAgain ?? false,
    updatedAt: Date.now(),
  });
}

export const listForProblem = query({
  args: { problemId: v.id("problems") },
  returns: v.array(schema.doc("attempts")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await ctx.db.get(args.problemId);
    if (!problem || problem.ownerId !== ownerId) {
      throw new ConvexError("Problem not found.");
    }
    return await ctx.db
      .query("attempts")
      .withIndex("by_problemId_and_attemptedAt", (q) =>
        q.eq("problemId", args.problemId),
      )
      .order("desc")
      .take(500);
  },
});

export const migrateLegacyNotes = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .unique();
    const now = Date.now();
    if (profile?.attemptNotesMigratedAt) return null;
    if (
      profile?.attemptNotesMigrationStartedAt &&
      now - profile.attemptNotesMigrationStartedAt < 5 * 60 * 1000
    ) {
      return null;
    }

    const profileId = profile
      ? profile._id
      : await ctx.db.insert("profiles", {
          ownerId,
          attemptNotesMigrationStartedAt: now,
        });
    if (profile) {
      await ctx.db.patch(profile._id, { attemptNotesMigrationStartedAt: now });
    }
    await ctx.scheduler.runAfter(0, internal.attempts.migrateLegacyNotesBatch, {
      ownerId,
      profileId,
      cursor: null,
    });
    return null;
  },
});

export const migrateLegacyNotesBatch = internalMutation({
  args: {
    ownerId: v.string(),
    profileId: v.id("profiles"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const page = await ctx.db
      .query("problems")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .paginate({ numItems: 25, cursor: args.cursor });

    for (const problem of page.page) {
      const legacyNotes = problem.thoughts?.trim();
      if (!legacyNotes) continue;
      const latestAttempt = await ctx.db
        .query("attempts")
        .withIndex("by_problemId_and_attemptedAt", (q) =>
          q.eq("problemId", problem._id),
        )
        .order("desc")
        .first();
      if (!latestAttempt) continue;

      const currentNotes = latestAttempt.notes?.trim() ?? "";
      const notes = !currentNotes
        ? legacyNotes
        : currentNotes.includes(legacyNotes)
          ? currentNotes
          : `${currentNotes}\n\n${legacyNotes}`;
      await ctx.db.patch(latestAttempt._id, { notes, updatedAt: Date.now() });
      await ctx.db.patch(problem._id, { thoughts: undefined });
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.attempts.migrateLegacyNotesBatch, {
        ...args,
        cursor: page.continueCursor,
      });
    } else {
      await ctx.db.patch(args.profileId, {
        attemptNotesMigrationStartedAt: undefined,
        attemptNotesMigratedAt: Date.now(),
      });
    }
    return null;
  },
});

export const create = mutation({
  args: {
    problemId: v.id("problems"),
    ...attemptInputValidator.fields,
  },
  returns: v.id("attempts"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await requireProblem(ctx, ownerId, args.problemId);
    const cleaned = cleanAttemptInput(args);
    const legacyNotes = problem.thoughts?.trim() ?? "";
    const notes = legacyNotes && cleaned.notes && !cleaned.notes.includes(legacyNotes)
      ? `${legacyNotes}\n\n${cleaned.notes}`
      : cleaned.notes || legacyNotes;
    const now = Date.now();
    const attemptId = await ctx.db.insert("attempts", {
      ownerId,
      problemId: args.problemId,
      attemptedAt: cleaned.attemptedAt,
      grade: args.grade,
      shouldReviewAgain: args.shouldReviewAgain,
      notes,
      createdAt: now,
      updatedAt: now,
    });
    await refreshLatestAttempt(ctx, args.problemId, problem.attemptCount + 1);
    if (legacyNotes) await ctx.db.patch(args.problemId, { thoughts: undefined });
    return attemptId;
  },
});

export const update = mutation({
  args: {
    attemptId: v.id("attempts"),
    ...attemptInputValidator.fields,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.ownerId !== ownerId) {
      throw new ConvexError("Attempt not found.");
    }
    const cleaned = cleanAttemptInput(args);
    const problem = await requireProblem(ctx, ownerId, attempt.problemId);
    await ctx.db.patch(args.attemptId, {
      attemptedAt: cleaned.attemptedAt,
      grade: args.grade,
      shouldReviewAgain: args.shouldReviewAgain,
      notes: cleaned.notes,
      updatedAt: Date.now(),
    });
    await refreshLatestAttempt(ctx, attempt.problemId, problem.attemptCount);
    return null;
  },
});

export const remove = mutation({
  args: { attemptId: v.id("attempts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.ownerId !== ownerId) {
      throw new ConvexError("Attempt not found.");
    }
    const problem = await requireProblem(ctx, ownerId, attempt.problemId);
    await ctx.db.delete(args.attemptId);
    await refreshLatestAttempt(ctx, attempt.problemId, problem.attemptCount - 1);
    return null;
  },
});
