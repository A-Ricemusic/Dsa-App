import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwnerId } from "./lib/auth";
import { problemStats } from "./lib/aggregates";
import { cleanAttemptInput } from "./lib/attempts";
import { attemptInputValidator } from "./lib/validators";
import schema from "./schema";

async function requireProblem(ctx: MutationCtx, ownerId: string, problemId: Id<"problems">) {
  const problem = await ctx.db.get(problemId);
  if (!problem || problem.ownerId !== ownerId) {
    throw new ConvexError("Problem not found.");
  }
  return problem;
}

async function refreshLatestAttempt(
  ctx: MutationCtx,
  problem: Doc<"problems">,
  attemptCount: number,
) {
  const latest = await ctx.db
    .query("attempts")
    .withIndex("by_problemId_and_attemptedAt", (q) => q.eq("problemId", problem._id))
    .order("desc")
    .first();
  await ctx.db.patch("problems", problem._id, {
    attemptCount: Math.max(0, attemptCount),
    latestAttemptAt: latest?.attemptedAt,
    latestGrade: latest?.grade,
    latestShouldReview: latest?.shouldReviewAgain ?? false,
    updatedAt: Date.now(),
  });
  const updatedProblem = await ctx.db.get("problems", problem._id);
  if (updatedProblem) await problemStats.replaceOrInsert(ctx, problem, updatedProblem);
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
      .withIndex("by_problemId_and_attemptedAt", (q) => q.eq("problemId", args.problemId))
      .order("desc")
      .take(500);
  },
});

export const listForProblemPaginated = query({
  args: {
    problemId: v.id("problems"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(schema.doc("attempts")),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const problem = await ctx.db.get("problems", args.problemId);
    if (!problem || problem.ownerId !== ownerId) {
      throw new ConvexError("Problem not found.");
    }
    return await ctx.db
      .query("attempts")
      .withIndex("by_problemId_and_attemptedAt", (q) => q.eq("problemId", args.problemId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: {
    problemId: v.id("problems"),
    attemptId: v.id("attempts"),
  },
  returns: v.union(schema.doc("attempts"), v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const attempt = await ctx.db.get("attempts", args.attemptId);
    if (!attempt || attempt.ownerId !== ownerId || attempt.problemId !== args.problemId) {
      return null;
    }
    return attempt;
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
    const now = Date.now();
    const attemptId = await ctx.db.insert("attempts", {
      ownerId,
      problemId: args.problemId,
      attemptedAt: cleaned.attemptedAt,
      grade: args.grade,
      shouldReviewAgain: args.shouldReviewAgain,
      notes: cleaned.notes,
      createdAt: now,
      updatedAt: now,
    });
    await refreshLatestAttempt(ctx, problem, problem.attemptCount + 1);
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
    await refreshLatestAttempt(ctx, problem, problem.attemptCount);
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
    await refreshLatestAttempt(ctx, problem, problem.attemptCount - 1);
    return null;
  },
});
