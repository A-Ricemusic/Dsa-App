import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useFormRequest } from "./useFormRequest";

const auth = vi.hoisted(() => ({ owner: "first-owner" }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: auth.owner } }) }));

it("isolates drafts by owner and form and deduplicates pending writes across remounts", async () => {
  let resolve!: () => void;
  const action = vi.fn<() => Promise<void>>(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const first = renderHook(() => useFormRequest<string>("first-form"));
  let completion!: ReturnType<typeof first.result.current.run>;
  act(() => {
    completion = first.result.current.run("Private draft", action);
  });
  first.unmount();
  const second = renderHook(({ form }) => useFormRequest<string>(form), {
    initialProps: { form: "first-form" },
  });
  expect(second.result.current.state?.draft).toBe("Private draft");
  await act(async () => {
    await second.result.current.run("Duplicate draft", action);
  });
  expect(action).toHaveBeenCalledOnce();
  second.rerender({ form: "different-form" });
  expect(second.result.current.state).toBeUndefined();
  auth.owner = "different-owner";
  second.rerender({ form: "first-form" });
  expect(second.result.current.state).toBeUndefined();
  await act(async () => {
    resolve();
    await completion;
  });
  expect(second.result.current.state).toBeUndefined();
  auth.owner = "first-owner";
  second.rerender({ form: "first-form" });
  expect(second.result.current.state?.status).toBe("success");
  act(() => {
    second.result.current.clear();
  });
  expect(second.result.current.state).toBeUndefined();
});
