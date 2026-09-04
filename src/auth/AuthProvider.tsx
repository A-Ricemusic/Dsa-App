import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";

const LEGACY_REFRESH_TOKEN_KEY = "workos:refresh-token";
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
};

export type AuthContextValue = {
  isLoading: boolean;
  user: AuthUser | null;
  signIn: (returnTo: string) => Promise<void>;
  signOut: () => Promise<void>;
  fetchAccessToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>;
};

type SessionResult =
  | { kind: "authenticated"; user: AuthUser; accessToken: string }
  | { kind: "unauthenticated" }
  | { kind: "retryable"; retryAfterMs?: number };

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
let initialRestoreInFlight: Promise<SessionResult> | undefined;
const LocalAuthProvider = lazy(() => import("./LocalAuthProvider"));

export function AppAuthProvider({
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
  if (isLocalDevelopment()) {
    return (
      <Suspense fallback={null}>
        <LocalAuthProvider client={client} clientId={clientId} redirectUri={redirectUri}>
          {children}
        </LocalAuthProvider>
      </Suspense>
    );
  }

  return (
    <SecureAuthProvider client={client} clientId={clientId}>
      {children}
    </SecureAuthProvider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AppAuthProvider");
  return auth;
}

function SecureAuthProvider({
  client,
  clientId,
  children,
}: {
  client: ConvexReactClient;
  clientId: string;
  children: ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<SessionResult> | null>(null);

  const applySession = useCallback((result: SessionResult) => {
    if (result.kind === "authenticated") {
      accessToken.current = result.accessToken;
      setUser(result.user);
      setIsLoading(false);
    } else if (result.kind === "unauthenticated") {
      accessToken.current = null;
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!forceRefreshToken && accessToken.current) return accessToken.current;

      refreshInFlight.current ??= requestSession(forceRefreshToken).finally(() => {
        refreshInFlight.current = null;
      });
      const result = await refreshInFlight.current;
      applySession(result);
      return result.kind === "authenticated" ? result.accessToken : null;
    },
    [applySession],
  );

  const revalidateSession = useCallback(async () => {
    refreshInFlight.current ??= requestSession(false).finally(() => {
      refreshInFlight.current = null;
    });
    const result = await refreshInFlight.current;
    applySession(result);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      let retryDelay = INITIAL_RETRY_DELAY_MS;
      for (;;) {
        if (cancelled) return;
        const result = await restoreSessionOnce(clientId);
        if (cancelled) return;
        if (result.kind !== "retryable") {
          applySession(result);
          return;
        }

        await delay(result.retryAfterMs ?? retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [applySession, clientId]);

  useEffect(() => {
    if (!user) return;

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void revalidateSession();
      }
    };
    window.addEventListener("online", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);
    return () => {
      window.removeEventListener("online", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [revalidateSession, user]);

  const signIn = useCallback(async (returnTo: string) => {
    const url = new URL("/api/auth/login", window.location.origin);
    url.searchParams.set("returnTo", safeReturnPath(returnTo));
    window.location.assign(url);
  }, []);
  const signOut = useCallback(async () => {
    window.location.assign(new URL("/api/auth/logout", window.location.origin));
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({ isLoading, user, signIn, signOut, fetchAccessToken: refreshSession }),
    [isLoading, refreshSession, signIn, signOut, user],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthenticatedConvexProvider client={client}>{children}</AuthenticatedConvexProvider>
    </AuthContext.Provider>
  );
}

export function AuthenticatedConvexProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const { isLoading, user, fetchAccessToken } = useAuth();
  const convexAuth = useMemo(
    () => ({ isLoading, isAuthenticated: Boolean(user), fetchAccessToken }),
    [fetchAccessToken, isLoading, user],
  );
  const authAdapter = useCallback(() => convexAuth, [convexAuth]);
  return (
    <ConvexProviderWithAuth client={client} useAuth={authAdapter}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export async function restoreSession(clientId: string): Promise<SessionResult> {
  const existing = await requestSession(false);
  if (existing.kind !== "unauthenticated") return existing;

  const legacyRefreshToken = getLegacyRefreshToken(clientId);
  if (legacyRefreshToken) {
    const migrated = await request("/api/auth/migrate", {
      method: "POST",
      body: JSON.stringify({ refreshToken: legacyRefreshToken }),
    });
    if (migrated.kind === "authenticated") removeLegacyRefreshToken(clientId);
    if (migrated.kind !== "unauthenticated") return migrated;
    removeLegacyRefreshToken(clientId);
  }

  // Another tab may have completed the one-time migration while this tab was
  // reading localStorage. Re-check the shared HttpOnly cookie before deciding
  // that the user is signed out.
  await delay(250);
  return requestSession(false);
}

function restoreSessionOnce(clientId: string) {
  initialRestoreInFlight ??= restoreSession(clientId).finally(() => {
    initialRestoreInFlight = undefined;
  });
  return initialRestoreInFlight;
}

function requestSession(forceRefreshToken: boolean) {
  return request("/api/auth/session", { method: forceRefreshToken ? "POST" : "GET" });
}

async function request(path: string, init: RequestInit): Promise<SessionResult> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Recall-CSRF": "1",
        ...init.headers,
      },
    });

    if (response.ok) {
      const value = (await response.json()) as Partial<{
        user: AuthUser;
        accessToken: string;
      }>;
      if (value.user && typeof value.accessToken === "string") {
        return { kind: "authenticated", user: value.user, accessToken: value.accessToken };
      }
      return { kind: "retryable" };
    }
    if (response.status === 401) return { kind: "unauthenticated" };

    const retryAfterSeconds = Number(response.headers.get("Retry-After"));
    return {
      kind: "retryable",
      retryAfterMs:
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1_000
          : undefined,
    };
  } catch {
    return { kind: "retryable" };
  }
}

function getLegacyRefreshToken(clientId: string) {
  try {
    return (
      window.localStorage.getItem(`${LEGACY_REFRESH_TOKEN_KEY}:${clientId}`) ??
      window.localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

function removeLegacyRefreshToken(clientId: string) {
  try {
    window.localStorage.removeItem(`${LEGACY_REFRESH_TOKEN_KEY}:${clientId}`);
    window.localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // The secure cookie is already established. A browser policy that blocks
    // localStorage cleanup does not invalidate the new session.
  }
}

export function safeReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const destination = new URL(value, window.location.origin);
    if (destination.origin !== window.location.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

function isLocalDevelopment() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}
