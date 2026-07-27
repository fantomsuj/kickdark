(function exposePopupController(root, factory) {
  const api = factory();

  root.KickNightModePopup = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createPopupApi() {
  "use strict";

  const PREFERENCE_KEY = "kickNightModePreference";

  function labelFor(mode) {
    return `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
  }

  function createPopupController({ core, storage, view }) {
    let currentMode = "system";

    async function start() {
      view.setSaving(true);

      try {
        const stored = await storage.get(PREFERENCE_KEY);
        currentMode = core.normalizeMode(stored[PREFERENCE_KEY]);
        view.setMode(currentMode);
        view.setMessage(
          currentMode === "system"
            ? "Following your computer"
            : `${labelFor(currentMode)} mode is active`,
          "neutral"
        );
      } catch {
        currentMode = "system";
        view.setMode(currentMode);
        view.setMessage(
          "Using System — Chrome storage is unavailable",
          "warning"
        );
      } finally {
        view.setSaving(false);
      }
    }

    async function select(value) {
      const nextMode = core.normalizeMode(value);
      const previousMode = currentMode;

      view.setSaving(true);
      view.setMode(nextMode);

      try {
        await storage.set({ [PREFERENCE_KEY]: nextMode });
        currentMode = nextMode;
        view.setMessage(`${labelFor(nextMode)} mode selected`, "success");
      } catch {
        view.setMode(previousMode);
        view.setMessage("Could not save your appearance", "error");
      } finally {
        view.setSaving(false);
      }
    }

    return Object.freeze({ start, select });
  }

  function createDomView(documentObject) {
    const form = documentObject.querySelector("[data-appearance-form]");
    const inputs = [...documentObject.querySelectorAll('input[name="mode"]')];
    const status = documentObject.querySelector("[data-status]");

    return {
      setMode(mode) {
        for (const input of inputs) input.checked = input.value === mode;
      },
      setSaving(saving) {
        form.setAttribute("aria-busy", String(saving));
        for (const input of inputs) input.disabled = saving;
      },
      setMessage(message, tone) {
        status.textContent = message;
        status.dataset.tone = tone;
      }
    };
  }

  function bootstrap(globalObject) {
    const documentObject = globalObject.document;
    const chromeApi = globalObject.chrome;
    const core = globalObject.KickNightModeCore;

    if (!documentObject) return;

    const view = createDomView(documentObject);

    if (!chromeApi?.storage?.local || !core) {
      view.setMode("system");
      view.setSaving(true);
      view.setMessage("Chrome storage is unavailable", "error");
      return;
    }

    const controller = createPopupController({
      core,
      storage: chromeApi.storage.local,
      view
    });

    const inputs = documentObject.querySelectorAll('input[name="mode"]');
    for (const input of inputs) {
      input.addEventListener("change", () => {
        if (input.checked) void controller.select(input.value);
      });
    }

    void controller.start();
  }

  if (typeof document === "object") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => bootstrap(globalThis), {
        once: true
      });
    } else {
      bootstrap(globalThis);
    }
  }

  return Object.freeze({
    PREFERENCE_KEY,
    createPopupController,
    createDomView,
    bootstrap
  });
});
