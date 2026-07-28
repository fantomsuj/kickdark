import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const captureDirectory = path.resolve(
  repositoryRoot,
  process.argv[2] || ".context/captures"
);
const fixtureDirectory = path.join(repositoryRoot, "test", "fixtures");
const fixtureNames = [
  "tasks",
  "documents",
  "transactions",
  "clients",
  "accounts",
  "rules",
  "profit-loss",
  "invoicing",
  "billing",
  "tasks-new-task",
  "dialog-menu-form",
  "filter-dialog",
  "menu",
  "form",
  "empty-state"
];

function captureFromFile(fixtureName) {
  const capturePath = path.join(captureDirectory, `${fixtureName}.json`);
  const source = JSON.parse(fs.readFileSync(capturePath, "utf8"));
  return source.capture || source;
}

function assertSanitized(capture, fixtureName) {
  if (
    capture.version !== 1 ||
    !/^[a-z0-9-]+$/.test(capture.route) ||
    !/^[a-z0-9-]+$/.test(capture.surface)
  ) {
    throw new Error(`${fixtureName} has invalid capture metadata`);
  }
  if (
    /\s(?:id|href|src|action|value|style|aria-label|aria-labelledby|aria-describedby)=/i.test(
      capture.html
    ) ||
    /https?:|www\.|mailto:|@\w+\.\w+/i.test(capture.html) ||
    />[^<\s][^<]*</.test(capture.html)
  ) {
    throw new Error(`${fixtureName} contains unsanitized page content`);
  }
}

function markSurfaces(source) {
  let html = source.replace(/\sclass="undefined"/g, "");
  html = html.replace(
    /<body\b/,
    '<body data-kick-night-test-surface="application"'
  );
  html = html.replace(
    /<main\b/g,
    '<main data-kick-night-test-surface="page"'
  );
  html = html.replace(
    /<nav\b/g,
    '<nav data-kick-night-test-surface="sidebar"'
  );
  html = html.replace(
    /<header\b/g,
    '<header data-kick-night-test-surface="header"'
  );
  html = html.replace(
    /<section\b/g,
    '<section data-kick-night-test-surface="group"'
  );
  html = html.replace(
    /<section data-kick-night-test-surface="group"(\s+class="[^"]*\bToastify\b[^"]*")/g,
    "<section$1"
  );
  html = html.replace(
    /<(div|section)(\s+class="[^"]*\bsub-navigation-portals\b[^"]*")/g,
    '<$1 data-kick-night-test-surface="toolbar"$2'
  );
  html = html.replace(
    /<(div|section)(\s+class="[^"]*\bview-table-row\b[^"]*")/g,
    '<$1 data-kick-night-test-surface="row"$2'
  );
  html = html.replace(
    /<(input|button|select|textarea)\b/g,
    '<$1 data-kick-night-test-control'
  );
  html = html.replace(
    /<([a-z0-9-]+)(\s+[^>]*role="(?:dialog|alertdialog|menu|listbox)"[^>]*)>/gi,
    '<$1 data-kick-night-test-surface="overlay"$2>'
  );
  return html;
}

fs.mkdirSync(fixtureDirectory, { recursive: true });

const manifest = {
  version: 1,
  policy:
    "Captured inside authenticated Kick pages and sanitized before serialization.",
  fixtures: {}
};

for (const fixtureName of fixtureNames) {
  const capture = captureFromFile(fixtureName);
  assertSanitized(capture, fixtureName);
  const fixtureHtml = [
    "<!doctype html>",
    '<html data-kick-night-mode="dark">',
    markSurfaces(capture.html),
    "</html>",
    ""
  ].join("\n");

  fs.writeFileSync(
    path.join(fixtureDirectory, `${fixtureName}.html`),
    fixtureHtml
  );
  manifest.fixtures[fixtureName] = {
    route: capture.route,
    surface: capture.surface,
    selectorCandidates: capture.selectorCandidates
  };
}

fs.writeFileSync(
  path.join(fixtureDirectory, "capture-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

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

function exceptionFor(selector, declarations, inPrint) {
  if (inPrint) return "print";
  if (
    selector === 'html[data-kick-night-mode="dark"]' ||
    /#(?:root|__next)\b/.test(selector) ||
    /\sbody\s*>\s*div:first-of-type/.test(selector)
  ) {
    return "root";
  }
  if (/::-webkit-scrollbar/.test(selector)) return "scrollbar";
  if (
    /(?:\bimg\b|\bvideo\b|\bcanvas\b|\bsvg\b|\biframe\b|\bobject\b|\bembed\b|\breceipt\b|\battachment\b|\bupload\b|\bdocument\b|\bavatar\b|\blogo\b|\bpdf\b)/.test(
      selector
    ) &&
    /(?:filter\s*:\s*none|color-scheme\s*:\s*light)/i.test(declarations)
  ) {
    return "protected-media";
  }
  return null;
}

async function buildSelectorInventory() {
  const browser = await chromium.launch({ channel: "chromium" });
  const page = await browser.newPage();
  const productionCss = fs.readFileSync(
    path.join(repositoryRoot, "styles", "kick-dark.css"),
    "utf8"
  );
  const tasksHtml = fs.readFileSync(
    path.join(fixtureDirectory, "tasks.html"),
    "utf8"
  );

  await page.setContent(tasksHtml);
  await page.addStyleTag({ content: productionCss });
  const rules = await page.evaluate(() => {
    const style = Array.from(document.querySelectorAll("style")).at(-1);
    const collected = [];
    const collect = (cssRules, inPrint = false) => {
      for (const rule of Array.from(cssRules)) {
        const isPrint =
          inPrint ||
          (rule.constructor.name === "CSSMediaRule" &&
            rule.conditionText.toLowerCase() === "print");
        if (rule.selectorText) {
          collected.push({
            selectorText: rule.selectorText,
            declarations: rule.style.cssText,
            inPrint: isPrint
          });
        }
        if (rule.cssRules) collect(rule.cssRules, isPrint);
      }
    };
    collect(style.sheet.cssRules);
    return collected;
  });

  const inventory = {
    version: 1,
    policy:
      "Selectors are mapped to sanitized authenticated fixtures. Test markers are evidence only and are never production selectors.",
    selectors: [],
    variables: {}
  };

  for (const rule of rules) {
    for (const selector of splitSelectors(rule.selectorText)) {
      const exception = exceptionFor(
        selector,
        rule.declarations,
        rule.inPrint
      );
      if (exception) {
        inventory.selectors.push({
          selector,
          evidence: "documented-exception",
          exception,
          routes: [],
          surfaces: [exception]
        });
        continue;
      }

      const routes = new Set();
      const surfaces = new Set();
      const candidate = evidenceSelector(selector);

      for (const fixtureName of fixtureNames) {
        const fixtureHtml = fs.readFileSync(
          path.join(fixtureDirectory, `${fixtureName}.html`),
          "utf8"
        );
        await page.setContent(fixtureHtml);
        const matchedSurfaces = await page.evaluate((query) => {
          let matches;
          try {
            matches = Array.from(document.querySelectorAll(query));
          } catch {
            return [];
          }
          return matches.map((element) => {
            const marked = element.closest(
              "[data-kick-night-test-surface], [data-kick-night-fixture-surface]"
            );
            return (
              marked?.getAttribute("data-kick-night-test-surface") ||
              marked?.getAttribute("data-kick-night-fixture-surface") ||
              element.localName
            );
          });
        }, candidate);

        if (matchedSurfaces.length > 0) {
          routes.add(manifest.fixtures[fixtureName].route);
          for (const surface of matchedSurfaces) surfaces.add(surface);
        }
      }

      inventory.selectors.push({
        selector,
        evidence: "captured",
        routes: Array.from(routes).sort(),
        surfaces: Array.from(surfaces).sort()
      });
    }
  }

  const borderVariableSelectors = inventory.selectors.filter(
    ({ selector }) =>
      selector === 'html[data-kick-night-mode="dark"] header' ||
      selector ===
        'html[data-kick-night-mode="dark"] section:has([role="columnheader"])'
  );
  inventory.variables["--border-color"] = {
    evidence: "authenticated-cssom",
    purpose: "Kick table and organization-header border contract",
    routes: Array.from(
      new Set(borderVariableSelectors.flatMap(({ routes }) => routes))
    ).sort(),
    surfaces: ["group", "header"],
    exclusions: ["financial-state color", "media", "document rendering"]
  };

  fs.writeFileSync(
    path.join(fixtureDirectory, "selector-inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`
  );
  await browser.close();
}

await buildSelectorInventory();
