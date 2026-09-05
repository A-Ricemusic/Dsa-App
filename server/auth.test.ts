import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { WorkOS } from "@workos-inc/node";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { sealData, unsealData } from "iron-session";
import { authConfig, createAuthHandler } from "./auth";

const config = authConfig({
  WORKOS_CLIENT_ID: "client_test",
  WORKOS_API_KEY: "sk_test_example",
  WORKOS_REDIRECT_URI: "https://app.example.com/callback",
  WORKOS_COOKIE_PASSWORD: "test-only-cookie-password-at-least-32-characters",
});
const user = {
  object: "user" as const,
  id: "user_test",
  email: "test@example.com",
  firstName: "Test",
  lastName: null,
  name: "Test",
  locale: "en",
  emailVerified: true,
  profilePictureUrl: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  lastSignInAt: null,
  externalId: null,
  metadata: {},
};
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let workos: WorkOS;
let handler: ReturnType<typeof createAuthHandler>;
let accessToken: string;
let sealedSession: string;

beforeAll(async () => {
  keys = await generateKeyPair("RS256");
});
beforeEach(async () => {
  workos = new WorkOS(config.apiKey, { clientId: config.clientId });
  const jwk = await exportJWK(keys.publicKey);
  vi.spyOn(workos.userManagement, "getJWKS").mockResolvedValue(
    createLocalJWKSet({ keys: [jwk] }) as Awaited<ReturnType<typeof workos.userManagement.getJWKS>>,
  );
  accessToken = await token("1h");
  sealedSession = await sealData(
    { accessToken, refreshToken: "private-refresh-token", user },
    { password: config.cookiePassword, ttl: 0 },
  );
  handler = createAuthHandler(config, workos);
});
afterEach(() => vi.restoreAllMocks());

function token(expiration: string) {
  return new SignJWT({ sid: "session_test" })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(user.id)
    .setIssuer("https://api.workos.com/")
    .setAudience(config.clientId)
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(keys.privateKey);
}
function request(action: string, cookie = "", headers: Record<string, string> = {}) {
  return new Request(`https://app.example.com/api/auth/${action}`, {
    method: "POST",
    headers: {
      Origin: "https://app.example.com",
      "X-Requested-With": "recall",
      Cookie: cookie,
      ...headers,
    },
  });
}
function sessionCookie(value = sealedSession) {
  return `wos-session=${encodeURIComponent(value)}`;
}

describe("server-managed WorkOS authentication", () => {
  it("restores and verifies an encrypted session without exposing its refresh token", async () => {
    const response = await handler(request("session", sessionCookie()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: { id: user.id, email: user.email, firstName: user.firstName },
      accessToken,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("restores the same cookie after constructing a new server instance", async () => {
    expect((await handler(request("session", sessionCookie()))).status).toBe(200);
    const restartedHandler = createAuthHandler(config, workos);
    expect((await restartedHandler(request("session", sessionCookie()))).status).toBe(200);
  });

  it.each(["", "wos-session=garbage", "wos-session=Fe26.2*invalid"])(
    "returns signed-out for absent or invalid cookies: %s",
    async (cookie) => {
      const response = await handler(request("session", cookie));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ user: null, accessToken: null });
    },
  );

  it("refreshes expired tokens with the SDK and persists the new encrypted cookie", async () => {
    const expiredSession = await sealData(
      { accessToken: await token("-1h"), refreshToken: "private-refresh-token", user },
      { password: config.cookiePassword, ttl: 0 },
    );
    const refresh = vi
      .spyOn(workos.userManagement, "authenticateWithRefreshToken")
      .mockResolvedValue({
        user,
        accessToken,
        refreshToken: "rotated-private-token",
        sealedSession,
      });
    const response = await handler(request("session", sessionCookie(expiredSession)));
    expect(response.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshToken: "private-refresh-token",
        session: { sealSession: true, cookiePassword: config.cookiePassword },
      }),
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Lax");
    expect(await response.text()).not.toContain("private-token");
  });

  it("honors Convex's request to refresh even an unexpired access token", async () => {
    const refresh = vi
      .spyOn(workos.userManagement, "authenticateWithRefreshToken")
      .mockResolvedValue({ user, accessToken, refreshToken: "private-token", sealedSession });
    expect((await handler(request("refresh", sessionCookie()))).status).toBe(200);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("preserves the cookie on a transient refresh failure", async () => {
    const load = workos.userManagement.loadSealedSession.bind(workos.userManagement);
    vi.spyOn(workos.userManagement, "loadSealedSession").mockImplementation((options) => {
      const session = load(options);
      vi.spyOn(session, "refresh").mockResolvedValue({
        authenticated: false,
        reason: "network_error",
        retryable: true,
      } as Awaited<ReturnType<typeof session.refresh>>);
      return session;
    });
    const response = await handler(request("refresh", sessionCookie()));
    expect(response.status).toBe(503);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("clears the cookie on a terminal refresh rejection", async () => {
    const load = workos.userManagement.loadSealedSession.bind(workos.userManagement);
    vi.spyOn(workos.userManagement, "loadSealedSession").mockImplementation((options) => {
      const session = load(options);
      vi.spyOn(session, "refresh").mockResolvedValue({
        authenticated: false,
        reason: "invalid_grant",
        retryable: false,
      } as Awaited<ReturnType<typeof session.refresh>>);
      return session;
    });
    const response = await handler(request("refresh", sessionCookie()));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("signs out by clearing the cookie and returning the WorkOS logout URL", async () => {
    const response = await handler(request("sign-out", sessionCookie()));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("wos-session=; Max-Age=0");
    const { url } = await response.json();
    expect(new URL(url).pathname).toBe("/user_management/sessions/logout");
  });

  it.each(["session", "refresh", "sign-out"])("rejects cross-origin %s", async (action) => {
    expect(
      (await handler(request(action, sessionCookie(), { Origin: "https://attacker.example" })))
        .status,
    ).toBe(403);
    expect(
      (await handler(request(action, sessionCookie(), { "X-Requested-With": "" }))).status,
    ).toBe(403);
    expect((await handler(new Request(`https://app.example.com/api/auth/${action}`))).status).toBe(
      405,
    );
  });

  it("generates PKCE and binds callback state to a sealed HttpOnly cookie", async () => {
    const loginResponse = await handler(
      new Request("https://app.example.com/sign-in?returnTo=https://attacker.example"),
    );
    const authorization = new URL(loginResponse.headers.get("location")!);
    const cookie = loginResponse.headers.getSetCookie()[0]!.split(";")[0]!;
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly; Secure; SameSite=Lax");
    const loginData = await unsealData<{ state: string; codeVerifier: string }>(
      decodeURIComponent(cookie.slice("wos-login=".length)),
      { password: config.cookiePassword },
    );
    expect(loginData.state).toBe(authorization.searchParams.get("state"));
    const exchange = vi
      .spyOn(workos.userManagement, "authenticateWithCode")
      .mockResolvedValue({ user, accessToken, refreshToken: "private-token", sealedSession });
    const callback = await handler(
      new Request(`https://app.example.com/callback?code=test-code&state=${loginData.state}`, {
        headers: { Cookie: cookie },
      }),
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("/");
    expect(exchange).toHaveBeenCalledWith(
      expect.objectContaining({ codeVerifier: loginData.codeVerifier }),
    );
    expect(callback.headers.getSetCookie()).toHaveLength(2);
    expect(callback.headers.get("set-cookie")).not.toContain("private-token");
  });

  it.each(["", "?code=attacker-code&state=unrelated"])(
    "rejects callbacks without a matching login cookie: %s",
    async (query) => {
      const exchange = vi.spyOn(workos.userManagement, "authenticateWithCode");
      expect((await handler(new Request(`https://app.example.com/callback${query}`))).status).toBe(
        400,
      );
      expect(exchange).not.toHaveBeenCalled();
    },
  );

  it("returns 404 for unknown authentication endpoints", async () => {
    expect((await handler(request("does-not-exist"))).status).toBe(404);
  });
});
