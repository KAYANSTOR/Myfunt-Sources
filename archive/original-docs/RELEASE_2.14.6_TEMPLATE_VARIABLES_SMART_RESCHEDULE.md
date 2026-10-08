# Myfnt 2.14.6 — Template Variables & Smart Reschedule

## Added
- Unified canonical variable catalog shared by event templates and reminder rules.
- Arabic hash variables such as #اسم_الشركة, #موعد_المناسبة, #نوع_الباقة, #المتبقي.
- Existing English-brace variables remain fully compatible.
- Variable picker inserts at the current cursor position.
- Live template preview using real company/booking data when available.
- Arabic day name automatically appears through #يوم_المناسبة and #موعد_المناسبة.
- SMS character/segment estimator with Unicode/GSM-7 awareness.

## Scheduling hardening
- Pending rule-based reminder messages are cancelled when a booking is edited/rescheduled.
- Pending reminder messages are cancelled when a booking is cancelled.
- Transactional history such as booking-created/payment messages is not cancelled.
- Cancelled queued messages no longer consume SMS reservation limits.
- Internal reminder rendering now uses the same canonical template formatter as SMS.

## Compatibility
- Existing default reminder rules are preserved.
- Existing templates are preserved.
- Smart notification monitoring was not replaced or removed.
