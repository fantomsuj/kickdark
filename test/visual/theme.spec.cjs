const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  auditContrast,
  auditFocusedIndicator,
  loadFixture,
  productionStylesheetPath
} = require("./helpers.cjs");
const { fixtureCases, fixtureNames } = require("./audit-cases.cjs");
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
    expect(
      report.iconViolations,
      JSON.stringify(report.iconViolations, null, 2)
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
                }: ${style.backgroundColor} ${element.outerHTML.slice(0, 220)}`
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

test("unclassified controls and structural containers keep Kick geometry and hierarchy", async ({
  page
}) => {
  const productionCss = fs.readFileSync(productionStylesheetPath, "utf8");
  await page.setContent(`
    <html data-kick-night-mode="dark">
      <body>
        <section style="color: rgb(21, 31, 41); background: rgb(241, 242, 243)">
          <button style="color: rgb(31, 41, 51); border: 0px none rgb(31, 41, 51); background: transparent">
            <svg></svg>
          </button>
          <div role="status" style="color: rgb(41, 51, 61); background: transparent"></div>
          <table><tbody><tr><td><span style="color: rgb(51, 61, 71); background: transparent"></span></td></tr></tbody></table>
          <input class="form-check-input" type="checkbox" style="width: 21px; height: 19px">
        </section>
      </body>
    </html>
  `);
  await page.addStyleTag({ content: productionCss });

  const styles = await page.locator("section, button, [role='status'], td > span, input")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          tag: element.localName,
          role: element.getAttribute("role"),
          color: style.color,
          background: style.backgroundColor,
          borderWidth: style.borderTopWidth,
          ...(element.matches("input")
            ? {
                width: style.width,
                height: style.height,
                color: undefined,
                background: undefined,
                borderWidth: undefined
              }
            : {})
        };
      })
    );

  expect(styles).toEqual([
    {
      tag: "section",
      role: null,
      color: "rgb(21, 31, 41)",
      background: "rgb(241, 242, 243)",
      borderWidth: "0px"
    },
    {
      tag: "button",
      role: null,
      color: "rgb(31, 41, 51)",
      background: "rgba(0, 0, 0, 0)",
      borderWidth: "0px"
    },
    {
      tag: "div",
      role: "status",
      color: "rgb(41, 51, 61)",
      background: "rgba(0, 0, 0, 0)",
      borderWidth: "0px"
    },
    {
      tag: "span",
      role: null,
      color: "rgb(51, 61, 71)",
      background: "rgba(0, 0, 0, 0)",
      borderWidth: "0px"
    },
    {
      tag: "input",
      role: null,
      color: undefined,
      background: undefined,
      borderWidth: undefined,
      width: "21px",
      height: "19px"
    }
  ]);
});

test("bare icon controls stay borderless and transparent at rest", async ({
  page
}) => {
  await loadFixture(page, "tasks");
  const styles = await page
    .locator("button[data-kick-night-test-control]:has(svg)")
    .evaluateAll((elements) =>
      elements
        .filter((element) => !element.textContent.trim())
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            color: style.color,
            background: style.backgroundColor,
            borderWidth: style.borderTopWidth
          };
        })
    );

  expect(styles.length).toBeGreaterThan(0);
  expect(styles).toEqual(
    styles.map(() => ({
      color: "rgb(244, 247, 251)",
      background: "rgba(0, 0, 0, 0)",
      borderWidth: "0px"
    }))
  );
});

test("task checkbox geometry is identical in light and dark modes", async ({
  page
}) => {
  await loadFixture(page, "tasks");
  const checkbox = page.locator(".form-check-input").first();
  const dark = await checkbox.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  await page.locator("html").evaluate((element) => {
    element.removeAttribute("data-kick-night-mode");
  });
  const light = await checkbox.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });

  expect(Math.abs(dark.width - light.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(dark.height - light.height)).toBeLessThanOrEqual(1);
});

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "compact", width: 1024, height: 900 },
  { name: "desktop", width: 1440, height: 900 }
]) {
  test(`${viewport.name} fixture shell has no horizontal overflow`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadFixture(page, "tasks");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
  });
}

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

async function focusedSnapshotTarget(page, fixtureName) {
  if (fixtureName === "mobile-unavailable") {
    return page.locator(
      "body > div:first-of-type > div:has(> h1 + p):has(button)"
    );
  }

  const captureRoot = page.locator("[data-kick-night-fixture-surface]");
  const captureRootCount = await captureRoot.count();
  if (captureRootCount === 1) {
    const tag = await captureRoot.evaluate((element) => element.localName);
    if (tag !== "html" && tag !== "body") return captureRoot;
  }

  const topLevelDialog = page.locator(
    "[role='dialog']:not([role='dialog'] [role='dialog'])"
  );
  if ((await topLevelDialog.count()) === 1) return topLevelDialog;

  const topLevelMain = page.locator("main:not(main main)");
  if ((await topLevelMain.count()) === 1) return topLevelMain;

  return page.locator("body");
}

for (const auditCase of fixtureCases) {
  const viewportPairs =
    auditCase.viewportClass === "mobile"
      ? [
          { label: null, width: 375, height: 812 },
          { label: "768", width: 768, height: 1024 }
        ]
      : [
          { label: null, width: 1440, height: 900 },
          { label: "1024", width: 1024, height: 900 }
        ];

  for (const viewport of viewportPairs) {
    for (const theme of ["light", "dark"]) {
      test(`${auditCase.id} ${viewport.width}px ${theme} matches reviewed focused evidence`, async ({
        page
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height
        });
        await loadFixture(page, auditCase.fixture);
        if (theme === "light") {
          await page.locator("html").evaluate((element) => {
            element.removeAttribute("data-kick-night-mode");
          });
        }

        const evidenceName = path.basename(auditCase.evidence[theme]);
        const snapshotName = viewport.label
          ? evidenceName.replace(
              `-${theme}.png`,
              `-${viewport.label}-${theme}.png`
            )
          : evidenceName;
        const target = await focusedSnapshotTarget(page, auditCase.fixture);
        await expect(target).toHaveScreenshot(snapshotName, {
          timeout: 15000
        });
      });
    }
  }
}
