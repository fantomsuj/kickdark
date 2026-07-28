const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  auditContrast,
  auditFocusedIndicator,
  loadFixture,
  productionStylesheetPath
} = require("./helpers.cjs");

const fixtureNames = [
  "tasks",
  "activity",
  "categories",
  "document-categories",
  "documents",
  "transactions",
  "clients",
  "accounts",
  "rules",
  "accounting",
  "chart-of-accounts",
  "reconciliation",
  "counterparties",
  "classes",
  "insights",
  "profit-loss",
  "balance-sheet",
  "general-ledger",
  "trial-balance",
  "expenses-by-vendor",
  "cash-flow-statement",
  "invoicing",
  "billing",
  "team",
  "organization-billing",
  "tasks-new-task",
  "dialog-menu-form",
  "command-palette",
  "filter-dialog",
  "menu",
  "form",
  "empty-state"
];
const fixtureDirectory = path.join(__dirname, "..", "fixtures");

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

function evidenceSelector(selector) {
  return selector
    .replace(/::placeholder/g, "")
    .replace(/:(?:hover|focus-visible|focus|active|checked)\b/g, "")
    .replace(
      /\[(?:aria-(?:selected|expanded|disabled)|data-state)="[^"]+"\]/g,
      ""
    );
}

function isDocumentedSelectorException(selector, declarations, inPrint) {
  if (inPrint) return true;
  if (
    selector === 'html[data-kick-night-mode="dark"]' ||
    /#(?:root|__next)\b/.test(selector) ||
    /\sbody\s*>\s*div:first-of-type/.test(selector)
  ) {
    return true;
  }
  if (/::-webkit-scrollbar/.test(selector)) return true;
  if (
    /(?:\bimg\b|\bvideo\b|\bcanvas\b|\bsvg\b|\biframe\b|\bobject\b|\bembed\b|\breceipt\b|\battachment\b|\bupload\b|\bdocument\b|\bavatar\b|\blogo\b|\bpdf\b)/.test(
      selector
    ) &&
    /(?:filter\s*:\s*none|color-scheme\s*:\s*light)/i.test(declarations)
  ) {
    return true;
  }
  return false;
}

async function productionRules(page) {
  await loadFixture(page, "tasks");
  return page.evaluate(() => {
    const root = document.querySelector(
      "style[data-kick-night-production-stylesheet]"
    );
    const rules = [];
    const collect = (cssRules, inPrint = false) => {
      for (const rule of Array.from(cssRules)) {
        const isPrint =
          inPrint ||
          (rule.constructor.name === "CSSMediaRule" &&
            rule.conditionText.toLowerCase() === "print");
        if (rule.selectorText) {
          rules.push({
            selectorText: rule.selectorText,
            declarations: rule.style.cssText,
            inPrint: isPrint
          });
        }
        if (rule.cssRules) collect(rule.cssRules, isPrint);
      }
    };
    collect(root.sheet.cssRules);
    return rules;
  });
}

async function loadCombinedFixtures(page) {
  const fragments = fixtureNames.map((fixtureName) => {
    const source = fs.readFileSync(
      path.join(fixtureDirectory, `${fixtureName}.html`),
      "utf8"
    );
    return source
      .replace(/<!doctype html>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<body([^>]*)>/i, "<div$1>")
      .replace(/<\/body>/i, "</div>");
  });
  const fixtureCss = fs.readFileSync(
    path.join(fixtureDirectory, "fixture-shell.css"),
    "utf8"
  );
  const productionCss = fs.readFileSync(productionStylesheetPath, "utf8");

  await page.setContent(
    `<html data-kick-night-mode="dark"><body>${fragments.join(
      "\n"
    )}</body></html>`
  );
  await page.addStyleTag({ content: fixtureCss });
  await page.addStyleTag({ content: productionCss });
}

test("every production selector has captured DOM evidence", async ({ page }) => {
  const rules = await productionRules(page);
  const selectors = [];

  for (const rule of rules) {
    for (const selector of splitSelectors(rule.selectorText)) {
      if (
        isDocumentedSelectorException(
          selector,
          rule.declarations,
          rule.inPrint
        )
      ) {
        continue;
      }
      selectors.push({ selector, candidate: evidenceSelector(selector) });
    }
  }

  await loadCombinedFixtures(page);
  const unmatched = await page.evaluate((queries) => {
    return queries
      .filter(({ candidate }) => {
        try {
          return document.querySelector(candidate) === null;
        } catch {
          return true;
        }
      })
      .map(({ selector }) => selector);
  }, selectors);

  expect(unmatched, `selectors without captured evidence:\n${unmatched.join("\n")}`)
    .toEqual([]);
});

for (const fixtureName of fixtureNames) {
  test(`${fixtureName} has zero computed contrast violations`, async ({
    page
  }) => {
    await loadFixture(page, fixtureName);
    const report = await auditContrast(page);

    expect(
      report.textViolations,
      JSON.stringify(report.textViolations, null, 2)
    ).toEqual([]);
    expect(
      report.controlViolations,
      JSON.stringify(report.controlViolations, null, 2)
    ).toEqual([]);
  });
}

test("major surfaces pair a dark background with readable foreground", async ({
  page
}) => {
  for (const fixtureName of fixtureNames) {
    await loadFixture(page, fixtureName);
    const failures = await page
      .locator(
        [
          "[data-kick-night-test-surface]",
          "main > article > div:first-child > div:first-child",
          "section:has([role='columnheader']) > div:first-child"
        ].join(",")
      )
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const style = getComputedStyle(element);
          const match = style.backgroundColor.match(
            /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/
          );
          if (!match) return [`${element.localName}: unparseable background`];
          const channels = match.slice(1).map(Number);
          const isWhite = channels.every((channel) => channel >= 245);
          return isWhite
            ? [
                `${
                  element.getAttribute("data-kick-night-test-surface") ||
                  element.localName
                }: ${style.backgroundColor}`
              ]
            : [];
        })
      );
    expect(failures, `${fixtureName} contains unthemed major surfaces`).toEqual(
      []
    );
  }
});

test("business profile heading and field labels remain readable", async ({
  page
}) => {
  await loadFixture(page, "form");

  const colors = await page.locator("main h1, main .form-group__label")
    .evaluateAll((elements) =>
      elements.map((element) => ({
        selector: element.matches("h1") ? "h1" : ".form-group__label",
        color: getComputedStyle(element).color
      }))
    );

  expect(colors).toEqual([
    { selector: "h1", color: "rgb(244, 247, 251)" },
    { selector: ".form-group__label", color: "rgb(183, 192, 206)" },
    { selector: ".form-group__label", color: "rgb(183, 192, 206)" }
  ]);
});

test("Command-K Home pill and shortcut keycaps use dark surfaces", async ({
  page
}) => {
  await loadFixture(page, "command-palette");

  const keycaps = await page.locator('[role="dialog"] kbd').evaluateAll(
    (elements) =>
      elements.map((element) => ({
        current: element.getAttribute("aria-current"),
        color: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderTopColor
      }))
  );

  expect(keycaps).toEqual([
    {
      current: "page",
      color: "rgb(244, 247, 251)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    },
    {
      current: null,
      color: "rgb(183, 192, 206)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    },
    {
      current: null,
      color: "rgb(183, 192, 206)",
      background: "rgb(15, 24, 38)",
      border: "rgb(113, 129, 152)"
    }
  ]);
});

test("audited route surfaces contain no white glare bands", async ({ page }) => {
  const auditedSurfaces = {
    tasks: ".sub-navigation-portals > div > div",
    activity: "main > div > .w-100",
    categories: "main > div > .w-100",
    "document-categories": "main > div > .w-100",
    transactions:
      ".sub-navigation-portals > div:first-child > div:first-child, .transactions > div:first-child > div:first-child",
    clients:
      ".sub-navigation-portals > div > div, .billingOwnership, .billingOwnership > div",
    accounts: ".balance",
    rules: "main > div > .w-100, main table, main th, main td",
    accounting: "main > div > .w-100, main a",
    "chart-of-accounts": "main > div > .w-100",
    counterparties:
      "main > div > .w-100, section:has(.view-table-row) + div",
    classes: "main > div > .w-100",
    insights: "main > div > .w-100",
    "profit-loss":
      "main > div > .w-100, main header:has(h3.font-weight-medium), .has-overflow > section, .has-overflow > section .view-table-row > div",
    "balance-sheet":
      "main > div > .w-100, .view-table-row .label, .data-table__drill-down",
    "general-ledger": "main > div > .w-100",
    "trial-balance": "main > div > .w-100, .title",
    "expenses-by-vendor": "main > div > .w-100, .view-table-row",
    "cash-flow-statement":
      "main > div > .w-100, .view-table-row .label, .data-table__drill-down",
    invoicing: "main",
    billing: ".sub-navigation-portals > div > div",
    "organization-billing": "main > div > div > div",
    "tasks-new-task":
      '[role="dialog"], [role="dialog"] [role="textbox"]',
    "command-palette": '[role="dialog"] kbd',
    "filter-dialog": '[role="dialog"]'
  };

  for (const [fixtureName, selector] of Object.entries(auditedSurfaces)) {
    await loadFixture(page, fixtureName);
    const surfaces = await page.locator(selector).evaluateAll((elements) =>
      elements.map((element) => ({
        tag: element.localName,
        className: element.className,
        background: getComputedStyle(element).backgroundColor
      }))
    );

    expect(surfaces.length, `${fixtureName} audit selector has no evidence`)
      .toBeGreaterThan(0);
    expect(
      surfaces.filter(({ background }) => {
        const match = background.match(
          /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/
        );
        return match && match.slice(1).every((channel) => Number(channel) >= 245);
      }),
      `${fixtureName} contains a white glare surface`
    ).toEqual([]);
  }
});

test("hover, selected, expanded, disabled, and focus-visible states stay legible", async ({
  page
}) => {
  await loadFixture(page, "tasks");
  const row = page.locator(".view-table-row").first();
  await row.hover();
  await row.evaluate((element) => element.setAttribute("aria-selected", "true"));

  const control = page
    .locator("button[data-kick-night-test-control]")
    .first();
  await control.evaluate((element) => {
    element.setAttribute("aria-expanded", "true");
    element.setAttribute("aria-disabled", "true");
  });
  await control.focus();

  const report = await auditContrast(page);
  const focus = await auditFocusedIndicator(
    page,
    "button[data-kick-night-test-control]"
  );

  expect(report.textViolations).toEqual([]);
  expect(report.controlViolations).toEqual([]);
  expect(focus.ratio).toBeGreaterThanOrEqual(3);
});

test("production CSS never depends on fixture-only markers", () => {
  const stylesheet = fs.readFileSync(productionStylesheetPath, "utf8");
  expect(stylesheet).not.toMatch(/data-kick-night-(?:test|fixture)/);
});

test("print media resets the rendered dark fixture to light", async ({ page }) => {
  await loadFixture(page, "tasks");
  await page.emulateMedia({ media: "print" });

  const surfaces = await page
    .locator(
      [
        "body",
        "nav.navigation-menu",
        "header",
        "main",
        ".view-table-row",
        "button"
      ].join(",")
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.color,
          background: style.backgroundColor,
          shadow: style.boxShadow
        };
      })
    );

  expect(surfaces.length).toBeGreaterThan(0);
  expect(surfaces).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        color: "rgb(0, 0, 0)",
        background: "rgb(255, 255, 255)",
        shadow: "none"
      })
    ])
  );
  expect(
    surfaces.filter(
      ({ color, background }) =>
        color !== "rgb(0, 0, 0)" || background !== "rgb(255, 255, 255)"
    )
  ).toEqual([]);
});

for (const fixtureName of fixtureNames) {
  test(`${fixtureName} matches the reviewed sanitized snapshot`, async ({
    page
  }) => {
    await loadFixture(page, fixtureName);
    await expect(page).toHaveScreenshot(`sanitized-${fixtureName}.png`, {
      fullPage: true,
      timeout: 15000
    });
  });

  test(`${fixtureName} matches the reviewed compact snapshot`, async ({
    page
  }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await loadFixture(page, fixtureName);
    await expect(page).toHaveScreenshot(
      `sanitized-${fixtureName}-compact.png`,
      {
        fullPage: true,
        timeout: 15000
      }
    );
  });
}
