import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { serverAuth } from "./server/vite-auth.ts";
import { authConfig } from "./server/auth.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (!env.CONVEX_URL) throw new Error("CONVEX_URL is required");
  if (env.VERCEL === "1") {
    const config = authConfig(env);
    if (new URL(config.redirectUri).protocol !== "https:") {
      throw new Error("The Vercel WORKOS_REDIRECT_URI must use HTTPS");
    }
  }
  return {
    plugins: [react(), tailwindcss(), serverAuth(env)],
    define: {
      // Only this public value enters the browser bundle. All WorkOS config stays server-side.
      "import.meta.env.CONVEX_URL": JSON.stringify(env.CONVEX_URL),
    },
  };
});
