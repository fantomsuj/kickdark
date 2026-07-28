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
const captureManifestPath = path.join(
  __dirname,
  "fixtures",
  "capture-manifest.json"
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
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let match;

  while ((match = pattern.exec(withoutComments))) {
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
  const rules = rulesFrom(readStylesheet());
  assert.ok(rules.length > 10, "expected a substantive dark theme stylesheet");

  for (const rule of rules) {
    for (const selector of splitSelectors(rule.selector)) {
      assert.match(
        selector,
        /^html\[data-kick-night-mode="dark"\]/,
        `unscoped selector: ${selector}`
      );
    }
  }
});

test("the existing night palette remains byte-for-byte stable", () => {
  const stylesheet = readStylesheet();
  const palette = {
    "--kick-night-page": "#0f1826",
    "--kick-night-surface": "#1a2336",
    "--kick-night-raised": "#202b3d",
    "--kick-night-hover": "#26344a",
    "--kick-night-text": "#f4f7fb",
    "--kick-night-muted": "#b7c0ce",
    "--kick-night-subtle": "#8f9caf",
    "--kick-night-border": "rgba(255, 255, 255, 0.1)",
    "--kick-night-border-strong": "rgba(255, 255, 255, 0.16)",
    "--kick-night-accent": "#3793da",
    "--kick-night-positive": "#53c28b",
    "--kick-night-warning": "#f2b84b",
    "--kick-night-negative": "#f2777a"
  };

  for (const [token, value] of Object.entries(palette)) {
    assert.match(
      stylesheet,
      new RegExp(
        `${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*${value.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}\\s*;`,
        "i"
      ),
      `${token} changed from the approved palette`
    );
  }
});

test("selectors use captured stable evidence rather than hypothetical hooks", () => {
  const stylesheet = readStylesheet();
  const manifest = JSON.parse(fs.readFileSync(captureManifestPath, "utf8"));
  const candidates = new Set(
    Object.values(manifest.fixtures).flatMap(
      ({ selectorCandidates }) => selectorCandidates
    )
  );

  assert.doesNotMatch(
    stylesheet,
    /\[\s*class\s*\*=/i,
    "class substring selectors are too broad"
  );
  assert.doesNotMatch(
    stylesheet,
    /\[\s*style\s*\*=/i,
    "inline-style selectors cannot be supported by sanitized evidence"
  );
  assert.doesNotMatch(
    stylesheet,
    /\[class~="_?[a-z0-9-]+_[a-z0-9]{5}_[0-9]+"\]/i,
    "generated CSS-module hashes are not stable selectors"
  );
  assert.doesNotMatch(stylesheet, /data-kick-night-(?:test|fixture)/i);
  assert.doesNotMatch(stylesheet, /filter\s*:\s*invert\s*\(/i);

  for (const match of stylesheet.matchAll(
    /\[(data-(?:slot|variant))="([^"]+)"\]/gi
  )) {
    const candidate = `[${match[1]}="${match[2]}"]`;
    assert.ok(
      candidates.has(candidate),
      `hypothetical selector absent from capture inventory: ${candidate}`
    );
  }
});

test("selector evidence covers every audited route and interactive state", () => {
  const manifest = JSON.parse(fs.readFileSync(captureManifestPath, "utf8"));
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(manifest.fixtures).map(
        ([name, { route, surface }]) => [name, { route, surface }]
      )
    ),
    {
      tasks: { route: "tasks", surface: "application" },
      activity: { route: "activity", surface: "application" },
      categories: { route: "categories", surface: "application" },
      "document-categories": {
        route: "document-categories",
        surface: "application"
      },
      documents: { route: "documents", surface: "application" },
      transactions: { route: "transactions", surface: "application" },
      clients: { route: "clients", surface: "application" },
      accounts: { route: "accounts", surface: "application" },
      rules: { route: "rules", surface: "application" },
      accounting: { route: "accounting", surface: "application" },
      "chart-of-accounts": {
        route: "chart-of-accounts",
        surface: "application"
      },
      reconciliation: {
        route: "reconciliation",
        surface: "application"
      },
      counterparties: { route: "counterparties", surface: "application" },
      classes: { route: "classes", surface: "application" },
      insights: { route: "insights", surface: "application" },
      "profit-loss": { route: "profit-loss", surface: "report" },
      "balance-sheet": { route: "balance-sheet", surface: "report" },
      "general-ledger": { route: "general-ledger", surface: "report" },
      "trial-balance": { route: "trial-balance", surface: "report" },
      "expenses-by-vendor": {
        route: "expenses-by-vendor",
        surface: "report"
      },
      "cash-flow-statement": {
        route: "cash-flow-statement",
        surface: "report"
      },
      invoicing: { route: "invoicing", surface: "empty-state" },
      billing: { route: "billing", surface: "empty-state" },
      team: { route: "team", surface: "application" },
      "organization-billing": {
        route: "organization-billing",
        surface: "application"
      },
      "tasks-new-task": { route: "tasks-new-task", surface: "overlay" },
      "dialog-menu-form": {
        route: "documents",
        surface: "dialog-menu-form"
      },
      "command-palette": {
        route: "accounts",
        surface: "command-palette"
      },
      "filter-dialog": {
        route: "transactions-filter",
        surface: "overlay"
      },
      menu: { route: "documents", surface: "menu" },
      form: { route: "documents", surface: "form" },
      "empty-state": { route: "documents", surface: "empty-state" }
    }
  );
});

test("global light foregrounds are declared only with a paired background", () => {
  const globalSurface =
    /(?:^|,\s*)html\[data-kick-night-mode="dark"\](?:\s+(?:body|main|body\s*>\s*div:first-of-type))?(?:\s*,|$)/;

  for (const { selector, declarations } of rulesFrom(readStylesheet())) {
    if (
      globalSurface.test(selector) &&
      /(?:^|;)\s*color\s*:\s*(?:var\(--kick-night-text\)|#f[0-9a-f]{2,5})/i.test(
        declarations
      )
    ) {
      assert.match(
        declarations,
        /(?:^|;)\s*background(?:-color)?\s*:/i,
        `global light foreground lacks a paired background: ${selector}`
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
    assert.ok(
      rules.some(
        ({ selector, declarations }) =>
          selector.toLowerCase().includes(term) &&
          /filter\s*:\s*none\s*!important/i.test(declarations)
      ),
      `missing filter protection for ${term}`
    );
  }
});

test("printing resets the page to a light color scheme", () => {
  const printBlock = readStylesheet().match(
    /@media\s+print\s*\{([\s\S]*)\}\s*$/i
  );

  assert.ok(printBlock, "missing print reset");
  assert.match(printBlock[1], /color-scheme\s*:\s*light\s*!important/i);
  assert.match(printBlock[1], /background\s*:\s*white\s*!important/i);
  assert.match(printBlock[1], /color\s*:\s*black\s*!important/i);
});
