# Step 21F — Smart Notifications & Immediate Messaging

Baseline: Myfnt 2.11.9 (stable booking-save / IndexedDB blocked fix).

## Scope
Only messaging / notifications were changed. Booking persistence, IndexedDB schema, auth, roles, finance transactions and calendar query code were not refactored.

## Transactional SMS
- `booking.created`, `booking.updated`, `booking.cancelled`, `payment.created`, `payment.voided`, and `customer.created` are treated as transactional events.
- Transactional SMS requests are due immediately; company preferred-send-time and stagger scheduling do not delay them.
- If a newly-created booking contains its initial receipt, booking creation + first payment are bundled into ONE `booking.created` SMS event. No second `payment.created` SMS is generated for that initial receipt.
- Default booking-created text mentions the first payment and remaining balance when an initial payment exists.
- `balance.remaining` is an internal smart insight by default and is not automatically emitted as another SMS after booking/payment changes.

## Offline SMS outbox
- Offline is not counted as a failed attempt.
- Due rows remain `queued` with `بانتظار عودة الإنترنت`.
- Queue flush runs on app boot, `online`, foreground visibility, and every 30 seconds while visible and online.
- Idempotency keys remain the duplicate-prevention authority.
- If no SMS gateway adapter is connected, rows remain queued rather than being falsely marked sent.

## Smart internal notifications
A reconcile engine runs on startup, every scheduler cycle, booking/payment changes, and foreground return. It upserts current conditions and removes stale condition alerts.

Current insights include:
- booking created / later payment created activity (visible in the company inbox, including the current/admin account)
- booking without booking number
- booking without customer phone
- booking without price
- booking with no payment
- remaining balance
- event today
- event tomorrow
- event in two days
- past event with remaining balance
- temporary booking expiring within six hours
- expired temporary booking
- SMS waiting / sent / failed states

Smart-condition alerts use stable keys so the same issue is updated, not duplicated. When the underlying condition is fixed, the stale smart alert is removed.

## Reminder rules
Rules still decide their due time. Once a reminder becomes due, the SMS request is eligible immediately; it is not scheduled a second time to another company send window.

## Important runtime boundary
The static PWA can queue and retry while it is open/foregrounded. Reliable delivery while the PWA is fully closed, cross-device notification fan-out, and secret gateway execution remain server responsibilities for the future Laravel Queue/API layer.
