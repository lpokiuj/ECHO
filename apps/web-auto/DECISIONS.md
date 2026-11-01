# DECISIONS (orchestrator log)

## Feature 2: Design foundation

### D-001 Accent color
- Question: which single accent for the neutral theme (PLAN: Brand, none supplied)?
- Options: (a) deep teal; (b) indigo; (c) wait for brand colors.
- Choice: (a) deep teal, text/background pairs checked for AA (>= 4.5:1). Token-only, swappable.
- Reasoning: no brand given; smaller scope than waiting; reversible. Reversible: yes. Asked by: B.
- Revisit? yes, when brand colors exist.

### D-002 tw-animate-css
- Question: shadcn CLI may add `tw-animate-css`, not on the approved list.
- Options: (a) remove it, hand-write keyframes in index.css; (b) ask to approve; (c) skip animations.
- Choice: (a). Approved dependency list stays unchanged.
- Reasoning: CLAUDE.md forbids unlisted deps; keeps animation. Reversible: yes. Asked by: B.

### D-003 Dev-only "Desain" nav link
- Question: /design is required but not in the screens table; add a nav link?
- Options: (a) link in shell nav, removed in feature 10; (b) URL only.
- Choice: (a), flagged dev-only; feature 10 must remove link and route together.
- Reasoning: required route needs to be reachable for review; trivial to remove. Reversible: yes. Asked by: B.

### D-004 shadcn generation method (feature 2) — supersedes part of D-002
- Question: how to produce shadcn files after the failed `init -d -y`?
- Options: (a) `init --base radix` with flags; (b) hand-write components.json (Radix) then `shadcn add --dry-run`, review, `add` without -y; (c) hand-write all components.
- Choice: (b). Check every dry-run/view for `@base-ui` and Geist; fallback to (c) per component. Reversible: yes. Asked by: B.
- D-002 superseded: user approved `tw-animate-css` and `shadcn` (already on PLAN.md list), so CLI animation classes are kept; no hand-written keyframes needed.

### D-005 Style value, accent hex, token format, pre-auth header
- components.json style: read from CLI `--dry-run`/help; fall back to "new-york" Radix. Verify no Base UI imports. Reversible: yes.
- Accent: primary ~#0f766e (confirmed by contrast test >= 4.5). Hex values allowed in index.css `:root` only (not in src/components, src/features). Reversible: yes.
- Shell header before auth: logo/title + menu button only; user menu arrives in feature 4. Reversible: yes. Asked by: B.

### D-006 Components via `shadcn view`, not `add` (feature 2)
- Question: `add --dry-run` showed it would install unapproved `cn` and `next-themes`.
- Options: (a) accept them; (b) take source via `shadcn view` and write files by hand; (c) abort shadcn.
- Choice: (b), made by B and accepted by me. Approved list unchanged. (`cn@0.2.6` appears only as a transitive dependency of the approved `shadcn` package.) Reversible: yes. Asked by: B (deviation).

### D-007 axe not run with Radix Select open; Desain dev badge (feature 2)
- Open Select state is skipped in axe (aria-hidden-focus false positive from Radix); accepted, axe runs before/after. Revisit in feature 10 hardening. Reversible: yes.
- "dev" badge on Desain link kept until feature 10 (D-003). Reversible: yes. Asked by: B.

## Feature 3: API client and session core

### D-008 401 on change-password
- Question: treat it as wrong password always, or only if token is recent?
- Options: (a) always wrong password (PLAN.md says so); (b) track lastTokenAt; (c) verify via GET /me.
- Choice: (a). Reasoning: PLAN.md already decides it; simplest; a dead session surfaces on the next call. Reversible: yes. Asked by: B.

### D-009 Types scope and ESLint guard
- Types: only what each feature needs, appended to the single `src/api/types.ts`. Reversible: yes.
- SECURITY: add ESLint `no-restricted-globals`/`no-restricted-properties` for localStorage (config only, no dependency). Stricter option chosen. Reversible: yes. Asked by: B.
