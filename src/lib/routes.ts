import type { AttemptId, ProblemId } from "./types";

export type AppRoute =
  | { kind: "dashboard" }
  | { kind: "problems" }
  | { kind: "categories" }
  | { kind: "problem"; problemId: ProblemId }
  | { kind: "attempt"; problemId: ProblemId; attemptId: AttemptId }
  | { kind: "not-found" };

export function routeFromPath(pathname: string): AppRoute {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "dashboard" };
  if (parts.length === 1 && parts[0] === "problems") return { kind: "problems" };
  if (parts.length === 1 && parts[0] === "categories") return { kind: "categories" };
  if (parts.length === 2 && parts[0] === "problems")
    return { kind: "problem", problemId: parts[1] as ProblemId };
  if (parts.length === 4 && parts[0] === "problems" && parts[2] === "attempts") {
    return { kind: "attempt", problemId: parts[1] as ProblemId, attemptId: parts[3] as AttemptId };
  }
  return { kind: "not-found" };
}
