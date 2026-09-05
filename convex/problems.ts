import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwnerId } from "./lib/auth";
import { cleanAttemptInput } from "./lib/attempts";
import { categoryStats, problemStats } from "./lib/aggregates";
import { attemptInputValidator, difficultyValidator } from "./lib/validators";
import schema from "./schema";

const CLEANUP_BATCH_SIZE = 100;

const problemWithCategoriesValidator = schema.doc("problems").extend({
  categoryIds: v.array(v.id("categories")),
  categories: v.array(schema.doc("categories")),
});

async function withCategories(ctx: QueryCtx, ownerId: string, problem: Doc<"problems">) {
  const assignments = await ctx.db
    .query("problemCategories")
    .withIndex("by_problemId", (q) => q.eq("problemId", problem._id))
    .take(13);
  if (assignments.length > 12) {
    throw new ConvexError("This problem has too many category assignments.");
  }
  const categories = (
    await Promise.all(
      assignments.map((assignment) => ctx.db.get("categories", assignment.categoryId)),
    )
  ).filter(
    (category): category is Doc<"categories"> => category !== null && category.ownerId === ownerId,
  );
  return {
    ...problem,
    categoryIds: categories.map((category) => category._id),
    categories,
  };
}

function cleanProblem(args: { name: string; url: string }) {
  const name = args.name.trim();
  const url = args.url.trim();
  if (name.length < 2 || name.length > 120) {
    throw new ConvexError("Problem names must be between 2 and 120 characters.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
  } catch {
    throw new ConvexError("Enter a valid http or https problem link.");
  }
  return { name, url };
}

async function deleteCategoryAssignment(ctx: MutationCtx, assignment: Doc<"problemCategories">) {
  await ctx.db.delete("problemCategories", assignment._id);
  await categoryStats.deleteIfExists(ctx, assignment);
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
      await deleteCategoryAssignment(ctx, assignment);
    }
  }
  for (const categoryId of uniqueIds) {
    if (!current.has(categoryId)) {
      const assignmentId = await ctx.db.insert("problemCategories", {
        ownerId,
        problemId,
        categoryId,
        createdAt: Date.now(),
      });
      const assignment = await ctx.db.get("problemCategories", assignmentId);
      if (assignment) await categoryStats.insertIfDoesNotExist(ctx, assignment);
    }
  }
}

export const cleanupDeletedProblem = internalMutation({
  args: { problemId: v.id("problems") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_problemId_and_attemptedAt", (q) => q.eq("problemId", args.problemId))
      .take(CLEANUP_BATCH_SIZE);
    const assignments = await ctx.db
      .query("problemCategories")
      .withIndex("by_problemId", (q) => q.eq("problemId", args.problemId))
      .take(CLEANUP_BATCH_SIZE);

    for (const attempt of attempts) await ctx.db.delete(attempt._id);
    for (const assignment of assignments) {
      await deleteCategoryAssignment(ctx, assignment);
    }

    if (attempts.length === CLEANUP_BATCH_SIZE || assignments.length === CLEANUP_BATCH_SIZE) {
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

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(problemWithCategoriesValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const result = await ctx.db
      .query("problems")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((problem) => withCategories(ctx, ownerId, problem))),
    };
  },
});

export const get = query({
  args: { problemId: v.id("problems") },
  returns: v.union(problemWithCategoriesValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await ctx.db.get("problems", args.problemId);
    if (!problem || problem.ownerId !== ownerId) return null;
    return await withCategories(ctx, ownerId, problem);
  },
});

export const dashboard = query({
  args: {},
  returns: v.object({
    recent: v.array(problemWithCategoriesValidator),
    nextReview: v.union(problemWithCategoriesValidator, v.null()),
  }),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const recent = await ctx.db
      .query("problems")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(5);
    const nextReview = await ctx.db
      .query("problems")
      .withIndex("by_ownerId_and_latestShouldReview", (q) =>
        q.eq("ownerId", ownerId).eq("latestShouldReview", true),
      )
      .order("desc")
      .first();
    return {
      recent: await Promise.all(recent.map((problem) => withCategories(ctx, ownerId, problem))),
      nextReview: nextReview ? await withCategories(ctx, ownerId, nextReview) : null,
    };
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
    categoryIds: v.array(v.id("categories")),
    firstAttempt: v.optional(attemptInputValidator),
  },
  returns: v.id("problems"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const cleaned = cleanProblem(args);
    const now = Date.now();
    const firstAttempt = args.firstAttempt
      ? { ...args.firstAttempt, ...cleanAttemptInput(args.firstAttempt) }
      : undefined;
    const problemId = await ctx.db.insert("problems", {
      ownerId,
      name: cleaned.name,
      url: cleaned.url,
      difficulty: args.difficulty,
      attemptCount: firstAttempt ? 1 : 0,
      latestAttemptAt: firstAttempt?.attemptedAt,
      latestGrade: firstAttempt?.grade,
      latestShouldReview: firstAttempt?.shouldReviewAgain ?? false,
      createdAt: now,
      updatedAt: now,
    });
    const problem = await ctx.db.get("problems", problemId);
    if (problem) await problemStats.insertIfDoesNotExist(ctx, problem);
    if (firstAttempt) {
      await ctx.db.insert("attempts", {
        ownerId,
        problemId,
        attemptedAt: firstAttempt.attemptedAt,
        grade: firstAttempt.grade,
        shouldReviewAgain: firstAttempt.shouldReviewAgain,
        notes: firstAttempt.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
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
    await ctx.db.patch("problems", args.problemId, {
      name: cleaned.name,
      url: cleaned.url,
      difficulty: args.difficulty,
      updatedAt: Date.now(),
    });
    const updatedProblem = await ctx.db.get("problems", args.problemId);
    if (updatedProblem) await problemStats.replaceOrInsert(ctx, problem, updatedProblem);
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
    const assignments = await ctx.db
      .query("problemCategories")
      .withIndex("by_problemId", (q) => q.eq("problemId", args.problemId))
      .take(CLEANUP_BATCH_SIZE);
    for (const assignment of assignments) {
      await deleteCategoryAssignment(ctx, assignment);
    }
    await ctx.db.delete("problems", args.problemId);
    await problemStats.deleteIfExists(ctx, problem);
    await ctx.scheduler.runAfter(0, internal.problems.cleanupDeletedProblem, {
      problemId: args.problemId,
    });
    return null;
  },
});
