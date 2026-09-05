import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { useAuth } from "./auth/AuthProvider";
import type { ProblemId } from "./lib/types";
import { makeProblem } from "./test/factories";
import { ThemeProvider } from "./components/Theme";
import App from "./App";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<typeof useAuth>(),
  mutation: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}));
const problems = Array.from({ length: 5 }, (_, index) =>
  makeProblem({
    _id: `problem-${index}` as ProblemId,
    name: `Practice ${index + 1}`,
    attemptCount: 1,
    latestGrade: "C",
    latestShouldReview: index < 4,
  }),
);
vi.mock("./auth/AuthProvider", () => ({ useAuth: mocks.auth }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: () => mocks.mutation,
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "problems:list" ? problems : [],
}));

function authState(
  overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
  return {
    user: null,
    loading: false,
    error: false,
    retry: vi.fn<() => void>(),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    fetchAccessToken: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    ...overrides,
  };
}
function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  mocks.auth.mockReturnValue(authState());
});

describe("merged app routing and authentication", () => {
  it("uses the server sign-in endpoint from both redesigned landing actions", () => {
    renderApp();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: "Start your journal" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("keeps the loading screen until server session restoration completes", () => {
    mocks.auth.mockReturnValue(authState({ loading: true }));
    renderApp();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("preserves main's retry behavior after an initial session failure", async () => {
    const user = userEvent.setup();
    const state = authState({ error: true });
    mocks.auth.mockReturnValue(state);
    renderApp();
    expect(
      screen.getByRole("heading", { name: "Unable to check your session" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.retry).toHaveBeenCalledOnce();
  });

  it("keeps the redesigned workspace available when refreshing authentication fails", async () => {
    const user = userEvent.setup();
    const state = authState({
      user: { id: "test", email: "test@example.com", firstName: "Test" },
      error: true,
    });
    mocks.auth.mockReturnValue(state);
    renderApp();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Retry" }));
    expect(state.retry).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(state.signOut).toHaveBeenCalledWith();
  });

  it("opens the full review queue through main's router and resets via navigation", async () => {
    const user = userEvent.setup();
    mocks.auth.mockReturnValue(
      authState({ user: { id: "test", email: "test@example.com", firstName: "Test" } }),
    );
    renderApp();
    await user.click(screen.getByRole("button", { name: "View all 4 to review" }));
    expect(window.location.pathname).toBe("/problems");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Practice 5" })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("button", { name: "Problems" }),
    );
    expect(screen.getByRole("button", { name: "Practice 5" })).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
    fireEvent.popState(window);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });

  it("retains main's not-found route and recovery action", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/missing/page");
    renderApp();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to problems" }));
    expect(window.location.pathname).toBe("/problems");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
