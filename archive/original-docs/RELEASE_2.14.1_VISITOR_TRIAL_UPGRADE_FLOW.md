# Myfnt 2.14.1 — Visitor Trial + Upgrade Flow

## Added
- Visitor onboarding journey after 10 seconds for unauthenticated visitors.
- 4-step onboarding: business type, business name, base packages, first package pricing.
- Local visitor trial workspace with automatic setup.
- Trial limits: up to 5 bookings and 5 payments before prompting real account signup.
- New upgrade payment methods:
  - فلوسك 828338
  - كاش 929383
  - موبايل موني 938383
  - كريمي حاسب 928383
  - جوالي 393873
  - جيب 8383733
- Payment proof image attachment in the upgrade request form.

## Changed
- Financial movement date is now auto-calculated in:
  - create receipt/payment form
  - edit payment form
- Calendar pinning default is ON.
- Package field default is ON.
- Unified settings hub no longer shows "إعدادات النظام".
- Removed MAX and ULTRA plans from subscription plans.

## UX / Visual
- Added dedicated visitor-experience.css and visitor-experience.js.
- Added field notes for auto-calculated dates.
- Enhanced upgrade request layout with proof uploader.

## Version
- App version updated to 2.14.1.
- Service worker and manifest updated.
