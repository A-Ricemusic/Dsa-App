import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  authUnavailable,
  clearFlowCookie,
  getAuthConfig,
  getFlowCookie,
  getWorkOS,
  methodNotAllowed,
  noStore,
  setSessionCookie,
  statesMatch,
} from "../../server/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const config = getAuthConfig();
    const flow = getFlowCookie(req, config);
    clearFlowCookie(res, config);

    if (!flow || !statesMatch(req.query.state, flow.state) || typeof req.query.code !== "string") {
      return res.status(400).json({ error: "invalid_auth_callback" });
    }

    const authentication = await getWorkOS(config).userManagement.authenticateWithCode({
      clientId: config.clientId,
      code: req.query.code,
      codeVerifier: flow.codeVerifier,
      session: { sealSession: true, cookiePassword: config.cookiePassword },
    });

    if (!authentication.sealedSession) {
      throw new Error("WorkOS did not return a sealed session");
    }

    setSessionCookie(res, config, authentication.sealedSession);
    // Keep the original path in the URL so refreshes and deployments return to
    // the exact page where sign-in began.
    return res.redirect(302, new URL(flow.returnTo, config.appOrigin).toString());
  } catch (error) {
    return authUnavailable(res, error);
  }
}
