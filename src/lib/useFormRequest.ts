import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "../auth/AuthProvider";

type RequestState<Draft> = {
  draft: Draft;
  status: "pending" | "success" | "error";
  result?: unknown;
  error?: unknown;
};
// Keep in-flight writes and their drafts across route unmounts. Nothing is stored on disk.
const requests = new Map<string, RequestState<unknown>>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => {
  for (const listener of listeners) listener();
};

export function useFormRequest<Draft>(formKey: string) {
  const { user } = useAuth();
  const key = JSON.stringify([user?.id, formKey]);
  const snapshot = useCallback(() => requests.get(key) as RequestState<Draft> | undefined, [key]);
  const state = useSyncExternalStore(subscribe, snapshot);
  const clear = useCallback(() => {
    if (requests.get(key)?.status !== "pending") {
      requests.delete(key);
      notify();
    }
  }, [key]);
  const run = useCallback(
    async <Result>(draft: Draft, action: () => Promise<Result>) => {
      if (requests.get(key)?.status === "pending") return undefined;
      const request: RequestState<Draft> = { draft, status: "pending" };
      requests.set(key, request);
      notify();
      try {
        const result = await action();
        requests.set(key, { draft, status: "success", result });
        notify();
        return { result };
      } catch (error) {
        requests.set(key, { draft, status: "error", error });
        notify();
        return undefined;
      }
    },
    [key],
  );
  return useMemo(
    () => ({ state, run, clear, pending: state?.status === "pending" }),
    [state, run, clear],
  );
}
