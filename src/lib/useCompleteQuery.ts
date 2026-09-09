import { getFunctionName } from "convex/server";
import { convexToJson, type Value } from "convex/values";
import { useAuth } from "../auth/AuthProvider";
import { useEffect, useState } from "react";
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
  const { user } = useAuth();
  const key = JSON.stringify([
    user?.id,
    getFunctionName(query),
    convexToJson(args as Record<string, Value>),
  ]);
  const { results, status, loadMore } = usePaginatedQuery(query, args, { initialNumItems: 200 });
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(200);
  }, [status, loadMore]);
  const [complete, setComplete] = useState<{ key: string; results: typeof results }>();
  if (complete && complete.key !== key) setComplete(undefined);
  if (
    status === "Exhausted" &&
    (complete?.key !== key ||
      complete.results.length !== results.length ||
      results.some((item, index) => item !== complete.results[index]))
  ) {
    setComplete({ key, results });
  }
  return status === "Exhausted" ? results : complete?.key === key ? complete.results : undefined;
}
