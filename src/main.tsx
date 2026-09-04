import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import { clearLegacyDevSession, restoreReturnPath } from "./auth/session";
import { ThemeProvider } from "./components/Theme";
import "./styles.css";

const convexUrl = requiredEnvironmentVariable("CONVEX_URL", import.meta.env.CONVEX_URL);
const workosClientId = requiredEnvironmentVariable(
  "WORKOS_CLIENT_ID",
  import.meta.env.WORKOS_CLIENT_ID,
);
const redirectUri = import.meta.env.WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;

if (!import.meta.env.DEV) clearLegacyDevSession(workosClientId);

const root = createRoot(document.getElementById("root")!);
const convex = new ConvexReactClient(convexUrl);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AuthKitProvider
        clientId={workosClientId}
        redirectUri={redirectUri}
        devMode={import.meta.env.DEV}
        onRedirectCallback={({ state }) => restoreReturnPath(state?.returnTo)}
      >
        <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    </ThemeProvider>
  </StrictMode>,
);

function requiredEnvironmentVariable(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}
