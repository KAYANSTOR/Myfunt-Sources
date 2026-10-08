# 16 — القرارات وحل تعارضات الوثائق

## الهدف

هذا الملف يمنع رجوع الوكيل إلى وثيقة تاريخية وتنفيذ قرار قديم بالخطأ.

## القرار 1 — اسم المنتج

**Canonical:** Mivent / مايفنت

**Legacy:** Myfnt / Ozan

السبب: الاسم الظاهر في manifest والعلامة المستخدمة في تجربة المنتج هي مايفنت، بينما Myfnt/Ozan أسماء داخلية تاريخية.

## القرار 2 — Sync Push

**Canonical:**

`POST /api/v1/sync/push`

**Legacy references:**

`POST /api/v1/sync/commands`

السبب:
- adapter الحالي يستعمل `/sync/push`.
- JSON sync contract الحالي يحدد `/sync/push`.

## القرار 3 — الشركة والمستخدمون

**Canonical schema:** `company_memberships`

**Canonical UI wording:** `مستخدمو الشركة`

لا ننشئ `company_users` كجدول جديد بسبب تقرير parity.

## القرار 4 — Booking Details

هناك تقرير parity يصف محاولة دمج التفاصيل، بينما SQL المرجعي المنظم ما زال يملك:

- `bookings`
- `booking_details`

إذن Flutter canonical domain يحافظ على الفصل، مع إمكانية تقديم Aggregate في repository.

## القرار 5 — Audit names

Canonical:
- `booking_audit`
- `payment_audit`

لا تحولها إلى `booking_logs` أو `payment_logs` دون عقد جديد.

## القرار 6 — Auth

Canonical client flow:
- phone start.
- phone verify.
- session.

تقرير `/auth/login` أقدم، ويعامل كتفصيل backend داخلي محتمل وليس عقد Flutter الأساسي.

## القرار 7 — Backup

Local backup ≠ Cloud backup.

لا تجعل وجود internet يؤدي تلقائيًا إلى رفع نسخة محلية قديمة إلى الخادم.

## القرار 8 — Feature Gate

Client gate UX فقط.

Server gate أمني.

## القرار 9 — Historical docs

لا نحذفها.

لا نعدلها لتتظاهر بأنها Canonical.

نضعها في `archive/` مع إبقاء النسخة الأصلية.

## القرار 10 — Flutter ليس PWA

- Service Worker لا ينتقل.
- IndexedDB لا تنتقل كتنفيذ.
- Install banner لا ينتقل.
- Browser LocalStorage لا ينتقل.

الذي ينتقل:
- السلوك.
- البيانات.
- السياسات.
- الهوية البصرية.
- Offline-first.
- النسخ والمزامنة.
