import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { makeCategory, makeProblem } from "../test/factories";
import { TopicsView } from "./TopicsView";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("renders unpracticed topics, latest averages, and downloads the complete CSV", () => {
  const dfs = makeCategory("Depth-first search");
  const bfs = makeCategory("Breadth-first search");
  const createObjectURL = vi.fn<() => string>().mockReturnValue("blob:topics");
  const revokeObjectURL = vi.fn<() => void>();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.useFakeTimers();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^recall-topics-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(this.href).toBe("blob:topics");
    });
  render(
    <TopicsView
      categories={[dfs, bfs]}
      problems={[makeProblem({ categoryIds: [dfs._id], attemptCount: 3, latestGrade: "C" })]}
    />,
  );
  const table = screen.getByRole("table");
  expect(within(table).getByText("2.00")).toBeVisible();
  expect(within(table).getByText("1 / 1")).toBeVisible();
  expect(within(table).getByText("Not practiced")).toBeVisible();
  expect(within(table).getByText("—")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(click).toHaveBeenCalledOnce();
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:topics");
  expect(document.querySelector("a[download]")).toBeNull();
});

it("shows an empty state and disables export without topics or questions", () => {
  render(<TopicsView categories={[]} problems={[]} />);
  expect(screen.getByText("Build your topic overview")).toBeVisible();
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
});
