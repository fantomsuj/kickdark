(function exposeThemeCore(root, factory) {
  const api = factory();

  root.KickNightModeCore = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === "object" ? globalThis : this, function createThemeCore() {
  "use strict";

  const VALID_MODES = Object.freeze(["system", "light", "dark"]);

  function normalizeMode(value) {
    return VALID_MODES.includes(value) ? value : "system";
  }

  function resolveMode(mode, systemIsDark) {
    const normalized = normalizeMode(mode);
    return normalized === "system"
      ? systemIsDark
        ? "dark"
        : "light"
      : normalized;
  }

  return Object.freeze({
    VALID_MODES,
    normalizeMode,
    resolveMode
  });
});
