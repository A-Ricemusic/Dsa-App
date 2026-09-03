import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOwnerId } from "./lib/auth";
import { difficultyValidator } from "./lib/validators";
import schema from "./schema";

const CLEANUP_BATCH_SIZE = 100;

function cleanProblem(args: {
  name: string;
  url: string;
  thoughts: string;
}) {
  const name = args.name.trim();
  const url = args.url.trim();
  const thoughts = args.thoughts.trim();
  if (name.length < 2 || name.length > 120) {
    throw new ConvexError("Problem names must be between 2 and 120 characters.");
  }
  if (thoughts.length > 4000) {
    throw new ConvexError("Thoughts must be 4,000 characters or fewer.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new ConvexError("Enter a valid http or https problem link.");
  }
  return { name, url, thoughts };
}

async function setCategories(
  ctx: MutationCtx,
  ownerId: string,
  problemId: Id<"problems">,
  categoryIds: Id<"categories">[],
) {
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length > 12) {
    throw new ConvexError("Choose no more than 12 categories per problem.");
  }
  for (const categoryId of uniqueIds) {
    const category = await ctx.db.get(categoryId);
    if (!category || category.ownerId !== ownerId) {
      throw new ConvexError("One of those categories is unavailable.");
    }
  }

  const existing = await ctx.db
    .query("problemCategories")
    .withIndex("by_problemId", (q) => q.eq("problemId", problemId))
    .take(100);
  const wanted = new Set(uniqueIds);
  const current = new Set(existing.map((item) => item.categoryId));

  for (const assignment of existing) {
    if (assignment.ownerId === ownerId && !wanted.has(assignment.categoryId)) {
      await ctx.db.delete(assignment._id);
    }
  }
  for (const categoryId of uniqueIds) {
    if (!current.has(categoryId)) {
      await ctx.db.insert("problemCategories", {
        ownerId,
        problemId,
        categoryId,
        createdAt: Date.now(),
      });
    }
  }
}

export const cleanupDeletedProblem = internalMutation({
  args: { problemId: v.id("problems") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_problemId_and_attemptedAt", (q) =>
        q.eq("problemId", args.problemId),
      )
      .take(CLEANUP_BATCH_SIZE);
    const assignments = await ctx.db
      .query("problemCategories")
      .withIndex("by_problemId", (q) => q.eq("problemId", args.problemId))
      .take(CLEANUP_BATCH_SIZE);

    for (const attempt of attempts) await ctx.db.delete(attempt._id);
    for (const assignment of assignments) await ctx.db.delete(assignment._id);

    if (
      attempts.length === CLEANUP_BATCH_SIZE ||
      assignments.length === CLEANUP_BATCH_SIZE
    ) {
      await ctx.scheduler.runAfter(0, internal.problems.cleanupDeletedProblem, args);
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(schema.doc("problems")),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    return await ctx.db
      .query("problems")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(500);
  },
});

export const listCategoryAssignments = query({
  args: {},
  returns: v.array(schema.doc("problemCategories")),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    return await ctx.db
      .query("problemCategories")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .take(6000);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    difficulty: difficultyValidator,
    thoughts: v.string(),
    categoryIds: v.array(v.id("categories")),
  },
  returns: v.id("problems"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const cleaned = cleanProblem(args);
    const now = Date.now();
    const problemId = await ctx.db.insert("problems", {
      ownerId,
      ...cleaned,
      difficulty: args.difficulty,
      attemptCount: 0,
      latestShouldReview: false,
      createdAt: now,
      updatedAt: now,
    });
    await setCategories(ctx, ownerId, problemId, args.categoryIds);
    return problemId;
  },
});

export const update = mutation({
  args: {
    problemId: v.id("problems"),
    name: v.string(),
    url: v.string(),
    difficulty: difficultyValidator,
    thoughts: v.string(),
    categoryIds: v.array(v.id("categories")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await ctx.db.get(args.problemId);
    if (!problem || problem.ownerId !== ownerId) {
      throw new ConvexError("Problem not found.");
    }
    const cleaned = cleanProblem(args);
    await ctx.db.patch(args.problemId, {
      ...cleaned,
      difficulty: args.difficulty,
      updatedAt: Date.now(),
    });
    await setCategories(ctx, ownerId, args.problemId, args.categoryIds);
    return null;
  },
});

export const remove = mutation({
  args: { problemId: v.id("problems") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await ctx.db.get(args.problemId);
    if (!problem || problem.ownerId !== ownerId) {
      throw new ConvexError("Problem not found.");
    }
    await ctx.db.delete(args.problemId);
    await ctx.scheduler.runAfter(0, internal.problems.cleanupDeletedProblem, {
      problemId: args.problemId,
    });
    return null;
  },
});
