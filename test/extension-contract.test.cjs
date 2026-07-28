const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8")
);

test("the manifest declares the Kick theme and toolbar toggle without permissions", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal("permissions" in manifest, false);
  assert.equal("host_permissions" in manifest, false);
  assert.deepEqual(manifest.action, {
    default_title: "Toggle Kick Night Mode",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  });
  assert.deepEqual(manifest.background, {
    service_worker: "src/background.js"
  });
  assert.equal(manifest.content_scripts.length, 1);

  const [contentScript] = manifest.content_scripts;
  assert.deepEqual(contentScript.matches, ["https://use.kick.co/*"]);
  assert.deepEqual(contentScript.js, ["src/content.js"]);
  assert.deepEqual(contentScript.css, ["styles/kick-dark.css"]);
  assert.equal(contentScript.run_at, "document_start");
  assert.equal(contentScript.all_frames, false);
  assert.equal(contentScript.match_about_blank, false);
});

test("unused popup and theme-controller runtime files remain absent", () => {
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

test("the content runtime does not inspect accounting DOM content or page input", () => {
  const contentSource = fs.readFileSync(
    path.join(projectRoot, "src/content.js"),
    "utf8"
  );

  assert.doesNotMatch(
    contentSource,
    /\b(querySelector|querySelectorAll|getElementById|getElementsByClassName|textContent)\b/
  );
  assert.doesNotMatch(
    contentSource,
    /addEventListener\s*\(\s*["'](?:click|input|submit|keydown|keyup)["']/
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
  assert.match(validation.stdout, /toolbar: tab relay/);
  assert.match(validation.stdout, /preference: namespaced appearance only/);
});
