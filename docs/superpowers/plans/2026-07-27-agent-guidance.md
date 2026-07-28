# Agent Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise root `AGENTS.md` that states the extension goal, its non-negotiable guardrails, and the verification command.

**Architecture:** This is a single repository-guidance document with no runtime or test-code changes. It gives agents the project invariant at discovery time and delegates detailed architecture, installation, and testing guidance to the existing README and docs.

**Tech Stack:** Markdown and the existing npm verification suite.

## Global Constraints

- Use the conventional root filename `AGENTS.md`.
- Keep the file limited to one goal sentence and five guardrails.
- Keep the extension scoped to `use.kick.co`.
- Preserve financial media, embedded content, and light printing.
- Add no analytics, remote assets, network requests, or unnecessary permissions.
- Keep appearance changes behind the dark-mode root marker.
- Require `npm run check` before completion.
- Do not alter or commit concurrently staged command-palette work.

---

### Task 1: Root agent guidance

**Files:**
- Create: `AGENTS.md`

**Interfaces:**
- Consumes: the product contract documented in `README.md` and `manifest.json`.
- Produces: repository-wide instructions automatically discovered by coding agents.

- [x] **Step 1: Create the approved root guidance**

Create `AGENTS.md` with exactly:

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

- [x] **Step 2: Verify the document**

Run:

```bash
git diff --check -- AGENTS.md
sed -n '1,80p' AGENTS.md
```

Expected: no whitespace errors, and output contains only the approved goal and
five guardrails.

- [x] **Step 3: Run project verification**

Run: `npm run check`

Expected: unit tests, Playwright tests, and packaged-extension validation pass.
If a concurrent unrelated change causes a failure, report that failure rather
than modifying the unrelated work.

- [x] **Step 4: Commit only the guidance files**

Run:

```bash
git commit --only AGENTS.md docs/superpowers/plans/2026-07-27-agent-guidance.md \
  -m "Add concise agent guidance"
```

Expected: the commit contains only `AGENTS.md` and this completed plan; existing
staged command-palette files remain staged and uncommitted.
