# Myfnt 2.14.7 — Event Registry + Communication Contract

## What changed
- Added `myfnt-event-registry.js` as the canonical registry for domain/event codes.
- Booking and finance raw domain events are normalized once into `myfnt:event` envelopes.
- Communication Policy now obtains its configurable event definitions from Event Registry rather than maintaining a second event list.
- Notification Center consumes canonical events for booking/customer/payment communication routing.
- Existing raw listeners remain only as a fail-safe fallback when the registry is unavailable; both paths never run together.
- Smart booking insights retain their current stable detection/storage behavior, but every issue now has a canonical `eventCode` contract ready for later migration.

## Preserved
- Smart Notification Engine and all existing smart checks.
- Alert rules/default reminders and scheduler.
- SMS approval/quiet-hours/template logic from 2.14.5/2.14.6.
- Message result notifications.
- Existing IndexedDB/local data structures; no destructive migration.
