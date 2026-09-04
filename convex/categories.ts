import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOwnerId } from "./lib/auth";
import { categoryStats } from "./lib/aggregates";
import { normalizeCategoryName } from "./lib/categories";
import schema from "./schema";

const CLEANUP_BATCH_SIZE = 100;

const categoryWithCountValidator = schema.doc("categories").extend({
  problemCount: v.union(v.number(), v.null()),
});

export const cleanupDeletedCategory = internalMutation({
  args: { categoryId: v.id("categories") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const assignments = await ctx.db
      .query("problemCategories")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId))
      .take(CLEANUP_BATCH_SIZE);

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
      await categoryStats.deleteIfExists(ctx, assignment);
    }

    if (assignments.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.categories.cleanupDeletedCategory, args);
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(schema.doc("categories")),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .take(250);
    return categories.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(categoryWithCountValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .unique();
    const result = await ctx.db
      .query("categories")
      .withIndex("by_ownerId_and_normalizedName", (q) => q.eq("ownerId", ownerId))
      .paginate(args.paginationOpts);
    const counts =
      profile?.categoryStatsReadyAt && result.page.length > 0
        ? await categoryStats.countBatch(
            ctx,
            result.page.map((category) => ({ namespace: category._id })),
          )
        : result.page.map(() => null);
    return {
      ...result,
      page: result.page.map((category, index) =>
        Object.assign({}, category, { problemCount: counts[index] ?? null }),
      ),
    };
  },
});

export const ensureDefaults = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
      .unique();

    if (profile?.defaultCategoriesSeededAt) return 0;

    const defaults = await ctx.db
      .query("defaultCategories")
      .withIndex("by_sortOrder")
      .order("asc")
      .take(250);
    if (defaults.length === 0) return 0;

    const now = Date.now();
    let inserted = 0;
    for (const defaultCategory of defaults) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_ownerId_and_normalizedName", (q) =>
          q.eq("ownerId", ownerId).eq("normalizedName", defaultCategory.normalizedName),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("categories", {
          ownerId,
          name: defaultCategory.name,
          normalizedName: defaultCategory.normalizedName,
          isDefault: true,
          createdAt: now,
        });
        inserted += 1;
      }
    }

    if (profile) {
      await ctx.db.patch(profile._id, { defaultCategoriesSeededAt: now });
    } else {
      await ctx.db.insert("profiles", {
        ownerId,
        defaultCategoriesSeededAt: now,
      });
    }
    return inserted;
  },
});

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const name = args.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 48) {
      throw new ConvexError("Category names must be between 2 and 48 characters.");
    }
    const normalizedName = normalizeCategoryName(name);
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_ownerId_and_normalizedName", (q) =>
        q.eq("ownerId", ownerId).eq("normalizedName", normalizedName),
      )
      .unique();
    if (existing) throw new ConvexError("That category already exists.");

    return await ctx.db.insert("categories", {
      ownerId,
      name,
      normalizedName,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { categoryId: v.id("categories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerId !== ownerId) {
      throw new ConvexError("Category not found.");
    }
    await ctx.db.delete(args.categoryId);
    await ctx.scheduler.runAfter(0, internal.categories.cleanupDeletedCategory, {
      categoryId: args.categoryId,
    });
    return null;
  },
});
