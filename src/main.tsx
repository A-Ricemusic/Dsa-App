import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import App from "./App";
import { AppAuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./components/Theme";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? import.meta.env.CONVEX_URL;
const workosClientId = import.meta.env.WORKOS_CLIENT_ID;
const redirectUri = import.meta.env.WORKOS_REDIRECT_URI || `${window.location.origin}/callback`;

const root = createRoot(document.getElementById("root")!);
const convex = new ConvexReactClient(convexUrl!);

root.render(
  <StrictMode>
    <ThemeProvider>
      <AppAuthProvider client={convex} clientId={workosClientId!} redirectUri={redirectUri}>
        <App />
      </AppAuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
