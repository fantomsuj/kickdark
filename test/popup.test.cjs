const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/theme-core.js");

function loadPopupApi() {
  try {
    return require("../popup/popup.js");
  } catch {
    return {};
  }
}

function createView() {
  return {
    mode: undefined,
    saving: false,
    message: undefined,
    tone: undefined,
    setMode(mode) {
      this.mode = mode;
    },
    setSaving(saving) {
      this.saving = saving;
    },
    setMessage(message, tone) {
      this.message = message;
      this.tone = tone;
    }
  };
}

function setup({ storedMode = "system", getError, setError } = {}) {
  const api = loadPopupApi();
  const writes = [];
  const view = createView();
  const storage = {
    async get() {
      if (getError) throw getError;
      return { kickNightModePreference: storedMode };
    },
    async set(value) {
      if (setError) throw setError;
      writes.push(value);
    }
  };
  const controller = api.createPopupController?.({ core, storage, view });

  return { controller, view, writes };
}

test("startup displays the valid stored appearance", async () => {
  const { controller, view } = setup({ storedMode: "dark" });

  await controller?.start();

  assert.equal(view.mode, "dark");
  assert.equal(view.saving, false);
});

test("startup normalizes malformed storage values", async () => {
  const { controller, view } = setup({ storedMode: "sepia" });

  await controller?.start();

  assert.equal(view.mode, "system");
});

test("selecting dark persists only the appearance preference", async () => {
  const { controller, view, writes } = setup({ storedMode: "system" });
  await controller?.start();

  await controller?.select("dark");

  assert.deepEqual(writes, [{ kickNightModePreference: "dark" }]);
  assert.equal(view.mode, "dark");
  assert.equal(view.message, "Dark mode selected");
  assert.equal(view.tone, "success");
});

test("invalid selections persist the system fallback", async () => {
  const { controller, view, writes } = setup({ storedMode: "light" });
  await controller?.start();

  await controller?.select("sepia");

  assert.deepEqual(writes, [{ kickNightModePreference: "system" }]);
  assert.equal(view.mode, "system");
});

test("failed reads display the system fallback and a warning", async () => {
  const { controller, view } = setup({
    getError: new Error("storage unavailable")
  });

  await controller?.start();

  assert.equal(view.mode, "system");
  assert.equal(view.message, "Using System — Chrome storage is unavailable");
  assert.equal(view.tone, "warning");
});

test("failed writes restore the previous appearance and display an error", async () => {
  const { controller, view } = setup({
    storedMode: "light",
    setError: new Error("storage unavailable")
  });
  await controller?.start();

  await controller?.select("dark");

  assert.equal(view.mode, "light");
  assert.equal(view.saving, false);
  assert.equal(view.message, "Could not save your appearance");
  assert.equal(view.tone, "error");
});
