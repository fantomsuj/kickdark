# Kick Night Mode Audit — 2026-07-28

## Outcome

The extension stylesheet and regression suite were hardened against the
theme-induced failures found during the live and fixture audit. The critical
print failure, boxed icon controls, task-checkbox distortion, responsive
fixture overflow, mobile-unavailable glare, and broad selector overmatching
now have targeted fixes and automated coverage.

The committed images in `screenshots/` are deterministic, sanitized structural
evidence. They contain no account data or identifiers. They are not presented
as authenticated screenshots. Authenticated recapture remains a manual
privacy-gated step because the currently available tenant was not independently
confirmed as the designated disposable dummy tenant.

## Findings

### P0 — Resolved: dark print colors survived on white paper

Dark foreground tokens remained active after print backgrounds were made white,
making printed Tasks and reports unreadable. Print media now remaps every dark
token to a light-print palette and applies a high-specificity dark-on-white
fallback. Protected images, charts, documents, canvases, video, and embeds
retain their original rendering.

### P1 — Resolved: bare icon actions became heavy bordered boxes

The former blanket button rule flattened plus, chat, settings, expand, close,
and similar icon actions into the same bordered hierarchy. Captured app-shell,
table-row, transaction, main-content, footer, and dialog icon families are now
near-white, transparent, and borderless at rest. Hover, expanded, and
focus-visible states use the theme hover surface and accent focus treatment.

### P1 — Resolved: task checkbox geometry changed in dark mode

Custom appearance, forced dimensions, and an inset check treatment were
removed. Kick retains ownership of checkbox shape and size; the extension now
only supplies `accent-color`. Regression coverage compares light/dark geometry
and protects unclassified checkbox dimensions from future overrides.

### P1 — Resolved in code: mobile-unavailable glare and overflow

The 375 px live fallback was observed with a white surface and nearly invisible
secondary copy. A captured structural selector now themes the blocker, heading,
copy, and action without relying on generated class names. The sanitized
375×812 and 768×1024 cases are fully dark, readable, and free of horizontal
overflow. Final authenticated recapture requires reloading the unpacked
extension in Chrome first.

### P1 — Resolved: compact evidence rendered an artificial desktop shell

The fixture shell's 1180 px minimum was removed. It now uses responsive
248/76/56 px navigation columns and flexible content at 1440, 1024, 768, and
375 px. Horizontal overflow is asserted at all four widths.

### P2 — Resolved: broad selectors overmatched unrelated Kick components

Blanket `header`, `section`, `button`, `[role="status"]`, table-descendant,
heading, label, and checkbox-geometry styling was replaced with
capture-supported control and surface families. Negative regression tests prove
that an unclassified section, status region, table descendant, icon button, or
checkbox keeps its host geometry and hierarchy.

### P2 — Inventory complete; authenticated evidence pending

Firm Profile, Task groups, and onboarding are now explicit cases in
`case-manifest.json` rather than silent route omissions. They deliberately have
no fixture or screenshot claim until a designated dummy tenant can be used to
capture and sanitize those surfaces.

## Evidence and coverage

- Manifest version: 1
- Audited cases: 36
- Sanitized fixture-backed cases: 33
- Explicit live-only pending cases: 3
- Deterministic paired images: 132
- Desktop evidence widths: 1440×900 and 1024×900
- Mobile fallback evidence widths: 375×812 and 768×1024
- Protected families: images, charts, documents, canvases, video, iframes,
  objects, and embeds

The manifest drives fixture generation, test enumeration, screenshot naming,
theme pairing, and viewport bounds. The previous 64 low-value fixed-shell
full-page snapshots were removed.

Automated audits cover computed text, form-boundary and SVG/icon contrast;
focus indication; dark surface glare; icon rest hierarchy; task-checkbox
geometry; responsive overflow; print colors; media preservation; root-marker
scoping; selector evidence; and negative selector matching.

## Privacy and live-review boundary

The authenticated app was inspected read-only to confirm the mobile defect.
No application records were created, changed, or deleted. No raw DOM, URL,
cookie, storage state, browser chrome, account name, or capture metadata was
committed.

To close the remaining manual evidence items:

1. Confirm the browser is connected to the designated dummy tenant.
2. Reload the unpacked extension so Chrome picks up the new stylesheet.
3. Recapture the manifest matrix in light and dark, including Profile, Task
   groups, and onboarding.
4. Review console output and first paint for new errors or a light flash.
5. Remove any disposable records and verify cleanup if interaction states
   require creating them.

Upstream semantic or accessible-name defects should be recorded separately;
the extension remains appearance-only.
