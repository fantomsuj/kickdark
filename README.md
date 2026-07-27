# Kick Night Mode

A private, carefully designed Chrome dark mode for the [Kick accounting web app](https://use.kick.co/).

Kick Night Mode adds System, Light, and Dark appearance settings without reading, storing, or transmitting accounting data. It runs only on `use.kick.co` and requests only Chrome's local `storage` permission.

## Install in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in desktop Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Select **Load unpacked**.
5. Choose the repository folder—the folder containing `manifest.json`.
6. Pin **Kick Night Mode** from Chrome's Extensions menu.

Open [use.kick.co](https://use.kick.co/) and choose **System**, **Light**, or **Dark** from the toolbar popup. Existing Kick tabs update immediately; reload the extension from `chrome://extensions` after changing its source files.

## Appearance modes

- **System** follows the computer's light or dark appearance and is the default.
- **Light** restores Kick's original presentation.
- **Dark** uses charcoal and deep navy surfaces designed for long nighttime sessions.

The dark theme protects receipts, attachments, uploaded documents, logos, avatars, images, video, canvases, SVG charts, and third-party frames from automatic color inversion. Printing resets to a light, ink-friendly presentation.

## Privacy and security

The extension:

- Runs only on `https://use.kick.co/*`.
- Stores one local setting: `kickNightModePreference`.
- Does not request access to tabs, browsing history, cookies, the clipboard, or network requests.
- Does not use analytics, remote code, remote fonts, or external assets.
- Does not read transaction text, form values, or other accounting page content.
- Does not observe clicks, typing, form submissions, or other page interactions.

You can audit the complete runtime in `manifest.json`, `src/`, `popup/`, and `styles/`.

## Development

The extension uses plain HTML, CSS, and JavaScript and has no runtime or development dependencies. Node.js 20 or newer is required for tests and validation.

```bash
npm test
npm run validate
npm run check
```

Regenerate the bundled raster icons after changing the icon generator:

```bash
npm run generate:icons
```

The validation script rejects expanded permissions, broader host matches, missing resources, remote runtime URLs, data-transport APIs, dangerous dynamic code, unexpected page-content access, malformed icons, and an unprotected stylesheet.

## Project structure

```text
manifest.json              Chrome Manifest V3 package definition
src/theme-core.js          Appearance validation and resolution
src/content.js             Kick page theme controller
popup/                     Toolbar popup UI and controller
styles/kick-dark.css       Scoped dark theme and media safety rules
icons/                     Bundled Chrome raster icons
scripts/                   Deterministic icon generation and validation
test/                      Node behavior and package-contract tests
docs/superpowers/          Product design and implementation plan
```

## Limitations

Kick is an independently developed web application, so a future Kick interface update may introduce new light surfaces that need an additional scoped selector. Third-party bank-connection windows and other cross-origin embedded services retain their own appearance. Authenticated transaction, report, journal-entry, and document workflows should be visually reviewed whenever Kick substantially changes its UI.

## Troubleshooting

- If the theme does not appear, confirm the extension is enabled and the page URL begins with `https://use.kick.co/`, then reload the Kick tab.
- If the popup reports a storage error, reload the extension from `chrome://extensions`.
- If a receipt or chart looks wrong, switch to Light mode and open an issue with a screenshot that contains no financial or personal information.

Kick Night Mode is an independent project and is not affiliated with or endorsed by Kick.
