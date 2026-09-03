import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const difficulty = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

const grade = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("D"),
  v.literal("F"),
);

export default defineSchema({
  profiles: defineTable({
    ownerId: v.string(),
    defaultCategoriesSeededAt: v.optional(v.number()),
  }).index("by_ownerId", ["ownerId"]),

  problems: defineTable({
    ownerId: v.string(),
    name: v.string(),
    url: v.string(),
    difficulty,
    thoughts: v.string(),
    attemptCount: v.number(),
    latestAttemptAt: v.optional(v.number()),
    latestGrade: v.optional(grade),
    latestShouldReview: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_ownerId_and_latestShouldReview", [
      "ownerId",
      "latestShouldReview",
    ]),

  attempts: defineTable({
    ownerId: v.string(),
    problemId: v.id("problems"),
    attemptedAt: v.number(),
    grade,
    shouldReviewAgain: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_attemptedAt", ["ownerId", "attemptedAt"])
    .index("by_problemId_and_attemptedAt", ["problemId", "attemptedAt"]),

  categories: defineTable({
    ownerId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_ownerId_and_normalizedName", ["ownerId", "normalizedName"]),

  problemCategories: defineTable({
    ownerId: v.string(),
    problemId: v.id("problems"),
    categoryId: v.id("categories"),
    createdAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_problemId", ["problemId"])
    .index("by_categoryId", ["categoryId"])
    .index("by_problemId_and_categoryId", ["problemId", "categoryId"]),
});
