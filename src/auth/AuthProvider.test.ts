import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreSession, safeReturnPath } from "./AuthProvider";

const clientId = "client_test";
const refreshTokenKey = `workos:refresh-token:${clientId}`;
const user = {
  id: "user_123",
  email: "person@example.com",
  emailVerified: true,
  firstName: "Person",
  lastName: "Example",
  profilePictureUrl: null,
};

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("safeReturnPath", () => {
  it("preserves a same-origin app route including search and hash", () => {
    expect(safeReturnPath("/problems/problem_123?tab=notes#attempts")).toBe(
      "/problems/problem_123?tab=notes#attempts",
    );
  });

  it("rejects absolute and protocol-relative redirects", () => {
    expect(safeReturnPath("https://attacker.example/steal")).toBe("/");
    expect(safeReturnPath("//attacker.example/steal")).toBe("/");
  });

  it("defaults invalid state to the dashboard", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath("not-a-route")).toBe("/");
  });
});

describe("legacy session migration", () => {
  it("creates the server session before removing the legacy refresh token", async () => {
    window.localStorage.setItem(refreshTokenKey, "legacy-refresh-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ user, accessToken: "access-token" }, { status: 200 }));

    await expect(restoreSession(clientId)).resolves.toEqual({
      kind: "authenticated",
      user,
      accessToken: "access-token",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/migrate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "legacy-refresh-token" }),
        credentials: "same-origin",
      }),
    );
    expect(window.localStorage.getItem(refreshTokenKey)).toBeNull();
  });

  it("keeps the legacy token when migration fails transiently", async () => {
    window.localStorage.setItem(refreshTokenKey, "legacy-refresh-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(restoreSession(clientId)).resolves.toEqual({
      kind: "retryable",
      retryAfterMs: undefined,
    });
    expect(window.localStorage.getItem(refreshTokenKey)).toBe("legacy-refresh-token");
  });

  it("restores an existing secure cookie session without reading legacy storage", async () => {
    window.localStorage.setItem(refreshTokenKey, "stale-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ user, accessToken: "access-token" }, { status: 200 }));

    await expect(restoreSession(clientId)).resolves.toMatchObject({ kind: "authenticated" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(refreshTokenKey)).toBe("stale-token");
  });
});
