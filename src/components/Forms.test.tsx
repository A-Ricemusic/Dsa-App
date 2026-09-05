import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ProblemForm } from "./ProblemForm";
import { AttemptForm } from "./AttemptForm";
import { makeProblem } from "../test/factories";
import type { Attempt } from "../lib/types";
import { AppErrorBoundary } from "./AppErrorBoundary";

const mocks = vi.hoisted(() => ({ mutation: vi.fn<() => Promise<unknown>>() }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.mutation }));
beforeEach(() => {
  mocks.mutation.mockReset().mockResolvedValue("new-id");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

it("preserves problem edits across live refreshes, but resets when reopened", async () => {
  const user = userEvent.setup();
  const problem = makeProblem();
  const props = { open: true, onClose: vi.fn<() => void>(), categories: [], problem };
  const view = render(<ProblemForm {...props} />);
  await user.clear(screen.getByLabelText("Problem name"));
  await user.type(screen.getByLabelText("Problem name"), "Unsaved draft");
  const refreshed = { ...problem, name: "Remote update", categoryIds: [...problem.categoryIds] };
  view.rerender(<ProblemForm {...props} problem={refreshed} />);
  expect(screen.getByLabelText("Problem name")).toHaveValue("Unsaved draft");
  view.rerender(<ProblemForm {...props} open={false} problem={refreshed} />);
  view.rerender(<ProblemForm {...props} problem={refreshed} />);
  expect(screen.getByLabelText("Problem name")).toHaveValue("Remote update");
});

it("preserves attempt notes and grade during live updates and initializes a different attempt", async () => {
  const user = userEvent.setup();
  const attempt: Attempt = {
    _id: "attempt-1" as Attempt["_id"],
    _creationTime: 1,
    ownerId: "test-user",
    problemId: makeProblem()._id,
    attemptedAt: Date.UTC(2026, 7, 1),
    grade: "C",
    shouldReviewAgain: true,
    notes: "Original",
    createdAt: 1,
    updatedAt: 1,
  };
  const props = { open: true, onClose: vi.fn<() => void>(), problemId: attempt.problemId, attempt };
  const view = render(<AttemptForm {...props} />);
  await user.clear(screen.getByLabelText(/Attempt notes/));
  await user.type(screen.getByLabelText(/Attempt notes/), "My draft");
  await user.click(screen.getByRole("button", { name: "A" }));
  view.rerender(<AttemptForm {...props} attempt={{ ...attempt, notes: "Remote" }} />);
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "A" })).toHaveAttribute("aria-pressed", "true");
  view.rerender(
    <AttemptForm
      {...props}
      attempt={{ ...attempt, _id: "attempt-2" as Attempt["_id"], notes: "Different" }}
    />,
  );
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("Different");
});

it("keeps an in-flight save in its dialog and prevents duplicate submits", async () => {
  let resolve!: () => void;
  mocks.mutation.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const onClose = vi.fn<() => void>();
  render(<AttemptForm open onClose={onClose} problemId={makeProblem()._id} />);
  const button = screen.getByRole("button", { name: "Log attempt" });
  fireEvent.submit(button.closest("form")!);
  fireEvent.submit(button.closest("form")!);
  expect(mocks.mutation).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(onClose).not.toHaveBeenCalled();
  resolve();
  await screen.findByRole("button", { name: "Log attempt" });
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows a recovery action when a journal query throws", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <AppErrorBoundary>
      <BrokenQuery />
    </AppErrorBoundary>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Your journal couldn’t load.");
  expect(screen.getByRole("button", { name: "Reload journal" })).toBeInTheDocument();
});

function BrokenQuery(): never {
  throw new Error("Query failed");
}
