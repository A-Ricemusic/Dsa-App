import type { Connect, Plugin } from "vite";
import { authConfig, createAuthHandler } from "./auth.ts";

// Local dev and production-preview use the same handler as Vercel Functions.
export function serverAuth(env: Record<string, string>): Plugin {
  const middleware = (): Connect.NextHandleFunction => {
    const config = authConfig(env);
    const handleAuth = createAuthHandler(config);
    return async (req, res, next) => {
      const url = new URL(req.url ?? "/", config.redirectUri);
      if (
        url.pathname !== "/sign-in" &&
        url.pathname !== "/callback" &&
        !url.pathname.startsWith("/api/auth/")
      )
        return next();
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const result = await handleAuth(new Request(url, { method: req.method, headers }));
        res.statusCode = result.status;
        result.headers.forEach((value, name) => {
          if (name !== "set-cookie") res.setHeader(name, value);
        });
        res.setHeader("Set-Cookie", result.headers.getSetCookie());
        res.end(await result.text());
      } catch (error) {
        next(error);
      }
    };
  };
  return {
    name: "workos-server-auth",
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
