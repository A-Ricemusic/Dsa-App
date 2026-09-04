const LEGACY_REFRESH_TOKEN_KEY = "workos:refresh-token";

export function currentReturnPath() {
  const { pathname, search, hash } = window.location;
  if (pathname === "/callback") return "/";
  return `${pathname}${search}${hash}`;
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string") return "/";

  try {
    const destination = new URL(value, window.location.origin);
    if (destination.origin !== window.location.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

export function restoreReturnPath(value: unknown) {
  window.history.replaceState({}, "", safeReturnPath(value));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function clearLegacyDevSession(clientId: string) {
  try {
    window.localStorage.removeItem(`${LEGACY_REFRESH_TOKEN_KEY}:${clientId}`);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Storage may be unavailable under restrictive browser policies. AuthKit's
    // production cookie session remains independent of these legacy values.
  }
}
