# 04 — نموذج البيانات

## الهوية

كل Domain entity له:

- `id`: UUID canonical.
- `company_id`: tenant boundary.
- `version`: optimistic concurrency عند الكيانات المتزامنة.
- `created_at` / `updated_at` عند الحاجة.
- `deleted_at` للـsoft delete حيث يسمح العقد.

### الأرقام المعروضة

- `booking_no`
- `customer_no`
- `receipt_no`
- `movement_no`

هذه أرقام عرض/أعمال داخل الشركة وليست هوية المزامنة.

## الكيانات الأساسية

| الكيان | الغرض |
|---|---|
| companies | مساحة الشركة |
| users | الحسابات العالمية |
| company_memberships | عضوية المستخدم داخل الشركة |
| company_settings | إعدادات الشركة |
| plans | تعريف الخطط |
| company_subscriptions | اشتراك الشركة |
| booking_packages | الباقات |
| booking_package_versions | تاريخ أسعار الباقات |
| booking_types | أنواع/حالات المناسبة |
| customers | العملاء |
| bookings | الحجز الرئيسي |
| booking_details | Snapshot وتفاصيل الحجز |
| payments | الحركات المالية |
| booking_audit | سجل الحجز |
| payment_audit | سجل السند |
| wallets | الصناديق/المحافظ |
| ledger_accounts | الحسابات |
| journal_entries | القيود |
| journal_lines | سطور القيود |
| calendar_blocks | منع/تمييز التقويم |
| alert_rules | قواعد التنبيه |
| notifications | إشعارات التطبيق |
| notification_jobs | تنفيذ إشعارات الخادم |
| sms_templates | قوالب SMS |
| sms_messages | سجل الرسائل |
| sms_approvals | موافقات الإرسال |
| company_backups | Metadata للنسخ |
| support_tickets | الدعم |
| support_messages | رسائل الدعم |
| chat_threads | المحادثات |
| chat_messages | رسائل المحادثات |
| archive_records | الأرشيف |
| error_logs | سجل الأخطاء |
| sync_change_log | Delta feed للخادم |
| sync_idempotency | منع تكرار Push |
| sync_conflicts | التعارضات |

## علاقات أساسية

```text
Company
 ├── Memberships → Users
 ├── Settings
 ├── Packages
 │    └── Package Versions
 ├── Customers
 │    └── Bookings
 │          ├── Booking Details
 │          ├── Payments
 │          └── Booking Audit
 ├── Wallets / Ledger
 ├── Calendar Blocks
 ├── Alert Rules
 ├── Messages / Approvals
 └── Backups / Support / Archive
```

## المال

المرجع النهائي يستخدم minor units في التخزين/API.

مثال:
- `100.50` → `10050` minor عند العمل بعملة ذات منزلتين.

Flutter يجب أن يخزن/يتعامل مع القيم المالية بدقة مناسبة، وألا يستخدم floating point كمرجع محاسبي.

## Booking

الحد الأدنى:

- customer
- event date
- start/end
- confirmation
- temporary expiry
- status
- amount
- paid cache
- currency
- package snapshot
- customer snapshot
- deposit/discount/surcharge
- audit

## قاعدة الحذف

- الحجوزات والعملاء والباقات: Soft Delete حسب السياسة.
- السندات والقيود: لا حذف نهائي.
- التصحيح المالي: Reverse/Correction.
- Audit: Append-only.

## قاعدة Tenant

كل Query tenant-scoped يجب أن تقيد بـ`company_id` من Scope الموثوق.

لا تثق في company id القادم من Body كسلطة.
