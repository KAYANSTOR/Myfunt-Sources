# Myfnt 2.14.14 — Data Integrity Foundation

## الإصلاحات الأساسية

- إصلاح Reset ليحذف البيانات التشغيلية فعليًا من IndexedDB قبل مسح واجهة RAM، مع إزالة الصفوف التابعة وسجلات المزامنة/التعارضات المرتبطة ومنع عودة البيانات بعد Hydration.
- تغيير `MyfntOffline.record()` بحيث لا يبتلع أخطاء IndexedDB؛ الخطأ ينتقل إلى المستدعي ويمكن تنفيذ rollback.
- إضافة مسارات Durable awaited مع rollback للباقات وإعدادات الشركة/الحجز والأيام المميزة وقواعد التنبيه.
- تعديل أهم واجهات الحفظ لتنتظر نجاح IndexedDB قبل إظهار رسالة النجاح.
- إصلاح Navigation caching في Service Worker: `cache.put(request, response)` الصحيح، مع fallback للصفحة المطلوبة ثم shell.
- رفع الإصدار والكاش إلى 2.14.14.

## مبدأ النسخة

IndexedDB هو المصدر الدائم. `state` وLocalStorage طبقات توافق/واجهة ولا يجوز إعلان نجاح عملية مهمة قبل نجاح الكتابة الدائمة.
