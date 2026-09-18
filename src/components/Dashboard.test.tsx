import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { makeProblem } from "../test/factories";
import { Dashboard } from "./Dashboard";

function renderDashboard(attemptGrades: { grade: "A" | "B" | "C" | "D" | "F" }[]) {
  render(
    <Dashboard
      problems={[makeProblem({ attemptCount: attemptGrades.length, latestGrade: "B" })]}
      attemptGrades={attemptGrades}
      firstName="Test"
      onAddProblem={vi.fn<() => void>()}
      onOpenProblem={vi.fn<() => void>()}
      onSeeAll={vi.fn<() => void>()}
    />,
  );
}

it("shows the percentage of all attempts graded A or B", () => {
  renderDashboard([{ grade: "A" }, { grade: "B" }, { grade: "B" }, { grade: "C" }]);

  expect(within(screen.getByText("Pass rate").parentElement!).getByText("75%")).toBeVisible();
});

it("shows no pass rate before the first attempt", () => {
  renderDashboard([]);

  expect(within(screen.getByText("Pass rate").parentElement!).getByText("—")).toBeVisible();
});
