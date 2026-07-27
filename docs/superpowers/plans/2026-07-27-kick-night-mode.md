# Kick Night Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a privacy-first Chrome Manifest V3 extension that provides reliable System, Light, and Dark appearance modes for `use.kick.co`.

**Architecture:** Static manifest content scripts apply a root theme attribute and a scoped stylesheet only on Kick. Dependency-free shared controllers isolate preference, content, and popup behavior so Node's built-in test runner can exercise real behavior without remote packages or browser mocks.

**Tech Stack:** Chrome Extensions Manifest V3, vanilla JavaScript, HTML, CSS, Node.js built-in `node:test`, Node.js asset and validation scripts.

## Global Constraints

- Target only `https://use.kick.co/*`.
- Request only the `storage` extension permission.
- Default to `system`; valid values are exactly `system`, `light`, and `dark`.
- Store only the appearance preference under `kickNightModePreference`.
- Make no remote requests and package all code and assets locally.
- Do not read accounting page content or register page input, click, or form listeners.
- Preserve images, video, canvas, SVG, receipts, uploads, avatars, logos, document viewers, and third-party iframes.
- Disable theme overrides for printing.

## File structure

- `manifest.json`: Chrome MV3 metadata, narrow permissions, content script, stylesheet, popup, and icons.
- `src/theme-core.js`: mode validation and System resolution.
- `src/content.js`: root-attribute controller and Chrome bootstrap.
- `popup/popup.html`: accessible popup structure.
- `popup/popup.css`: popup visual system.
- `popup/popup.js`: storage-backed popup controller and DOM bootstrap.
- `styles/kick-dark.css`: scoped Kick dark theme and safety resets.
- `scripts/generate-icons.mjs`: deterministic raster icon generator.
- `scripts/validate-extension.mjs`: package, manifest, privacy, CSS, and icon validation.
- `test/*.test.cjs`: behavior tests.
- `README.md`: installation, use, privacy, testing, and limitations.

---

### Task 1: Theme preference core

**Files:**
- Create: `package.json`
- Create: `test/theme-core.test.cjs`
- Create: `src/theme-core.js`

**Interfaces:**
- Produces: `VALID_MODES`, `normalizeMode(value)`, and `resolveMode(mode, systemIsDark)`.

- [ ] **Step 1: Write the failing test**

Create tests with literal expectations:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/theme-core.js");

test("invalid stored values fall back to system", () => {
  for (const value of [undefined, null, "", "sepia", 1]) {
    assert.equal(core.normalizeMode(value), "system");
  }
});

test("system resolves from the operating-system preference", () => {
  assert.equal(core.resolveMode("system", true), "dark");
  assert.equal(core.resolveMode("system", false), "light");
  assert.equal(core.resolveMode("dark", false), "dark");
});
```

- [ ] **Step 2: Run `npm test` and verify the test fails because the module is absent.**

- [ ] **Step 3: Implement the minimal universal module**

```js
(function expose(root, factory) {
  const api = factory();
  root.KickNightModeCore = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : this, function createCore() {
  const VALID_MODES = Object.freeze(["system", "light", "dark"]);
  const normalizeMode = (value) => VALID_MODES.includes(value) ? value : "system";
  const resolveMode = (mode, systemIsDark) =>
    normalizeMode(mode) === "system" ? (systemIsDark ? "dark" : "light") : normalizeMode(mode);
  return Object.freeze({ VALID_MODES, normalizeMode, resolveMode });
});
```

- [ ] **Step 4: Run `npm test` and verify both tests pass.**

- [ ] **Step 5: Commit `package.json`, the test, and implementation with message `Add theme preference core`.**

### Task 2: Page theme controller

**Files:**
- Create: `test/content.test.cjs`
- Create: `src/content.js`

**Interfaces:**
- Consumes: `KickNightModeCore.normalizeMode` and `resolveMode`.
- Produces: `createThemeController({ root, mediaQuery, storage, storageChanges })` with `start()` and `stop()`.

- [ ] **Step 1: Write failing tests using real lightweight event fakes.**

Cover these literal outcomes:

```js
assert.equal(root.dataset.kickNightMode, "dark");
assert.equal(root.dataset.kickNightMode, "light");
assert.equal(mediaQuery.listenerCount(), 1);
assert.equal(mediaQuery.listenerCount(), 0);
```

The tests must show that storage changes apply immediately, System follows media changes, explicit Dark stops listening to media changes, and a failed read falls back to System.

- [ ] **Step 2: Run `npm test -- test/content.test.cjs` and verify failure because `createThemeController` is absent.**

- [ ] **Step 3: Implement the controller and bootstrap.**

The controller sets only `root.dataset.kickNightMode`, subscribes to `chrome.storage.onChanged`, and adds/removes the media-query `change` listener as mode changes. Bootstrap with:

```js
createThemeController({
  root: document.documentElement,
  mediaQuery: matchMedia("(prefers-color-scheme: dark)"),
  storage: chrome.storage.local,
  storageChanges: chrome.storage.onChanged
}).start();
```

- [ ] **Step 4: Run the content tests and full test suite; verify all pass.**

- [ ] **Step 5: Commit with message `Apply theme state on Kick pages`.**

### Task 3: Accessible popup

**Files:**
- Create: `test/popup.test.cjs`
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

**Interfaces:**
- Consumes: `KickNightModeCore.normalizeMode`.
- Produces: `createPopupController({ storage, view })` with `start()` and `select(mode)`.
- View contract: `setMode(mode)`, `setSaving(boolean)`, and `setMessage(text, tone)`.

- [ ] **Step 1: Write failing controller tests.**

Verify startup displays the stored mode; selecting Dark writes exactly:

```js
{ kickNightModePreference: "dark" }
```

Verify invalid selections normalize to System, read failures show the System fallback, and write failures restore the previous selection with an error message.

- [ ] **Step 2: Run `npm test -- test/popup.test.cjs` and verify failure for the missing controller.**

- [ ] **Step 3: Implement the controller plus popup DOM.**

Use a `<fieldset>` with three radio inputs and visible labels. Keep the popup at 320px, use semantic dark navy surfaces, show a privacy footer, and bootstrap on `DOMContentLoaded`. Do not use inline scripts, remote assets, or page messaging.

- [ ] **Step 4: Run popup tests and the full suite; verify all pass.**

- [ ] **Step 5: Commit with message `Add appearance popup`.**

### Task 4: Dark theme stylesheet

**Files:**
- Create: `styles/kick-dark.css`
- Create: `test/styles.test.cjs`

**Interfaces:**
- Consumes: `html[data-kick-night-mode="dark"]`.
- Produces: dark visual overrides active only under the root attribute.

- [ ] **Step 1: Write a behavior-oriented CSS contract test.**

Parse each non-`@media print` ruleset and fail if a selector is not rooted at `html[data-kick-night-mode="dark"]`. Assert the computed policy inventory includes explicit safety rules for `img`, `video`, `canvas`, `svg`, `iframe`, receipt/upload/document/avatar/logo class patterns, and a print reset.

- [ ] **Step 2: Run the stylesheet test and verify failure because the stylesheet is absent.**

- [ ] **Step 3: Implement the stylesheet.**

Define semantic custom properties and cover page backgrounds, primary surfaces, navigation, cards, tables, forms, buttons, links, menus, listboxes, dialogs, tooltips, tabs, scrollbars, overlays, toasts, and loading states. Do not use `filter: invert(...)`; preserve media with `filter: none !important` and avoid altering third-party iframe contents.

- [ ] **Step 4: Run stylesheet and full tests; verify all pass.**

- [ ] **Step 5: Commit with message `Style Kick for dark mode`.**

### Task 5: Manifest, icons, and privacy validation

**Files:**
- Create: `test/extension-contract.test.cjs`
- Create: `scripts/generate-icons.mjs`
- Create: `scripts/validate-extension.mjs`
- Create: `manifest.json`
- Generate: `icons/icon-16.png`
- Generate: `icons/icon-32.png`
- Generate: `icons/icon-48.png`
- Generate: `icons/icon-128.png`

**Interfaces:**
- Consumes: all extension source files.
- Produces: a loadable Manifest V3 package and `npm run validate`.

- [ ] **Step 1: Write failing package contract tests.**

Execute `scripts/validate-extension.mjs` and assert exit code `0`. The validator must parse the real manifest, resolve every referenced file, reject permissions other than `storage`, reject host matches other than `https://use.kick.co/*`, reject remote URL literals and dangerous code APIs, and parse PNG headers to confirm 16, 32, 48, and 128 pixel square icons.

- [ ] **Step 2: Run the contract test and verify failure because manifest and validator are absent.**

- [ ] **Step 3: Implement the deterministic icon generator, run it, then create the manifest and validator.**

Use static content scripts in this order:

```json
"js": ["src/theme-core.js", "src/content.js"],
"css": ["styles/kick-dark.css"],
"run_at": "document_start"
```

Declare `"permissions": ["storage"]`, no broad host permissions, and no background worker.

- [ ] **Step 4: Run `npm run validate` and `npm test`; verify all checks pass.**

- [ ] **Step 5: Commit with message `Package Chrome extension`.**

### Task 6: Documentation and final verification

**Files:**
- Modify: `README.md`
- Verify: all tracked extension files.

**Interfaces:**
- Consumes: the completed extension package.
- Produces: user installation and maintenance guidance.

- [ ] **Step 1: Replace the placeholder README with exact steps for `chrome://extensions`, Developer mode, Load unpacked, use, privacy, test commands, limitations, and troubleshooting.**

- [ ] **Step 2: Run `npm test`, `npm run validate`, and `git diff --check`; verify zero failures or whitespace errors.**

- [ ] **Step 3: Inspect `git status --short`, the complete diff, permissions, and generated icon dimensions.**

- [ ] **Step 4: Commit with message `Document Kick Night Mode`.**

- [ ] **Step 5: Push `agent/kick-night-mode` and open a draft pull request into `main` with the validation results.**
