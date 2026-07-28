const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contentSource = fs.readFileSync(
  path.join(__dirname, "../src/content.js"),
  "utf8"
);

function executeContentScript(overrides = {}) {
  const root = { dataset: {} };
  const context = {
    document: { documentElement: root },
    ...overrides
  };

  vm.runInNewContext(contentSource, context);
  return root;
}

test("dark mode is applied synchronously when the content script executes", () => {
  const root = executeContentScript();

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("activation does not depend on storage, runtime, or system-theme APIs", () => {
  const unavailable = () => {
    throw new Error("preference API must not be used");
  };
  const root = executeContentScript({
    chrome: {
      runtime: new Proxy({}, { get: unavailable }),
      storage: new Proxy({}, { get: unavailable })
    },
    matchMedia: unavailable
  });

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("re-execution remains an unconditional dark activation", () => {
  const root = { dataset: { kickNightMode: "light" } };
  const context = { document: { documentElement: root } };

  vm.runInNewContext(contentSource, context);
  vm.runInNewContext(contentSource, context);

  assert.equal(root.dataset.kickNightMode, "dark");
});
