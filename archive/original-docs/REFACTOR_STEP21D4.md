# Step 21D4 — Core Choice Refactor (2.11.2)

## Root cause
Visual chips/cards were implemented in multiple places as a hidden native `input` wrapped by a clickable `label`.
On Android/PWA this creates two interaction paths (label activation + input click/change) which can bubble into window/scroll handlers and trigger unstable layout/focus behavior.

## Architectural fix
A single `MyfntChoice` core was added (`assets/js/myfnt-choice.js`).
Visual choices now use real `button type="button"` elements with `aria-pressed` as their state. Hidden form fields are used only as inert data carriers where form submission still needs a scalar value.

## Migrated components
- Communication-policy event chips and recipient chips (already button-based, now aligned with the same model).
- Booking-form required-field chips.
- Booking-form visible-control chips.
- Alert-rule channel chips.
- Upgrade billing-cycle cards.
- Upgrade payment-method cards.
- Package visibility choice.
- Package icon choice grid.

## Intentionally NOT converted
Real form switches/checkboxes that are not visual chips, e.g. a true on/off setting, remain native controls.

## Rule going forward
Do not implement a visual chip/card using `label + hidden checkbox/radio`.
Use `button + aria-pressed` and `MyfntChoice`.
