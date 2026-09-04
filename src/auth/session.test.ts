import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLegacyDevSession,
  currentReturnPath,
  restoreReturnPath,
  safeReturnPath,
} from "./session";

describe("auth session navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("preserves same-origin paths and rejects open redirects", () => {
    expect(safeReturnPath("/problems?status=review#attempts")).toBe(
      "/problems?status=review#attempts",
    );
    expect(safeReturnPath("https://attacker.example/phish")).toBe("/");
    expect(safeReturnPath("//attacker.example/phish")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
  });

  it("captures the current application route for the sign-in round trip", () => {
    window.history.replaceState({}, "", "/problems/abc?tab=history#latest");
    expect(currentReturnPath()).toBe("/problems/abc?tab=history#latest");

    window.history.replaceState({}, "", "/callback?code=secret");
    expect(currentReturnPath()).toBe("/");
  });

  it("restores the validated route and notifies the client router", () => {
    const listener = vi.fn<() => void>();
    window.addEventListener("popstate", listener);

    restoreReturnPath("/categories?sort=name");

    expect(`${window.location.pathname}${window.location.search}`).toBe("/categories?sort=name");
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", listener);
  });

  it("removes both legacy devMode refresh-token keys", () => {
    window.localStorage.setItem("workos:refresh-token", "legacy");
    window.localStorage.setItem("workos:refresh-token:client_test", "scoped");
    window.localStorage.setItem("unrelated", "keep");

    clearLegacyDevSession("client_test");

    expect(window.localStorage.getItem("workos:refresh-token")).toBeNull();
    expect(window.localStorage.getItem("workos:refresh-token:client_test")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
  });
});
