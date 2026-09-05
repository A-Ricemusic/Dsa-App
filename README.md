# Recall

A private data structures and algorithms practice journal built with React, Vite, Tailwind CSS, Convex, and WorkOS AuthKit.

## Local setup

Install dependencies:

```bash
bun install
```

Copy `.env.example` to `.env.local`. Keep the existing Convex values and add:

```bash
CONVEX_DEPLOYMENT=dev:your-deployment
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_SITE_URL=https://your-deployment.convex.site
WORKOS_CLIENT_ID=client_your_client_id
WORKOS_REDIRECT_URI=http://localhost:5173/callback
WORKOS_API_KEY=sk_test_your_api_key
WORKOS_COOKIE_PASSWORD=replace_with_at_least_32_random_characters
```

In the WorkOS dashboard, configure the application with:

- Redirect URI: `http://localhost:5173/callback`
- Sign-in URL: `http://localhost:5173/sign-in`
- Logout redirect: `http://localhost:5173`

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

`vercel.json` configures Bun installation, the Vite build, the server-only Vercel
authentication function, and the existing Convex deployment step. Add these
environment variables to the Vercel project:

- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI` (for example, `https://your-domain.com/callback`)
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`

The Vercel build supplies `CONVEX_URL` through the existing Convex deploy
command. Keep `WORKOS_COOKIE_PASSWORD` unchanged across deployments; changing it
invalidates existing application sessions.

In WorkOS, add the production callback (`https://your-domain.com/callback`),
sign-in URL (`https://your-domain.com/sign-in`), and logout redirect
(`https://your-domain.com`). Set only `WORKOS_CLIENT_ID` on the corresponding
Convex deployment. `WORKOS_API_KEY` and `WORKOS_COOKIE_PASSWORD` belong in the
application server environment on Vercel, not in Convex.

## Authentication and routing

The frontend remains a client-rendered React + Vite app. Convex remains the data
backend and verifies WorkOS access tokens using `convex/auth.config.ts`.

`server/auth.ts` uses the official [WorkOS Node SDK session helpers](https://workos.com/docs/reference/authkit/session-helpers)
for encrypted sessions, JWT verification, PKCE login, and token refresh. The
same handler runs through Vite in development/preview and through
`api/auth/[action].ts` as a Vercel Function in production. No Next.js or additional
hosted server is needed. A static-only host would not run this authentication function.

The refresh token stays inside an encrypted, HttpOnly, SameSite=Lax cookie on
the application origin, with Secure enabled for HTTPS. Only a short-lived access
token and basic user information reach the React app; neither token is written
to localStorage. The existing `wos-session` cookie name and cookie password are
retained. No browser-data clearing or legacy-storage migration is required.

- `/sign-in` starts WorkOS login; `/callback` finishes it and returns to `/`.
- POST `/api/auth/session` restores the session before rendering signed-in/out UI.
- POST `/api/auth/refresh` refreshes tokens when Convex requests them.
- POST `/api/auth/sign-out` clears the cookie and returns WorkOS's logout URL.

Session endpoints require same-origin requests and a custom header, never allow
CORS, and return `Cache-Control: no-store`. Login uses a ten-minute encrypted
state/PKCE cookie. Temporary network/WorkOS errors preserve the session and show
a retry state; terminal session failures require login again.

Refreshes and new builds do not themselves invalidate sessions. Keep the public
hostname, WorkOS application, and `WORKOS_COOKIE_PASSWORD` stable across deployments.
No custom WorkOS domain is required. The browser cookie's 400-day retention does
not override WorkOS's session policies.

SPA routes are resolved in `src/lib/routes.ts`; unknown paths show “Page not found.”
Vercel serves the SPA shell for page URLs (HTTP 200, as with a normal static SPA),
while unknown authentication endpoints return HTTP 404. There is no per-page auth
middleware allowlist to maintain.

WorkOS session maximum lifetime and inactivity timeout are controlled in the
WorkOS dashboard. Set those values to the desired product policy; the app refreshes
valid sessions automatically but cannot override an administrator revocation or a
provider-enforced maximum lifetime.

## Commands

```bash
bun run dev        # Vite frontend and server-side auth on port 5173
bun run dev:convex # Convex development sync
bun run typecheck  # Strict TypeScript check
bun run build      # Production build
bun run preview    # Test the built frontend with the same auth handler locally
```
