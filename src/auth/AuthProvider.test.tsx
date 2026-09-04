import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

const session = {
  user: { id: "user_test", email: "test@example.com", firstName: "Test" },
  accessToken: "short-lived-access-token",
};
afterEach(() => vi.unstubAllGlobals());

it("keeps loading until cookie restoration completes instead of flashing sign-in", async () => {
  let resolve!: (value: Response) => void;
  const fetchMock = vi.fn<typeof fetch>(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  expect(result.current.loading).toBe(true);
  await act(async () => resolve(Response.json(session)));
  expect(result.current.loading).toBe(false);
  expect(result.current.user).toEqual(session.user);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/session",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Requested-With": "recall" },
    }),
  );
});

it("restores the session on remount without reading or writing localStorage", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(Response.json(session))),
  );
  const get = vi.spyOn(Storage.prototype, "getItem");
  const set = vi.spyOn(Storage.prototype, "setItem");
  const first = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(first.result.current.user).toEqual(session.user));
  first.unmount();
  const second = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(second.result.current.user).toEqual(session.user));
  expect(get).not.toHaveBeenCalled();
  expect(set).not.toHaveBeenCalled();
});

it("deduplicates React StrictMode's startup requests", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(Response.json(session)));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, {
    wrapper: ({ children }) => (
      <StrictMode>
        <AuthProvider>{children}</AuthProvider>
      </StrictMode>
    ),
  });
  await waitFor(() => expect(result.current.user).toEqual(session.user));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("keeps the authenticated user on temporary failure and recovers on retry", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(session))
    .mockResolvedValueOnce(Response.json({ error: "temporarily unavailable" }, { status: 503 }))
    .mockResolvedValueOnce(Response.json(session));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user).toEqual(session.user));
  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.user).toEqual(session.user);
  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.error).toBe(false));
  expect(result.current.user).toEqual(session.user);
});

it("does not treat an initial connection failure as signed-out", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")));
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(true);
});

it("signs out only when the server rejects the session", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(Response.json({ user: null, accessToken: null }, { status: 401 })),
  );
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user).toEqual(session.user));
  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.user).toBeNull());
  expect(result.current.error).toBe(false);
});

it("uses the server refresh endpoint when Convex requests a fresh token", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(() => Promise.resolve(Response.json(session)));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user).toEqual(session.user));
  await act(async () => {
    expect(await result.current.fetchAccessToken({ forceRefreshToken: true })).toBe(
      session.accessToken,
    );
  });
  expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/refresh", expect.any(Object));
});

it("does not lose a forced refresh behind an in-flight session check", async () => {
  let resolve!: (response: Response) => void;
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(Response.json(session));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  let refresh!: Promise<string | null>;
  act(() => {
    refresh = result.current.fetchAccessToken({ forceRefreshToken: true });
  });
  await act(async () => {
    resolve(Response.json(session));
    await refresh;
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/refresh", expect.any(Object));
});

it("retains the session and reports an error if logout fails", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(session))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(useAuth, { wrapper: AuthProvider });
  await waitFor(() => expect(result.current.user).toEqual(session.user));
  await act(async () => result.current.signOut());
  expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/sign-out", expect.any(Object));
  expect(result.current.user).toEqual(session.user);
  expect(result.current.error).toBe(true);
});
