import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Session = {
  user: { id: string; email: string; firstName: string | null } | null;
  accessToken: string | null;
};
const signedOut: Session = { user: null, accessToken: null };

async function authRequest(action: string) {
  return fetch(`/api/auth/${action}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "X-Requested-With": "recall" },
    signal: AbortSignal.timeout(15000),
  });
}

const AuthContext = createContext<{
  user: Session["user"];
  loading: boolean;
  error: boolean;
  fetchAccessToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>;
  retry: () => void;
  signOut: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(signedOut);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const pending = useRef<Promise<Session> | null>(null);
  const pendingIsRefresh = useRef(false);
  const signingOut = useRef(false);

  const loadSession = useCallback(function load(force = false): Promise<Session> {
    if (signingOut.current) return Promise.resolve(signedOut);
    if (pending.current) {
      // Do not satisfy a forced refresh with an older, non-refresh request.
      return force && !pendingIsRefresh.current
        ? pending.current.then(() => load(true))
        : pending.current;
    }
    pendingIsRefresh.current = force;
    const request = async () => {
      try {
        const response = await authRequest(force ? "refresh" : "session");
        if (!response.ok && response.status !== 401) throw new Error("Session request failed");
        const next: Session = response.status === 401 ? signedOut : await response.json();
        setSession(next);
        setError(false);
        return next;
      } catch (requestError) {
        // A network error is not a sign-out. Keep the cookie and current UI state.
        setError(true);
        throw requestError;
      } finally {
        setLoading(false);
        pending.current = null;
      }
    };
    pending.current = request();
    return pending.current;
  }, []);

  const retry = useCallback(() => {
    void loadSession().catch(() => {});
  }, [loadSession]);

  useEffect(() => {
    retry();
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [retry]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      return (await loadSession(forceRefreshToken)).accessToken;
    },
    [loadSession],
  );

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      // Finish any refresh before deleting its cookie, so it cannot restore logout state.
      await pending.current?.catch(() => {});
      const response = await authRequest("sign-out");
      if (!response.ok) throw new Error("Sign-out failed");
      const { url } = (await response.json()) as { url: string };
      setSession(signedOut);
      window.location.assign(url);
    } catch {
      signingOut.current = false;
      setError(true);
    }
  }, []);

  const value = useMemo(
    () => ({ user: session.user, loading, error, fetchAccessToken, retry, signOut }),
    [session.user, loading, error, fetchAccessToken, retry, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
