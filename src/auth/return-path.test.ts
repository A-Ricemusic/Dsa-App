import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps an internal application path", () => {
    expect(safeReturnPath("/problems/abc?tab=history#latest")).toBe(
      "/problems/abc?tab=history#latest",
    );
  });

  it.each([
    null,
    "",
    "problems",
    "//attacker.example/phish",
    "https://attacker.example/phish",
    "/callback?code=secret",
    "/sign-in",
  ])("uses the dashboard for an unsafe return path: %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });
});
