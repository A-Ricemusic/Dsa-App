import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clientSession,
  getAuthConfig,
  getWorkOS,
  methodNotAllowed,
  migrationFailed,
  noStore,
  requireSameOrigin,
  setSessionCookie,
} from "../../server/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  try {
    const config = getAuthConfig();
    if (!requireSameOrigin(req, res, config)) return;

    const refreshToken = readRefreshToken(req.body);
    if (!refreshToken) return res.status(400).json({ error: "invalid_refresh_token" });

    const authentication = await getWorkOS(config).userManagement.authenticateWithRefreshToken({
      clientId: config.clientId,
      refreshToken,
      session: { sealSession: true, cookiePassword: config.cookiePassword },
    });

    if (!authentication.sealedSession) {
      throw new Error("WorkOS did not return a sealed session");
    }

    setSessionCookie(res, config, authentication.sealedSession);
    return res.status(200).json(clientSession(authentication.user, authentication.accessToken));
  } catch (error) {
    return migrationFailed(res, error);
  }
}

function readRefreshToken(body: unknown) {
  let parsed = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== "object" || !("refreshToken" in parsed)) return undefined;
  const value = (parsed as { refreshToken?: unknown }).refreshToken;
  return typeof value === "string" && value.length > 0 && value.length <= 16_384
    ? value
    : undefined;
}
