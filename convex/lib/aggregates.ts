import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";

export const problemStats = new TableAggregate<{
  Namespace: string;
  Key: [boolean, string];
  DataModel: DataModel;
  TableName: "problems";
}>(components.problemStats, {
  namespace: (problem) => problem.ownerId,
  sortKey: (problem) => [problem.latestShouldReview, problem.latestGrade ?? "unattempted"],
  sumValue: (problem) => problem.attemptCount,
});

export const categoryStats = new TableAggregate<{
  Namespace: Id<"categories">;
  Key: null;
  DataModel: DataModel;
  TableName: "problemCategories";
}>(components.categoryStats, {
  namespace: (assignment) => assignment.categoryId,
  sortKey: () => null,
});
