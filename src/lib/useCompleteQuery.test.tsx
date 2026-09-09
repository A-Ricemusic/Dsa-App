import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useCompleteQuery } from "./useCompleteQuery";

const mocks = vi.hoisted(() => ({
  query: vi.fn<
    (...args: unknown[]) => {
      results: number[];
      status: string;
      loadMore: (count: number) => void;
    }
  >(),
  loadMore: vi.fn<(count: number) => void>(),
  owner: "query-test-user",
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: mocks.owner } }) }));
vi.mock("convex/react", () => ({ usePaginatedQuery: mocks.query }));
beforeEach(() => {
  mocks.loadMore.mockClear();
  mocks.owner = "query-test-user";
});

it("does not expose incomplete totals and loads through the final page", () => {
  mocks.query.mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    loadMore: mocks.loadMore,
  });
  const hook = renderHook(() => useCompleteQuery(api.problems.listPage, {}));
  expect(hook.result.current).toBeUndefined();
  expect(mocks.loadMore).not.toHaveBeenCalled();
  mocks.query.mockReturnValue({ results: [1], status: "CanLoadMore", loadMore: mocks.loadMore });
  hook.rerender();
  expect(hook.result.current).toBeUndefined();
  expect(mocks.loadMore).toHaveBeenCalledExactlyOnceWith(200);
  mocks.query.mockReturnValue({ results: [1], status: "LoadingMore", loadMore: mocks.loadMore });
  hook.rerender();
  expect(hook.result.current).toBeUndefined();
  expect(mocks.loadMore).toHaveBeenCalledOnce();
  mocks.query.mockReturnValue({ results: [1, 2], status: "Exhausted", loadMore: mocks.loadMore });
  hook.rerender();
  expect(hook.result.current).toEqual([1, 2]);
});

it("passes changed query arguments through and withholds the previous collection while loading", () => {
  mocks.query.mockReturnValue({ results: [1], status: "Exhausted", loadMore: mocks.loadMore });
  const hook = renderHook(({ args }) => useCompleteQuery(api.attempts.listForProblemPage, args), {
    initialProps: { args: { problemId: "first-problem" as Id<"problems"> } },
  });
  mocks.query.mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    loadMore: mocks.loadMore,
  });
  hook.rerender({ args: { problemId: "second-problem" as Id<"problems"> } });
  expect(hook.result.current).toBeUndefined();
  expect(mocks.query).toHaveBeenLastCalledWith(
    api.attempts.listForProblemPage,
    { problemId: "second-problem" },
    { initialNumItems: 200 },
  );
});

it("keeps the last complete collection through recovery without publishing partial totals", () => {
  mocks.query.mockReturnValue({ results: [1, 2], status: "Exhausted", loadMore: mocks.loadMore });
  const hook = renderHook(() => useCompleteQuery(api.problems.listPage, {}));
  for (const status of ["LoadingMore", "LoadingFirstPage", "CanLoadMore"]) {
    mocks.query.mockReturnValue({ results: [1], status, loadMore: mocks.loadMore });
    hook.rerender();
    expect(hook.result.current).toEqual([1, 2]);
  }
  mocks.query.mockReturnValue({
    results: [1, 2, 3],
    status: "Exhausted",
    loadMore: mocks.loadMore,
  });
  hook.rerender();
  expect(hook.result.current).toEqual([1, 2, 3]);
});

it("never reuses a complete snapshot across owners", () => {
  mocks.query.mockReturnValue({ results: [1], status: "Exhausted", loadMore: mocks.loadMore });
  const hook = renderHook(() => useCompleteQuery(api.problems.listPage, {}));
  mocks.owner = "another-owner";
  mocks.query.mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    loadMore: mocks.loadMore,
  });
  hook.rerender();
  expect(hook.result.current).toBeUndefined();
  mocks.owner = "query-test-user";
  hook.rerender();
  expect(hook.result.current).toBeUndefined();
});

it("never reuses a complete snapshot for a different query function", () => {
  mocks.query.mockReturnValue({ results: [1], status: "Exhausted", loadMore: mocks.loadMore });
  const hook = renderHook(
    ({ categories }) =>
      useCompleteQuery(categories ? api.categories.listPage : api.problems.listPage, {}),
    { initialProps: { categories: false } },
  );
  mocks.query.mockReturnValue({
    results: [],
    status: "LoadingFirstPage",
    loadMore: mocks.loadMore,
  });
  hook.rerender({ categories: true });
  expect(hook.result.current).toBeUndefined();
});
