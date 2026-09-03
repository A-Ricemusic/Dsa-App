import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import { ThemeProvider } from "./components/Theme";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? import.meta.env.CONVEX_URL;
const workosClientId = import.meta.env.WORKOS_CLIENT_ID;
const redirectUri =
  import.meta.env.WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;

function safeReturnPath(state: Record<string, unknown> | null | undefined) {
  if (typeof state?.returnTo !== "string") return "/";

  try {
    const destination = new URL(state.returnTo, window.location.origin);
    if (destination.origin !== window.location.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

function handleAuthRedirect({
  state,
}: {
  state: Record<string, unknown> | null | undefined;
}) {
  window.history.replaceState({}, "", safeReturnPath(state));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const root = createRoot(document.getElementById("root")!);
const convex = new ConvexReactClient(convexUrl!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AuthKitProvider
        clientId={workosClientId!}
        redirectUri={redirectUri}
        // This static SPA has no same-origin auth server. Browser-managed
        // storage keeps the rotating WorkOS refresh token across Vercel builds
        // instead of relying on a third-party api.workos.com cookie.
        devMode
        onRedirectCallback={handleAuthRedirect}
      >
        <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    </ThemeProvider>
  </StrictMode>,
);
