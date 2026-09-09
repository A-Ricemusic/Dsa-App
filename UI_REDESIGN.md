# UI review and redesign

The redesign uses a compact top navigation, shared tables, restrained color, and plain section dividers to make the practice data easier to scan.

## Review findings and changes

| Area                     | Finding                                                                                           | Change                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Navigation               | A 272px sidebar, promotional content, and duplicate mobile navigation consumed space.             | One responsive navigation bar with visible destinations, theme control, and sign-out.                                              |
| Overview                 | A large greeting banner and separate statistic cards pushed useful data down the page.            | Compact heading, inline statistics, review queue, and recent problems table.                                                       |
| Review queue             | A colored summary card exposed only the next problem.                                             | Three immediately accessible problems and a direct action to open the full filtered queue.                                         |
| Problems                 | Large filter containers, separate desktop/mobile markup, and rigid columns made scanning harder.  | A shared semantic table, readable names, compact filter controls, and collapsible mobile filters.                                  |
| Categories               | Individual cards, decorative icons, and arbitrary progress bars obscured simple counts.           | A table of names, counts, and types with an inline creation form and visible removal controls.                                     |
| Problem details          | Statistics and each attempt lived in separate cards.                                              | Inline metadata and a continuous attempt history with note previews.                                                               |
| Attempt details          | Repeated problem information and a decorative context card competed with notes.                   | A readable notes column, short metadata strip, and quiet problem details.                                                          |
| Forms                    | Nested cards, generous padding, and square grade buttons made forms unnecessarily long.           | Plain sections, compact grade controls, sticky actions, explicit selection states, and native modal dialogs.                       |
| Sign-in and empty states | Decorative layers, low-contrast lime text, and warning icons added noise.                         | Simple copy, a clear sign-in action, an explicitly labeled example journal, and neutral empty states.                              |
| Theme and accessibility  | Small labels, weak dark-mode action contrast, and limited modal focus handling reduced usability. | Larger labels, accessible accent text, keyboard focus indicators, a skip link, native modal focus handling, and focus restoration. |

## Workspace

- Branch: `redesign/minimal-ui`
- Worktree: `../dsa-tracker-minimal-ui`
- Baseline commit: `33f504c` snapshots the existing uncommitted framework migration so the redesign builds on the current application.
- Main integration: `44c3cdf` brings the Vite runtime, server-managed WorkOS session cookies, route validation, and normalized category-name index into the redesign.
- Development preview: run `bun run dev` in this worktree (port 5173, matching the configured WorkOS callback).

## Verification

- `bun run typecheck`
- `bun run lint`
- `bun run format`
- `bun run test`: 77 tests, including server authentication, session restoration and retry, route validation, review-queue navigation, shared-table navigation, and combined search/reset behavior.
- `bun run build`: successful production build.
- Browser checks cover populated and empty states, desktop/tablet/mobile layouts, light/dark themes, filter interaction, form submission with local fixtures, editing, keyboard dismissal, backdrop dismissal, and focus restoration.
- Local sample data and browser artifacts live in the ignored `.cache/ui-review/` directory. Sample records are isolated from the application's database.

The existing backend APIs, authentication flow, and data model continue to support the redesigned interface. Browser interaction checks use Chromium; automated accessibility checks supplement the visual review.

The follow-up [application audit](AUDIT.md) documents pagination, draft preservation, recovery, keyboard fixes, development health evidence, and merge-readiness limits.
