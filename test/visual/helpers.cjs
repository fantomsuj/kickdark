const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.join(__dirname, "..", "..");
const productionStylesheetPath = path.join(
  repositoryRoot,
  "styles",
  "kick-dark.css"
);
const fixtureStylesheetPath = path.join(
  repositoryRoot,
  "test",
  "fixtures",
  "fixture-shell.css"
);

function contrastRuntime() {
  function parseColor(value) {
    const match = value.match(
      /^rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i
    );
    if (!match) throw new Error(`Unsupported computed color: ${value}`);
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] === undefined ? 1 : Number(match[4])
    };
  }

  function composite(foreground, background) {
    const alpha = foreground.a + background.a * (1 - foreground.a);
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r:
        (foreground.r * foreground.a +
          background.r * background.a * (1 - foreground.a)) /
        alpha,
      g:
        (foreground.g * foreground.a +
          background.g * background.a * (1 - foreground.a)) /
        alpha,
      b:
        (foreground.b * foreground.a +
          background.b * background.a * (1 - foreground.a)) /
        alpha,
      a: alpha
    };
  }

  function effectiveBackground(element) {
    const layers = [];
    for (let current = element; current; current = current.parentElement) {
      layers.push(parseColor(getComputedStyle(current).backgroundColor));
    }

    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) result = composite(layer, result);
    return result;
  }

  function channel(value) {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  }

  function luminance(color) {
    return (
      channel(color.r) * 0.2126 +
      channel(color.g) * 0.7152 +
      channel(color.b) * 0.0722
    );
  }

  function contrast(first, second) {
    const lighter = Math.max(luminance(first), luminance(second));
    const darker = Math.min(luminance(first), luminance(second));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function rounded(value) {
    return Math.round(value * 100) / 100;
  }

  function colorLabel(color) {
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(
      color.b
    )}, ${rounded(color.a)})`;
  }

  function visibleTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const element = node.parentElement;
          const style = getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility !== "visible" ||
            Number(style.opacity) === 0
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          const range = document.createRange();
          range.selectNodeContents(node);
          return range.getClientRects().length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }

  function textAudit() {
    const violations = [];
    const nodes = visibleTextNodes();

    for (const node of nodes) {
      const element = node.parentElement;
      const style = getComputedStyle(element);
      const background = effectiveBackground(element);
      const foreground = composite(parseColor(style.color), background);
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const isLarge =
        fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const threshold = isLarge ? 3 : 4.5;
      const ratio = contrast(foreground, background);

      if (ratio + 0.001 < threshold) {
        violations.push({
          text: node.nodeValue.trim(),
          element: element.localName,
          className: element.className,
          ratio: rounded(ratio),
          threshold,
          foreground: colorLabel(foreground),
          background: colorLabel(background)
        });
      }
    }

    return { audited: nodes.length, violations };
  }

  function controlAudit() {
    const selector = [
      "[data-kick-night-test-control]",
      "input:not([type='hidden'])",
      "select",
      "textarea"
    ].join(",");
    const controls = Array.from(document.querySelectorAll(selector)).filter(
      (element) => {
        const style = getComputedStyle(element);
        return (
          element.getAttribute("aria-hidden") !== "true" &&
          style.display !== "none" &&
          style.visibility === "visible" &&
          element.getClientRects().length > 0
        );
      }
    );
    const violations = [];

    for (const element of controls) {
      if (element.matches("button, [role='button']")) continue;

      const isBareIcon =
        element.matches("button, [role='button']") &&
        element.querySelector("svg") &&
        !element.textContent.trim();
      if (isBareIcon) continue;

      const style = getComputedStyle(element);
      const surrounding = effectiveBackground(element.parentElement);
      const fill = effectiveBackground(element);
      const border = parseColor(style.borderTopColor);
      const borderWidth = Number.parseFloat(style.borderTopWidth);
      const borderRatio =
        borderWidth > 0 ? contrast(composite(border, surrounding), surrounding) : 1;
      const fillRatio = contrast(fill, surrounding);
      const ratio = Math.max(borderRatio, fillRatio);
      const isUnboxedButton =
        element.matches("button, [role='button']") &&
        borderWidth === 0 &&
        fillRatio < 1.01;
      const isNativeChoice =
        element.matches("input[type='checkbox'], input[type='radio']") &&
        style.appearance !== "none";

      if (!isUnboxedButton && !isNativeChoice && ratio + 0.001 < 3) {
        violations.push({
          element: element.localName,
          className: element.className,
          ratio: rounded(ratio),
          threshold: 3,
          border: colorLabel(border),
          fill: colorLabel(fill),
          surrounding: colorLabel(surrounding)
        });
      }
    }

    return { audited: controls.length, violations };
  }

  function iconAudit() {
    const icons = Array.from(
      document.querySelectorAll(
        "button svg, [role='button'] svg, [role='menuitem'] svg, [role='option'] svg"
      )
    ).filter((element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility === "visible" &&
        element.getClientRects().length > 0
      );
    });
    const violations = [];

    for (const element of icons) {
      const style = getComputedStyle(element);
      const background = effectiveBackground(element);
      const foreground = composite(parseColor(style.color), background);
      const ratio = contrast(foreground, background);
      if (ratio + 0.001 < 3) {
        violations.push({
          element: element.localName,
          className: element.className.baseVal || element.className,
          control: element.closest("button, [role='button']")?.outerHTML.slice(
            0,
            240
          ),
          container:
            element.closest(
              "[data-kick-night-test-surface], .entities-navigation, .view-table-row, footer, header, main, nav"
            )?.outerHTML.slice(0, 180),
          ratio: rounded(ratio),
          threshold: 3,
          foreground: colorLabel(foreground),
          background: colorLabel(background)
        });
      }
    }

    return { audited: icons.length, violations };
  }

  function focusedIndicator(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing focus target: ${selector}`);
    const style = getComputedStyle(element);
    const surrounding = effectiveBackground(element.parentElement);
    const outline = parseColor(style.outlineColor);
    const outlineWidth = Number.parseFloat(style.outlineWidth);
    const ratio =
      outlineWidth > 0 && style.outlineStyle !== "none"
        ? contrast(composite(outline, surrounding), surrounding)
        : 1;
    return {
      ratio: rounded(ratio),
      threshold: 3,
      width: outlineWidth,
      style: style.outlineStyle,
      color: colorLabel(outline),
      surrounding: colorLabel(surrounding)
    };
  }

  return { textAudit, controlAudit, iconAudit, focusedIndicator };
}

async function auditContrast(page) {
  return page.evaluate((runtimeSource) => {
    const runtime = (0, eval)(`(${runtimeSource})`)();
    const text = runtime.textAudit();
    const controls = runtime.controlAudit();
    const icons = runtime.iconAudit();
    return {
      auditedTextNodes: text.audited,
      auditedControls: controls.audited,
      auditedIcons: icons.audited,
      textViolations: text.violations,
      controlViolations: controls.violations,
      iconViolations: icons.violations
    };
  }, contrastRuntime.toString());
}

async function auditFocusedIndicator(page, selector) {
  return page.evaluate(
    ({ runtimeSource, target }) => {
      const runtime = (0, eval)(`(${runtimeSource})`)();
      return runtime.focusedIndicator(target);
    },
    { runtimeSource: contrastRuntime.toString(), target: selector }
  );
}

async function loadFixture(page, fixtureName) {
  const fixturePath = path.join(
    repositoryRoot,
    "test",
    "fixtures",
    `${fixtureName}.html`
  );
  const fixtureHtml = fs.readFileSync(fixturePath, "utf8");
  const fixtureCss = fs.readFileSync(fixtureStylesheetPath, "utf8");
  const productionCss = fs.readFileSync(productionStylesheetPath, "utf8");

  await page.setContent(fixtureHtml);
  await page.addStyleTag({ content: fixtureCss });
  await page.addStyleTag({ content: productionCss });
  await page.locator("style").last().evaluate((element) => {
    element.dataset.kickNightProductionStylesheet = "";
  });
  await page.locator("[data-kick-night-test-text]").evaluateAll((elements) => {
    for (const element of elements) {
      if (!element.textContent.trim()) {
        element.append(document.createTextNode("Sample"));
      }
    }
  });
}

module.exports = {
  auditContrast,
  auditFocusedIndicator,
  loadFixture,
  productionStylesheetPath,
  repositoryRoot
};
