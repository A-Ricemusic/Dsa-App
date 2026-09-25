import { ConvexError } from "convex/values";

// Dates are calendar days, not instants; null clears an existing schedule.
export function cleanReviewDate(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const date = new Date(value + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ConvexError("Enter a valid review date.");
  }
  return value;
}
