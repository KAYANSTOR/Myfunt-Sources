# Myfnt 2.14.11 — Preview Stability Hotfix

## Fixed
- Booking preview no longer crashes with `ReferenceError: phoneDisplay is not defined`.
- The preview now derives the visible local phone number from the canonical `MyfntPhone.display()` formatter while keeping normalized digits for contact actions.
- Card click flow remains unchanged; the fix is at the actual failing preview renderer.

## Preserved
- Event Registry and Recipient/Channel Resolver from 2.14.8.
- Smart Notification Engine and all existing alert defaults.
