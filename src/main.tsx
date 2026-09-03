import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? import.meta.env.CONVEX_URL;
const workosClientId = import.meta.env.WORKOS_CLIENT_ID;
const redirectUri =
  import.meta.env.WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;

function handleAuthRedirect() {
  window.history.replaceState({}, "", "/");
}

const root = createRoot(document.getElementById("root")!);
const convex = new ConvexReactClient(convexUrl!);

root.render(
  <StrictMode>
    <AuthKitProvider
      clientId={workosClientId!}
      redirectUri={redirectUri}
      onRedirectCallback={handleAuthRedirect}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithAuthKit>
    </AuthKitProvider>
  </StrictMode>,
);
