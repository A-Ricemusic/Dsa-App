import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useState, type ReactNode } from "react";
import { ThemeProvider } from "./Theme";

export function AppProviders({ children }: { children: ReactNode }) {
  const [convex] = useState(() => new ConvexReactClient(import.meta.env.CONVEX_URL));

  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Convex intentionally accepts this hook function as its authentication adapter. */}
        {/* oxlint-disable-next-line react/rules-of-hooks */}
        <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
          {children}
        </ConvexProviderWithAuth>
      </AuthProvider>
    </ThemeProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isLoading, fetchAccessToken } = useAuth();

  return {
    isLoading,
    isAuthenticated: Boolean(user),
    fetchAccessToken,
  };
}
