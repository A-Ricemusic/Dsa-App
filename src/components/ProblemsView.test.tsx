import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName, type FunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";
import type { ProblemId, ProblemWithCategories } from "../lib/types";
import { makeCategory, makeProblem } from "../test/factories";
import { ProblemsView } from "./ProblemsView";

const { usePaginatedQueryMock, useQueryMock } = vi.hoisted(() => ({
  usePaginatedQueryMock: vi.fn<(query: FunctionReference<"query">) => unknown>(),
  useQueryMock: vi.fn<() => unknown>(),
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: usePaginatedQueryMock,
  useQuery: useQueryMock,
}));

const binaryTree = makeCategory("Binary Tree", "category-tree");
const arrays = makeCategory("Arrays", "category-arrays");

const problems = [
  makeProblem({
    _id: "problem-tree" as ProblemId,
    name: "Tree Recovery",
    difficulty: "hard",
    attemptCount: 2,
    latestAttemptAt: 300,
    latestGrade: "C",
    latestShouldReview: true,
    categoryIds: [binaryTree._id],
    categories: [binaryTree],
  }),
  makeProblem({
    _id: "problem-array" as ProblemId,
    name: "Array Search",
    difficulty: "medium",
    attemptCount: 1,
    latestAttemptAt: 200,
    latestGrade: "A",
    latestShouldReview: false,
    categoryIds: [arrays._id],
    categories: [arrays],
  }),
  makeProblem({
    _id: "problem-new" as ProblemId,
    name: "New Problem",
    difficulty: "easy",
    attemptCount: 0,
    latestShouldReview: false,
  }),
];

function renderProblems() {
  usePaginatedQueryMock.mockReset().mockImplementation((query) => {
    const isProblemQuery = getFunctionName(query) === "problems:listPaginated";
    return {
      results: isProblemQuery ? problems : [arrays, binaryTree],
      status: "Exhausted",
      loadMore: vi.fn<(numItems: number) => void>(),
    };
  });
  useQueryMock.mockReset().mockReturnValue({
    ready: true,
    problemCount: problems.length,
    attemptCount: 3,
    reviewCount: 1,
    gradeCounts: { A: 1, B: 0, C: 1, D: 0, F: 0 },
  });
  render(
    <ProblemsView
      onAddProblem={vi.fn<() => void>()}
      onOpenProblem={vi.fn<(problem: ProblemWithCategories) => void>()}
    />,
  );
}

describe("ProblemsView filters", () => {
  it("shows only problems whose latest attempt needs review", async () => {
    const user = userEvent.setup();
    renderProblems();

    await user.click(screen.getByRole("button", { name: "All review states" }));
    await user.type(
      screen.getByRole("combobox", { name: "Search review status options" }),
      "Review again",
    );
    await user.click(screen.getByRole("option", { name: /Review again/ }));

    expect(screen.getAllByText("Tree Recovery")).toHaveLength(2);
    expect(screen.queryByText("Array Search")).not.toBeInTheDocument();
    expect(screen.queryByText("New Problem")).not.toBeInTheDocument();
    expect(screen.getByText("Latest attempt: review again")).toBeInTheDocument();
  });

  it("does not treat an unattempted problem as no-review-needed", async () => {
    const user = userEvent.setup();
    renderProblems();

    await user.click(screen.getByRole("button", { name: "All review states" }));
    await user.type(
      screen.getByRole("combobox", { name: "Search review status options" }),
      "No review needed",
    );
    await user.click(screen.getByRole("option", { name: /No review needed/ }));

    expect(screen.getAllByText("Array Search")).toHaveLength(2);
    expect(screen.queryByText("Tree Recovery")).not.toBeInTheDocument();
    expect(screen.queryByText("New Problem")).not.toBeInTheDocument();
  });

  it("searches category options before filtering the list", async () => {
    const user = userEvent.setup();
    renderProblems();

    await user.click(screen.getByRole("button", { name: "All categories" }));
    await user.type(
      screen.getByRole("combobox", { name: "Search category options" }),
      "binary tree",
    );
    await user.click(screen.getByRole("option", { name: "Binary Tree" }));

    expect(screen.getAllByText("Tree Recovery")).toHaveLength(2);
    expect(screen.queryByText("Array Search")).not.toBeInTheDocument();
  });
});
