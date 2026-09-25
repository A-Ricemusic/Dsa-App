import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { makeAttempt, makeCategory, makeProblem } from "../test/factories";
import type { Attempt } from "../lib/types";
import { TopicsView } from "./TopicsView";

const mocks = vi.hoisted(() => ({
  query: vi.fn<() => Promise<{ page: Attempt[]; isDone: boolean; continueCursor: string }>>(),
}));
vi.mock("convex/react", () => ({ useConvex: () => ({ query: mocks.query }) }));

afterEach(() => {
  mocks.query.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("renders unpracticed topics, latest averages, and downloads the complete CSV", async () => {
  mocks.query.mockResolvedValue({ page: [makeAttempt(3)], isDone: true, continueCursor: "" });
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
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  });
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

it("loads only on export, prevents duplicate requests, and permits retry after failure", async () => {
  let rejectRequest!: (reason: Error) => void;
  mocks.query.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  const createObjectURL = vi.fn<() => string>();
  vi.stubGlobal("URL", { createObjectURL });
  render(<TopicsView categories={[]} problems={[makeProblem({ attemptCount: 1 })]} />);
  expect(mocks.query).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  const busy = screen.getByRole("button", { name: "Preparing CSV…" });
  expect(busy).toBeDisabled();
  fireEvent.click(busy);
  expect(mocks.query).toHaveBeenCalledOnce();
  expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {
    problemId: "problem-default",
    paginationOpts: { cursor: null, numItems: 100 },
  });
  await act(async () => {
    rejectRequest(new Error("Offline"));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
  mocks.query.mockRejectedValueOnce(new Error("Still offline"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  });
  expect(mocks.query).toHaveBeenCalledTimes(2);
});

it("offers export ranges, validates custom dates, and reports when none match", async () => {
  mocks.query.mockResolvedValue({ page: [], isDone: true, continueCursor: "" });
  render(<TopicsView categories={[]} problems={[makeProblem({ attemptCount: 1 })]} />);
  const range = screen.getByRole("combobox", { name: "CSV date range" });
  fireEvent.click(range);
  expect(
    within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["All time", "Past 30 days", "Past 365 days", "Custom dates"]);
  fireEvent.click(screen.getByRole("option", { name: "Custom dates" }));
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a valid start and end date");
  expect(mocks.query).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-09-24" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("No attempts in this date range");
});

it("downloads the selected period with matching category totals and five notes columns per problem", async () => {
  const category = makeCategory("DFS");
  mocks.query.mockResolvedValue({
    page: [
      {
        ...makeAttempt(9, "Outside the range"),
        attemptedAt: +new Date(2026, 8, 9, 12),
        grade: "A",
      },
      { ...makeAttempt(7, "Review recursion"), attemptedAt: +new Date(2026, 8, 7, 12), grade: "F" },
      { ...makeAttempt(6, "Check the base case"), attemptedAt: +new Date(2026, 8, 6, 12) },
      { ...makeAttempt(1, "Old notes"), attemptedAt: +new Date(2026, 8, 1, 12) },
    ],
    isDone: true,
    continueCursor: "",
  });
  const createObjectURL = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:topics");
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn<() => void>() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(
    <TopicsView
      categories={[category]}
      problems={[
        makeProblem({
          name: "Tree traversal",
          categories: [category],
          categoryIds: [category._id],
          attemptCount: 4,
          latestGrade: "A",
        }),
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("combobox", { name: "CSV date range" }));
  fireEvent.click(screen.getByRole("option", { name: "Custom dates" }));
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-06" } });
  fireEvent.change(screen.getByLabelText("Through"), { target: { value: "2026-09-07" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  });
  const blob = createObjectURL.mock.calls[0]![0];
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsText(blob);
  });
  expect(csv).toContain('"DFS","1","2","0.00"');
  expect(csv).toContain(
    '"Tree traversal","https://leetcode.com/problems/default-problem/","medium","DFS","F","2","F","Yes","Review recursion","C","Yes","Check the base case","NA","NA","NA"',
  );
  expect(csv.match(/"Tree traversal"/g)).toHaveLength(1);
  for (let index = 1; index <= 5; index++) expect(csv).toContain(`"Attempt notes ${index}"`);
  expect(csv).not.toContain("Outside the range");
  expect(csv).not.toContain("Old notes");
  expect(csv).not.toContain("Problem ID");
  expect(csv).not.toContain("Record type");
});

it("supports keyboard selection and dismisses the custom range menu", () => {
  render(<TopicsView categories={[]} problems={[makeProblem()]} />);
  const range = screen.getByRole("combobox", { name: "CSV date range" });
  range.focus();
  fireEvent.keyDown(range, { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "All time" })).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(range, { key: "End" });
  fireEvent.keyDown(range, { key: "Enter" });
  expect(range).toHaveTextContent("Custom dates");
  expect(screen.getByLabelText("From")).toBeVisible();
  expect(range).toHaveFocus();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.click(range);
  fireEvent.keyDown(range, { key: "Escape" });
  expect(range).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(range);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
