# Recall

A private data structures and algorithms practice journal built with React, Vite, Tailwind CSS, Convex, and WorkOS AuthKit.

## Local setup

Install dependencies:

```bash
bun install
```

Copy `.env.example` to `.env.local`. Keep the existing Convex values and add:

```bash
CONVEX_URL=https://your-deployment.convex.cloud
WORKOS_CLIENT_ID=client_your_client_id
WORKOS_REDIRECT_URI=http://localhost:5173/callback
WORKOS_API_KEY=sk_your_api_key
WORKOS_COOKIE_PASSWORD=replace_with_at_least_32_random_characters
```

In the WorkOS dashboard, configure the application with:

- Redirect URI: `http://localhost:5173/callback`
- Sign-in URL: `http://localhost:5173/login`
- Allowed CORS origin: `http://localhost:5173`

Add the same WorkOS client ID to the existing Convex development deployment:

```bash
bunx convex env set WORKOS_CLIENT_ID client_your_client_id
```

Then run the backend and frontend in separate terminals:

```bash
bun run dev:convex
bun run dev
```

## Vercel

`vercel.json` configures Bun installation, the Vite build, and SPA routing. Add these environment variables to the Vercel project:

- `CONVEX_URL`
- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI` (for example, `https://your-domain.com/callback`)
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD` (generate once with `openssl rand -base64 32`)

Also add the production callback, `/login` sign-in URL, and production origin to WorkOS. Set `WORKOS_CLIENT_ID` on the production Convex deployment before deploying its functions.

Production authentication uses a same-origin Vercel Function and a sealed,
`HttpOnly`, `Secure`, `SameSite=Lax` cookie. The access token exists only in
memory and the rotating refresh token is never exposed to application JavaScript.
On the first deployment of this version, an existing AuthKit `devMode` session is
migrated to the protected cookie before its legacy local-storage token is removed,
so the rollout does not force a sign-in. Keep `WORKOS_COOKIE_PASSWORD` stable:
changing or deleting it invalidates existing cookies. Vercel preview URLs are
separate origins and intentionally do not share the production session.

WorkOS session maximum lifetime and inactivity timeout are controlled in the
WorkOS dashboard. Set those values to the desired product policy; the app refreshes
valid sessions automatically but cannot override an administrator revocation or a
provider-enforced maximum lifetime.

## Commands

```bash
bun run dev        # Vite frontend
bun run dev:convex # Convex development sync
bun run typecheck  # Strict TypeScript check
bun run build      # Production build
```
