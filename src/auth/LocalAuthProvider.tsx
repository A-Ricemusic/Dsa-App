import { type ReactNode, useCallback, useMemo } from "react";
import { AuthKitProvider, useAuth as useWorkOSAuth } from "@workos-inc/authkit-react";
import type { ConvexReactClient } from "convex/react";
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
  AuthenticatedConvexProvider,
  safeReturnPath,
} from "./AuthProvider";

export default function LocalAuthProvider({
  client,
  clientId,
  redirectUri,
  children,
}: {
  client: ConvexReactClient;
  clientId: string;
  redirectUri: string;
  children: ReactNode;
}) {
  return (
    <AuthKitProvider
      clientId={clientId}
      redirectUri={redirectUri}
      devMode
      onRedirectCallback={({ state }) => restoreReturnPath(state)}
    >
      <LocalAuthBridge client={client}>{children}</LocalAuthBridge>
    </AuthKitProvider>
  );
}

function LocalAuthBridge({ client, children }: { client: ConvexReactClient; children: ReactNode }) {
  const auth = useWorkOSAuth();
  const signIn = useCallback(
    async (returnTo: string) => auth.signIn({ state: { returnTo } }),
    [auth],
  );
  const signOut = useCallback(
    async () => auth.signOut({ returnTo: window.location.origin }),
    [auth],
  );
  const fetchAccessToken = useCallback(async () => {
    try {
      return await auth.getAccessToken();
    } catch {
      return null;
    }
  }, [auth]);
  const user = useMemo<AuthUser | null>(
    () =>
      auth.user
        ? {
            id: auth.user.id,
            email: auth.user.email,
            emailVerified: auth.user.emailVerified,
            firstName: auth.user.firstName,
            lastName: auth.user.lastName,
            profilePictureUrl: auth.user.profilePictureUrl,
          }
        : null,
    [auth.user],
  );
  const value = useMemo<AuthContextValue>(
    () => ({ isLoading: auth.isLoading, user, signIn, signOut, fetchAccessToken }),
    [auth.isLoading, fetchAccessToken, signIn, signOut, user],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthenticatedConvexProvider client={client}>{children}</AuthenticatedConvexProvider>
    </AuthContext.Provider>
  );
}

function restoreReturnPath(state: Record<string, unknown> | null | undefined) {
  const returnTo = safeReturnPath(state?.returnTo);
  window.history.replaceState({}, "", returnTo);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
