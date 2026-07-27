const test = require("node:test");
const assert = require("node:assert/strict");

function loadCore() {
  try {
    return require("../src/theme-core.js");
  } catch {
    return {};
  }
}

const core = loadCore();

test("valid appearance modes are preserved", () => {
  for (const mode of ["system", "light", "dark"]) {
    assert.equal(core.normalizeMode?.(mode), mode);
  }
});

test("invalid stored values fall back to system", () => {
  for (const value of [undefined, null, "", "sepia", 1, {}, []]) {
    assert.equal(core.normalizeMode?.(value), "system");
  }
});

test("system resolves from the operating-system preference", () => {
  assert.equal(core.resolveMode?.("system", true), "dark");
  assert.equal(core.resolveMode?.("system", false), "light");
});

test("explicit appearance ignores the operating-system preference", () => {
  assert.equal(core.resolveMode?.("dark", false), "dark");
  assert.equal(core.resolveMode?.("light", true), "light");
});

test("invalid appearance resolves through the system fallback", () => {
  assert.equal(core.resolveMode?.("sepia", true), "dark");
  assert.equal(core.resolveMode?.("sepia", false), "light");
});
