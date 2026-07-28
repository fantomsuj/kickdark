const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");
const {
  auditManifest,
  auditManifestPath,
  fixtureNames
} = require("./audit-cases.cjs");

const fixtureDirectory = path.join(__dirname, "..", "fixtures");

test("versioned audit cases drive fixture coverage and paired evidence", () => {
  expect(
    fs.existsSync(auditManifestPath),
    "missing versioned audit case manifest"
  ).toBe(true);

  const manifest = auditManifest;
  expect(manifest.version).toBe(1);
  expect(manifest.cases.length).toBeGreaterThanOrEqual(fixtureNames.length);

  const manifestedFixtures = new Set();
  for (const auditCase of manifest.cases) {
    expect(auditCase.id).toMatch(/^[a-z0-9-]+$/);
    expect(auditCase.route).toBeTruthy();
    expect(auditCase.surface).toBeTruthy();
    expect(auditCase.state).toBeTruthy();
    expect(["desktop", "tablet", "mobile"]).toContain(
      auditCase.viewportClass
    );
    expect(auditCase.expectedControlFamily).toBeTruthy();
    expect(Array.isArray(auditCase.protectedElements)).toBe(true);
    expect(auditCase.evidence.light).toMatch(/-light\.png$/);
    expect(auditCase.evidence.dark).toMatch(/-dark\.png$/);
    if (auditCase.fixture) manifestedFixtures.add(auditCase.fixture);
  }

  expect([...manifestedFixtures].sort()).toEqual([...fixtureNames].sort());
  expect(manifest.cases.map(({ id }) => id)).toEqual(
    expect.arrayContaining([
      "firm-profile-default",
      "task-groups-default",
      "onboarding-default",
      "mobile-unavailable-default"
    ])
  );
});

test("committed audit evidence is complete, paired, and viewport-bounded", () => {
  const auditDirectory = path.dirname(auditManifestPath);

  function pngDimensions(filePath) {
    const bytes = fs.readFileSync(filePath);
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20)
    };
  }

  for (const auditCase of auditManifest.cases.filter(
    ({ fixture }) => fixture
  )) {
    const supplementalLabel =
      auditCase.viewportClass === "mobile" ? "768" : "1024";
    const maxWidths =
      auditCase.viewportClass === "mobile" ? [375, 768] : [1440, 1024];

    for (const [index, label] of [null, supplementalLabel].entries()) {
      const paths = Object.fromEntries(
        ["light", "dark"].map((theme) => {
          const basePath = path.join(
            auditDirectory,
            auditCase.evidence[theme]
          );
          const evidencePath = label
            ? basePath.replace(`-${theme}.png`, `-${label}-${theme}.png`)
            : basePath;
          expect(
            fs.existsSync(evidencePath),
            `missing ${auditCase.id} ${label || "primary"} ${theme} evidence`
          ).toBe(true);
          return [theme, evidencePath];
        })
      );
      const light = pngDimensions(paths.light);
      const dark = pngDimensions(paths.dark);
      expect(dark).toEqual(light);
      expect(light.width).toBeGreaterThan(0);
      expect(light.width).toBeLessThanOrEqual(maxWidths[index]);
      expect(light.height).toBeGreaterThan(0);
    }
  }
});

test("committed fixtures contain sanitized structure only", async () => {
  for (const fixtureName of fixtureNames) {
    const fixturePath = path.join(fixtureDirectory, `${fixtureName}.html`);
    expect(
      fs.existsSync(fixturePath),
      `missing sanitized ${fixtureName} fixture`
    ).toBe(true);

    const html = fs.readFileSync(fixturePath, "utf8");
    expect(html).toContain('data-kick-night-mode="dark"');
    expect(html).toContain("data-kick-night-fixture-surface");
    expect(html).not.toMatch(
      /\s(?:id|href|src|action|value|style|aria-label|aria-labelledby|aria-describedby)=/i
    );
    expect(html).not.toMatch(/https?:|www\.|mailto:|@\w+\.\w+/i);
    expect(html).not.toMatch(
      /class="[^"]*_[a-z0-9-]+_[a-z0-9]{5}_[0-9]+/i
    );
    expect(html).not.toMatch(
      /class="[^"]*(?:\d{4}-\d{2}-\d{2}|\b\d{4,}\b)[^"]*"/i
    );
    expect(html).not.toMatch(/>[^<\s][^<]*</);
  }
});

test("selector inventory maps captured selectors and adopted Kick variables", () => {
  const inventoryPath = path.join(
    fixtureDirectory,
    "selector-inventory.json"
  );
  expect(
    fs.existsSync(inventoryPath),
    "missing route-backed selector inventory"
  ).toBe(true);

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  expect(inventory.version).toBe(1);
  expect(inventory.selectors.length).toBeGreaterThan(20);

  for (const entry of inventory.selectors) {
    expect(entry.selector).toMatch(
      /^html\[data-kick-night-mode="dark"\]/
    );
    if (entry.evidence === "captured") {
      expect(entry.routes.length, entry.selector).toBeGreaterThan(0);
      expect(entry.surfaces.length, entry.selector).toBeGreaterThan(0);
    }
  }

  expect(inventory.variables["--border-color"].routes).toEqual(
    expect.arrayContaining(["tasks", "documents", "transactions"])
  );
  expect(inventory.variables["--border-color"].surfaces).toEqual(
    expect.arrayContaining(["header", "group"])
  );
});
