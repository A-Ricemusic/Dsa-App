import { WorkOS } from "@workos-inc/node";
import { parse, serialize } from "cookie";
import { sealData, unsealData } from "iron-session";

const SESSION_COOKIE = "wos-session";
const LOGIN_COOKIE = "wos-login";
const SESSION_MAX_AGE = 60 * 60 * 24 * 400;

export function authConfig(env: Record<string, string | undefined>) {
  for (const key of [
    "WORKOS_CLIENT_ID",
    "WORKOS_API_KEY",
    "WORKOS_REDIRECT_URI",
    "WORKOS_COOKIE_PASSWORD",
  ]) {
    if (!env[key]) throw new Error(`${key} is required for server-side authentication`);
  }
  const redirectUri = new URL(env.WORKOS_REDIRECT_URI!);
  if (redirectUri.pathname !== "/callback")
    throw new Error("WORKOS_REDIRECT_URI must end in /callback");
  if (
    redirectUri.protocol !== "https:" &&
    !(redirectUri.protocol === "http:" && redirectUri.hostname === "localhost")
  ) {
    throw new Error("WORKOS_REDIRECT_URI must use HTTPS (except http://localhost for development)");
  }
  if (env.WORKOS_COOKIE_PASSWORD!.length < 32)
    throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters");
  return {
    clientId: env.WORKOS_CLIENT_ID!,
    apiKey: env.WORKOS_API_KEY!,
    redirectUri: redirectUri.href,
    cookiePassword: env.WORKOS_COOKIE_PASSWORD!,
  };
}

// WorkOS owns session encryption, JWT verification, PKCE generation, and refresh.
// This handler only connects its Node SDK to same-origin HTTP requests.
export function createAuthHandler(
  config: ReturnType<typeof authConfig>,
  workos = new WorkOS(config.apiKey, { clientId: config.clientId }),
) {
  const origin = new URL(config.redirectUri).origin;
  const cookieOptions = {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
  };

  return async function handleAuth(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname.split("/").at(-1);
    const headers = new Headers({
      "Cache-Control": "no-store",
      Vary: "Cookie",
      "Referrer-Policy": "no-referrer",
    });
    const cookies = parse(request.headers.get("cookie") ?? "");
    const setCookie = (name: string, value: string, maxAge: number) => {
      headers.append("Set-Cookie", serialize(name, value, { ...cookieOptions, maxAge }));
    };
    const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
    const redirect = (location: string) => {
      headers.set("Location", location);
      return new Response(null, { status: 303, headers });
    };

    try {
      if (!["sign-in", "callback", "session", "refresh", "sign-out"].includes(action ?? "")) {
        return json({ error: "Not found" }, 404);
      }
      const expectedMethod = action === "sign-in" || action === "callback" ? "GET" : "POST";
      if (request.method !== expectedMethod) {
        headers.set("Allow", expectedMethod);
        return json({ error: "Method not allowed" }, 405);
      }
      // A required custom header plus an exact Origin check prevents cross-site
      // forms/fetches from refreshing or ending a user's session. No CORS access.
      if (
        expectedMethod === "POST" &&
        (request.headers.get("Origin") !== origin ||
          request.headers.get("X-Requested-With") !== "recall")
      ) {
        return json({ error: "Forbidden" }, 403);
      }

      if (action === "sign-in") {
        const {
          url: authorizationUrl,
          state,
          codeVerifier,
        } = await workos.userManagement.getAuthorizationUrlWithPKCE({
          provider: "authkit",
          redirectUri: config.redirectUri,
        });
        setCookie(
          LOGIN_COOKIE,
          await sealData({ state, codeVerifier }, { password: config.cookiePassword, ttl: 600 }),
          600,
        );
        return redirect(authorizationUrl);
      }

      if (action === "callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const login = await unsealData<{ state?: string; codeVerifier?: string }>(
          cookies[LOGIN_COOKIE] ?? "",
          { password: config.cookiePassword },
        );
        setCookie(LOGIN_COOKIE, "", 0);
        if (!code || !state || state !== login.state || !login.codeVerifier) {
          return new Response(
            'Sign-in could not be verified. <a href="/sign-in">Try signing in again</a>.',
            {
              status: 400,
              headers: new Headers([...headers, ["Content-Type", "text/html; charset=utf-8"]]),
            },
          );
        }
        const { sealedSession } = await workos.userManagement.authenticateWithCode({
          code,
          codeVerifier: login.codeVerifier,
          session: { sealSession: true, cookiePassword: config.cookiePassword },
        });
        if (!sealedSession) throw new Error("WorkOS did not return a sealed session");
        setCookie(SESSION_COOKIE, sealedSession, SESSION_MAX_AGE);
        return redirect("/");
      }

      const session = workos.userManagement.loadSealedSession({
        sessionData: cookies[SESSION_COOKIE] ?? "",
        cookiePassword: config.cookiePassword,
      });
      let auth = await session.authenticate();
      if (
        (auth.authenticated && action === "refresh") ||
        (!auth.authenticated && auth.reason === "invalid_jwt")
      ) {
        const refreshed = await session.refresh();
        if (!refreshed.authenticated) {
          if (refreshed.retryable) {
            headers.set("Retry-After", String(refreshed.retryAfter ?? 5));
            return json({ error: "Authentication is temporarily unavailable. Please retry." }, 503);
          }
          setCookie(SESSION_COOKIE, "", 0);
          if (action === "sign-out") return json({ url: "/" });
          return json({ user: null, accessToken: null }, 401);
        } else {
          if (!refreshed.sealedSession)
            throw new Error("WorkOS did not return a refreshed session");
          setCookie(SESSION_COOKIE, refreshed.sealedSession, SESSION_MAX_AGE);
          auth = await session.authenticate();
        }
      }
      if (auth.authenticated) {
        if (action === "sign-out") {
          setCookie(SESSION_COOKIE, "", 0);
          return json({ url: workos.userManagement.getLogoutUrl({ sessionId: auth.sessionId }) });
        }
        return json({
          user: { id: auth.user.id, email: auth.user.email, firstName: auth.user.firstName },
          accessToken: auth.accessToken,
        });
      }
      setCookie(SESSION_COOKIE, "", 0);
      if (action === "sign-out") return json({ url: "/" });
      return json({ user: null, accessToken: null }, 401);
    } catch {
      // Do not log credentials or discard cookies on transport/configuration errors.
      console.error("WorkOS authentication request failed", { action });
      if (action === "callback" || action === "sign-in") {
        headers.set("Content-Type", "text/html; charset=utf-8");
        return new Response(
          'Authentication is temporarily unavailable. <a href="/sign-in">Try signing in again</a>.',
          { status: 503, headers },
        );
      }
      return json({ error: "Authentication is temporarily unavailable. Please retry." }, 503);
    }
  };
}
