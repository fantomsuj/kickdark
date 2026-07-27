(function exposeContentController(root, factory) {
  const api = factory();

  root.KickNightModeContent = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createContentApi() {
  "use strict";

  const PREFERENCE_KEY = "kickNightModePreference";

  function createThemeController({
    core,
    root,
    mediaQuery,
    storage,
    storageChanges
  }) {
    let mode = "system";
    let started = false;
    let watchingSystem = false;

    function applyTheme() {
      root.dataset.kickNightMode = core.resolveMode(mode, mediaQuery.matches);
    }

    function onSystemChange() {
      if (mode === "system") applyTheme();
    }

    function addSystemListener() {
      if (watchingSystem) return;

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", onSystemChange);
      } else {
        mediaQuery.addListener(onSystemChange);
      }

      watchingSystem = true;
    }

    function removeSystemListener() {
      if (!watchingSystem) return;

      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onSystemChange);
      } else {
        mediaQuery.removeListener(onSystemChange);
      }

      watchingSystem = false;
    }

    function setMode(value) {
      mode = core.normalizeMode(value);

      if (mode === "system") {
        addSystemListener();
      } else {
        removeSystemListener();
      }

      applyTheme();
    }

    function onStorageChange(changes, areaName) {
      if (areaName !== "local" || !(PREFERENCE_KEY in changes)) return;
      setMode(changes[PREFERENCE_KEY].newValue);
    }

    async function start() {
      if (started) return;
      started = true;

      storageChanges.addListener(onStorageChange);
      setMode("system");

      try {
        const stored = await storage.get(PREFERENCE_KEY);
        setMode(stored[PREFERENCE_KEY]);
      } catch {
        setMode("system");
      }
    }

    function stop() {
      if (!started) return;
      started = false;
      storageChanges.removeListener(onStorageChange);
      removeSystemListener();
    }

    return Object.freeze({ start, stop });
  }

  function bootstrap(globalObject) {
    const chromeApi = globalObject.chrome;
    const documentObject = globalObject.document;

    if (
      !chromeApi?.storage?.local ||
      !chromeApi?.storage?.onChanged ||
      !documentObject?.documentElement ||
      typeof globalObject.matchMedia !== "function" ||
      !globalObject.KickNightModeCore
    ) {
      return;
    }

    const controller = createThemeController({
      core: globalObject.KickNightModeCore,
      root: documentObject.documentElement,
      mediaQuery: globalObject.matchMedia("(prefers-color-scheme: dark)"),
      storage: chromeApi.storage.local,
      storageChanges: chromeApi.storage.onChanged
    });

    void controller.start();
  }

  if (typeof document === "object") {
    bootstrap(globalThis);
  }

  return Object.freeze({
    PREFERENCE_KEY,
    createThemeController,
    bootstrap
  });
});
