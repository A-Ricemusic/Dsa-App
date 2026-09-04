import { beforeEach, describe, expect, it } from "vitest";
import { clearLegacyDevSessions } from "./session";

describe("auth session navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("removes every legacy devMode refresh-token key", () => {
    window.localStorage.setItem("workos:refresh-token", "legacy");
    window.localStorage.setItem("workos:refresh-token:client_test", "scoped");
    window.localStorage.setItem("workos:refresh-token:client_other", "also-scoped");
    window.localStorage.setItem("unrelated", "keep");

    clearLegacyDevSessions();

    expect(window.localStorage.getItem("workos:refresh-token")).toBeNull();
    expect(window.localStorage.getItem("workos:refresh-token:client_test")).toBeNull();
    expect(window.localStorage.getItem("workos:refresh-token:client_other")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
  });
});
