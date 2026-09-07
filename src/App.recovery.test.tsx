import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import App from "./App";
import { ThemeProvider } from "./components/Theme";
import { makeProblem } from "./test/factories";

const state = vi.hoisted(() => ({
  statuses: {} as Record<string, string>,
  rows: {} as Record<string, unknown[]>,
  mutation: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  loadMore: vi.fn<(n: number) => void>(),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => state.mutation,
  usePaginatedQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    return {
      results: state.rows[name] ?? [],
      status: state.statuses[name] ?? "Exhausted",
      loadMore: state.loadMore,
    };
  },
}));
vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "alice", email: "alice@example.test", firstName: "Alice" },
    loading: false,
    error: false,
    retry: () => {},
    signOut: async () => {},
    fetchAccessToken: async () => null,
  }),
}));
beforeEach(() => {
  state.statuses = {};
  state.rows = { "problems:listPage": [makeProblem()] };
  state.mutation.mockReset().mockResolvedValue(null);
  window.history.replaceState(null, "", "/problems/problem-default");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
const app = () => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
);

it("retains problem drafts through pagination recovery", async () => {
  const user = userEvent.setup();
  const view = render(app());
  await user.click(screen.getByRole("button", { name: "Edit problem" }));
  await user.clear(screen.getByLabelText("Problem name"));
  await user.type(screen.getByLabelText("Problem name"), "Unsaved user draft");
  expect(screen.getByLabelText("Problem name")).toHaveValue("Unsaved user draft");
  state.statuses["categories:listPage"] = "LoadingMore";
  view.rerender(app());
  expect(screen.getByRole("dialog")).toHaveTextContent("Update problem");
  expect(screen.getByLabelText("Problem name")).toHaveValue("Unsaved user draft");
  state.statuses["categories:listPage"] = "Exhausted";
  view.rerender(app());
  expect(screen.getByLabelText("Problem name")).toHaveValue("Unsaved user draft");
});

it("retains attempt drafts through parent pagination recovery", async () => {
  const user = userEvent.setup();
  const view = render(app());
  await user.click(screen.getByRole("button", { name: "Log attempt" }));
  await user.type(screen.getByLabelText(/Attempt notes/), "Unsaved attempt notes");
  state.statuses["problems:listPage"] = "LoadingMore";
  view.rerender(app());
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("Unsaved attempt notes");
  state.statuses["problems:listPage"] = "Exhausted";
  view.rerender(app());
  expect(screen.getByLabelText(/Attempt notes/)).toHaveValue("Unsaved attempt notes");
});

it("retains filters through pagination recovery", async () => {
  window.history.replaceState(null, "", "/problems");
  const user = userEvent.setup();
  const view = render(app());
  await user.type(
    screen.getByRole("textbox", { name: "Search problems or categories" }),
    "hash map",
  );
  state.statuses["problems:listPage"] = "LoadingMore";
  view.rerender(app());
  state.statuses["problems:listPage"] = "Exhausted";
  view.rerender(app());
  expect(screen.getByRole("textbox", { name: "Search problems or categories" })).toHaveValue(
    "hash map",
  );
});
