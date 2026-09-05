import { authConfig, createAuthHandler } from "../../server/auth.js";

let handleAuth: ReturnType<typeof createAuthHandler>;

export default {
  fetch(request: Request) {
    handleAuth ??= createAuthHandler(authConfig(process.env));
    return handleAuth(request);
  },
};
