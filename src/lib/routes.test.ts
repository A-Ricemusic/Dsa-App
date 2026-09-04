import { expect, it } from "vitest";
import { routeFromPath } from "./routes";

it.each([
  ["/", "dashboard"],
  ["/problems", "problems"],
  ["/categories", "categories"],
  ["/problems/example", "problem"],
  ["/problems/example/attempts/example", "attempt"],
  ["/does-not-exist", "not-found"],
  ["/categories/extra", "not-found"],
  ["/problems/example/extra", "not-found"],
])("resolves %s to %s without server middleware", (path, kind) => {
  expect(routeFromPath(path).kind).toBe(kind);
});
