# Myfnt — تدقيق تدفق البيانات والمزامنة والنسخ الاحتياطي

الإصدار المفحوص: **2.13.1 / Step21N.1** (مبني على 2.13.0 Step21N)

## 1. النتيجة المعمارية الأساسية

لوحة الإدارة لا يجب أن تكون وسيطًا بين التطبيق وقاعدة البيانات. المسار الإنتاجي الصحيح هو:

```text
تطبيق Myfnt (PWA / Flutter لاحقًا) ─┐
                                    ├── HTTPS API / Laravel ── Business Services ── MySQL
لوحة الإدارة Web Admin ────────────┘                              │
                                                                  ├─ Queue Workers / SMS
                                                                  ├─ Object Storage
                                                                  └─ Backup Service
```

كلا الواجهتين تتحدثان مع نفس API وبنفس قواعد الصلاحيات والعزل `company_id`.

**الوضع الحالي:** لا يوجد Laravel/MySQL متصل. `OzanApi` ما زال `mode: mock`. طبقة `MyfntSync` تمنع عمدًا تفريغ `sync_queue` عندما يكون النقل Mock.

---

## 2. ماذا يحدث حاليًا عند إنشاء حجز؟

1. المستخدم يملأ فورم الحجز.
2. طبقة Repository / Booking logic تنشئ أو تربط العميل.
3. يتم تحديث نموذج الحجز في RAM للواجهة.
4. `MyfntOffline.record()` / `MyfntLocal.commitBookingAggregate()` يحول بيانات الواجهة إلى صفوف normalized.
5. تحفظ المعاملة في IndexedDB `myfnt-local-3.1`.
6. الصفوف الأساسية تكون عادةً:
   - `customers`
   - `bookings`
   - `booking_details`
   - `payments` إذا توجد دفعة
   - سجلات audit اللازمة
7. إذا كان Laravel/API الحقيقي غير مربوط: **لا ينشأ sync_queue**.
8. عند ربط API الحقيقي مستقبلًا: نفس الكتابة المحلية تنشئ command idempotent في `sync_queue` ضمن مسار الكتابة.
9. الـ UI يظل يعمل من IndexedDB/RAM ولا ينتظر الشبكة.

## 3. كيف سترسل التغييرات إلى Laravel؟

الطبقة الحالية مجهزة للعقد التالي:

```text
POST /api/v1/sync/commands
{
  op_id,
  company_id,
  entity_type,
  entity_id,
  operation,
  base_version,
  payload
}
```

الخادم يجب أن:

1. يتحقق من Token.
2. يستخرج عضوية المستخدم للشركة، ولا يثق بـ `company_id` القادم وحده.
3. يتحقق من Permission.
4. يتحقق من `op_id` لمنع تنفيذ الطلب مرتين.
5. يتحقق من `base_version` لمنع الكتابة فوق تعديل جهاز آخر.
6. ينفذ Transaction في MySQL.
7. يزيد `server_version`.
8. يسجل actor / audit.
9. يرجع `server_version` و `request_id`.

بعد نجاح الطلب يحذف العميل الأمر المكتمل من `sync_queue` في Step21N.

## 4. سحب التغييرات من الخادم

العميل الحالي يملك أساسًا لـ:

```text
GET /api/v1/sync/pull?cursor=<cursor>&limit=100
```

ويريد ردًا مثل:

```json
{
  "ok": true,
  "changes": [],
  "next_cursor": "..."
}
```

كل تغيير يطبق في IndexedDB أولًا، ثم يطلق `myfnt:remote-applied`، وبعدها `MyfntHydration` يحدث RAM والواجهة.

إذا وجد تعديل محلي غير محسوم، لا يكتب فوقه بصمت بل يسجل `sync_conflicts`.

---

## 5. تسجيل الدخول لشركة موجودة على جهاز جديد

### الوضع الحالي

المصادقة الحالية Local Demo، ولذلك لا يوجد تنزيل بيانات شركة قديمة من خادم. `auth.js` ينشئ جلسة محلية ويختار شركة موجودة في بيانات الجهاز فقط.

### التنفيذ الإنتاجي المطلوب

#### المرحلة A — Login

```text
POST /api/v1/auth/login
```

الرد يحتوي على:
- access token قصير العمر
- refresh mechanism آمن
- user
- memberships
- active company
- plan/capabilities
- bootstrap token أو revision

#### المرحلة B — Manifest

```text
GET /api/v1/bootstrap/manifest
```

الرد:
- `company_revision`
- عدد الحجوزات
- عدد العملاء
- عدد الحركات
- أقدم/أحدث سنة
- آخر sync cursor
- schema version
- server time

#### المرحلة C — البيانات ذات الأولوية

يتم تنزيل:
1. الشركة والإعدادات
2. المستخدمون والصلاحيات الضرورية
3. الباقات وقواعد التنبيه
4. حجوزات **السنة الحالية + السنة التالية**
5. جميع العملاء المرتبطين بهذه الحجوزات
6. جميع سندات الحجوزات داخل Working Set مهما كان تاريخ دفع السند
7. الحركات المستقلة داخل السنتين

يتم الحفظ مباشرة في IndexedDB على دفعات، وليس بناء JSON عملاق في RAM.

#### المرحلة D — التاريخ القديم

إذا كانت سياسة الشركة تريد Offline history كاملًا، يتم backfill على صفحات أثناء فتح التطبيق:

```text
2025 -> 2024 -> 2023 -> ...
```

البيانات القديمة تحفظ في IndexedDB فقط، ولا تدخل Working Set.

للشركات التي تصل إلى ملايين الحركات، يجب عدم إجبار كل هاتف على تنزيل التاريخ المالي كله. يفضل اختيار: `Full Offline Archive` أو `On-demand history` حسب الخطة/مساحة الجهاز.

---

## 6. واجهة Initial Sync المطلوبة

الحزمة الحالية لديها نافذة Sync تعرض:
- حالة API
- طابور التغييرات
- Pending / Failed / Conflict
- progress للطابور
- health check
- فحص الجداول المحلية

لكنها **لا تملك بعد progress حقيقي لتنزيل شركة من الخادم**.

الواجهة المطلوبة عند Laravel:

```text
جاري تجهيز بيانات قاعة مايفنت

✓ إعدادات الشركة
✓ الباقات والصلاحيات
● الحجوزات 2,450 / 8,120
● العملاء 1,105 / 3,420
○ السندات 0 / 13,870

السنة الحالية والتالية جاهزتان للاستخدام
يتم تجهيز السجل القديم محليًا...

[استخدام التطبيق الآن]
```

ويجب تخزين checkpoint لكل مرحلة في `local_meta` حتى يستأنف من آخر Cursor بعد إغلاق التطبيق أو انقطاع الإنترنت.

---

## 7. الإعدادات

الوضع الحالي:

```text
Settings UI
 -> Repository settings
 -> company_settings في IndexedDB
 -> sync_queue فقط عندما API حقيقي متصل
```

الإنتاج:

```text
Client local write
 -> sync command
 -> Laravel CompanySettingsService
 -> company_settings MySQL
 -> change feed
 -> أجهزة الشركة الأخرى + Admin pull
```

لوحة الإدارة تعدل نفس كيان `company_settings` عبر API، وليس LocalStorage التطبيق.

---

## 8. الرسائل النصية SMS

### الوضع الحالي

`myfnt-messages.js` يخزن الرسائل في IndexedDB `sms_messages`.

الحالات تشمل:
- created
- scheduled
- queued
- sending
- sent
- failed
- blocked

إذا لا توجد شبكة تبقى `queued`.
إذا لا توجد `MyfntSmsGateway.send` تبقى بانتظار ربط البوابة.

**ملاحظة أمنية مهمة:** `sms_messages` ليست حاليًا ضمن `SYNCABLE` العام، والإعداد المحلي للبوابة يمكن أن يحتوي Secret على الجهاز. هذا مناسب للتجربة فقط، وليس للإنتاج.

### الإنتاج الصحيح

```text
UI -> إنشاء Message Request محلي
   -> sync/API /messages
   -> MySQL sms_messages
   -> Laravel Queue Job
   -> بوابة SMS من الخادم
   -> provider response
   -> تحديث status / cost / provider_id
   -> Admin + Client يحصلان على التحديث عبر pull
```

مفاتيح/Secrets بوابة SMS يجب أن تحفظ مشفرة على الخادم ولا ترسل للمتصفح.

---

## 9. النسخ الاحتياطية الحالية

هناك أكثر من مفهوم:

### A. Emergency snapshot

`myfnt-local-3.1 / snapshots`

- لا ينشأ مع كل عملية.
- ينشأ عند طلب تصدير طوارئ.
- مفتاحه `workspace = companyId:userId`.

### B. Daily backup database

قاعدة IndexedDB مستقلة باسم يبدأ بـ:

```text
ozan-daily-backups-v1-<userId>-<companyId>
```

ولذلك هي **محلية للجهاز والمتصفح + المستخدم + الشركة**.

Step21N.1 يحتفظ الآن بآخر **5 نسخ فقط** بدل 7.

### C. Manual JSON backup

ينشأ ملف `ozan-backup-v1` مع SHA-256.

### D. Secure encrypted export

يوجد تنسيق مضغوط/مشفر AES-GCM + PBKDF2 لنسخة اختيارية.

---

## 10. ماذا تحتوي النسخة اليومية/اليدوية الحالية؟

`ozan-backup-v1` يحتوي أساسًا على:

- bookings
- customers
- packages
- receipts
- specialDays
- settings
- notificationRead
- notificationReadAt
- syncAudit
- financeAudit
- financeCustomerNotes
- bookingHistory
- experience/preferences
- bookingContacts
- notification snapshots/generated notifications
- alert templates
- usage metadata

ولا يصدر Token أو Password في مسار النسخة الآمنة.

### ما لا تعتبره النسخة الحالية Full Database Backup حقيقيًا

لا تنسخ بشكل canonical جميع جداول IndexedDB normalized، ومنها حسب الحالة:
- `company_memberships`
- `plans / subscriptions`
- `booking_package_versions`
- `booking_details` كجدول مستقل (تُعاد بناؤها من legacy payload)
- كامل `payment_audit` بصيغته normalized
- `wallets / ledger_accounts / journal_entries / journal_lines`
- `sms_messages` كسجل كامل
- `sms_templates`
- `support_* / chat_*`
- `archive_records`
- `entity_tombstones`
- `sync_conflicts`
- الصور/Media Blobs
- `sync_queue` (ويجب أصلًا ألا ننقله كنسخة business)
- session/auth secrets

بالتالي `ozan-backup-v1` هو **نسخة أعمال قابلة للاستعادة للواجهة الحالية**، وليس dump كاملًا لكل قاعدة normalized.

---

## 11. النسخ من عدة أجهزة

### الحالي

كل جهاز ينشئ نسخه المحلية بنفسه. إذا دخل نفس الحساب من هاتفين، فلكل هاتف IndexedDB خاص به. وإذا دخل مستخدم آخر من نفس الشركة على نفس الأصل، اسم قاعدة daily الحالي يفصل النسخة أيضًا حسب `userId`.

### الإنتاج الصحيح

نعتمد مستويين:

#### Device Backups
- آخر 5 نسخ محلية على كل جهاز.
- سريعة.
- تعمل Offline.
- لا ترفع تلقائيًا.

#### Company Cloud Backups
- ينشئها **الخادم من MySQL المركزي**، وليس جهازًا بعينه.
- تمثل حالة الشركة الموحدة بعد المزامنة.
- يحتفظ مثلًا بآخر 5 snapshots + سياسة أطول حسب الباقة.
- تعرض: created_at, revision, size, counts, checksum, status.

لا نجعل كل هاتف يرفع Full backup يوميًا؛ لأن ذلك يكرر البيانات وقد يرفع نسخة جهاز متأخر عن الخادم.

---

## 12. ما تم تعديله في Step21N.1

1. daily retention أصبح 5 بدل 7.
2. مركز النسخ يعرض آخر خمس نسخ محلية.
3. لكل نسخة:
   - التاريخ
   - الحجم التقريبي
   - عدد الحجوزات
   - عدد السندات
   - عدد العملاء
   - تنزيل
   - استعادة
   - حذف
4. تعرض الواجهة حالة Online/Offline وتوضح أن النسخ المحلية تعمل في الحالتين.
5. الاستعادة من نسخة daily تمر عبر نفس فحص SHA-256 المستخدم للملف.
6. أصلح مسارًا خطيرًا: بعد الاستعادة المحلية أصبحت إعادة بناء IndexedDB تستعمل:

```js
mirrorAll({ enqueue: false })
```

بدل إنشاء آلاف أوامر Sync عند توصيل API الحقيقي.

---

## 13. الاستعادة Offline وOnline

### Offline

- يمكن فتح النسخة المحلية.
- فحص SHA-256 يعمل محليًا.
- التحقق من schema والعلاقات يعمل محليًا.
- تستبدل بيانات الجهاز بعد التأكيد.
- يعاد بناء IndexedDB محليًا.
- لا يوجد Push.

### Online

في Step21N.1 **نفس الاستعادة تظل Local Only**.

وجود الإنترنت لا يعني رفع النسخة تلقائيًا.

هذا مهم لأن رفع نسخة قديمة مباشرة قد يمحو تغييرات أحدث من أجهزة أخرى.

### Cloud Restore مستقبلًا

إجراء منفصل مثل:

```text
POST /api/v1/backups/{backup}/restore/prepare
POST /api/v1/backups/{backup}/restore/confirm
```

الخادم يقوم بـ:
1. قفل منطقي قصير للشركة أو إنشاء restore revision.
2. التحقق من صلاحية Owner.
3. إنشاء pre-restore snapshot تلقائي.
4. التحقق من checksum/schema.
5. الاستعادة داخل Transaction/controlled batches.
6. إنشاء company revision جديد.
7. إبطال/تحديث cursors القديمة.
8. إجبار الأجهزة على re-bootstrap أو pull من revision الجديد.

---

## 14. مخطط النسخة الاحتياطية V2 المقترح

يفضل الانتقال لاحقًا إلى ZIP/stream وليس JSON واحدًا:

```text
myfnt-backup-v2.zip
  manifest.json
  tables/
    company_settings.jsonl
    booking_packages.jsonl
    booking_package_versions.jsonl
    customers.jsonl
    bookings.jsonl
    booking_details.jsonl
    payments.jsonl
    booking_audit.jsonl
    payment_audit.jsonl
    calendar_blocks.jsonl
    alert_rules.jsonl
    sms_templates.jsonl
    sms_messages.jsonl
    archive_records.jsonl
  media/
    company-logo.webp
    ...
```

`manifest.json`:
- schema version
- app version
- DB revision
- company UUID
- createdBy user UUID
- createdBy device ID (metadata only)
- createdAt
- table counts
- per-file SHA-256
- total SHA-256 / signature
- min compatible version
- source = local | cloud

### لا يدخل في backup business
- access tokens
- passwords
- refresh tokens
- SMS gateway secrets plaintext
- sync leases
- `sending` queue state
- temporary notification jobs
- caches

---

## 15. خطة التنفيذ الدقيقة قبل Laravel

### Step A — Backup V2 Foundation
- تعريف `backup_manifest`.
- فصل business data عن transport/runtime.
- تصنيف كل جدول: `business`, `audit`, `media`, `runtime`, `ephemeral`.
- اختبار restore على نسخة 0 / 100 / 10k حجوزات.

### Step B — Bootstrap UI
- نافذة `CompanyBootstrapWindow`.
- progress لكل entity.
- حفظ cursors في `local_meta`.
- Resume بعد crash/network loss.
- زر استخدام التطبيق بمجرد تجهيز السنتين.

### Step C — API Contract
- auth
- bootstrap manifest/pages
- sync command/batch
- pull cursor
- messages
- backups metadata/restore

### Step D — Laravel Core
- tenancy by company membership.
- policies.
- transactions.
- idempotency table.
- change feed table.
- server_version.
- audit actor.

### Step E — Initial Company Sync
- priority current+next year.
- related payments/customers.
- historical backfill.
- storage quota checks.

### Step F — SMS Server Queue
- credentials server-side only.
- quota atomic on server.
- retries/idempotency.
- delivery receipts.

### Step G — Cloud Backup
- server-generated snapshots.
- last 5 visible by default.
- pre-restore automatic snapshot.
- restore audit.

### Step H — Admin Panel
- نفس Laravel API.
- لا وصول مباشر لـ MySQL من المتصفح.
- company isolation on every query.
- audit and restore controls.

---

## 16. قرار مهم قبل بدء API

لا ننشئ لوحة الإدارة أولًا كمصدر بيانات مستقل. نبني **API + Auth + Bootstrap + Sync contract** أولًا، ثم التطبيق ولوحة الإدارة يصبحان عميلين لنفس النظام. هذا يمنع وجود منطق مختلف بين الإدارة والتطبيق.
