# Command Palette Dark-Mode Repair

## Goal

Remove the remaining light-theme artifacts from Kick's Command-K palette while
preserving the palette's existing dark hierarchy and blue keyboard-focus
treatment.

## Scope

The repair covers the visible `Home` pill and command shortcut keycaps inside
the Command-K dialog. The dialog shell, search field, command rows, backdrop,
focus behavior, and palette layout remain unchanged.

This change does not alter the extension runtime, manifest, permissions,
activation behavior, or theme palette.

## Styling design

- Give the `Home` pill the page fill with primary night-mode text.
- Give shortcut keycaps the page fill with muted night-mode text.
- Use the existing control-border token to keep each compact surface legible.
- Preserve the current blue focus and selection accents.
- Scope every new rule behind `html[data-kick-night-mode="dark"]` and the
  command dialog's stable semantic structure.
- Do not use Kick's generated CSS-module class names.
- Do not apply a blanket background override to all dialog descendants because
  that could damage calendars, form controls, icons, and status treatments.

## Structural evidence

Add a dedicated privacy-safe sanitized fixture for the Command-K palette with
the confirmed semantic structure for its pills and shortcut labels. The fixture
must contain no account data, page copy, values, URLs, identifiers, or generated
class selectors.

If the live structure exposes a semantic element such as `kbd`, use that
element within the dialog scope. Otherwise, select the narrowest stable
role/element relationship present in the sanitized structure. The production
selector must match the selector inventory.

## Testing

Follow a red-green cycle:

1. Add the sanitized palette structure and a rendered regression assertion.
2. Confirm the test fails because the pill/keycap surfaces compute to a light
   background.
3. Add the minimal scoped CSS rule.
4. Confirm the targeted test and all existing unit and visual tests pass.

The regression test must verify that:

- the `Home` pill and shortcut keycaps have non-light backgrounds;
- their text remains readable;
- the dialog's focus/selection accent remains the existing blue token; and
- existing filter-dialog and calendar rendering remains unchanged.

## Acceptance criteria

- No white `Home` pill or shortcut keycaps remain in the Command-K palette.
- The keycaps are visually distinct from command rows without appearing bright.
- Blue focus and selection affordances remain visible.
- Other dialogs and routes have no visual regressions.
- `npm run check` and `git diff --check` pass.
