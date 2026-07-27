const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/theme-core.js");

function loadContentApi() {
  try {
    return require("../src/content.js");
  } catch {
    return {};
  }
}

function createMediaQuery(initialMatches) {
  const listeners = new Set();

  return {
    matches: initialMatches,
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") listeners.delete(listener);
    },
    setMatches(matches) {
      this.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

function createStorageChanges() {
  const listeners = new Set();

  return {
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    dispatch(changes, areaName = "local") {
      for (const listener of listeners) listener(changes, areaName);
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

function setup({ storedMode = "system", systemIsDark = false, getError } = {}) {
  const api = loadContentApi();
  const root = { dataset: {} };
  const mediaQuery = createMediaQuery(systemIsDark);
  const printMediaQuery = createMediaQuery(false);
  const storageChanges = createStorageChanges();
  const storage = {
    async get() {
      if (getError) throw getError;
      return { kickNightModePreference: storedMode };
    }
  };

  const controller = api.createThemeController?.({
    core,
    root,
    mediaQuery,
    printMediaQuery,
    storage,
    storageChanges
  });

  return { controller, root, mediaQuery, printMediaQuery, storageChanges };
}

test("stored dark mode is applied to the root element", async () => {
  const { controller, root } = setup({ storedMode: "dark" });

  await controller?.start();

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("system mode follows operating-system appearance changes", async () => {
  const { controller, root, mediaQuery } = setup({
    storedMode: "system",
    systemIsDark: false
  });

  await controller?.start();
  assert.equal(root.dataset.kickNightMode, "light");
  assert.equal(mediaQuery.listenerCount(), 1);

  mediaQuery.setMatches(true);
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("storage changes apply immediately and explicit modes ignore system changes", async () => {
  const { controller, root, mediaQuery, storageChanges } = setup({
    storedMode: "system"
  });

  await controller?.start();
  storageChanges.dispatch({
    kickNightModePreference: { newValue: "dark" }
  });

  assert.equal(root.dataset.kickNightMode, "dark");
  assert.equal(mediaQuery.listenerCount(), 0);

  mediaQuery.setMatches(false);
  assert.equal(root.dataset.kickNightMode, "dark");
});

test("irrelevant storage changes and storage areas are ignored", async () => {
  const { controller, root, storageChanges } = setup({ storedMode: "dark" });

  await controller?.start();
  storageChanges.dispatch({ anotherSetting: { newValue: "light" } });
  storageChanges.dispatch(
    { kickNightModePreference: { newValue: "light" } },
    "sync"
  );

  assert.equal(root.dataset.kickNightMode, "dark");
});

test("failed storage reads fall back to system without blocking the page", async () => {
  const { controller, root, mediaQuery } = setup({
    systemIsDark: true,
    getError: new Error("storage unavailable")
  });

  await controller?.start();

  assert.equal(root.dataset.kickNightMode, "dark");
  assert.equal(mediaQuery.listenerCount(), 1);
});

test("print entry suppresses extension styling until print exit", async () => {
  const { controller, root, printMediaQuery } = setup({ storedMode: "dark" });

  await controller?.start();
  assert.equal(printMediaQuery.listenerCount(), 1);
  assert.equal("kickNightPrinting" in root.dataset, false);

  printMediaQuery.setMatches(true);
  assert.equal(root.dataset.kickNightPrinting, "");

  printMediaQuery.setMatches(false);
  assert.equal("kickNightPrinting" in root.dataset, false);
});

test("system appearance changes during print update the theme without ending print suppression", async () => {
  const { controller, root, mediaQuery, printMediaQuery } = setup({
    storedMode: "system",
    systemIsDark: false
  });

  await controller?.start();
  printMediaQuery.setMatches(true);
  mediaQuery.setMatches(true);

  assert.equal(root.dataset.kickNightMode, "dark");
  assert.equal(root.dataset.kickNightPrinting, "");
});

test("stop removes every extension listener", async () => {
  const { controller, root, mediaQuery, printMediaQuery, storageChanges } = setup({
    storedMode: "system"
  });

  assert.equal(typeof controller?.stop, "function");
  await controller?.start();
  printMediaQuery.setMatches(true);
  controller?.stop();

  assert.equal(mediaQuery.listenerCount(), 0);
  assert.equal(printMediaQuery.listenerCount(), 0);
  assert.equal(storageChanges.listenerCount(), 0);
  assert.equal("kickNightPrinting" in root.dataset, false);
});

test("bootstrap creates both appearance and print media queries", () => {
  const api = loadContentApi();
  const mediaQueries = [];
  const storageChanges = createStorageChanges();
  const globalObject = {
    chrome: {
      storage: {
        local: {
          async get() {
            return { kickNightModePreference: "system" };
          }
        },
        onChanged: storageChanges
      }
    },
    document: { documentElement: { dataset: {} } },
    KickNightModeCore: core,
    matchMedia(query) {
      mediaQueries.push(query);
      return createMediaQuery(false);
    }
  };

  api.bootstrap(globalObject);

  assert.deepEqual(mediaQueries, ["(prefers-color-scheme: dark)", "print"]);
});
