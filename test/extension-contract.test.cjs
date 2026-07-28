const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);

test("the manifest activates only the always-on Kick content script", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal("permissions" in manifest, false);
  assert.equal("host_permissions" in manifest, false);
  assert.equal("action" in manifest, false);
  assert.equal("background" in manifest, false);
  assert.equal(manifest.content_scripts.length, 1);

  const [contentScript] = manifest.content_scripts;
  assert.deepEqual(contentScript.matches, ["https://use.kick.co/*"]);
  assert.deepEqual(contentScript.js, ["src/content.js"]);
  assert.deepEqual(contentScript.css, ["styles/kick-dark.css"]);
  assert.equal(contentScript.run_at, "document_start");
  assert.equal(contentScript.all_frames, false);
  assert.equal(contentScript.match_about_blank, false);
});

test("appearance preference and popup runtime files are absent", () => {
  for (const relativePath of [
    "src/theme-core.js",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js"
  ]) {
    assert.equal(
      fs.existsSync(path.join(projectRoot, relativePath)),
      false,
      `${relativePath} should not ship`
    );
  }
});

test("the content runtime has no preference or listener machinery", () => {
  const contentSource = fs.readFileSync(
    path.join(projectRoot, "src/content.js"),
    "utf8"
  );

  assert.doesNotMatch(
    contentSource,
    /\b(?:storage|runtime|matchMedia|addEventListener|removeEventListener)\b/
  );
});

test("the packaged extension passes manifest, privacy, and asset validation", () => {
  const validation = spawnSync(
    process.execPath,
    ["scripts/validate-extension.mjs"],
    {
      cwd: projectRoot,
      encoding: "utf8"
    }
  );

  assert.equal(
    validation.status,
    0,
    [validation.stdout, validation.stderr].filter(Boolean).join("\n")
  );
  assert.match(validation.stdout, /Extension validation passed/);
  assert.match(validation.stdout, /permissions: none/);
  assert.match(validation.stdout, /host scope: https:\/\/use\.kick\.co\/\*/);
  assert.match(validation.stdout, /icons: 16, 32, 48, 128/);
});
