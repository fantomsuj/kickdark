# Command Palette Dark-Mode Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Command-K palette's white Home pill and shortcut keycaps with scoped dark-theme surfaces.

**Architecture:** Model the palette with a privacy-safe sanitized fixture, reproduce Kick's surviving light keycap declarations in the fixture shell, and protect the behavior with computed-style assertions. Add one semantic `kbd` rule scoped to dark dialogs; avoid generated classes and broad descendant overrides.

**Tech Stack:** Manifest V3 extension CSS, sanitized HTML fixtures, Node.js test runner, Playwright.

## Global Constraints

- Preserve the existing night-mode palette byte-for-byte.
- Preserve the existing blue focus and selection accents.
- Do not change runtime JavaScript, the manifest, permissions, or activation behavior.
- Scope production CSS behind `html[data-kick-night-mode="dark"]`.
- Do not use generated CSS-module class names or fixture-only attributes in production selectors.
- Keep account data, page copy, values, URLs, and identifiers out of tracked fixtures.

---

### Task 1: Add a failing Command-K keycap regression

**Files:**
- Modify: `scripts/build-sanitized-fixtures.mjs`
- Create: `test/fixtures/command-palette.html` through the fixture builder
- Modify: `test/fixtures/capture-manifest.json` through the fixture builder
- Modify: `test/fixtures/selector-inventory.json` through the fixture builder
- Modify: `test/fixtures/fixture-shell.css`
- Modify: `test/styles.test.cjs`
- Modify: `test/visual/theme.spec.cjs`

**Interfaces:**
- Consumes: the fixture builder's `{ version, route, surface, html, selectorCandidates }` capture contract.
- Produces: a `command-palette` fixture containing a dialog, current Home `kbd`, and shortcut `kbd` elements for rendered style tests.

- [ ] **Step 1: Register the sanitized fixture**

Add `"command-palette"` after `"dialog-menu-form"` in the `fixtureNames` array
in `scripts/build-sanitized-fixtures.mjs`.

Create the gitignored `.context/captures/command-palette.json` builder input:

```json
{
  "version": 1,
  "route": "accounts",
  "surface": "command-palette",
  "html": "<div role=\"dialog\" tabindex=\"-1\" data-kick-night-fixture-surface=\"command-palette\"><div><kbd aria-current=\"page\" data-kick-night-test-text=\"normal\"></kbd><button type=\"button\"></button></div><input type=\"text\"><div role=\"listbox\"><div role=\"option\" aria-selected=\"true\"><span data-kick-night-test-text=\"normal\"></span><kbd data-kick-night-test-text=\"normal\"></kbd></div><div role=\"option\" aria-selected=\"false\"><span data-kick-night-test-text=\"normal\"></span><kbd data-kick-night-test-text=\"normal\"></kbd></div></div></div>",
  "selectorCandidates": [
    "[aria-current=\"page\"]",
    "[aria-selected=\"false\"]",
    "[aria-selected=\"true\"]",
    "[role=\"dialog\"]",
    "[role=\"listbox\"]",
    "[role=\"option\"]",
    "[tabindex=\"-1\"]",
    "[type=\"button\"]",
    "[type=\"text\"]",
    "button",
    "div",
    "input",
    "kbd",
    "span"
  ]
}
```

Run:

```bash
npm run fixtures:build
```

Expected: the command succeeds and creates the tracked fixture, manifest entry,
and selector inventory without unsanitized content.

- [ ] **Step 2: Reproduce Kick's surviving light keycap styles**

Append this authenticated-surface model to `test/fixtures/fixture-shell.css`:

```css
[data-kick-night-fixture-surface="command-palette"] kbd {
  display: inline-flex;
  padding: 3px 7px;
  color: #515d71;
  border: 1px solid #d9dde2;
  border-radius: 5px;
  background: #ffffff;
}
```

- [ ] **Step 3: Register the fixture in contract and visual tests**

Add this entry to the expected fixture map in `test/styles.test.cjs`:

```js
"command-palette": {
  route: "accounts",
  surface: "command-palette"
},
```

Add `"command-palette"` to `fixtureNames` in `test/visual/theme.spec.cjs`.

Add this focused regression:

```js
test("Command-K Home pill and shortcut keycaps use dark surfaces", async ({
  page
}) => {
  await loadFixture(page, "command-palette");

  const keycaps = await page.locator('[role="dialog"] kbd').evaluateAll(
    (elements) =>
      elements.map((element) => ({
        current: element.getAttribute("aria-current"),
        color: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderTopColor
      }))
  );

  expect(keycaps).toEqual([
    {
      current: "page",
      color: "rgb(244, 247, 251)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    },
    {
      current: null,
      color: "rgb(183, 192, 206)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    },
    {
      current: null,
      color: "rgb(183, 192, 206)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    }
  ]);
});
```

Add the fixture to the glare-band map:

```js
"command-palette": '[role="dialog"] kbd',
```

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
npx playwright test test/visual/theme.spec.cjs --grep "Command-K Home pill"
```

Expected: FAIL because the computed keycap background is
`rgb(255, 255, 255)` and the foreground/border still use light-theme colors.

---

### Task 2: Add the minimal semantic dark-theme rule

**Files:**
- Modify: `styles/kick-dark.css`
- Modify: `test/fixtures/selector-inventory.json` through the fixture builder

**Interfaces:**
- Consumes: `kbd` descendants of the captured `[role="dialog"]` structure.
- Produces: page-fill keycaps with a control border, muted shortcut text, and primary current-page text.

- [ ] **Step 1: Implement the scoped keycap styles**

Add after the existing dialog control rules in `styles/kick-dark.css`:

```css
html[data-kick-night-mode="dark"] [role="dialog"] kbd {
  color: var(--kick-night-muted) !important;
  border: 1px solid var(--kick-night-control-border) !important;
  background-color: var(--kick-night-page) !important;
}

html[data-kick-night-mode="dark"]
  [role="dialog"]
  kbd[aria-current="page"] {
  color: var(--kick-night-text) !important;
}
```

- [ ] **Step 2: Rebuild selector evidence**

Run:

```bash
npm run fixtures:build
```

Expected: PASS, and both new selectors have `captured` evidence on the
`accounts` route and `command-palette` surface.

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
npx playwright test test/visual/theme.spec.cjs --grep "Command-K Home pill"
```

Expected: PASS.

- [ ] **Step 4: Verify nearby dialog behavior**

Run:

```bash
npx playwright test test/visual/theme.spec.cjs --grep "filter-dialog|dialog-menu-form|Command-K"
```

Expected: existing dialog and calendar tests pass; only missing command-palette
snapshots may require review in Task 3.

---

### Task 3: Review snapshots and run the full release gate

**Files:**
- Create: `test/visual/theme.spec.cjs-snapshots/sanitized-command-palette-darwin.png`
- Create: `test/visual/theme.spec.cjs-snapshots/sanitized-command-palette-compact-darwin.png`

**Interfaces:**
- Consumes: the final fixture and production CSS from Tasks 1 and 2.
- Produces: reviewed desktop and compact rendered baselines.

- [ ] **Step 1: Generate the two new snapshots**

Run:

```bash
npx playwright test test/visual/theme.spec.cjs --grep "command-palette matches" --update-snapshots
```

Expected: PASS and two new PNG files.

- [ ] **Step 2: Inspect both snapshots**

Open both PNG files and confirm:

- the Home and shortcut keycaps use deep page fill;
- Home text is primary and shortcut text is muted;
- borders remain visible;
- selected rows retain blue treatment; and
- no unrelated light surfaces appear.

- [ ] **Step 3: Run the complete verification suite**

Run:

```bash
npm run check
git diff --check
```

Expected: all unit, visual, privacy, contrast, snapshot, and extension validation
checks pass with no whitespace errors.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --stat
git diff -- styles/kick-dark.css test/fixtures test/styles.test.cjs test/visual
```

Expected: only the scoped CSS, sanitized fixture evidence, regression tests,
and reviewed snapshots change; user-authored untracked documentation remains
untouched.
