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

    const nextMode =
      root.dataset.kickNightMode === "dark" ? "light" : "dark";
    applyMode(nextMode);
    persistMode(nextMode);
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== preferenceKey) return;

    applyMode(normalizeMode(event.newValue));
  });
})();
