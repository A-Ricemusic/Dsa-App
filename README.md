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
```

In the WorkOS dashboard, configure the application with:

- Redirect URI: `http://localhost:5173/callback`
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

- `WORKOS_CLIENT_ID`
- `WORKOS_REDIRECT_URI` (for example, `https://your-domain.com/callback`)

The Vercel build supplies `CONVEX_URL` through the existing Convex deploy
command. No WorkOS API key or application-owned cookie password is required.

Add the production callback and production origin to WorkOS. Set
`WORKOS_CLIENT_ID` on the production Convex deployment before deploying its
functions. A `/callback` server function is not needed: Vercel serves the SPA and
AuthKit React completes the callback in the browser.

Production authentication uses AuthKit React's cookie mode. The SDK keeps the
access token in memory and refreshes it through the WorkOS-managed session cookie;
the app does not need a WorkOS API key or its own cookie password. Development
uses the SDK's documented `devMode` only while Vite is running in development.
The first production load also removes refresh tokens left by the old forced
`devMode` configuration.

AuthKit restores a valid cookie-backed production session when the application
loads. Refreshing the page or deploying a new JavaScript bundle does not itself
invalidate that session. WorkOS supports a custom Authentication API domain,
but this application does not require an additional hostname environment
variable for session restoration.

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
