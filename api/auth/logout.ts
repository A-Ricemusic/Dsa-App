import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  authUnavailable,
  clearSessionCookie,
  getAuthConfig,
  getSessionCookie,
  getWorkOS,
  methodNotAllowed,
  noStore,
} from "../../server/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  try {
    const config = getAuthConfig();
    const sessionData = getSessionCookie(req, config);
    clearSessionCookie(res, config);

    if (!sessionData) return res.redirect(302, config.appOrigin);

    const logoutUrl = await getWorkOS(config)
      .userManagement.loadSealedSession({
        sessionData,
        cookiePassword: config.cookiePassword,
      })
      .getLogoutUrl({ returnTo: config.appOrigin });
    return res.redirect(302, logoutUrl);
  } catch (error) {
    return authUnavailable(res, error);
  }
}
