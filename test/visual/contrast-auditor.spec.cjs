const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const helperPath = path.join(__dirname, "helpers.cjs");

test("contrast auditor composites backgrounds and applies WCAG text thresholds", async ({
  page
}) => {
  expect(
    fs.existsSync(helperPath),
    "the rendered contrast auditor must exist"
  ).toBe(true);
  const { auditContrast } = require(helperPath);

  await page.setContent(`
    <style>
      html, body { background: rgb(255, 255, 255); }
      .overlay { background: rgba(0, 0, 0, 0.8); }
      .good { color: rgb(255, 255, 255); }
      .bad { color: rgb(130, 130, 130); }
      .large { color: rgb(220, 220, 220); font: 700 19px/1 sans-serif; }
    </style>
    <div class="overlay">
      <p class="good">Readable normal text</p>
      <p class="bad">Unreadable normal text</p>
      <p class="large">Readable large text</p>
    </div>
  `);

  const report = await auditContrast(page);

  expect(report.auditedTextNodes).toBe(3);
  expect(report.textViolations).toHaveLength(1);
  expect(report.textViolations[0].text).toBe("Unreadable normal text");
  expect(report.textViolations[0].threshold).toBe(4.5);
});

test("control and focus indicators require three-to-one contrast", async ({
  page
}) => {
  expect(
    fs.existsSync(helperPath),
    "the rendered contrast auditor must exist"
  ).toBe(true);
  const { auditContrast, auditFocusedIndicator } = require(helperPath);

  await page.setContent(`
    <style>
      html, body { background: rgb(255, 255, 255); }
      input {
        color: rgb(0, 0, 0);
        background: rgb(250, 250, 250);
        border: 1px solid rgb(230, 230, 230);
      }
      input:focus-visible {
        outline: 2px solid rgb(0, 90, 180);
        outline-offset: 2px;
      }
    </style>
    <input data-kick-night-test-control value="Control">
  `);

  const report = await auditContrast(page);
  expect(report.controlViolations).toHaveLength(1);

  await page.locator("input").focus();
  const focus = await auditFocusedIndicator(page, "input");
  expect(focus.ratio).toBeGreaterThanOrEqual(3);
});

test("boxed text buttons require three-to-one boundary contrast", async ({
  page
}) => {
  const { auditContrast } = require(helperPath);

  await page.setContent(`
    <style>
      html, body { background: rgb(255, 255, 255); }
      button {
        color: rgb(0, 0, 0);
        background: rgb(250, 250, 250);
        border: 1px solid rgb(230, 230, 230);
      }
    </style>
    <button data-kick-night-test-control>Save changes</button>
  `);

  const report = await auditContrast(page);
  expect(report.controlViolations).toHaveLength(1);
  expect(report.controlViolations[0].element).toBe("button");
  expect(report.controlViolations[0].threshold).toBe(3);
});

test("borderless text buttons rely on label contrast instead of a resting boundary", async ({
  page
}) => {
  const { auditContrast } = require(helperPath);

  await page.setContent(`
    <style>
      html, body { background: rgb(26, 35, 54); }
      button {
        color: rgb(244, 247, 251);
        background: rgb(15, 24, 38);
        border: 1px solid transparent;
      }
    </style>
    <button data-kick-night-test-control>View details</button>
  `);

  const report = await auditContrast(page);
  expect(report.textViolations).toEqual([]);
  expect(report.controlViolations).toEqual([]);
});

test("bare icon controls audit icon contrast without requiring a resting box", async ({
  page
}) => {
  const { auditContrast } = require(helperPath);

  await page.setContent(`
    <style>
      html, body { background: rgb(20, 30, 40); }
      button { color: rgb(50, 60, 70); border: 0; background: transparent; }
      svg { color: currentColor; fill: currentColor; }
    </style>
    <button data-kick-night-test-control><svg><path></path></svg></button>
  `);

  const report = await auditContrast(page);
  expect(report.controlViolations).toEqual([]);
  expect(report.iconViolations).toHaveLength(1);
  expect(report.iconViolations[0].threshold).toBe(3);
});
