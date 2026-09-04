import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  if (env.VERCEL === "1") {
    const requiredAuthEnvironment = [
      "WORKOS_CLIENT_ID",
      "WORKOS_REDIRECT_URI",
      "WORKOS_API_KEY",
      "WORKOS_COOKIE_PASSWORD",
    ] as const;
    for (const name of requiredAuthEnvironment) {
      if (!env[name]) throw new Error(`${name} must be configured before a Vercel deployment`);
    }
    if (env.WORKOS_COOKIE_PASSWORD.length < 32) {
      throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters long");
    }
    const redirectUri = new URL(env.WORKOS_REDIRECT_URI);
    if (redirectUri.protocol !== "https:" || redirectUri.pathname !== "/callback") {
      throw new Error("WORKOS_REDIRECT_URI must be an HTTPS URL ending in /callback");
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: "VITE_",
    define: {
      "import.meta.env.CONVEX_URL": JSON.stringify(env.CONVEX_URL ?? ""),
      "import.meta.env.WORKOS_CLIENT_ID": JSON.stringify(env.WORKOS_CLIENT_ID ?? ""),
      "import.meta.env.WORKOS_REDIRECT_URI": JSON.stringify(env.WORKOS_REDIRECT_URI ?? ""),
    },
  };
});
