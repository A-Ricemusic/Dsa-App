<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

After every change, run `bun run typecheck`, `bun run lint`, `bun run format`, and `bun run test` before considering the work complete.

DO NOT MIGRATE FRAMEWORKS WITHOUT THE USER'S EXPLICIT APPROVAL.
This application uses React + Vite with Convex. Authentication changes do not
authorize replacing the frontend framework, build tool, or backend.
