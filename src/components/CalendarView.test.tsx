import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CalendarView } from "./CalendarView";
import { makeProblem } from "../test/factories";
import type { ProblemId } from "../lib/types";
import { calendarDate, reviewDateLabel } from "../lib/calendar";

const save = vi.fn<(args: { problemId: ProblemId; reviewDate: string | null }) => Promise<null>>();
vi.mock("convex/react", () => ({ useMutation: () => save }));
beforeEach(() => save.mockReset().mockResolvedValue(null));
const today = calendarDate(new Date());
const scheduled = makeProblem({ name: "Two Sum", reviewDate: today });
const backlog = makeProblem({
  _id: "backlog" as ProblemId,
  name: "Coin Change",
  latestShouldReview: true,
});
const overdue = makeProblem({
  _id: "overdue" as ProblemId,
  name: "Course Schedule",
  reviewDate: "2020-01-01",
});

it("shows daily reviews, overdue work and unscheduled flags separately and opens problems", () => {
  const open = vi.fn<() => void>();
  render(<CalendarView problems={[scheduled, backlog, overdue]} onOpenProblem={open} />);
  expect(
    within(screen.getByRole("region", { name: "Selected day reviews" })).getByText("Two Sum"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Overdue reviews" })).getByText("Course Schedule"),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Unscheduled reviews" })).getByText("Coin Change"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Two Sum" }));
  expect(open).toHaveBeenCalledWith(scheduled);
});

it("navigates months and returns to today", () => {
  render(<CalendarView problems={[scheduled]} onOpenProblem={vi.fn<() => void>()} />);
  const current = screen.getByRole("button", { name: reviewDateLabel(today) + ", 1 reviews" });
  expect(current).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Next month" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(
    screen.getByRole("button", { name: reviewDateLabel(today) + ", 1 reviews" }),
  ).toHaveAttribute("aria-current", "date");
});

it("schedules a searched problem on the selected day", async () => {
  render(<CalendarView problems={[backlog]} onOpenProblem={vi.fn<() => void>()} />);
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "coin" } });
  // Search result plus the backlog's open-problem button.
  fireEvent.click(screen.getAllByRole("button", { name: "Coin Change" })[0]!);
  expect(screen.getByLabelText("Review date")).toHaveValue(today);
  expect(save).not.toHaveBeenCalled();
  fireEvent.blur(screen.getByLabelText("Review date"));
  expect(await screen.findByRole("status")).toHaveTextContent("Review scheduled.");
  expect(save).toHaveBeenCalledWith({ problemId: backlog._id, reviewDate: today });
});

it("reschedules and clears a scheduled review, preserving errors for retry", async () => {
  render(<CalendarView problems={[scheduled]} onOpenProblem={vi.fn<() => void>()} />);
  fireEvent.click(screen.getByRole("button", { name: reviewDateLabel(today) }));
  save.mockRejectedValueOnce(new Error("Connection failed"));
  fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2028-02-29" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("Connection failed");
  expect(screen.getByLabelText("Review date")).toHaveValue("2028-02-29");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Review scheduled.");
  expect(save).toHaveBeenLastCalledWith({ problemId: scheduled._id, reviewDate: "2028-02-29" });
  fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Review date cleared.");
  expect(save).toHaveBeenLastCalledWith({ problemId: scheduled._id, reviewDate: null });
});
