# Myfnt Refactor Step 4 — Booking Form

Goal: organize booking-form CSS without changing the visible result or booking behavior.

## Changes
- Removed obsolete date-control layout patches from `app.css` that had been superseded by `myfnt-form-v294.css`.
- Kept the generic base `.date-control` rule in `app.css` as a harmless foundation.
- Made `#bookingForm .date-control` the single owner of the booking form's final date layout.
- Consolidated duplicate booking-date input declarations into one rule.
- Moved booking time panel styles (`booking-time-panel`, fields, description) from global `app.css` into the booking-form stylesheet and scoped them to `#bookingForm`.
- Preserved the current package chip sizing and form-only money-word styling.
- No HTML structure or booking JavaScript behavior was changed.
- Cache revision updated from `r3` to `r4`; visible application version remains 2.9.7.

## Validation
- JavaScript syntax: OK
- CSS brace balance: OK
- Missing HTML local assets: 0
- Missing Service Worker local assets: 0
- Legacy 1.9.3/1.9.4 date layout patches: removed
- Booking date input final rule: one form-scoped declaration
- Booking time panel: one form-scoped owner

## Intentionally not changed
- Booking data model
- Package selection logic
- Amount/deposit calculations
- Customer matching behavior
- Hidden/required field settings
- Booking save flow
- Success dialogs
- Dark mode behavior
- Other forms using `.booking-form` or `.sticky-actions`
