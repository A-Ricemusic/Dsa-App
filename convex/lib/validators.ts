import { v } from "convex/values";

export const difficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

export const gradeValidator = v.union(
  v.literal("A"),
  v.literal("B"),
  v.literal("C"),
  v.literal("D"),
  v.literal("F"),
);

export const attemptInputValidator = v.object({
  attemptedAt: v.number(),
  grade: gradeValidator,
  shouldReviewAgain: v.boolean(),
  notes: v.string(),
});
