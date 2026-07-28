const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const fixtureDirectory = path.join(__dirname, "..", "fixtures");
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
