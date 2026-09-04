import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const convexUrl = env.CONVEX_URL || "";
  const workosClientId = env.WORKOS_CLIENT_ID || "";
  const workosRedirectUri = env.WORKOS_REDIRECT_URI || "";

  if (env.VERCEL === "1") {
    requireDeploymentValue("CONVEX_URL", convexUrl);
    requireDeploymentValue("WORKOS_CLIENT_ID", workosClientId);
    requireDeploymentValue("WORKOS_REDIRECT_URI", workosRedirectUri);

    const redirectUri = new URL(workosRedirectUri);
    if (redirectUri.protocol !== "https:" || redirectUri.pathname !== "/callback") {
      throw new Error("The production WorkOS redirect URI must be HTTPS and end in /callback");
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // These three values are public browser configuration. Keep the existing
      // deployment variable names instead of changing the application's contract.
      "import.meta.env.CONVEX_URL": JSON.stringify(convexUrl),
      "import.meta.env.WORKOS_CLIENT_ID": JSON.stringify(workosClientId),
      "import.meta.env.WORKOS_REDIRECT_URI": JSON.stringify(workosRedirectUri),
    },
  };
});

function requireDeploymentValue(name: string, value: string) {
  if (!value) throw new Error(`${name} must be configured before a Vercel deployment`);
}
