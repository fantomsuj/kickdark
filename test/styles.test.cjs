const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const stylesheetPath = path.join(
  __dirname,
  "..",
  "styles",
  "kick-dark.css"
);

function readStylesheet() {
  try {
    return fs.readFileSync(stylesheetPath, "utf8");
  } catch {
    return "";
  }
}

function rulesFrom(source) {
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;

  while ((match = pattern.exec(source))) {
    const selector = match[1].trim().replace(/^@media[^{]*\s+/, "");
    const declarations = match[2].trim();
    if (selector.startsWith("@")) continue;
    rules.push({ selector, declarations });
  }

  return rules;
}

function splitSelectors(selectorList) {
  const selectors = [];
  let current = "";
  let bracketDepth = 0;
  let parenthesisDepth = 0;
  let quote = null;

  for (const character of selectorList) {
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }

    if (character === '"' || character === "'") quote = character;
    if (character === "[") bracketDepth += 1;
    if (character === "]") bracketDepth -= 1;
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") parenthesisDepth -= 1;

    if (character === "," && bracketDepth === 0 && parenthesisDepth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) selectors.push(current.trim());
  return selectors;
}

test("every visual selector is scoped to the dark-state root", () => {
  const stylesheet = readStylesheet();
  const rules = rulesFrom(stylesheet);

  assert.ok(rules.length > 10, "expected a substantive dark theme stylesheet");

  for (const rule of rules) {
    for (const selector of splitSelectors(rule.selector)) {
      assert.match(
        selector.trim(),
        /^html\[data-kick-night-mode="dark"\]/,
        `unscoped selector: ${selector.trim()}`
      );
    }
  }
});

test("protected financial media explicitly keeps normal rendering", () => {
  const stylesheet = readStylesheet();
  const rules = rulesFrom(stylesheet);
  const protectedTerms = [
    "img",
    "video",
    "canvas",
    "svg",
    "iframe",
    "receipt",
    "attachment",
    "upload",
    "document",
    "avatar",
    "logo"
  ];

  for (const term of protectedTerms) {
    const protectedRule = rules.find(
      ({ selector, declarations }) =>
        selector.toLowerCase().includes(term) &&
        /filter\s*:\s*none\s*!important/i.test(declarations)
    );
    assert.ok(protectedRule, `missing filter protection for ${term}`);
  }

  assert.doesNotMatch(stylesheet, /filter\s*:\s*invert\s*\(/i);
});

test("printing resets the page to a light color scheme", () => {
  const stylesheet = readStylesheet();
  const printBlock = stylesheet.match(/@media\s+print\s*\{([\s\S]*)\}\s*$/i);

  assert.ok(printBlock, "missing print reset");
  assert.match(printBlock[1], /color-scheme\s*:\s*light\s*!important/i);
  assert.match(printBlock[1], /background\s*:\s*white\s*!important/i);
  assert.match(printBlock[1], /color\s*:\s*black\s*!important/i);
});

test("semantic surfaces do not rely on broad class-name matching", () => {
  const stylesheet = readStylesheet();
  const unsafeFragments = [
    "card",
    "panel",
    "surface",
    "modal",
    "popover",
    "dropdown",
    "tooltip",
    "overlay",
    "toast",
    "notification",
    "loading",
    "success",
    "warning",
    "error",
    "danger",
    "divider"
  ];

  for (const fragment of unsafeFragments) {
    assert.doesNotMatch(
      stylesheet,
      new RegExp(`\\[class\\*=["']${fragment}["'](?:\\s+i)?\\]`, "i"),
      `broad class-name selector remains for ${fragment}`
    );
  }

  assert.doesNotMatch(
    stylesheet,
    /button:not\([^{}]*\[class\*=["'](?:primary|brand)["']/i,
    "generic buttons must not infer intent from primary or brand class names"
  );
  assert.doesNotMatch(
    stylesheet,
    /\[role=["']button["']\]:not\([^{}]*\[class\*=["'](?:primary|brand)["']/i,
    "role buttons must not infer intent from primary or brand class names"
  );
});

test("semantic surface map covers the complete Kick application shell", () => {
  const stylesheet = readStylesheet();
  const requiredCoverage = [
    ["app shell", /html\[data-kick-night-mode="dark"\]\s+(?:body|#root|#__next)/i],
    ["page canvas", /html\[data-kick-night-mode="dark"\]\s+(?:main|\[role="main"\])/i],
    ["side navigation", /html\[data-kick-night-mode="dark"\]\s+\[role="navigation"\]/i],
    ["header", /html\[data-kick-night-mode="dark"\]\s+(?:header|\[role="banner"\])/i],
    ["notice", /html\[data-kick-night-mode="dark"\]\s+\[role="(?:note|status)"\]/i],
    ["table", /html\[data-kick-night-mode="dark"\]\s+table/i],
    ["table header", /html\[data-kick-night-mode="dark"\]\s+\[role="columnheader"\]/i],
    ["table row", /html\[data-kick-night-mode="dark"\]\s+\[role="row"\]/i],
    ["form control", /html\[data-kick-night-mode="dark"\]\s+(?:input|select|textarea)/i],
    ["button", /html\[data-kick-night-mode="dark"\]\s+(?:button|\[role="button"\])/i],
    ["secondary button", /\[data-variant="secondary"\]/i],
    ["badge", /\[data-slot="badge"\]/i],
    ["menu", /\[role="menu"\]/i],
    ["listbox", /\[role="listbox"\]/i],
    ["popover", /\[data-radix-popper-content-wrapper\]/i],
    ["dialog", /\[role="dialog"\]/i],
    ["empty state", /\[data-state="empty"\]/i],
    ["loading state", /\[aria-busy="true"\]/i],
    ["error state", /\[data-tone="negative"\]/i],
    ["settings screen", /\[data-page="settings"\]/i],
    ["settings panel", /\[data-slot="settings-panel"\]/i],
    ["hover state", /:hover/i],
    ["selected state", /(?:aria-selected="true"|data-state="selected")/i],
    ["focus state", /:focus-visible/i],
    ["white utility repair", /\[class~="bg-white"\]/i],
    [
      "inline white repair",
      /\[style\*="background-color:\s*(?:white|rgb\(255,\s*255,\s*255\))"\]/i
    ]
  ];

  for (const [surface, pattern] of requiredCoverage) {
    assert.match(stylesheet, pattern, `missing semantic coverage for ${surface}`);
  }
});
