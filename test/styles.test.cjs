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

function assertSelectorDeclarations(rules, selector, expectedDeclarations) {
  const rule = rules.find(({ selector: selectorList }) =>
    splitSelectors(selectorList).includes(selector)
  );

  assert.ok(rule, `missing semantic selector: ${selector}`);

  for (const expected of expectedDeclarations) {
    assert.match(
      rule.declarations,
      expected,
      `${selector} is missing declaration contract ${expected}`
    );
  }
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

test("audited semantic surface map uses narrow selectors and enforced tier declarations", () => {
  const stylesheet = readStylesheet();
  const rules = rulesFrom(stylesheet);
  const root = 'html[data-kick-night-mode="dark"]';

  assert.doesNotMatch(
    stylesheet,
    /section\s*\[\s*data-slot\s*\]/i,
    "generic slotted sections must not override the page-canvas tier"
  );
  assert.doesNotMatch(
    stylesheet,
    /\[\s*class\s*\*=/i,
    "class substring selectors are too broad for an audited surface map"
  );

  const contracts = [
    [
      `${root} body`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)\s*!important/i,
        /(?:^|;)\s*background\s*:\s*var\(--kick-night-page\)\s*!important/i
      ]
    ],
    [
      `${root} [data-slot="page"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-page\)\s*!important/i
      ]
    ],
    [
      `${root} [role="navigation"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} header`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} [role="status"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [data-slot="card"]`,
      [
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i,
        /(?:^|;)\s*box-shadow\s*:\s*0 12px 34px rgba\(0,\s*0,\s*0,\s*0\.2\)/i
      ]
    ],
    [
      `${root} table`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} [role="columnheader"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-muted\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [role="row"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*transparent/i
      ]
    ],
    [
      `${root} [role="row"]:hover`,
      [
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-hover\)\s*!important/i
      ]
    ],
    [
      `${root} input`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)\s*!important/i,
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-page\)\s*!important/i
      ]
    ],
    [
      `${root} button`,
      [/(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)/i]
    ],
    [
      `${root} button[data-variant="secondary"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)/i
      ]
    ],
    [
      `${root} button[data-variant="secondary"]:hover`,
      [/(?:^|;)\s*background-color\s*:\s*var\(--kick-night-hover\)/i]
    ],
    [
      `${root} [data-slot="badge"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [role="menu"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [role="listbox"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [data-radix-popper-content-wrapper] > *`,
      [
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i,
        /(?:^|;)\s*box-shadow\s*:\s*0 18px 54px rgba\(0,\s*0,\s*0,\s*0\.34\)/i
      ]
    ],
    [
      `${root} [role="dialog"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border-strong\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
      ]
    ],
    [
      `${root} [data-state="empty"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-muted\)/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} [aria-busy="true"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-muted\)/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-hover\)\s*!important/i
      ]
    ],
    [
      `${root} [data-tone="negative"]`,
      [/(?:^|;)\s*color\s*:\s*var\(--kick-night-negative\)\s*!important/i]
    ],
    [
      `${root} [data-page="settings"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-page\)\s*!important/i
      ]
    ],
    [
      `${root} [data-slot="settings-panel"]`,
      [
        /(?:^|;)\s*border-color\s*:\s*var\(--kick-night-border\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} [data-state="selected"]`,
      [/(?:^|;)\s*background-color\s*:\s*var\(--kick-night-hover\)\s*!important/i]
    ],
    [
      `${root} button:focus-visible`,
      [/(?:^|;)\s*outline\s*:\s*2px solid var\(--kick-night-accent\)\s*!important/i]
    ],
    [
      `${root} [role="option"][aria-selected="true"]`,
      [
        /(?:^|;)\s*color\s*:\s*var\(--kick-night-text\)\s*!important/i,
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-hover\)\s*!important/i
      ]
    ],
    [
      `${root} [class~="bg-white"]`,
      [
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ],
    [
      `${root} [style*="background-color: white"]`,
      [
        /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
      ]
    ]
  ];

  for (const [selector, declarations] of contracts) {
    assertSelectorDeclarations(rules, selector, declarations);
  }
});

test("authenticated Clients surfaces map audited class tokens to dark tiers", () => {
  const rules = rulesFrom(readStylesheet());
  const root = 'html[data-kick-night-mode="dark"]';
  const pageTier = [
    /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-page\)\s*!important/i
  ];
  const raisedTier = [
    /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-raised\)\s*!important/i
  ];
  const surfaceTier = [
    /(?:^|;)\s*background-color\s*:\s*var\(--kick-night-surface\)\s*!important/i
  ];
  const contracts = [
    [
      `${root} [class~="_main-interface_fvouj_1"][class~="_main-interface-with-navigation_fvouj_13"][class~="_navOpen_fvouj_17"]`,
      pageTier
    ],
    [
      `${root} [class~="_container_9a976_1"][class~="_borderTop_116yu_17"]`,
      raisedTier
    ],
    [
      `${root} [class~="_flexLayout_mvksx_2"][class~="w-100"][class~="_content_1mxb1_8"]`,
      surfaceTier
    ],
    [
      `${root} [class~="form-group"][class~="form-group--icon"][class~="form-group--icon--left"]`,
      surfaceTier
    ],
    [
      `${root} [class~="_row_4s7es_6"][class~="_headerRow_y765f_21"][class~="_headers_16kq2_68"]`,
      raisedTier
    ],
    ...["name", "entities", "team", "startDate", "actions", "filler"].map((semanticName) => [
      `${root} [class~="_cell_16kq2_45"][class~="${semanticName}"]`,
      surfaceTier
    ])
  ];

  for (const [selector, declarations] of contracts) {
    assertSelectorDeclarations(rules, selector, declarations);
  }
});
