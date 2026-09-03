import type { Doc, Id } from "../../convex/_generated/dataModel";

export type Difficulty = "easy" | "medium" | "hard";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type View = "dashboard" | "problems" | "categories";
export type SortKey = "recent" | "grade" | "attempts" | "name";

export type Problem = Omit<Doc<"problems">, "thoughts">;
export type Category = Doc<"categories">;
export type Attempt = Doc<"attempts">;
export type CategoryId = Id<"categories">;
export type ProblemId = Id<"problems">;
export type AttemptId = Id<"attempts">;

export type ProblemWithCategories = Problem & {
  categoryIds: CategoryId[];
  categories: Category[];
  legacyAttemptNotes?: string;
};
