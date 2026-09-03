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

Also add the production callback, `/login` sign-in URL, and production origin to WorkOS. Set `WORKOS_CLIENT_ID` on the production Convex deployment before deploying its functions.

## Commands

```bash
bun run dev        # Vite frontend
bun run dev:convex # Convex development sync
bun run typecheck  # Strict TypeScript check
bun run build      # Production build
```
