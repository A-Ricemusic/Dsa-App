import { useEffect } from "react";
import {
  usePaginatedQuery,
  type PaginatedQueryArgs,
  type PaginatedQueryReference,
} from "convex/react";

// Overview totals and global filters must never mistake a partial page for the full library.
// Each transaction remains bounded; Convex keeps the loaded pages reactive.
export function useCompleteQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query>,
) {
  const { results, status, loadMore } = usePaginatedQuery(query, args, { initialNumItems: 200 });
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(200);
  }, [status, loadMore]);
  return status === "Exhausted" ? results : undefined;
}
