# Recall

A private data structures and algorithms practice journal built with React, Next.js, Tailwind CSS, Convex, and WorkOS AuthKit.

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

`vercel.json` configures Bun installation, the Next.js build, and the existing Convex deployment step. Add these environment variables to the Vercel project:

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

Authentication uses WorkOS's official Next.js server integration. It stores the
refresh token inside an encrypted `HttpOnly`, `Secure`, `SameSite=Lax` cookie on
the application origin. Browser JavaScript receives only a short-lived access
token when Convex needs one. The first load also removes refresh tokens left by
the old browser `devMode` implementation.

AuthKit reads and refreshes the application-owned session in Next.js proxy
middleware. Refreshing a nested route or deploying a new build does not itself
invalidate that session, and no custom WorkOS domain is required.

WorkOS session maximum lifetime and inactivity timeout are controlled in the
WorkOS dashboard. Set those values to the desired product policy; the app refreshes
valid sessions automatically but cannot override an administrator revocation or a
provider-enforced maximum lifetime.

## Commands

```bash
bun run dev        # Next.js frontend and auth server on port 5173
bun run dev:convex # Convex development sync
bun run typecheck  # Strict TypeScript check
bun run build      # Production build
```
