import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchableSelect, type SearchableOption } from "./SearchableSelect";

type GradeOption = "all" | "A" | "B" | "C";

const options: SearchableOption<GradeOption>[] = [
  { value: "all", label: "All grades" },
  { value: "A", label: "Grade A" },
  { value: "B", label: "Grade B" },
  { value: "C", label: "Grade C" },
];

describe("SearchableSelect", () => {
  it("prioritizes an exact value match and selects it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: GradeOption) => void>();
    render(
      <SearchableSelect
        label="Latest grade"
        searchPlaceholder="Search grades"
        value="all"
        options={options}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "All grades" }));
    await user.type(screen.getByRole("combobox", { name: "Search latest grade options" }), "A");

    expect(screen.getByRole("option", { name: "Grade A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Grade B" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Grade A" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("A");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All grades" })).toHaveFocus();
    });
  });

  it("supports keyboard search and selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(value: GradeOption) => void>();
    render(
      <SearchableSelect
        label="Latest grade"
        searchPlaceholder="Search grades"
        value="all"
        options={options}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "All grades" }));
    const search = screen.getByRole("combobox", { name: "Search latest grade options" });
    await user.type(search, "Grade C");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("C");
  });
});
