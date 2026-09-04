"use client";

import { AuthKitProvider, useAccessToken, useAuth } from "@workos-inc/authkit-nextjs/components";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { clearLegacyDevSessions } from "../auth/session";
import { ThemeProvider } from "./Theme";

type InitialAuth = ComponentProps<typeof AuthKitProvider>["initialAuth"];

export function AppProviders({
  children,
  convexUrl,
  initialAuth,
}: {
  children: ReactNode;
  convexUrl: string;
  initialAuth: InitialAuth;
}) {
  const [convex] = useState(() => new ConvexReactClient(convexUrl));

  useEffect(() => {
    clearLegacyDevSessions();
  }, []);

  return (
    <ThemeProvider>
      <AuthKitProvider initialAuth={initialAuth}>
        {/* Convex intentionally accepts this hook function as its authentication adapter. */}
        {/* oxlint-disable-next-line react/rules-of-hooks */}
        <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
          {children}
        </ConvexProviderWithAuth>
      </AuthKitProvider>
    </ThemeProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isLoading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }): Promise<string | null> => {
      if (!user) return null;

      try {
        return (forceRefreshToken ? await refresh() : await getAccessToken()) ?? null;
      } catch (error) {
        console.error("Unable to get a WorkOS access token for Convex", error);
        return null;
      }
    },
    [getAccessToken, refresh, user],
  );

  return {
    isLoading,
    isAuthenticated: Boolean(user),
    fetchAccessToken,
  };
}
