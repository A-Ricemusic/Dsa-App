const LEGACY_REFRESH_TOKEN_KEY = "workos:refresh-token";

export function clearLegacyDevSessions() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key === LEGACY_REFRESH_TOKEN_KEY || key?.startsWith(`${LEGACY_REFRESH_TOKEN_KEY}:`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage may be unavailable under restrictive browser policies. The
    // server-managed session is independent of these obsolete browser values.
  }
}
