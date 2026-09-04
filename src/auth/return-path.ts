const APPLICATION_ORIGIN = "https://recall.invalid";

export function safeReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const destination = new URL(value, APPLICATION_ORIGIN);
    if (destination.origin !== APPLICATION_ORIGIN) return "/";
    if (["/callback", "/sign-in"].includes(destination.pathname)) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
