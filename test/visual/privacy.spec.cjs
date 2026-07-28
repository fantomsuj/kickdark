const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const sanitizerPath = path.join(
  __dirname,
  "..",
  "..",
  "scripts",
  "sanitize-kick-dom.js"
);

test("in-page capture removes private content before serialization", async ({
  page
}) => {
  expect(
    fs.existsSync(sanitizerPath),
    "the in-page sanitizer must exist before structural capture"
  ).toBe(true);

  await page.setContent(`
    <main id="account-4815" class="page-shell bg-white">
      Private Client 8472
      <a href="https://example.test/private-ledger">Private document</a>
      <input value="4111111111111111" aria-label="Private bank account">
      <section
        class="card_abc123 _kickButton_1hog9_2 stable-panel view-table-row form-group__label object-icon__content period-2026-01-01-2026-07-27 account-4815"
        data-state="open"
        data-account-id="secret"
        style="color: red"
      >
        $98,765.43
      </section>
    </main>
  `);
  await page.addScriptTag({ path: sanitizerPath });

  const capture = await page.evaluate(() =>
    window.KickFixtureSanitizer.capture(document.querySelector("main"), {
      route: "privacy-test",
      surface: "page"
    })
  );
  const serialized = JSON.stringify(capture);

  for (const privateValue of [
    "Private Client",
    "8472",
    "example.test",
    "private-ledger",
    "4111111111111111",
    "Private bank account",
    "98,765.43",
    "account-4815",
    "period-2026-01-01-2026-07-27",
    "data-account-id",
    "color: red"
  ]) {
    expect(serialized).not.toContain(privateValue);
  }

  expect(capture.html).toContain('class="page-shell bg-white"');
  expect(capture.html).toContain(
    'class="stable-panel view-table-row form-group__label object-icon__content"'
  );
  expect(capture.html).toContain("form-group__label");
  expect(capture.html).toContain("object-icon__content");
  expect(capture.html).not.toContain("_kickButton_1hog9_2");
  expect(capture.html).toContain('data-state="open"');
  expect(capture.html).toContain('data-kick-night-test-text="normal"');
  expect(capture.route).toBe("privacy-test");
  expect(capture.surface).toBe("page");
});

test("capture accepts DOM elements whose document has no browsing window", async ({
  page
}) => {
  await page.addScriptTag({ path: sanitizerPath });

  const capturedHtml = await page.evaluate(() => {
    const detachedDocument = document.implementation.createHTMLDocument("");
    detachedDocument.body.textContent = "Private detached text";
    return window.KickFixtureSanitizer.capture(detachedDocument.body, {
      route: "detached-test",
      surface: "page"
    }).html;
  });

  expect(capturedHtml).toContain("data-kick-night-test-text");
  expect(capturedHtml).not.toContain("Private detached text");
});
