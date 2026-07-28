const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const preferenceKey = "kick-night-mode:appearance";
const contentSource = fs.readFileSync(
  path.join(__dirname, "../src/content.js"),
  "utf8"
);

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

function executeContentScript({
  storage = createStorage(),
  root = { dataset: {} }
} = {}) {
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

test("dark mode is the synchronous default", () => {
  const { root } = executeContentScript();

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("stored light mode is restored synchronously", () => {
  const storage = createStorage({ [preferenceKey]: "light" });
  const { root } = executeContentScript({ storage });

  assert.equal(root.dataset.kickNightMode, undefined);
});

test("stored dark mode is restored synchronously", () => {
  const storage = createStorage({ [preferenceKey]: "dark" });
  const { root } = executeContentScript({ storage });

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("a toolbar message toggles and persists the next appearance", () => {
  const { root, storage, runtimeListeners } = executeContentScript();

  runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(root.dataset.kickNightMode, undefined);
  assert.equal(storage.getItem(preferenceKey), "light");

  runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(root.dataset.kickNightMode, "dark");
  assert.equal(storage.getItem(preferenceKey), "dark");
});

test("a preference storage event synchronizes another Kick document", () => {
  const { root, listeners } = executeContentScript();

  listeners.storage({ key: preferenceKey, newValue: "light" });
  assert.equal(root.dataset.kickNightMode, undefined);

  listeners.storage({ key: preferenceKey, newValue: "dark" });
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("unrelated messages and storage events do not change appearance", () => {
  const { root, listeners, runtimeListeners } = executeContentScript();

  runtimeListeners[0]({ type: "something-else" });
  listeners.storage({ key: "other-key", newValue: "light" });

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("invalid stored state safely defaults to dark", () => {
  const storage = createStorage({ [preferenceKey]: "sepia" });
  const { root } = executeContentScript({ storage });

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("invalid synchronized state safely falls back to dark", () => {
  const { root, listeners } = executeContentScript({
    storage: createStorage({ [preferenceKey]: "light" })
  });

  assert.equal(root.dataset.kickNightMode, undefined);
  listeners.storage({ key: preferenceKey, newValue: "sepia" });
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("inaccessible storage does not prevent the current document toggling", () => {
  const inaccessible = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    }
  };
  const { root, runtimeListeners } = executeContentScript({
    storage: inaccessible
  });

  assert.equal(root.dataset.kickNightMode, "dark");
  runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  assert.equal(root.dataset.kickNightMode, undefined);
});

test("re-execution restores the appearance persisted by an earlier document", () => {
  const storage = createStorage();
  const first = executeContentScript({ storage });

  first.runtimeListeners[0]({ type: "kick-night-mode:toggle" });
  const second = executeContentScript({ storage });

  assert.equal(second.root.dataset.kickNightMode, undefined);
});
