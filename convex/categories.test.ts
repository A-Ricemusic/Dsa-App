import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

function createTestContext() {
  const t = convexTest(schema, modules);
  registerComponents(t);
  return {
    t,
    alice: t.withIdentity({ subject: "alice", issuer: "https://issuer.example" }),
    bob: t.withIdentity({ subject: "bob", issuer: "https://issuer.example" }),
  };
}

describe("categories", () => {
  it("requires authentication for every public operation", async () => {
    const { t, alice } = createTestContext();
    const categoryId = await alice.mutation(api.categories.create, { name: "Arrays" });

    await expect(t.query(api.categories.list)).rejects.toThrow("signed in");
    await expect(t.mutation(api.categories.ensureDefaults)).rejects.toThrow("signed in");
    await expect(t.mutation(api.categories.create, { name: "Graphs" })).rejects.toThrow(
      "signed in",
    );
    await expect(t.mutation(api.categories.remove, { categoryId })).rejects.toThrow("signed in");
  });

  it("copies defaults from the catalog once per owner without replacing custom categories", async () => {
    const { t, alice, bob } = createTestContext();

    await expect(alice.mutation(api.categories.ensureDefaults)).resolves.toBe(0);
    const profilesBeforeSeed = await t.run(async (ctx) => {
      return await ctx.db.query("profiles").withIndex("by_ownerId").take(10);
    });
    expect(profilesBeforeSeed).toEqual([]);

    await t.run(async (ctx) => {
      await ctx.db.insert("defaultCategories", {
        name: "Arrays",
        normalizedName: "arrays",
        sortOrder: 0,
      });
      await ctx.db.insert("defaultCategories", {
        name: "Trees",
        normalizedName: "trees",
        sortOrder: 1,
      });
    });
    const customArraysId = await alice.mutation(api.categories.create, { name: "Arrays" });

    await expect(alice.mutation(api.categories.ensureDefaults)).resolves.toBe(1);
    await expect(alice.mutation(api.categories.ensureDefaults)).resolves.toBe(0);
    await expect(bob.mutation(api.categories.ensureDefaults)).resolves.toBe(2);

    const aliceCategories = await alice.query(api.categories.list);
    const bobCategories = await bob.query(api.categories.list);
    expect(aliceCategories).toHaveLength(2);
    expect(bobCategories).toHaveLength(2);
    expect(aliceCategories.find((category) => category._id === customArraysId)).toMatchObject({
      name: "Arrays",
      normalizedName: "arrays",
      isDefault: false,
    });
    expect(bobCategories.find((category) => category.name === "Arrays")).toMatchObject({
      isDefault: true,
    });
  });

  it("normalizes names, validates input, rejects duplicates, and isolates owners", async () => {
    const { alice, bob } = createTestContext();
    const aliceCategoryId = await alice.mutation(api.categories.create, {
      name: "  Dynamic   Arrays  ",
    });
    const bobCategoryId = await bob.mutation(api.categories.create, { name: "Dynamic Arrays" });

    await expect(alice.mutation(api.categories.create, { name: "dynamic arrays" })).rejects.toThrow(
      "already exists",
    );
    await expect(alice.mutation(api.categories.create, { name: "x" })).rejects.toThrow(
      "between 2 and 48",
    );
    await expect(alice.mutation(api.categories.create, { name: "x".repeat(49) })).rejects.toThrow(
      "between 2 and 48",
    );

    await expect(alice.query(api.categories.list)).resolves.toMatchObject([
      {
        _id: aliceCategoryId,
        name: "Dynamic Arrays",
        normalizedName: "dynamic arrays",
        isDefault: false,
      },
    ]);
    await expect(bob.query(api.categories.list)).resolves.toMatchObject([
      { _id: bobCategoryId, name: "Dynamic Arrays" },
    ]);
  });

  it("lists categories alphabetically", async () => {
    const { alice } = createTestContext();
    await alice.mutation(api.categories.create, { name: "Trees" });
    await alice.mutation(api.categories.create, { name: "Arrays" });
    await alice.mutation(api.categories.create, { name: "Graphs" });

    const categories = await alice.query(api.categories.list);
    expect(categories.map((category) => category.name)).toEqual(["Arrays", "Graphs", "Trees"]);
  });

  it("protects ownership and cleans up assignments after removal", async () => {
    const { t, alice, bob } = createTestContext();
    const categoryId = await alice.mutation(api.categories.create, { name: "Arrays" });
    const problemId = await alice.mutation(api.problems.create, {
      name: "Two Sum",
      url: "https://leetcode.com/problems/two-sum/",
      difficulty: "easy",
      categoryIds: [categoryId],
    });

    await expect(bob.mutation(api.categories.remove, { categoryId })).rejects.toThrow(
      "Category not found",
    );
    await expect(alice.mutation(api.categories.remove, { categoryId })).resolves.toBeNull();

    vi.useFakeTimers();
    try {
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    } finally {
      vi.useRealTimers();
    }

    await expect(alice.query(api.categories.list)).resolves.toEqual([]);
    const assignments = await t.run(async (ctx) => {
      return await ctx.db
        .query("problemCategories")
        .withIndex("by_problemId", (q) => q.eq("problemId", problemId))
        .take(10);
    });
    expect(assignments).toEqual([]);
  });
});
