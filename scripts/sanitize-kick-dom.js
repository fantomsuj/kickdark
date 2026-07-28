(function exposeSanitizer(root) {
  "use strict";

  const SAFE_STATE_ATTRIBUTES = new Set([
    "aria-busy",
    "aria-checked",
    "aria-current",
    "aria-disabled",
    "aria-expanded",
    "aria-haspopup",
    "aria-hidden",
    "aria-invalid",
    "aria-modal",
    "aria-pressed",
    "aria-selected",
    "contenteditable",
    "data-orientation",
    "data-side",
    "data-state",
    "disabled",
    "role",
    "tabindex",
    "type"
  ]);

  const SAFE_CLASS_TOKEN = /^[A-Za-z_-][A-Za-z0-9_:/.-]{0,79}$/;
  const GENERATED_CLASS_TOKEN =
    /(?:^css-|^sc-|^_[a-z0-9-]+_[a-z0-9]{5}_[0-9]+$|(?<!_)_[a-z0-9]{5,}$)/i;
  const SENSITIVE_CLASS_TOKEN =
    /(?:\d{4}-\d{2}-\d{2}|\b\d{4,}\b)/;
  const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr"
  ]);

  function stableClassTokens(element) {
    return Array.from(element.classList).filter(
      (token) =>
        SAFE_CLASS_TOKEN.test(token) &&
        !GENERATED_CLASS_TOKEN.test(token) &&
        !SENSITIVE_CLASS_TOKEN.test(token) &&
        !/https?:|www\.|@/i.test(token)
    );
  }

  function safeStateValue(name, value) {
    if (name === "role") return /^[a-z-]{1,32}$/i.test(value);
    if (name === "type") {
      return /^(?:button|checkbox|email|number|password|radio|search|submit|tel|text|url)$/i.test(
        value
      );
    }
    if (name === "tabindex") return /^(?:-1|0)$/.test(value);
    if (name === "data-orientation") return /^(?:horizontal|vertical)$/.test(value);
    if (name === "data-side") return /^(?:top|right|bottom|left)$/.test(value);
    if (name === "data-state") {
      return /^(?:active|checked|closed|disabled|empty|inactive|indeterminate|off|on|open|selected|unchecked)$/i.test(
        value
      );
    }
    return /^(?:true|false|page|step|location|date|time|list|menu|dialog|grid|tree)$/i.test(
      value
    );
  }

  function escapeAttribute(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sanitizeElement(source, rootSurface) {
    const classTokens = stableClassTokens(source);
    const attributes = [];
    if (classTokens.length > 0) {
      attributes.push(`class="${escapeAttribute(classTokens.join(" "))}"`);
    }

    for (const { name, value } of Array.from(source.attributes)) {
      if (name === "class" || !SAFE_STATE_ATTRIBUTES.has(name)) continue;
      if (name === "disabled" && value === "") {
        attributes.push("disabled");
      } else if (safeStateValue(name, value)) {
        attributes.push(`${name}="${escapeAttribute(value)}"`);
      }
    }

    let hadVisibleText = false;
    const children = [];
    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === 1) {
        children.push(sanitizeElement(child));
      } else if (child.nodeType === 3 && child.nodeValue.trim()) {
        hadVisibleText = true;
      }
    }

    if (hadVisibleText) {
      attributes.push('data-kick-night-test-text="normal"');
    }
    if (rootSurface) {
      attributes.push(
        `data-kick-night-fixture-surface="${escapeAttribute(rootSurface)}"`
      );
    }

    const openingTag = `<${source.localName}${
      attributes.length > 0 ? ` ${attributes.join(" ")}` : ""
    }>`;
    if (VOID_ELEMENTS.has(source.localName)) return openingTag;
    return `${openingTag}${children.join("")}</${source.localName}>`;
  }

  function safeLabel(value, fallback) {
    return typeof value === "string" && /^[a-z0-9-]{1,48}$/.test(value)
      ? value
      : fallback;
  }

  function selectorCandidates(element) {
    const selectors = new Set([element.localName]);

    for (const token of stableClassTokens(element)) {
      const escaped = token.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      selectors.add(`[class~="${escaped}"]`);
    }

    for (const { name, value } of Array.from(element.attributes)) {
      if (!SAFE_STATE_ATTRIBUTES.has(name) || !safeStateValue(name, value)) {
        continue;
      }
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      selectors.add(`[${name}="${escaped}"]`);
    }

    return selectors;
  }

  function capture(source, metadata = {}) {
    if (!source || source.nodeType !== 1 || !source.ownerDocument) {
      throw new TypeError("capture source must be a page element");
    }

    const route = safeLabel(metadata.route, "unknown-route");
    const surface = safeLabel(metadata.surface, "unknown-surface");
    const html = sanitizeElement(source, surface);

    const candidates = new Set();
    for (const element of [source, ...source.querySelectorAll("*")]) {
      for (const selector of selectorCandidates(element)) {
        candidates.add(selector);
      }
    }

    return Object.freeze({
      version: 1,
      route,
      surface,
      html,
      selectorCandidates: Array.from(candidates).sort()
    });
  }

  root.KickFixtureSanitizer = Object.freeze({ capture });
})(typeof globalThis === "object" ? globalThis : window);
