import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ReviewDateForm } from "./ReviewDateForm";
import { makeProblem } from "../test/factories";
import type { ProblemId } from "../lib/types";

const save = vi.fn<(args: { problemId: ProblemId; reviewDate: string | null }) => Promise<null>>();
vi.mock("convex/react", () => ({ useMutation: () => save }));
beforeEach(() => save.mockReset().mockResolvedValue(null));

it("automatically saves a complete date and does not clear a schedule during incomplete input", async () => {
  const problem = makeProblem({ reviewDate: "2026-10-01" });
  render(<ReviewDateForm problem={problem} />);
  expect(screen.queryByRole("button", { name: "Save date" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("Review date"));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Review date"), { target: { value: "2026-10-03" } });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Review scheduled."));
  expect(save).toHaveBeenCalledExactlyOnceWith({
    problemId: problem._id,
    reviewDate: "2026-10-03",
  });
});

it("retries a failed clear as a clear, and reflects dates saved from another form", async () => {
  const problem = makeProblem({ reviewDate: "2026-10-01" });
  const view = render(<ReviewDateForm problem={problem} />);
  view.rerender(<ReviewDateForm problem={{ ...problem, reviewDate: "2026-10-02" }} />);
  expect(screen.getByLabelText("Review date")).toHaveValue("2026-10-02");
  save.mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Review date cleared."));
  expect(save).toHaveBeenLastCalledWith({ problemId: problem._id, reviewDate: null });
  expect(screen.getByLabelText("Review date")).toHaveValue("");
});
