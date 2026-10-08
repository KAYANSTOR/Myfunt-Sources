# QA — Myfnt 2.14.11 Preview Stability Hotfix

## Root cause confirmed from production diagnostic
`ReferenceError: phoneDisplay is not defined` inside `openPreview()` in `assets/js/bookings.js`.

The booking card click and event delegation were working; execution reached `openPreview()` and failed while rendering the phone row.

## Source fix
The preview now defines the display value from the canonical phone formatter:
- normalized phone stays used for contact actions.
- displayed phone uses `MyfntPhone.display()` so Yemen `967` is omitted in UI according to current app behavior.

No click-handler workaround or duplicate listener was added.

## Verification
- all JavaScript files: syntax check passed.
- all JSON files: parsed successfully.
- duplicate HTML IDs: none.
- ZIP integrity: passed.
- `phoneDisplay` now has a local declaration in `openPreview()`.

## Preserved
2.14.8 Event Registry, Recipient/Channel Resolver, Smart Notifications, templates and defaults remain unchanged.
