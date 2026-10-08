# Step 21F2 — Smart Notification Engine v2

Base: Myfnt 2.12.1
Release: 2.12.2

## Scope
Notification engine and notification-center presentation only. Booking save, IndexedDB transaction logic, SMS delivery/queue, finance, calendar, authentication and sync semantics were not redesigned in this step.

## Implemented
- One smart attention bundle per booking instead of multiple duplicated smart cards.
- Severity model: critical / high / normal / low.
- Context-aware issues: missing booking number, missing phone, missing price, missing package, no payment, overpayment, remaining balance near the event, event today/tomorrow/two days, past-event balance, temporary booking expiry.
- Smart actions derived from each issue.
- Stable dedupe key per booking (`smart:bundle:<bookingId>`).
- Auto-resolution: when all reasons disappear, bundle becomes resolved and remains visible for up to 24 hours as processed.
- Active unresolved bundles become unread again after 24 hours, without creating duplicate cards.
- Snooze: one hour / evening / tomorrow. Snooze metadata is local UI metadata and does not alter booking domain data.
- Daily digest (`smart:digest:<YYYY-MM-DD>`) with today's events, critical/high count and total remaining balance.
- Only today's digest is retained as active digest.
- Notification center tabs: All / Needs Attention.
- Legacy computed phone/balance/overdue/pending/today cards are suppressed when an authoritative v2 bundle exists for the same booking.
- Custom reminder rules and operational activity notifications remain independent and are not suppressed.

## Noise-control rules
- A remaining balance by itself becomes a smart attention issue only when the event is within 10 days (or already passed).
- Resolved cards are excluded from Needs Attention and unread badge counts.
- Snoozed notifications are excluded from inbox/badge until snooze expires.
- Stable keys prevent daily duplicate creation.

## Files changed
- assets/js/myfnt-notifications.js
- assets/js/ui.js
- assets/js/app.js
- assets/css/app.css
- assets/js/core.js (version only)
- index.html (version/cache query only)
- service-worker.js (cache/version only)

## Manual QA
1. Booking with missing phone + missing price -> one attention card with both reasons.
2. Add phone only -> same card updates and phone reason disappears.
3. Add price and resolve all issues -> card becomes "processed" instead of another card being created.
4. Booking tomorrow with remaining amount -> Critical/High card and payment action.
5. Tap Snooze -> choose hour/evening/tomorrow -> card disappears and returns only after due time if still unresolved.
6. Needs Attention tab excludes normal successful activity notifications.
7. Daily digest appears once for the current day and updates its text instead of duplicating.
8. Custom alert/reminder and booking/payment activity notifications still render normally.
