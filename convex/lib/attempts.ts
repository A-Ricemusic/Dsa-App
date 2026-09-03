import { ConvexError } from "convex/values";

export function cleanAttemptInput(args: {
  attemptedAt: number;
  notes: string;
}) {
  if (!Number.isFinite(args.attemptedAt) || args.attemptedAt <= 0) {
    throw new ConvexError("Choose a valid attempt date.");
  }

  const notes = args.notes.trim();
  if (notes.length > 4000) {
    throw new ConvexError("Attempt notes must be 4,000 characters or fewer.");
  }

  return { attemptedAt: args.attemptedAt, notes };
}
