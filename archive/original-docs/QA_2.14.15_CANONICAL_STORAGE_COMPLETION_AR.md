# QA — Myfnt 2.14.15 Canonical Storage Completion

## فحوص ثابتة منفذة
- JavaScript/Service Worker syntax: 55 ملفاً ناجحاً.
- JSON parse: 3 ملفات سليمة.
- HTML IDs: عدد 467، بدون أي ID مكرر.
- APP_VERSION = 2.14.15.
- Service Worker cache = v2.14.15-static.
- manifest version = 2.14.15.

## عقود التخزين المتحققة
- Repository Authority version = 2.
- packages: IndexedDB-first.
- company_settings: IndexedDB-first.
- calendar_blocks: IndexedDB-first.
- alert_rules: IndexedDB-first.
- LocalStorage writes لهذه المجالات أصبحت Shadow ولا تسبق نجاح IndexedDB في المسارات Durable.
- JSON Restore لا يعتبر LocalStorage شرطاً لنجاح التثبيت.
- Onboarding لا يضع علامة الاكتمال قبل Seed IndexedDB.

## اختبارات يدوية موصى بها على جهاز حقيقي
1. تعديل باقة ثم إعادة تحميل التطبيق والتأكد من بقاء التعديل.
2. ملء LocalStorage حتى Quota Failure إن أمكن، ثم تعديل باقة والتأكد أن IndexedDB يحتفظ بالتعديل بعد إعادة التشغيل.
3. تعديل إعدادات الشركة وطي التقويم وإعادة فتح التطبيق.
4. إضافة/تعديل/حذف يوم مميز وإعادة التشغيل.
5. إضافة/تعديل/حذف قاعدة تنبيه وإعادة التشغيل.
6. استيراد نسخة JSON صحيحة والتأكد أن البيانات تظهر بعد Reload حتى لو تعذر Shadow LocalStorage.
7. إنشاء حساب/شركة جديدة والتأكد أن الباقات الافتراضية والإعدادات تظهر بعد Reload.
8. تشغيل MyfntRegressionTests.run() والتأكد من نجاح عقد IndexedDB Authority الجديد.

## ملاحظة
لم يتم ربط API/Laravel في هذا الإصدار؛ Queue وTombstones وبنية Sync ما زالت محلية ومجهزة للمرحلة التالية.
