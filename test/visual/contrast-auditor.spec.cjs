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
      button {
        color: rgb(0, 0, 0);
        background: rgb(250, 250, 250);
        border: 1px solid rgb(230, 230, 230);
      }
      button:focus-visible {
        outline: 2px solid rgb(0, 90, 180);
        outline-offset: 2px;
      }
    </style>
    <button data-kick-night-test-control>Control</button>
  `);

  const report = await auditContrast(page);
  expect(report.controlViolations).toHaveLength(1);

  await page.getByRole("button").focus();
  const focus = await auditFocusedIndicator(page, "button");
  expect(focus.ratio).toBeGreaterThanOrEqual(3);
});
