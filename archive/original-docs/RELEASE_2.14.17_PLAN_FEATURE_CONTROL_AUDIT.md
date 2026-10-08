# Myfnt 2.14.17 — Plan & Feature Control Audit

## الهدف
توحيد التحكم في مزايا الخطط بدون نشر شروط الخطة داخل كل ملف.

## ما تم
- إضافة `assets/config/feature-catalog.json` كسجل مركزي للميزات.
- إضافة `assets/js/myfnt-feature-gate.js` كطبقة خفيفة للتحقق من الإتاحة والحدود والاستهلاك الشهري.
- عزل عدادات الاستخدام محليًا حسب `companyId:userId`.
- إضافة حدود أرقام الرسائل حسب الخطة، بدون احتساب هاتف الشركة 1 و2.
- ربط التصدير المشفر بالخطة والحد الشهري، والاستهلاك لا يحتسب إلا بعد نجاح إنشاء التنزيل.
- فصل ICS الحقيقي الموجود عن Google Calendar Sync غير المربوط بعد.
- إضافة حقول الخطط: `message_numbers_limit`, `encrypted_export_enabled`, `encrypted_exports_monthly_limit`, `google_calendar_sync_enabled`, `google_calendar_accounts_limit`, `calendar_ics_enabled`.

## قرارات البساطة
- FeatureGate في العميل لتحسين UX فقط؛ Laravel يعيد فرض كل حد وصلاحية.
- لا جداول إضافية محلية لكل ميزة؛ نستخدم `usage_counters` مركزيًا عند الخادم.
- لا ادعاء بأن Google Calendar مكتمل: الموجود الآن ICS؛ OAuth/API مرحلة Laravel/Integration لاحقة.
