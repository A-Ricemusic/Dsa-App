import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

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
