import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  authUnavailable,
  clearSessionCookie,
  clientSession,
  getAuthConfig,
  getSessionCookie,
  getWorkOS,
  methodNotAllowed,
  noStore,
  requireSameOrigin,
  setSessionCookie,
} from "../../server/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  try {
    const config = getAuthConfig();
    if (req.method === "POST" && !requireSameOrigin(req, res, config)) return;

    const sessionData = getSessionCookie(req, config);
    if (!sessionData) return res.status(401).json({ error: "no_session" });

    const session = getWorkOS(config).userManagement.loadSealedSession({
      sessionData,
      cookiePassword: config.cookiePassword,
    });

    if (req.method === "GET") {
      const authenticated = await session.authenticate();
      if (authenticated.authenticated) {
        return res.status(200).json(clientSession(authenticated.user, authenticated.accessToken));
      }
      if (authenticated.reason === "invalid_session_cookie") {
        clearSessionCookie(res, config);
        return res.status(401).json({ error: "invalid_session" });
      }
    }

    const refreshed = await session.refresh();
    if (!refreshed.authenticated) {
      if (refreshed.retryable) {
        if (refreshed.retryAfter !== undefined) {
          res.setHeader("Retry-After", String(refreshed.retryAfter));
        }
        return res.status(503).json({ error: refreshed.reason, retryable: true });
      }

      clearSessionCookie(res, config);
      return res.status(401).json({ error: refreshed.reason });
    }

    if (!refreshed.sealedSession || !refreshed.session) {
      throw new Error("WorkOS did not return refreshed sealed-session data");
    }

    setSessionCookie(res, config, refreshed.sealedSession);
    return res.status(200).json(clientSession(refreshed.user, refreshed.session.accessToken));
  } catch (error) {
    return authUnavailable(res, error);
  }
}
