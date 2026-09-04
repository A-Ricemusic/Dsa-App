import { timingSafeEqual } from "node:crypto";
import { AuthenticationException, OauthException, WorkOS, type User } from "@workos-inc/node";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SESSION_COOKIE = "recall_session";
const FLOW_COOKIE = "recall_auth_flow";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;
const FLOW_COOKIE_MAX_AGE = 60 * 10;

type AuthConfig = {
  apiKey: string;
  clientId: string;
  cookiePassword: string;
  redirectUri: string;
  appOrigin: string;
  secureCookies: boolean;
};

type AuthFlow = {
  state: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
};

export type ClientUser = Pick<
  User,
  "id" | "email" | "emailVerified" | "firstName" | "lastName" | "profilePictureUrl"
>;

export type ClientSession = {
  user: ClientUser;
  accessToken: string;
};

export function getAuthConfig(): AuthConfig {
  const apiKey = requiredEnv("WORKOS_API_KEY");
  const clientId = requiredEnv("WORKOS_CLIENT_ID");
  const cookiePassword = requiredEnv("WORKOS_COOKIE_PASSWORD");
  const redirectUri = requiredEnv("WORKOS_REDIRECT_URI");

  if (cookiePassword.length < 32) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters long");
  }

  const redirectUrl = new URL(redirectUri);
  if (redirectUrl.pathname !== "/callback") {
    throw new Error("WORKOS_REDIRECT_URI must end in /callback");
  }
  if (process.env.VERCEL === "1" && redirectUrl.protocol !== "https:") {
    throw new Error("WORKOS_REDIRECT_URI must use HTTPS in Vercel");
  }

  return {
    apiKey,
    clientId,
    cookiePassword,
    redirectUri: redirectUrl.toString(),
    appOrigin: redirectUrl.origin,
    secureCookies: redirectUrl.protocol === "https:",
  };
}

export function getWorkOS(config: AuthConfig) {
  return new WorkOS({ apiKey: config.apiKey, clientId: config.clientId });
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed);
  return res.status(405).json({ error: "method_not_allowed" });
}

export function noStore(res: VercelResponse) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

export function getCookie(req: VercelRequest, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function setSessionCookie(res: VercelResponse, config: AuthConfig, value: string) {
  appendSetCookie(
    res,
    serializeCookie(cookieName(SESSION_COOKIE, config), value, {
      maxAge: SESSION_COOKIE_MAX_AGE,
      secure: config.secureCookies,
    }),
  );
}

export function clearSessionCookie(res: VercelResponse, config: AuthConfig) {
  appendSetCookie(
    res,
    serializeCookie(cookieName(SESSION_COOKIE, config), "", {
      maxAge: 0,
      secure: config.secureCookies,
    }),
  );
}

export function getSessionCookie(req: VercelRequest, config: AuthConfig) {
  return getCookie(req, cookieName(SESSION_COOKIE, config));
}

export function setFlowCookie(res: VercelResponse, config: AuthConfig, flow: AuthFlow) {
  const encoded = Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
  appendSetCookie(
    res,
    serializeCookie(cookieName(FLOW_COOKIE, config), encoded, {
      maxAge: FLOW_COOKIE_MAX_AGE,
      secure: config.secureCookies,
    }),
  );
}

export function clearFlowCookie(res: VercelResponse, config: AuthConfig) {
  appendSetCookie(
    res,
    serializeCookie(cookieName(FLOW_COOKIE, config), "", {
      maxAge: 0,
      secure: config.secureCookies,
    }),
  );
}

export function getFlowCookie(req: VercelRequest, config: AuthConfig): AuthFlow | undefined {
  const value = getCookie(req, cookieName(FLOW_COOKIE, config));
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<AuthFlow>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return undefined;
    }
    return parsed as AuthFlow;
  } catch {
    return undefined;
  }
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const base = "https://return-path.invalid";
    const destination = new URL(value, base);
    if (destination.origin !== base) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

export function statesMatch(received: unknown, expected: string) {
  if (typeof received !== "string") return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
  );
}

export function requireSameOrigin(req: VercelRequest, res: VercelResponse, config: AuthConfig) {
  const origin = req.headers.origin;
  const csrfHeader = req.headers["x-recall-csrf"];
  if (origin !== config.appOrigin || csrfHeader !== "1") {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

export function clientSession(user: User, accessToken: string): ClientSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
    },
    accessToken,
  };
}

export function authUnavailable(res: VercelResponse, error: unknown) {
  console.error("WorkOS session request failed", safeError(error));
  return res.status(503).json({ error: "auth_temporarily_unavailable", retryable: true });
}

export function migrationFailed(res: VercelResponse, error: unknown) {
  if (
    (error instanceof OauthException && error.error === "invalid_grant") ||
    error instanceof AuthenticationException
  ) {
    return res.status(401).json({ error: "legacy_session_expired" });
  }
  return authUnavailable(res, error);
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; secure: boolean },
) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${options.maxAge}`,
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}

function cookieName(name: string, config: AuthConfig) {
  // The __Host- prefix prevents a sibling subdomain from shadowing these
  // authentication cookies. Browsers require Secure + Path=/ and no Domain.
  return config.secureCookies ? `__Host-${name}` : name;
}

function appendSetCookie(res: VercelResponse, value: string) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", value);
  } else if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current.map(String), value]);
  } else {
    res.setHeader("Set-Cookie", [String(current), value]);
  }
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  return { name: error.name, message: error.message };
}
