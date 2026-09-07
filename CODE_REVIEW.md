# Security and regression review — September 7, 2026

**Recommendation: request changes before merging.** I found three medium-priority functional regressions and one low-priority responsive-layout regression. No exploitable authentication bypass, cross-owner data exposure, or script-injection vulnerability was found in the reviewed paths. The earlier September 4 audit and subsequent “code ready” assessment missed the edge cases below; this review supersedes that merge recommendation.

Reviewed PR #2, `redesign/minimal-ui`, commit `bca8c8e`, against `origin/main` at `44c3cdf`. This was a code review and local verification pass: application code is unchanged, no deployments or Vercel CLI commands were run, and no real journal records were created or modified.

## Findings

### R1 — P2: Re-entering pagination discards drafts and filters

Locations: `src/lib/useCompleteQuery.ts:18`, `src/App.tsx:108`, `src/App.tsx:129`, `src/App.tsx:157`, and `src/components/AttemptPage.tsx:28`.

The new hook returns `undefined` for every status except `Exhausted`, including after a collection was already displayed. Convex can resume loading while repairing pagination—for example, a required page split or invalid-cursor recovery. Its installed `use_paginated_query.ts` explicitly returns a loading status in those cases.

When any parent collection enters that state, `Tracker` replaces the route with a spinner and computes an empty `problems` array. That unmounts problem/attempt pages and their local drafts or filters. A problem editor stays mounted, but receives `problem={undefined}`, switches from editing to creating, and clears its fields. On recovery it initializes again from persisted values. An attempt page also unmounts its form when its own attempt query returns to loading.

Three isolated reproductions confirmed: an unsaved problem name became empty and then reverted to the stored name; unsaved attempt notes disappeared; and a library search was cleared. These probes simulate supported pagination states; they do not claim ordinary same-record updates always trigger this issue or that a live required split was induced on the user's deployment.

**Recommended fix:** distinguish initial loading from background pagination recovery, preserve mounted route/form state, and retain the editor's target independently of a temporarily unavailable joined array. If retaining a previous complete snapshot, scope it to the query arguments and authenticated owner; never reuse it across accounts or problem IDs. Add tests for `Exhausted → LoadingMore/LoadingFirstPage → Exhausted` while editing/filtering.

### R2 — P2: A pending offline save traps the user in the dialog

Locations: `src/components/Primitives.tsx:42`, `src/components/Primitives.tsx:48`, `src/components/Primitives.tsx:65`, `src/components/AttemptForm.tsx:46`, and `src/components/ProblemForm.tsx:86`.

The new busy state disables Cancel, the close button, Escape, backdrop dismissal, and the form fields until the mutation promise settles. Convex queues mutations across a lost connection; its request manager retains the pending promise and resends the mutation on reconnection. A failed connection does not necessarily reject that promise promptly.

Consequently, submitting while offline—or losing connectivity during save or inline category creation—can leave the entire application behind an inert modal with no way to dismiss it, navigate, or sign out through the UI. Main allowed dismissal while a save was pending. The existing test verifies that dismissal is blocked briefly, but never covers an indefinitely pending operation.

An isolated test and the actual local frontend with a pending test mutation confirmed that Escape and clicking the backdrop leave the dialog open and both dismissal buttons disabled.

**Recommended fix:** show connection/pending status and provide a safe dismissal path while retaining the draft/request state and preventing duplicate submission. Guard late completion callbacks so an older request cannot close a newly opened editor. A UI timeout alone must not claim the backend mutation was canceled; it may still commit after reconnection.

### R3 — P2: A deleted category remains invisibly selected and blocks saving

Locations: `src/components/ProblemForm.tsx:54`, `src/components/ProblemForm.tsx:59`, and `src/components/ProblemForm.tsx:116`.

The new initialization guard correctly preserves text drafts across same-record updates, but it also prevents reconciliation of selected category IDs. If a selected category is deleted in another tab while the editor is open, that category disappears from the visible choices while its ID remains in the local `selected` set. Saving submits the deleted ID; the backend correctly rejects it as unavailable. The UI has no remaining button to deselect that ID, so the user must close/reopen and lose their draft to recover normally.

A reproduction removed the category from both current props and the category list while retaining the problem ID. The category button disappeared, “1/12 selected” remained, and the update still included the deleted ID. Main's previous reinitialization removed the obsolete selection, albeit with its own draft-reset drawback.

**Recommended fix:** reconcile category selections separately from draft text when a complete category collection changes, or show unavailable selections with an explicit removal action. Preserve the text draft and do not mistake temporary pagination/loading gaps for confirmed deletion. Add a delete-in-another-tab editor test.

### R4 — P3: Attempt counts disappear at intermediate mobile widths

Locations: `src/styles.css:623`, `src/styles.css:642`, and `src/components/ProblemList.tsx:46`.

The desktop attempt-count column is hidden below 768px, while its mobile replacement only becomes visible below 480px. Between 480px and 767px, neither is shown. Main's mobile layout displayed attempt counts throughout that range.

At 600px in the running local frontend, both `.attempts-column` and `.mobile-problem-meta` computed to `display: none`; the screenshot confirms no count is available in the library row. The shared component also affects the overview's recent-problem table.

**Recommended fix:** align the count visibility breakpoints while avoiding duplicate difficulty labels. Cover at least one intermediate width, such as 600px, with a visibility assertion rather than only overflow/accessibility checks.

## Security review

| Area                                | Evidence and result                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication and session handling | Server auth, frontend auth adapter, API route handler, JWT provider configuration, and hosting configuration are byte-for-byte unchanged from main. Reviewed sealed HttpOnly cookies, HTTPS Secure behavior, expiring PKCE/state verification, no-store responses, refresh handling, and logout behavior. Existing tests cover encrypted session restoration, refresh, terminal/transient failures, PKCE, and logout. No changed-path bypass found. |
| Cross-account authorization         | All public Convex entry points use server-derived identity. Reads use an owner index or first validate the parent. Writes validate the target document and referenced parent/categories. The `tokenIdentifier` ownership convention is preserved. Cleanup functions remain internal.                                                                                                                                                                |
| New query endpoints                 | Extra probes verified empty results for another identity, including equal subject strings from different issuers; a stolen pagination cursor did not expose the other identity's records. Unauthenticated access is rejected by the existing pagination tests.                                                                                                                                                                                      |
| Foreign-key writes and rollback     | Existing tests and extra probes reject attaching another owner's category or writing an attempt to another owner's problem. The failed transaction leaves no new problem behind.                                                                                                                                                                                                                                                                    |
| XSS and external links              | URL validation rejects `javascript:`, `data:`, and `file:` schemes. User text is rendered as React text, without `dangerouslySetInnerHTML` or HTML parsing. A notes payload containing `<img ... onerror=...>` remained literal text in the local browser and created no image element or alert. External links retain `rel="noreferrer"`.                                                                                                          |
| Browser-facing auth endpoints       | Actual localhost requests returned 401 for a signed-out session, 403 without the required request header, 405 for the wrong method, and 404 for an unknown action; each response was `no-store`. Exact Origin enforcement was also inspected in code and is covered by server tests.                                                                                                                                                                |
| Credentials and dependencies        | No environment files were added by this PR. The Vite configuration still explicitly exposes only the public Convex URL; the WorkOS server configuration is not imported by client code. Package manifest and lockfile are unchanged from main. Fresh `bun audit --json` returned `{}`. This does not establish the absence of unknown vulnerabilities.                                                                                              |
| Resource use                        | Indexed pagination improves correctness over the old truncation, but the UI still downloads and renders the entire personal library. Requests remain subject to Convex limits, and total browser/network work grows with account size. This is a scalability limitation, not a demonstrated cross-account exploit. No quota bypass or denial-of-service load test was performed.                                                                    |

No suspicious identity-from-argument, unchecked document write, public sensitive-data-by-ID query, or unchecked parent-reference write remained after following shared authorization helpers. This is source review plus targeted negative testing, not a penetration-test certification of deployed infrastructure.

## Functionality and local app verification

The running server at `http://localhost:5173/` was used; no replacement server was started. A fresh isolated Chromium browser had no user session. Signed-out behavior used the real local auth endpoints. To inspect authenticated screens safely, browser-only request interception substituted test auth/data adapters while loading the actual app entry point, routes, components, and stylesheet from port 5173. No source code or deployment was changed by those adapters.

The browser exercised:

- Overview → library → problem → attempt navigation, plus missing-route recovery.
- Problem creation without a first attempt, editing, and deletion.
- Attempt creation, note editing, deletion, and history navigation.
- Category creation/removal and library grade filtering.
- Literal rendering of an HTML-like notes payload.
- Desktop, 600px, and 390px layouts; light and dark themes; normal and pending forms.
- Real signed-out session handling and a simulated transient session failure followed by retry through the real endpoint.

The ten captured states reported no axe WCAG A/AA violations, horizontal page overflow, or page errors. Those results do **not** negate R2 or R4: neither an indefinitely blocked workflow nor an omitted data field is reliably detected by axe or an overflow check.

UI mutation calls and fixture state updates were verified in the browser; backend persistence, summaries, authorization, and cleanup were verified separately through `convex-test`. These are not represented as a live authenticated end-to-end test. Real WorkOS login, production data/configuration, manual assistive-technology testing, and Safari/Firefox remain outside verified coverage.

## Reproducible checks and artifacts

- `bun run typecheck`, `bun run lint`, `bun run format`, `bun run test`, and `bun run build`: passed; original suite remains **77 tests in 13 files**.
- `bun audit --json`: no reported advisories.
- `git diff --check`: passed.
- Five isolated regression probes assert the **observed buggy behavior** for R1–R3. Their passing result means the defects were reproduced, not that those behaviors are correct.
- Two additional backend probes verify issuer/cursor isolation, referenced-owner rejection, rollback, executable URL rejection, and literal note storage.
- `bun x vitest run --config .cache/security-review/vitest.config.ts`
- `bun x vitest run --config .cache/security-review/backend.config.ts`
- `node .cache/ui-review/local-security-check.mjs`
- `node .cache/ui-review/local-app-review.mjs`
- Browser results and screenshots: `.cache/security-review/` (ignored local review artifacts).

The current committed suite does not cover background pagination after completion, category deletion during an open editor, indefinitely pending/offline mutation recovery, or count visibility at intermediate widths. Fix R1–R3 before merge, add regression coverage for their expected corrected behavior, and address the small R4 breakpoint defect. Then rerun the required checks and local flows. No application fixes were applied during this review.
