# Kick Night Mode

A private, carefully designed Chrome dark mode for the [Kick accounting web app](https://use.kick.co/).

Kick Night Mode applies a polished dark theme whenever it is enabled, without reading, storing, or transmitting accounting data. It runs only on `use.kick.co` and requests no Chrome permissions.

## Install in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in desktop Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the repository folder—the folder containing `manifest.json`.
6. Reload any open Kick tabs.

Open [use.kick.co](https://use.kick.co/). Dark mode applies before first paint. To return to Kick's original appearance, disable the extension from `chrome://extensions`.

The theme uses charcoal and deep navy surfaces designed for long accounting sessions. It protects receipts, attachments, uploaded documents, logos, avatars, images, video, canvases, SVG charts, and third-party frames from automatic recoloring. Printing resets to a light, ink-friendly presentation.


## Privacy and security

The extension:

- Runs only on `https://use.kick.co/*`.
- Stores no settings.
- Does not request access to tabs, browsing history, cookies, the clipboard, or network requests.
- Does not use analytics, remote code, remote fonts, or external assets.
- Does not read transaction text, form values, or other accounting page content.
- Does not observe clicks, typing, form submissions, or other page interactions.

You can audit the complete runtime in `manifest.json`, `src/`, and `styles/`.

## Development

The extension runtime uses plain HTML, CSS, and JavaScript with no runtime
dependencies. Node.js 20 or newer and the exact locked Playwright development
dependency are required for tests and validation.

```bash
npm install
npx playwright install chromium
npm run test:unit
npm run test:visual
npm test
npm run check
```

`npm test` runs the unit and rendered-browser suites. `npm run check` runs both
suites plus packaged-extension validation. The rendered suite loads sanitized
Kick fixtures, enforces selector evidence and WCAG contrast contracts, exercises
interaction states, verifies the print reset, and compares reviewed screenshots.

See [Dark-theme evidence and testing](docs/dark-theme-testing.md) for the
privacy-safe fixture refresh procedure, selector-inventory rules, contrast
thresholds, snapshot review, and authenticated release QA.

Regenerate the bundled raster icons after changing the icon generator:

```bash
npm run generate:icons
```

The validation script rejects expanded permissions, broader host matches, missing resources, remote runtime URLs, data-transport APIs, dangerous dynamic code, unexpected page-content access, malformed icons, and an unprotected stylesheet.

## Project structure

```text
manifest.json              Chrome Manifest V3 package definition
src/content.js             Synchronous always-dark root activation
styles/kick-dark.css       Scoped dark theme and media safety rules
icons/                     Bundled Chrome raster icons
scripts/                   Deterministic icon generation and validation
test/fixtures/             Sanitized Kick structures and selector inventory
test/visual/               Rendered contrast, state, print, and snapshot tests
test/                      Node behavior and package-contract tests
docs/dark-theme-testing.md Fixture refresh and authenticated QA guide
docs/superpowers/          Product design and implementation plan
```

## Limitations

Kick is an independently developed web application, so a future Kick interface update may introduce new light surfaces that need an additional scoped selector. Third-party bank-connection windows and other cross-origin embedded services retain their own appearance. Authenticated transaction, report, journal-entry, and document workflows should be visually reviewed whenever Kick substantially changes its UI.

## Troubleshooting

- If the theme does not appear, confirm the extension is enabled and the page URL begins with `https://use.kick.co/`, reload the extension from `chrome://extensions`, then reload the Kick tab.
- If a receipt or chart looks wrong, disable the extension and open an issue with a screenshot that contains no financial or personal information.

Kick Night Mode is an independent project and is not affiliated with or endorsed by Kick.
