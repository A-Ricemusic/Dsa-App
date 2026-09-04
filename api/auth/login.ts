import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  authUnavailable,
  getAuthConfig,
  getWorkOS,
  methodNotAllowed,
  noStore,
  safeReturnPath,
  setFlowCookie,
} from "../../server/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const config = getAuthConfig();
    const workos = getWorkOS(config);
    const { url, state, codeVerifier } = await workos.userManagement.getAuthorizationUrlWithPKCE({
      clientId: config.clientId,
      provider: "authkit",
      redirectUri: config.redirectUri,
    });

    setFlowCookie(res, config, {
      state,
      codeVerifier,
      returnTo: safeReturnPath(req.query.returnTo),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return res.redirect(302, url);
  } catch (error) {
    return authUnavailable(res, error);
  }
}
