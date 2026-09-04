import type { Category, CategoryId, ProblemId, ProblemWithCategories } from "../lib/types";

export function makeCategory(name: string, id = name.toLocaleLowerCase().replaceAll(" ", "-")) {
  return {
    _id: id as CategoryId,
    _creationTime: 1,
    ownerId: "test-user",
    name,
    normalizedName: name.toLocaleLowerCase(),
    isDefault: true,
    createdAt: 1,
  } satisfies Category;
}

export function makeProblem(overrides: Partial<ProblemWithCategories> = {}): ProblemWithCategories {
  return {
    _id: "problem-default" as ProblemId,
    _creationTime: 1,
    ownerId: "test-user",
    name: "Default Problem",
    url: "https://leetcode.com/problems/default-problem/",
    difficulty: "medium",
    attemptCount: 0,
    latestShouldReview: false,
    createdAt: 1,
    updatedAt: 1,
    categoryIds: [],
    categories: [],
    ...overrides,
  };
}
