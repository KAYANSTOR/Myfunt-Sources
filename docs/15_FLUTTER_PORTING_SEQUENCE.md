# 15 — تسلسل تحويل الويب إلى Flutter

## المرحلة 1 — Foundation

- Flutter app shell.
- Theme.
- Arabic RTL.
- routing.
- error boundary.
- app bootstrap.
- Riverpod wiring.
- Drift database.

**لا تبنِ كل الشاشات قبل إنهاء هذا الجزء.**

## المرحلة 2 — Canonical DB

أنشئ:
- Company.
- User.
- Membership.
- Settings.
- Package.
- Package version.
- Customer.
- Booking.
- Booking Details.
- Payment.
- Audit.
- Calendar blocks.
- Alert rules.

ثم migrations.

## المرحلة 3 — Repository

ابدأ:
- BookingRepository.
- CustomerRepository.
- PaymentRepository.
- PackageRepository.
- SettingsRepository.

كل repository يوفر:
- read.
- watch.
- insert/update.
- delete/soft delete حسب الكيان.

## المرحلة 4 — Home + Calendar

ابدأ بأكثر رحلة استخدام.

- Home.
- Month navigator.
- Calendar.
- Day booking sheet.
- Upcoming bookings.
- quick actions.

## المرحلة 5 — Bookings

- List.
- Form.
- Details.
- temporary reservation.
- customer matching.
- audit.

## المرحلة 6 — Customers

- search.
- profile.
- history.

## المرحلة 7 — Finance

- payment entry.
- booking totals.
- receipt.
- correction/audit.

## المرحلة 8 — Notifications + Messages

- local notification engine.
- templates.
- outbox.
- message list.
- recipient resolver.

## المرحلة 9 — Settings + Plans

- company.
- booking/calendar customization.
- packages.
- season.
- feature gates.
- usage.

## المرحلة 10 — Backup/Restore

- local backups.
- restore.
- validation.
- secure export.

## المرحلة 11 — Auth

- phone.
- OTP.
- local session.
- server adapter boundary.

## المرحلة 12 — Sync

- Bootstrap.
- Adoption.
- Push.
- Pull.
- Conflict.
- checkpoint/resume.

## المرحلة 13 — Integrations

بعد ثبات الأساس فقط:
- Google Calendar.
- Google Drive.
- SMS provider.
- cloud backup.

## المرحلة 14 — Parity QA

قارن كل flow مقابل المصدر المرجعي.

لا تقارن الشاشة منفردة فقط؛ قارن:

```text
input
→ validation
→ transaction
→ persisted data
→ visible result
→ follow-up actions
```
