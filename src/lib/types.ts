import type { Doc, Id } from "../../convex/_generated/dataModel";

export type Difficulty = Doc<"problems">["difficulty"];
export const DIFFICULTIES = [
  "easy-",
  "easy",
  "easy+",
  "medium-",
  "medium",
  "medium+",
  "hard-",
  "hard",
  "hard+",
] as const satisfies readonly Difficulty[];
export type Grade = "A" | "B" | "C" | "D" | "F";
export type View = "dashboard" | "problems" | "categories" | "topics";
export type SortKey = "recent" | "grade" | "attempts" | "name";

export type Problem = Doc<"problems">;
export type Category = Doc<"categories">;
export type Attempt = Doc<"attempts">;
export type CategoryId = Id<"categories">;
export type ProblemId = Id<"problems">;
export type AttemptId = Id<"attempts">;

export type ProblemWithCategories = Problem & {
  categoryIds: CategoryId[];
  categories: Category[];
};
