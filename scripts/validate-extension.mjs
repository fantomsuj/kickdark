import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(projectRoot, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function expectExact(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} must remain narrowly scoped`);
}

function expectFile(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  assert.ok(fs.existsSync(absolutePath), `missing manifest resource: ${relativePath}`);
  return absolutePath;
}

function pngDimensions(relativePath) {
  const data = fs.readFileSync(expectFile(relativePath));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(data.subarray(0, 8).equals(signature), `${relativePath} is not a PNG`);
  assert.equal(data.toString("ascii", 12, 16), "IHDR", `${relativePath} lacks IHDR`);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

assert.equal(manifest.manifest_version, 3, "manifest must use version 3");
expectExact(manifest.permissions, ["storage"], "permissions");
assert.equal("host_permissions" in manifest, false, "broad host permissions are forbidden");
assert.equal("background" in manifest, false, "a background worker is unnecessary");
assert.equal("web_accessible_resources" in manifest, false, "web-accessible resources are unnecessary");

assert.equal(manifest.content_scripts.length, 1, "exactly one content script declaration is expected");
const [contentScript] = manifest.content_scripts;
expectExact(contentScript.matches, ["https://use.kick.co/*"], "host scope");
expectExact(contentScript.js, ["src/theme-core.js", "src/content.js"], "content script order");
expectExact(contentScript.css, ["styles/kick-dark.css"], "content styles");
assert.equal(contentScript.run_at, "document_start");
assert.equal(contentScript.all_frames, false);
assert.equal(contentScript.match_about_blank, false);

const referencedFiles = new Set([
  ...contentScript.js,
  ...contentScript.css,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon)
]);
for (const relativePath of referencedFiles) expectFile(relativePath);

const expectedIconSizes = [16, 32, 48, 128];
for (const size of expectedIconSizes) {
  const relativePath = manifest.icons[String(size)];
  assert.equal(relativePath, `icons/icon-${size}.png`);
  expectExact(pngDimensions(relativePath), { width: size, height: size }, `icon ${size}`);
}

const runtimeFiles = [
  "manifest.json",
  "src/theme-core.js",
  "src/content.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "styles/kick-dark.css"
];
const remoteUrlPattern = /https?:\/\/(?!use\.kick\.co\/\*)/i;
const dangerousPatterns = [
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /\bnew\s+Function\b/, label: "dynamic Function" },
  { pattern: /\.innerHTML\s*=/, label: "innerHTML assignment" },
  { pattern: /\bfetch\s*\(/, label: "network fetch" },
  { pattern: /\bXMLHttpRequest\b/, label: "XMLHttpRequest" },
  { pattern: /\bWebSocket\b/, label: "WebSocket" },
  { pattern: /\bsendBeacon\b/, label: "sendBeacon" }
];

for (const relativePath of runtimeFiles) {
  const source = fs.readFileSync(expectFile(relativePath), "utf8");
  assert.doesNotMatch(source, remoteUrlPattern, `${relativePath} contains a remote URL`);
  for (const { pattern, label } of dangerousPatterns) {
    assert.doesNotMatch(source, pattern, `${relativePath} uses prohibited ${label}`);
  }
}

const contentSource = fs.readFileSync(
  path.join(projectRoot, "src", "content.js"),
  "utf8"
);
assert.doesNotMatch(
  contentSource,
  /\b(querySelector|querySelectorAll|getElementById|getElementsByClassName|textContent)\b/,
  "the page content script must not read accounting DOM content"
);
assert.doesNotMatch(
  contentSource,
  /addEventListener\s*\(\s*["'](?:click|input|submit|keydown|keyup)["']/,
  "the page content script must not observe user interactions"
);

const stylesheet = fs.readFileSync(
  path.join(projectRoot, "styles", "kick-dark.css"),
  "utf8"
);
assert.doesNotMatch(stylesheet, /filter\s*:\s*invert\s*\(/i);
assert.match(stylesheet, /@media\s+print/i);

console.log("Extension validation passed");
console.log("  permissions: storage only");
console.log("  host scope: https://use.kick.co/*");
console.log(`  icons: ${expectedIconSizes.join(", ")}`);
console.log("  runtime: local-only, no data transport APIs");
