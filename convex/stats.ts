import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOwnerId } from "./lib/auth";
import { categoryStats, problemStats } from "./lib/aggregates";

const BACKFILL_BATCH_SIZE = 32;
const grades = ["A", "B", "C", "D", "F"] as const;

const gradeCountsValidator = v.object({
  A: v.number(),
  B: v.number(),
  C: v.number(),
  D: v.number(),
  F: v.number(),
});

async function findProfile(ctx: QueryCtx | MutationCtx, ownerId: string) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

export const ensureBackfill = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    let profile = await findProfile(ctx, ownerId);
    if (!profile) {
      const profileId = await ctx.db.insert("profiles", { ownerId });
      profile = await ctx.db.get("profiles", profileId);
    }
    if (!profile) return null;

    const now = Date.now();
    if (!profile.problemStatsReadyAt && !profile.problemStatsBackfillStartedAt) {
      await ctx.db.patch("profiles", profile._id, { problemStatsBackfillStartedAt: now });
      await ctx.scheduler.runAfter(0, internal.stats.backfillProblems, {
        ownerId,
        cursor: null,
      });
    }
    if (!profile.categoryStatsReadyAt && !profile.categoryStatsBackfillStartedAt) {
      await ctx.db.patch("profiles", profile._id, { categoryStatsBackfillStartedAt: now });
      await ctx.scheduler.runAfter(0, internal.stats.backfillCategoryAssignments, {
        ownerId,
        cursor: null,
      });
    }
    return null;
  },
});

export const backfillProblems = internalMutation({
  args: { ownerId: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const result = await ctx.db
      .query("problems")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .paginate({ cursor: args.cursor, numItems: BACKFILL_BATCH_SIZE });

    for (const problem of result.page) {
      await problemStats.insertIfDoesNotExist(ctx, problem);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.backfillProblems, {
        ownerId: args.ownerId,
        cursor: result.continueCursor,
      });
      return null;
    }

    const profile = await findProfile(ctx, args.ownerId);
    if (profile) {
      await ctx.db.patch("profiles", profile._id, {
        problemStatsBackfillStartedAt: undefined,
        problemStatsReadyAt: Date.now(),
      });
    }
    return null;
  },
});

export const backfillCategoryAssignments = internalMutation({
  args: { ownerId: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const result = await ctx.db
      .query("problemCategories")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .paginate({ cursor: args.cursor, numItems: BACKFILL_BATCH_SIZE });

    for (const assignment of result.page) {
      await categoryStats.insertIfDoesNotExist(ctx, assignment);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.backfillCategoryAssignments, {
        ownerId: args.ownerId,
        cursor: result.continueCursor,
      });
      return null;
    }

    const profile = await findProfile(ctx, args.ownerId);
    if (profile) {
      await ctx.db.patch("profiles", profile._id, {
        categoryStatsBackfillStartedAt: undefined,
        categoryStatsReadyAt: Date.now(),
      });
    }
    return null;
  },
});

export const get = query({
  args: {},
  returns: v.object({
    ready: v.boolean(),
    problemCount: v.union(v.number(), v.null()),
    attemptCount: v.union(v.number(), v.null()),
    reviewCount: v.union(v.number(), v.null()),
    gradeCounts: v.union(gradeCountsValidator, v.null()),
  }),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const profile = await findProfile(ctx, ownerId);
    if (!profile?.problemStatsReadyAt) {
      return {
        ready: false,
        problemCount: null,
        attemptCount: null,
        reviewCount: null,
        gradeCounts: null,
      };
    }

    const [problemCount, attemptCount, reviewCount, counts] = await Promise.all([
      problemStats.count(ctx, { namespace: ownerId }),
      problemStats.sum(ctx, { namespace: ownerId }),
      problemStats.count(ctx, {
        namespace: ownerId,
        bounds: { prefix: [true] },
      }),
      problemStats.countBatch(
        ctx,
        grades.flatMap((grade) => [
          { namespace: ownerId, bounds: { prefix: [false, grade] } },
          { namespace: ownerId, bounds: { prefix: [true, grade] } },
        ]),
      ),
    ]);

    const gradeCounts = Object.fromEntries(
      grades.map((grade, index) => [grade, counts[index * 2]! + counts[index * 2 + 1]!] as const),
    ) as Record<(typeof grades)[number], number>;

    return { ready: true, problemCount, attemptCount, reviewCount, gradeCounts };
  },
});
