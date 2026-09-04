import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn<(query: string) => MediaQueryList>().mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener:
          vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
        removeEventListener:
          vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
        addListener: vi.fn<(callback: (event: MediaQueryListEvent) => void) => void>(),
        removeListener: vi.fn<(callback: (event: MediaQueryListEvent) => void) => void>(),
        dispatchEvent: vi.fn<(event: Event) => boolean>(),
      }) as MediaQueryList,
  ),
});
