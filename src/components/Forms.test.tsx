import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ProblemForm } from "./ProblemForm";
import { AttemptForm } from "./AttemptForm";
import { makeCategory, makeProblem } from "../test/factories";
import type { Attempt } from "../lib/types";
import { AppErrorBoundary } from "./AppErrorBoundary";

const mocks = vi.hoisted(() => ({ mutation: vi.fn<() => Promise<unknown>>() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: "form-test-user" } }) }));
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

it("loads a refined difficulty and saves a different one", async () => {
  const user = userEvent.setup();
  const problem = makeProblem({ difficulty: "easy-" });
  render(<ProblemForm open onClose={vi.fn<() => void>()} categories={[]} problem={problem} />);

  expect(screen.getByRole("button", { name: "easy-" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "hard+" }));
  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(mocks.mutation).toHaveBeenCalledWith(
    expect.objectContaining({ problemId: problem._id, difficulty: "hard+" }),
  );
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

it("allows dismissal during a pending save, retains the draft after remount, and does not close a reopened editor", async () => {
  const user = userEvent.setup();
  let resolve!: () => void;
  mocks.mutation.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  const onClose = vi.fn<() => void>();
  const props = { open: true, onClose, problemId: makeProblem()._id };
  const first = render(<AttemptForm {...props} />);
  await user.type(screen.getByLabelText(/Attempt notes/), "Keep this pending draft");
  fireEvent.submit(screen.getByRole("button", { name: "Log attempt" }).closest("form")!);
  fireEvent.submit(screen.getByRole("button", { name: "Saving…" }).closest("form")!);
  expect(mocks.mutation).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Close dialog" })).not.toBeInTheDocument();
  const cancel = new Event("cancel", { bubbles: true, cancelable: true });
  fireEvent(screen.getByRole("dialog"), cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
  first.unmount();
  const second = render(<AttemptForm {...props} />);
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("Keep this pending draft");
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await act(async () => {
    resolve();
  });
  expect(screen.getByRole("status")).toHaveTextContent("Attempt saved.");
  expect(onClose).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Done" }));
  second.rerender(<AttemptForm {...props} open={false} />);
  second.rerender(<AttemptForm {...props} />);
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("");
});

it("removes a deleted category without losing the problem draft", async () => {
  const user = userEvent.setup();
  const category = {
    _id: "deleted" as import("../lib/types").CategoryId,
    _creationTime: 1,
    ownerId: "test-user",
    name: "Deleted topic",
    normalizedName: "deleted topic",
    isDefault: false,
    createdAt: 1,
  };
  const problem = makeProblem({ categoryIds: [category._id], categories: [category] });
  const props = { open: true, onClose: vi.fn<() => void>(), problem, categories: [category] };
  const view = render(<ProblemForm {...props} />);
  await user.clear(screen.getByLabelText("Problem name"));
  await user.type(screen.getByLabelText("Problem name"), "Keep these edits");
  view.rerender(
    <ProblemForm
      {...props}
      problem={{ ...problem, categoryIds: [], categories: [] }}
      categories={[]}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mocks.mutation).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Remove unavailable category" }));
  expect(screen.getByLabelText("Problem name")).toHaveValue("Keep these edits");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mocks.mutation).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Keep these edits", categoryIds: [] }),
  );
});

it("preserves a failed pending draft and allows retry after reopening", async () => {
  const user = userEvent.setup();
  let reject!: (reason: Error) => void;
  mocks.mutation
    .mockReturnValueOnce(
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
    )
    .mockResolvedValue("new-id");
  const props = {
    open: true,
    onClose: vi.fn<() => void>(),
    problemId: "retry-problem" as import("../lib/types").ProblemId,
  };
  const view = render(<AttemptForm {...props} />);
  await user.type(screen.getByLabelText(/Attempt notes/), "Retry this draft");
  await user.click(screen.getByRole("button", { name: "Log attempt" }));
  await user.click(screen.getByRole("button", { name: "Close" }));
  view.rerender(<AttemptForm {...props} open={false} />);
  await act(async () => {
    reject(new Error("Save failed"));
  });
  view.rerender(<AttemptForm {...props} />);
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("Retry this draft");
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
  await user.click(screen.getByRole("button", { name: "Log attempt" }));
  await waitFor(() => expect(mocks.mutation).toHaveBeenCalledTimes(2));
});

it("does not navigate or close a different editor when a dismissed problem save completes", async () => {
  const user = userEvent.setup();
  let resolve!: (id: string) => void;
  mocks.mutation.mockReturnValueOnce(
    new Promise<string>((done) => {
      resolve = done;
    }),
  );
  const props = {
    open: true,
    onClose: vi.fn<() => void>(),
    onCreated: vi.fn<(id: Attempt["problemId"]) => void>(),
    categories: [],
  };
  const view = render(<ProblemForm {...props} />);
  await user.type(screen.getByLabelText("Problem name"), "Pending new problem");
  await user.type(screen.getByLabelText("Problem link"), "https://example.com/problem");
  await user.click(screen.getByRole("button", { name: "Add problem" }));
  await user.click(screen.getByRole("button", { name: "Close" }));
  view.rerender(<ProblemForm {...props} open={false} />);
  const problem = makeProblem({ _id: "another-problem" as Attempt["problemId"] });
  view.rerender(<ProblemForm {...props} problem={problem} />);
  await user.clear(screen.getByLabelText("Problem name"));
  await user.type(screen.getByLabelText("Problem name"), "Different editor draft");
  await act(async () => {
    resolve("saved-problem");
  });
  expect(props.onClose).toHaveBeenCalledOnce();
  expect(props.onCreated).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Problem name")).toHaveValue("Different editor draft");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

it("restores a pending category creation and its problem draft across remounts", async () => {
  const user = userEvent.setup();
  const category = makeCategory("New category");
  let resolve!: (id: typeof category._id) => void;
  mocks.mutation.mockReturnValueOnce(
    new Promise<typeof category._id>((done) => {
      resolve = done;
    }),
  );
  const props = {
    open: true,
    onClose: vi.fn<() => void>(),
    categories: [],
    problem: makeProblem({ _id: "category-pending-problem" as Attempt["problemId"] }),
  };
  const first = render(<ProblemForm {...props} />);
  await user.clear(screen.getByLabelText("Problem name"));
  await user.type(screen.getByLabelText("Problem name"), "Category draft");
  await user.type(screen.getByLabelText("Search or create a category"), category.name);
  await user.click(screen.getByRole("button", { name: `Create “${category.name}”` }));
  await user.click(screen.getByRole("button", { name: "Close" }));
  first.unmount();
  const second = render(<ProblemForm {...props} />);
  expect(screen.getByLabelText("Problem name")).toHaveValue("Category draft");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(mocks.mutation).toHaveBeenCalledOnce();
  await act(async () => {
    resolve(category._id);
  });
  second.rerender(<ProblemForm {...props} categories={[category]} />);
  expect(screen.getByRole("button", { name: category.name })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByLabelText("Problem name")).toHaveValue("Category draft");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mocks.mutation).toHaveBeenLastCalledWith(
    expect.objectContaining({
      name: "Category draft",
      categoryIds: [category._id],
    }),
  );
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
