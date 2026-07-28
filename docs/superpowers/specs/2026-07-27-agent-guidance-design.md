# Agent Guidance — Design

## Goal

Add a root `AGENTS.md` that tells coding agents what Kick Night Mode is and
which constraints must remain true, without duplicating the README or detailed
development documentation.

## Content

The file contains:

- one sentence defining the extension as a private, permission-free,
  toggleable dark theme for `use.kick.co`;
- five concise guardrails covering host scope, protected financial media and
  printing, prohibited external behavior and permissions, dark-root CSS
  scoping, and the required verification command; and
- no architecture walkthrough, installation guide, or task-specific workflow.

## Exact guidance

```md
# Project Goal

Kick Night Mode is a private, permission-free Chrome extension that gives
`use.kick.co` a polished, toggleable dark theme without reading or changing
accounting data.

## Guardrails

- Keep the extension scoped to `use.kick.co`.
- Preserve images, documents, charts, embedded content, and light printing.
- Add no analytics, remote assets, network requests, or unnecessary permissions.
- Keep appearance changes behind the dark-mode root marker.
- Run `npm run check` before completing changes.
```

## Acceptance criteria

- The repository root contains `AGENTS.md`.
- The file matches the approved guidance exactly.
- The content is concise and consistent with the manifest and README.
- Existing unrelated working-tree changes remain untouched.
