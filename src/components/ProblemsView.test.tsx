import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProblemId, ProblemWithCategories } from "../lib/types";
import { makeCategory, makeProblem } from "../test/factories";
import { ProblemsView } from "./ProblemsView";

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
  render(
    <ProblemsView
      problems={problems}
      categories={[arrays, binaryTree]}
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

    expect(screen.getByRole("button", { name: "Tree Recovery" })).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Array Search" })).toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Tree Recovery" })).toBeInTheDocument();
    expect(screen.queryByText("Array Search")).not.toBeInTheDocument();
  });
});

describe("ProblemsView navigation and search", () => {
  it("opens the review queue directly without including unattempted problems", () => {
    render(
      <ProblemsView
        problems={problems}
        categories={[arrays, binaryTree]}
        initialReviewOnly
        onAddProblem={vi.fn<() => void>()}
        onOpenProblem={vi.fn<(problem: ProblemWithCategories) => void>()}
      />,
    );
    expect(screen.getByRole("button", { name: "Tree Recovery" })).toBeInTheDocument();
    expect(screen.queryByText("Array Search")).not.toBeInTheDocument();
    expect(screen.queryByText("New Problem")).not.toBeInTheDocument();
  });

  it("opens the selected problem from the shared table", async () => {
    const user = userEvent.setup();
    const onOpenProblem = vi.fn<(problem: ProblemWithCategories) => void>();
    render(
      <ProblemsView
        problems={problems}
        categories={[arrays, binaryTree]}
        onAddProblem={vi.fn<() => void>()}
        onOpenProblem={onOpenProblem}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Array Search" }));
    expect(onOpenProblem).toHaveBeenCalledWith(problems[1]);
  });

  it("combines search with review status and restores the library when cleared", async () => {
    const user = userEvent.setup();
    render(
      <ProblemsView
        problems={problems}
        categories={[arrays, binaryTree]}
        initialReviewOnly
        onAddProblem={vi.fn<() => void>()}
        onOpenProblem={vi.fn<(problem: ProblemWithCategories) => void>()}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: "Search problems or categories" }),
      "array",
    );
    expect(screen.getByText("No matches found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("button", { name: "Tree Recovery" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Array Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Problem" })).toBeInTheDocument();
  });
});
