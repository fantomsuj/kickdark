const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("the packaged extension passes manifest, privacy, and asset validation", () => {
  const projectRoot = path.join(__dirname, "..");
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
  assert.match(validation.stdout, /permissions: storage only/);
  assert.match(validation.stdout, /host scope: https:\/\/use\.kick\.co\/\*/);
  assert.match(validation.stdout, /icons: 16, 32, 48, 128/);
});
