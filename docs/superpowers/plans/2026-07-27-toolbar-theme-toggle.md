# Kick Night Mode Toolbar Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Chrome toolbar icon into a shared light/dark toggle whose choice applies synchronously across Kick tabs and survives reloads and browser restarts.

**Architecture:** The content script reads and writes one validated, namespaced `use.kick.co` local-storage value, applies the dark root marker synchronously, and synchronizes other tabs through the browser `storage` event. A minimal Manifest V3 background service worker relays toolbar clicks to the clicked tab; only matched Kick tabs contain the receiving content script.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, DOM `localStorage`, Node.js `node:test`, `vm`, Playwright, and the existing package validator.

## Global Constraints

- Dark mode is the default until the user makes a choice.
- Every open Kick tab updates immediately and new or reloaded Kick tabs inherit the choice.
- The choice survives browser restarts.
- Clicking the icon on a non-Kick page has no visible effect.
- Add no Chrome permission, popup, network request, analytics, remote code, or dynamic code.
- Read and store only the validated appearance values `dark` and `light`; never inspect accounting content.
- Preserve the user's unrelated changes in `styles/kick-dark.css`, `test/fixtures/fixture-shell.css`, `test/visual/theme.spec.cjs`, and untracked documentation.

## File map

- `src/content.js`: synchronous preference bootstrap, root-marker application, toggle-message handling, and cross-tab storage synchronization.
- `src/background.js`: toolbar-click bridge that sends one toggle message to the clicked tab and ignores a missing receiver.
- `manifest.json`: toolbar action and background-worker declarations while retaining the existing Kick-only content script.
- `test/content.test.cjs`: content-runtime behavior against real script execution in a controlled VM document/storage environment.
- `test/background.test.cjs`: toolbar bridge behavior against the real worker script with Chrome boundary fakes.
- `test/extension-contract.test.cjs`: observable manifest and packaged-extension contracts.
- `scripts/validate-extension.mjs`: package-resource and privacy validation for the new runtime files and approved APIs.
- `README.md`: installation, usage, privacy, structure, and troubleshooting copy for the toggle.

---

### Task 1: Shared synchronous appearance state

**Files:**
- Modify: `test/content.test.cjs`
- Modify: `src/content.js`

**Interfaces:**
- Consumes: `document.documentElement`, `window.localStorage`, `window.addEventListener("storage", listener)`, and `chrome.runtime.onMessage.addListener(listener)`.
- Produces: storage key `kick-night-mode:appearance`, message `{ type: "kick-night-mode:toggle" }`, and the existing `data-kick-night-mode="dark"` root contract.

- [ ] **Step 1: Replace the always-on tests with failing shared-state tests**

Build the VM helper with a real stateful storage fake:

```js
function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function executeContentScript({ storage = createStorage(), root = { dataset: {} } } = {}) {
  const listeners = {};
  const runtimeListeners = [];
  const window = {
    localStorage: storage,
    addEventListener(type, listener) {
      listeners[type] = listener;
    }
  };
  const context = {
    document: { documentElement: root },
    localStorage: storage,
    window,
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            runtimeListeners.push(listener);
          }
        }
      }
    }
  };

  vm.runInNewContext(contentSource, context);
  return { root, storage, listeners, runtimeListeners };
}
```

Add behavior tests with hand-derived expectations:

```js
test("dark mode is the synchronous default", () => {
  const { root } = executeContentScript();
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("stored light mode is restored synchronously", () => {
  const storage = createStorage({ "kick-night-mode:appearance": "light" });
  const { root } = executeContentScript({ storage });
  assert.equal(root.dataset.kickNightMode, undefined);
});

test("a toolbar message toggles and persists the next appearance", () => {
  const { root, storage, runtimeListeners } = executeContentScript();
  runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(root.dataset.kickNightMode, undefined);
  assert.equal(storage.getItem("kick-night-mode:appearance"), "light");
  runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(root.dataset.kickNightMode, "dark");
  assert.equal(storage.getItem("kick-night-mode:appearance"), "dark");
});

test("a preference storage event synchronizes another Kick document", () => {
  const { root, listeners } = executeContentScript();
  listeners.storage({
    key: "kick-night-mode:appearance",
    newValue: "light"
  });
  assert.equal(root.dataset.kickNightMode, undefined);
});

test("unrelated messages and storage events do not change appearance", () => {
  const { root, listeners, runtimeListeners } = executeContentScript();
  runtimeListeners[0]({ type: "something-else" });
  listeners.storage({ key: "other-key", newValue: "light" });
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("invalid or inaccessible stored state safely defaults to dark", () => {
  const malformed = createStorage({ "kick-night-mode:appearance": "sepia" });
  assert.equal(
    executeContentScript({ storage: malformed }).root.dataset.kickNightMode,
    "dark"
  );

  const inaccessible = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };
  const result = executeContentScript({ storage: inaccessible });
  assert.equal(result.root.dataset.kickNightMode, "dark");
  result.runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(result.root.dataset.kickNightMode, undefined);
});

test("re-execution restores the appearance persisted by an earlier document", () => {
  const storage = createStorage();
  const first = executeContentScript({ storage });
  first.runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  const second = executeContentScript({ storage });
  assert.equal(second.root.dataset.kickNightMode, undefined);
});
```

Production mutations these tests catch: unconditional dark activation, wrong preference key, failure to persist, failure to remove the root marker, accepting malformed state, reacting to unrelated events, and losing state on reload.

- [ ] **Step 2: Run the content tests and verify the new contract fails**

Run: `node --test test/content.test.cjs`

Expected: FAIL because the current script always writes the dark marker and does not register message or storage listeners.

- [ ] **Step 3: Implement the minimal validated content runtime**

Use a single private script scope in `src/content.js`:

```js
(() => {
  const preferenceKey = "kick-night-mode:appearance";
  const toggleMessageType = "kick-night-mode:toggle";
  const root = document.documentElement;

  function normalizeMode(value) {
    return value === "light" ? "light" : "dark";
  }

  function applyMode(mode) {
    if (mode === "dark") {
      root.dataset.kickNightMode = "dark";
    } else {
      delete root.dataset.kickNightMode;
    }
  }

  function readMode() {
    try {
      return normalizeMode(localStorage.getItem(preferenceKey));
    } catch {
      return "dark";
    }
  }

  function persistMode(mode) {
    try {
      localStorage.setItem(preferenceKey, mode);
    } catch {
      // The current document still toggles when origin storage is unavailable.
    }
  }

  applyMode(readMode());

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== toggleMessageType) return;
    const nextMode = root.dataset.kickNightMode === "dark" ? "light" : "dark";
    applyMode(nextMode);
    persistMode(nextMode);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== preferenceKey) return;
    applyMode(normalizeMode(event.newValue));
  });
})();
```

- [ ] **Step 4: Run the content tests and verify they pass**

Run: `node --test test/content.test.cjs`

Expected: all content tests PASS with zero failures.

- [ ] **Step 5: Commit the shared appearance state**

```bash
git add src/content.js test/content.test.cjs
git commit -m "Add shared Kick appearance state"
```

---

### Task 2: Toolbar bridge and package contract

**Files:**
- Create: `test/background.test.cjs`
- Create: `src/background.js`
- Modify: `test/extension-contract.test.cjs`
- Modify: `manifest.json`
- Modify: `scripts/validate-extension.mjs`

**Interfaces:**
- Consumes: the Task 1 message `{ type: "kick-night-mode:toggle" }`.
- Produces: a toolbar `action`, background service worker `src/background.js`, and one `chrome.tabs.sendMessage(tab.id, message)` attempt per valid toolbar click.

- [ ] **Step 1: Write failing background and manifest behavior tests**

Execute the real worker and capture its registered click listener:

```js
function loadBackground(sendMessage) {
  let onClicked;
  vm.runInNewContext(backgroundSource, {
    chrome: {
      action: {
        onClicked: {
          addListener(listener) {
            onClicked = listener;
          }
        }
      },
      tabs: { sendMessage }
    }
  });
  return onClicked;
}

test("a toolbar click sends the toggle contract to its tab", async () => {
  const calls = [];
  const onClicked = loadBackground((tabId, message) => {
    calls.push({ tabId, message });
    return Promise.resolve();
  });
  onClicked({ id: 42 });
  await Promise.resolve();
  assert.deepEqual(calls, [
    { tabId: 42, message: { type: "kick-night-mode:toggle" } }
  ]);
});

test("a click without a tab id has no effect", () => {
  let calls = 0;
  const onClicked = loadBackground(() => {
    calls += 1;
    return Promise.resolve();
  });
  onClicked({});
  assert.equal(calls, 0);
});

test("a missing content-script receiver is safely ignored", async () => {
  let rejectionHandled = false;
  const onClicked = loadBackground(() => ({
    catch(handler) {
      rejectionHandled = true;
      handler(new Error("Receiving end does not exist"));
    }
  }));
  onClicked({ id: 42 });
  assert.equal(rejectionHandled, true);
});
```

Change `test/extension-contract.test.cjs` so the manifest behavior expects:

```js
assert.equal("permissions" in manifest, false);
assert.equal("host_permissions" in manifest, false);
assert.deepEqual(manifest.action, {
  default_title: "Toggle Kick Night Mode",
  default_icon: {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
});
assert.deepEqual(manifest.background, {
  service_worker: "src/background.js"
});
```

Retain the Kick-only content-script assertions and packaged validator execution. Replace the obsolete assertion that preference/listener machinery is absent with observable privacy assertions already enforced by the validator: no page-content selectors, page input listeners, transport APIs, or expanded host access.

Production mutations these tests catch: wrong tab id, wrong message type, unhandled missing receiver, sending without a numeric tab id, missing toolbar declaration, missing worker, and added permissions.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test test/background.test.cjs test/extension-contract.test.cjs`

Expected: FAIL because `src/background.js` does not exist and the manifest still forbids `action` and `background`.

- [ ] **Step 3: Implement the toolbar bridge**

Create `src/background.js`:

```js
chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return;
  chrome.tabs
    .sendMessage(tab.id, { type: "kick-night-mode:toggle" })
    .catch(() => {});
});
```

- [ ] **Step 4: Declare the action and worker**

Add to `manifest.json` without adding `permissions` or `host_permissions`:

```json
"action": {
  "default_title": "Toggle Kick Night Mode",
  "default_icon": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
},
"background": {
  "service_worker": "src/background.js"
}
```

Change the manifest description from “always-on” to “toggleable.”

- [ ] **Step 5: Update packaged-extension validation**

In `scripts/validate-extension.mjs`:

Replace the obsolete `action` and `background` absence assertions with:

```js
expectExact(
  manifest.action,
  {
    default_title: "Toggle Kick Night Mode",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "toolbar action"
);
expectExact(
  manifest.background,
  { service_worker: "src/background.js" },
  "background worker"
);
```

Expand the referenced resources and runtime scan:

```js
const referencedFiles = new Set([
  ...contentScript.js,
  ...contentScript.css,
  manifest.background.service_worker,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
]);

const runtimeFiles = [
  "manifest.json",
  "src/background.js",
  "src/content.js",
  "styles/kick-dark.css"
];
```

Remove only the obsolete blanket rejection of
`storage|runtime|matchMedia|addEventListener|removeEventListener`. Retain the
zero-permission, Kick-only, local-resource, transport/dynamic-code,
page-content-selector, and page input-listener checks. Add:

```js
assert.doesNotMatch(
  contentSource,
  /\b(?:chrome\.storage|indexedDB)\b/,
  "appearance state must not require extension storage or a database"
);
```

Finish the validator output with:

```js
console.log("  toolbar: tab relay");
console.log("  preference: namespaced appearance only");
```

- [ ] **Step 6: Run the focused tests and validator**

Run:

```bash
node --test test/background.test.cjs test/extension-contract.test.cjs
npm run validate
```

Expected: all focused tests PASS and validation prints `Extension validation passed`, `permissions: none`, `toolbar: tab relay`, and `preference: namespaced appearance only`.

- [ ] **Step 7: Commit the toolbar and package contract**

```bash
git add src/background.js test/background.test.cjs manifest.json test/extension-contract.test.cjs scripts/validate-extension.mjs
git commit -m "Toggle Kick theme from the toolbar"
```

---

### Task 3: User documentation and full verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the verified toolbar-toggle behavior from Tasks 1 and 2.
- Produces: accurate installation, usage, privacy, project-structure, and troubleshooting guidance.

- [ ] **Step 1: Update the README behavior contract**

Make these concrete copy changes:

- replace “always-on” and “disable the extension from `chrome://extensions`” with instructions to click the toolbar icon;
- state that the choice synchronizes across Kick tabs and survives reloads and browser restarts;
- change “Stores no settings” to “Stores only the `dark` or `light` appearance choice in Kick's local browser storage”;
- keep the no-accounting-data, no-network, no-analytics, and no-Chrome-permission claims;
- describe `src/content.js` as preference bootstrap and theme synchronization;
- add `src/background.js` as the toolbar-click relay; and
- update troubleshooting to include clicking the icon and resetting the namespaced appearance preference when needed.

- [ ] **Step 2: Run the complete fresh verification suite**

Run:

```bash
npm run check
git diff --check origin/main...
git status --short
git diff --stat origin/main...
```

Expected: unit tests, Playwright tests, and package validation all PASS; diff check reports no whitespace errors; status shows only this feature's commits plus the user's preserved unrelated working-tree changes.

- [ ] **Step 3: Review the feature diff against the approved spec**

Run:

```bash
git diff --stat origin/main...
git diff origin/main... -- src/content.js src/background.js manifest.json test/content.test.cjs test/background.test.cjs test/extension-contract.test.cjs scripts/validate-extension.mjs README.md docs/superpowers/specs/2026-07-27-toolbar-theme-toggle-design.md docs/superpowers/plans/2026-07-27-toolbar-theme-toggle.md
```

Confirm every acceptance criterion has direct test or validation evidence and no unrelated user-owned file was staged.

- [ ] **Step 4: Commit the documentation**

```bash
git add README.md
git commit -m "Document the toolbar theme toggle"
```

- [ ] **Step 5: Re-run final verification after the last commit**

Run:

```bash
npm run check
git diff --check origin/main...
git status --short
```

Expected: all checks PASS, no whitespace errors, and only the pre-existing user-owned edits remain unstaged.
