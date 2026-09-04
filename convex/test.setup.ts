/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";

export const modules = import.meta.glob([
  "./**/*.{ts,js}",
  "!./**/*.d.ts",
  "!./**/*.test.ts",
  "!./test.setup.ts",
]);

export function registerComponents(test: TestConvex<SchemaDefinition<GenericSchema, boolean>>) {
  aggregateTest.register(test, "problemStats");
  aggregateTest.register(test, "categoryStats");
}
