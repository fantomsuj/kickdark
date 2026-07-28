const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./test/visual",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  reporter: "line",
  outputDir: ".context/playwright-results",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.002
    }
  },
  use: {
    browserName: "chromium",
    channel: "chromium",
    colorScheme: "dark",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 }
  }
});
