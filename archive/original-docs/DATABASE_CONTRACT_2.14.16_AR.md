# Myfnt 2.14.16 — Final Database & Tenant Isolation Contract

هذا العقد هو المرجع الرسمي قبل Laravel/MySQL. يفصل بين مخطط IndexedDB الحالي والمخطط المركزي النهائي.

## قواعد ثابتة
- UUID canonical IDs are client-generated and server-preserved.
- Every tenant-owned row carries company_id NOT NULL.
- Every repository/API query for tenant data must receive company_id from authenticated membership, never from untrusted request body.
- Business display numbers are unique only inside a company.
- Financial rows are never hard-deleted; corrections/reversals are append/audit operations.
- All syncable entities use optimistic versioning and soft deletion where applicable.
- Laravel policies/global scopes enforce tenant boundaries in addition to SQL composite indexes.
- Local sync_queue/tombstones/meta are device-local and never copied as domain tables to MySQL.

## الجداول النهائية

| الجدول | النطاق | IndexedDB | MySQL | الغرض | المزامنة |
|---|---|---|---|---|---|
| `companies` | tenant-root | exists | required | الشركة/مساحة العمل الأساسية | server canonical + bootstrap |
| `company_message_numbers` | tenant | missing-local | required | أرقام الرسائل الموحدة SMS/WhatsApp لكل شركة | server canonical; bootstrap to client |
| `users` | global | exists | required | حسابات المستخدمين العالمية | server auth canonical |
| `user_sessions` | global-user | missing-local | required | جلسات وأجهزة المستخدمين | server auth only |
| `company_memberships` | tenant | exists | required | ربط المستخدمين بالشركات والصلاحيات | server canonical + bootstrap |
| `company_settings` | tenant | exists | required | إعدادات الشركة والحجز والتقويم | two-way sync; versioned |
| `plans` | global | exists | required | خطط الاشتراك | server catalog |
| `company_subscriptions` | tenant | exists | required | اشتراك الشركة | server canonical + bootstrap |
| `usage_counters` | tenant | missing-local | required | عدادات حدود الخطة والرسائل والعمليات | server only; derived/counter |
| `booking_packages` | tenant | exists | required | باقات الحجز الحالية | two-way sync + versions |
| `booking_package_versions` | tenant | exists | required | تاريخ تسعير الباقات | append-only; bootstrap/pull |
| `booking_types` | tenant | exists | required | أنواع/حالات مناسبة قابلة للتخصيص | two-way sync |
| `customers` | tenant | exists | required | دليل العملاء | two-way sync |
| `bookings` | tenant | exists | required | رأس الحجز | two-way sync + conflict |
| `booking_details` | tenant | exists | required | تفاصيل وسنابشوت الحجز | two-way sync |
| `payments` | tenant | exists | required | السندات والحركات المالية المرتبطة بالحجوزات/العملاء | two-way sync; create/correct/reverse |
| `booking_audit` | tenant | exists | required | سجل تدقيق الحجوزات | append-only sync |
| `payment_audit` | tenant | exists | required | سجل تدقيق السندات | append-only sync |
| `wallets` | tenant | exists | required | الصناديق/المحافظ | server canonical; bootstrap |
| `ledger_accounts` | tenant | exists | required | دليل الحسابات | server canonical |
| `journal_entries` | tenant | exists | required | رأس القيد المحاسبي | server canonical; derived from payments/manual |
| `journal_lines` | tenant | exists | required | سطور القيود | server canonical |
| `calendar_blocks` | tenant | exists | required | أيام/فترات منع أو تمييز التقويم | two-way sync |
| `alert_rules` | tenant | exists | required | قواعد التنبيه الذكية | two-way sync |
| `notifications` | device-now/server-later | exists | required | سجل الإشعارات داخل التطبيق | server generates; client pull/read receipt |
| `notification_jobs` | tenant | exists | required | طابور تنفيذ الإشعارات | server worker only |
| `sms_templates` | tenant | exists | required | قوالب الرسائل | server canonical + bootstrap |
| `sms_messages` | tenant | exists | required | سجل إرسال الرسائل | server canonical; client enqueue approval only |
| `sms_approvals` | tenant | exists | required | موافقات إرسال الرسائل | two-way approve command |
| `company_backups` | tenant | exists | required | سجل النسخ الاحتياطية | server upload metadata only |
| `support_tickets` | tenant | exists | required | تذاكر الدعم | server canonical |
| `support_messages` | tenant | exists | required | رسائل الدعم | server canonical |
| `chat_threads` | tenant | exists | required | محادثات الشركة | server canonical |
| `chat_messages` | tenant | exists | required | رسائل المحادثات | server canonical |
| `archive_records` | tenant | exists | required | أرشيف كيانات النظام | server canonical / export |
| `error_logs` | device-now/server-later | exists | required | سجل الأخطاء التشغيلي | client optional telemetry -> server |
| `sync_change_log` | tenant | missing-local | required | سجل Delta Pull مركزي | server only; monotonically increasing cursor |
| `sync_idempotency` | tenant | missing-local | required | منع تكرار أوامر Push | server only |
| `sync_conflicts` | tenant | exists | required | سجل التعارضات المرئية | client+server conflict metadata |

## القيود الحرجة

- `(company_id, booking_no)` UNIQUE
- `(company_id, customer_no)` UNIQUE
- `(company_id, receipt_no)` UNIQUE
- `(company_id, movement_no)` UNIQUE
- `(company_id, user_id)` UNIQUE على العضويات
- `(company_id, metric_code, period_key)` UNIQUE على عدادات الاستخدام
- `company_id` لا يُؤخذ من Body عند Laravel؛ يُشتق من العضوية الموثقة.
- أي FK بين جدولين Tenant-scoped يجب أن يطابق نفس `company_id`.

## الحذف
- الحجوزات/العملاء/الباقات: soft delete حسب السياسة.
- السندات والقيود: لا حذف نهائي؛ Reverse/Correction فقط.
- سجلات Audit: append-only.
- بيانات Local runtime مثل sync_queue وtombstones لها Retention منفصل ولا تُرفع كجداول Domain.

## المزامنة
1. الجهاز ينشئ UUID ثابت.
2. Push يحمل `op_id`, `entity_id`, `base_version`, payload.
3. الخادم يرفض اختلاف version بـ409.
4. نجاح الكتابة يضيف حدثًا إلى `sync_change_log`.
5. Pull يتم بواسطة cursor لكل شركة.
6. الحذف يُرسل كعملية delete/soft-delete ويعود في change log.
7. idempotency يمنع تنفيذ نفس العملية مرتين.

## العزل
- SQL: company_id + indexes/unique المركبة.
- Laravel: Membership authorization + CompanyScope على كل Model tenant.
- API: لا يسمح بتحديد company_id حرًا من العميل.
- Jobs/Queues: يجب تضمين company_id والتحقق منه عند التنفيذ.
- Exports/Reports/Search: company_id شرط إلزامي في الاستعلام.
- Files/Backups: object keys namespace by company UUID.

## ملفات العقد
- `DATABASE_CONTRACT_2.14.16.json`: تعريف آلي كامل.
- `MYSQL_SCHEMA_BLUEPRINT_2.14.16.sql`: مخطط مرجعي للـ Laravel migrations.
- كشف Excel المرفق خارج الحزمة يوثق كل جدول وعمود وعلاقة.