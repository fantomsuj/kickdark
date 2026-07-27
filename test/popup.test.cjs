const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../src/theme-core.js");
const popupMarkup = fs.readFileSync(
  path.join(__dirname, "../popup/popup.html"),
  "utf8"
);
const popupStyles = fs.readFileSync(
  path.join(__dirname, "../popup/popup.css"),
  "utf8"
);

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = popupStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`)
  );

  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

function cssCustomProperty(rule, property) {
  const match = rule.match(new RegExp(`${property}\\s*:\\s*([^;]+)`));
  assert.ok(match, `Expected ${property} in CSS rule`);
  return match[1].trim();
}

function parseColor(color) {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map((offset) =>
      Number.parseInt(hex[1].slice(offset, offset + 2), 16)
    );
  }

  const rgba = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  assert.ok(rgba, `Expected a hex or rgb(a) color, received ${color}`);
  return [
    Number(rgba[1]),
    Number(rgba[2]),
    Number(rgba[3]),
    rgba[4] === undefined ? 1 : Number(rgba[4])
  ];
}

function composite(foreground, background) {
  const alpha = foreground[3] ?? 1;
  return foreground.slice(0, 3).map((channel, index) =>
    channel * alpha + background[index] * (1 - alpha)
  );
}

function contrastRatio(foreground, background) {
  const luminance = (color) => {
    const linear = color.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (
      0.2126 * linear[0] +
      0.7152 * linear[1] +
      0.0722 * linear[2]
    );
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function appearanceOptions() {
  return [...popupMarkup.matchAll(/<label class="mode-option">([\s\S]*?)<\/label>/g)]
    .map(([, option]) => ({
      value: option.match(/<input[^>]+value="([^"]+)"/)?.[1],
      label: option.match(/class="mode-label"[^>]*>([^<]+)</)?.[1]?.trim(),
      source: option
    }));
}

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

test("appearance is one semantic grouped preference list in System, Light, Dark order", () => {
  assert.match(
    popupMarkup,
    /<fieldset[^>]+class="mode-list"[^>]+data-appearance-form[^>]*>/
  );
  assert.match(
    popupMarkup,
    /<legend[^>]*>\s*Appearance\s*<\/legend>/
  );

  const options = appearanceOptions();
  assert.deepEqual(
    options.map(({ value, label }) => ({ value, label })),
    [
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" }
    ]
  );
  assert.equal(
    options.every(({ source }) => /<input[^>]+type="radio"[^>]+name="mode"/.test(source)),
    true
  );

  assert.match(cssRule(".mode-list"), /display:\s*(?:block|grid|flex)/);
  assert.match(cssRule(".mode-option"), /width:\s*100%/);
  assert.doesNotMatch(cssRule(".mode-list"), /repeat\(3/);
});

test("each labeled row exposes a trailing selected-state checkmark", () => {
  const options = appearanceOptions();

  assert.equal(options.length, 3);
  for (const { source } of options) {
    assert.match(
      source,
      /<span class="selection-mark" aria-hidden="true">\s*<\/span>\s*$/
    );
  }

  assert.match(
    popupStyles,
    /input:checked\)[^{]*\.selection-mark\s*\{[^}]*opacity:\s*1/
  );
});

test("preference rows provide keyboard focus, pressed, and saving feedback", () => {
  assert.match(
    cssRule(".mode-option:has(input:focus-visible)"),
    /outline:\s*(?!none)/
  );
  assert.match(cssRule(".mode-option:active"), /transform:/);
  assert.match(
    cssRule(".mode-option:has(input:disabled)"),
    /(?:opacity|cursor):/
  );
  assert.match(popupStyles, /\[aria-busy="true"\]/);
});

test("popup chrome follows the operating system appearance", () => {
  assert.match(cssRule(":root"), /color-scheme:\s*light dark/);
  assert.match(
    popupStyles,
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/
  );
  assert.doesNotMatch(
    popupStyles,
    /\[data-theme|kickNightModePreference|\.theme-(?:light|dark)/
  );
});

test("light secondary labels meet small-text contrast on page and grouped surfaces", () => {
  const rootRule = cssRule(":root");
  const secondaryLabel = parseColor(
    cssCustomProperty(rootRule, "--secondary-label")
  );
  const pageBackground = parseColor(
    cssCustomProperty(rootRule, "--background")
  );
  const groupedSurface = parseColor(cssCustomProperty(rootRule, "--surface"));
  const groupedSurfaceOverPage = composite(groupedSurface, pageBackground);

  assert.ok(
    contrastRatio(composite(secondaryLabel, pageBackground), pageBackground) >=
      4.5,
    "secondary labels must meet 4.5:1 on the light page background"
  );
  assert.ok(
    contrastRatio(
      composite(secondaryLabel, groupedSurfaceOverPage),
      groupedSurfaceOverPage
    ) >= 4.5,
    "secondary labels must meet 4.5:1 on the light grouped surface"
  );
});

test("popup offers reduced motion, transparency, and increased contrast fallbacks", () => {
  assert.match(
    popupStyles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/
  );
  assert.match(
    popupStyles,
    /@media\s*\(prefers-reduced-transparency:\s*reduce\)\s*\{/
  );
  assert.match(
    popupStyles,
    /@media\s*\(prefers-contrast:\s*more\)\s*\{/
  );
});

test("popup uses no gradients, glow effects, or external visual assets", () => {
  assert.doesNotMatch(popupStyles, /gradient\(|text-shadow|drop-shadow|@import|url\(/i);
  assert.doesNotMatch(popupMarkup, /<(?:img|svg)\b|https?:\/\//i);
});
