/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attempts from "../attempts.js";
import type * as categories from "../categories.js";
import type * as lib_aggregates from "../lib/aggregates.js";
import type * as lib_attempts from "../lib/attempts.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_validators from "../lib/validators.js";
import type * as problems from "../problems.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attempts: typeof attempts;
  categories: typeof categories;
  "lib/aggregates": typeof lib_aggregates;
  "lib/attempts": typeof lib_attempts;
  "lib/auth": typeof lib_auth;
  "lib/validators": typeof lib_validators;
  problems: typeof problems;
  stats: typeof stats;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  problemStats: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"problemStats">;
  categoryStats: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"categoryStats">;
};
