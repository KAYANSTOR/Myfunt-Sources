# Myfnt FINAL API Contract v1.1

**Laravel 13 / Offline First / Admin Control / Smart Plan Gate**

## ثوابت العقد
- كل عمليات الشركات معزولة بـ `company_id` وتخضع لـ Laravel Policies/Global Scope.
- `Bootstrap` لا يساوي المزامنة: الجهاز الجديد يستقبل Upsert ولا ينشئ `sync_queue`.
- التحديث العادي: `Push pending batch → Pull since cursor`.
- كل عملية محلية لها `op_id` ثابت لمنع التكرار و`base_version` لكشف التعارض.
- `FeatureGate` يطبق في الواجهة لتحسين UX، ويعاد فحصه في Laravel قبل التنفيذ.
- القيمة الفعلية للميزة تحل بالترتيب: الاشتراك → الخطة → استثناء الشركة → الاستهلاك/العدد.

## بنية محرك الخطط
- `feature_catalog`: تعريف الميزة ونوعها وفترتها ووحدة القياس.
- `plan_features`: قيمة الميزة داخل كل خطة.
- `company_feature_overrides`: استثناء مؤقت أو دائم لشركة محددة.
- `usage_counters`: للحدود الدورية فقط مثل الشهري والسنوي.
- الحدود الحالية مثل المستخدمين والباقات وأرقام الرسائل تحسب مباشرة من الجداول.

## Resolved Entitlements
يرجع `/api/v1/entitlements` لكل ميزة:
`feature_code, enabled, limit, period_type, used, remaining, config, source`.

## رموز الأخطاء الثابتة
`FEATURE_NOT_AVAILABLE`, `PLAN_LIMIT_REACHED`, `MONTHLY_LIMIT_REACHED`, `YEARLY_LIMIT_REACHED`, `STORAGE_LIMIT_REACHED`, `SUBSCRIPTION_EXPIRED`, `COMPANY_NOT_APPROVED`, `INSUFFICIENT_SMS_BALANCE`, `SYNC_CONFLICT`.

## المسارات
| المجال | Method | Endpoint | الوظيفة | الحماية |
|---|---|---|---|---|
| Auth | `POST` | `/api/v1/auth/phone/start` | بدء OTP | Public |
| Auth | `POST` | `/api/v1/auth/phone/verify` | التحقق والدخول/التسجيل | Public |
| Bootstrap | `GET` | `/api/v1/bootstrap` | تهيئة جهاز جديد + entitlements + working set | Auth + Company |
| Entitlements | `GET` | `/api/v1/entitlements` | القيم الفعلية للميزات بعد الخطة والاستثناء والاستهلاك | Auth + Company |
| Sync | `POST` | `/api/v1/sync/push` | Batch Push | Auth + Company |
| Sync | `GET` | `/api/v1/sync/pull?cursor={cursor}` | Pull بعد Cursor | Auth + Company |
| Bookings | `GET` | `/api/v1/bookings` | قائمة حجوزات بفلاتر | Auth + Company |
| Bookings | `POST` | `/api/v1/bookings` | إنشاء حجز | Auth + Company + Gate |
| Bookings | `PATCH` | `/api/v1/bookings/{id}` | تعديل حجز | Auth + Company |
| Packages | `POST` | `/api/v1/packages` | إنشاء باقة | Auth + Company + Gate |
| Company Users | `GET` | `/api/v1/company/users` | مستخدمو الشركة | Auth + Company |
| Company Users | `POST` | `/api/v1/company/users` | إضافة مستخدم | Auth + Company + Gate |
| Company Users | `DELETE` | `/api/v1/company/users/{id}` | إزالة مستخدم | Auth + Company |
| Payments | `POST` | `/api/v1/payments` | إضافة حركة مالية | Auth + Company |
| Message Numbers | `POST` | `/api/v1/message-numbers` | إضافة رقم رسائل | Auth + Company + Gate |
| Messages | `POST` | `/api/v1/messages/send` | إرسال SMS/WhatsApp | Auth + Company + Gates |
| Messages | `POST` | `/api/v1/messages/batch` | إرسال Batch من Local Outbox | Auth + Company + Gates |
| SMS Topup | `POST` | `/api/v1/sms/topups` | طلب شحن | Auth + Company |
| Integrations | `POST` | `/api/v1/integrations` | إضافة تكامل | Auth + Company + Gate |
| Backups | `POST` | `/api/v1/backups` | إنشاء نسخة مخصصة | Auth + Company + Gate |
| Backups | `GET` | `/api/v1/backups` | قائمة النسخ | Auth + Company |
| Trash | `POST` | `/api/v1/trash/{entity}/{id}/restore` | استعادة | Auth + Company + Gate |
| Exports | `POST` | `/api/v1/exports` | Export Job | Auth + Company + Gate |
| Imports | `POST` | `/api/v1/imports` | Import Job | Auth + Company + Gate |
| Reports | `POST` | `/api/v1/reports` | توليد تقرير محفوظ | Auth + Company |
| Settings | `PATCH` | `/api/v1/company/settings` | إعدادات الشركة المتقدمة | Auth + Company + Gate |
| Settings | `PATCH` | `/api/v1/company/settings/calendar` | تخصيص التقويم | Auth + Company + Gate |
| Settings | `PATCH` | `/api/v1/company/settings/booking` | تخصيص فورم الحجز | Auth + Company + Gate |
| Gateways | `POST` | `/api/v1/message-gateways` | إضافة بوابة مخصصة | Auth + Company + Gate |
| Admin | `GET` | `/api/v1/admin/overview` | مؤشرات المنصة | Admin |
| Admin | `GET` | `/api/v1/admin/companies` | بحث الشركات | Admin |
| Admin | `GET` | `/api/v1/admin/companies/{id}` | ملف الشركة للمراقبة | Admin |
| Admin | `POST` | `/api/v1/admin/companies/{id}/approve` | اعتماد شركة | Admin |
| Admin | `POST` | `/api/v1/admin/subscriptions/{id}/review` | مراجعة اشتراك | Admin |
| Admin Plans | `GET` | `/api/v1/admin/features` | كتالوج الميزات | Admin |
| Admin Plans | `PUT` | `/api/v1/admin/plans/{plan}/features/{feature}` | ضبط ميزة الخطة | Admin |
| Admin Plans | `GET` | `/api/v1/admin/companies/{id}/entitlements` | عرض الميزات الفعلية | Admin |
| Admin Plans | `POST` | `/api/v1/admin/companies/{id}/feature-overrides` | استثناء شركة | Admin |
| Admin Plans | `DELETE` | `/api/v1/admin/feature-overrides/{id}` | إلغاء استثناء | Admin |
| Admin SMS | `POST` | `/api/v1/admin/sms/topups/{id}/review` | اعتماد شحن | Admin Finance |
| Admin SMS | `GET` | `/api/v1/admin/gateways/health` | صحة البوابات | Admin |
| Admin Sync | `GET` | `/api/v1/admin/sync/health` | مؤشرات المزامنة | Admin |
| Admin | `POST` | `/api/v1/admin/announcements` | إعلان مركزي | Admin |
| Admin | `GET` | `/api/v1/admin/audit` | تدقيق الإدارة | Super Admin |

## Offline
- الإشعارات اليومية والذكية تولد محليًا من الحجوزات والعملاء والدفعات وتاريخ المناسبة.
- MySQL يحتفظ بقوالب الإشعارات والتنبيهات وقواعدها، وليس كل إشعار مولد.
- سند الحجز وسند القبض يولدان محليًا من بيانات الشركة/الحجز/العميل/الدفعة.
- الرسالة يمكن توليدها Offline وإضافتها إلى Local Outbox، لكن الإرسال الفعلي يمر عبر Laravel والبوابة.

## لوحة الإدارة
- لوحة الإدارة تستخدم نفس Services/Policies ولا تعدل قاعدة البيانات مباشرة.
- تفعيل الشركات، تغيير الخطط، استثناء الميزات، شحن SMS، إدارة البوابات والتعليق كلها تسجل في `platform_audit_logs`.
- مؤشرات الإدارة يجب أن تكون Aggregates/Pagination/Lazy tabs حتى لا تحمل قواعد الشركات كاملة.