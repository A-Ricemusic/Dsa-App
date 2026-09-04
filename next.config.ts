import type { NextConfig } from "next";

validateDeploymentEnvironment();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;

function validateDeploymentEnvironment() {
  if (process.env.VERCEL !== "1") return;

  for (const name of [
    "CONVEX_URL",
    "WORKOS_CLIENT_ID",
    "WORKOS_REDIRECT_URI",
    "WORKOS_API_KEY",
    "WORKOS_COOKIE_PASSWORD",
  ]) {
    if (!process.env[name]) throw new Error(`${name} must be configured before deployment`);
  }

  if (process.env.WORKOS_COOKIE_PASSWORD!.length < 32) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be at least 32 characters long");
  }

  const redirectUri = new URL(process.env.WORKOS_REDIRECT_URI!);
  if (redirectUri.protocol !== "https:" || redirectUri.pathname !== "/callback") {
    throw new Error("The production WORKOS_REDIRECT_URI must be HTTPS and end in /callback");
  }
}
