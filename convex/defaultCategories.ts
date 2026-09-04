import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { normalizeCategoryName } from "./lib/categories";

// Bootstrap and recovery data only. Once seeded, the defaultCategories table is
// the runtime source of truth; keep this mutation for new deployments and restores.
const DEFAULT_CATEGORY_NAMES = [
  "Arrays",
  "Strings",
  "Hash Table",
  "Math",
  "Dynamic Programming",
  "Sorting",
  "Greedy",
  "Depth-First Search",
  "Binary Search",
  "Trees",
  "Breadth-First Search",
  "Matrix",
  "Two Pointers",
  "Bit Manipulation",
  "Binary Tree",
  "Prefix Sum",
  "Stack",
  "Heap / Priority Queue",
  "Simulation",
  "Counting",
  "Graph Theory",
  "Design",
  "Sliding Window",
  "Backtracking",
  "Union Find",
  "Enumeration",
  "Linked List",
  "Ordered Set",
  "Monotonic Stack",
  "Trie",
  "Number Theory",
  "Divide and Conquer",
  "Recursion",
  "Bitmask",
  "Queue",
  "Binary Search Tree",
  "Segment Tree",
  "Memoization",
  "Geometry",
  "Combinatorics",
  "Topological Sort",
  "Hash Function",
  "Binary Indexed Tree",
  "Game Theory",
  "String Matching",
  "Shortest Path",
  "Interactive",
  "Rolling Hash",
  "Data Stream",
  "Brainteaser",
  "Monotonic Queue",
  "Randomized",
  "Merge Sort",
  "Doubly-Linked List",
  "Counting Sort",
  "Iterator",
  "Probability and Statistics",
  "Quickselect",
  "Suffix Array",
  "Bucket Sort",
  "Line Sweep",
  "Minimum Spanning Tree",
  "Reservoir Sampling",
  "Strongly Connected Component",
  "Eulerian Circuit",
  "Radix Sort",
  "Rejection Sampling",
  "Biconnected Component",
  "Deque",
  "Search",
  "Database",
] as const;

export const seed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let inserted = 0;
    for (const [sortOrder, name] of DEFAULT_CATEGORY_NAMES.entries()) {
      const normalizedName = normalizeCategoryName(name);
      const existing = await ctx.db
        .query("defaultCategories")
        .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalizedName))
        .unique();
      if (existing) continue;

      await ctx.db.insert("defaultCategories", {
        name,
        normalizedName,
        sortOrder,
      });
      inserted += 1;
    }
    return inserted;
  },
});
