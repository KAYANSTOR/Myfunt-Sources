# QA — Myfnt 2.14.14 Data Integrity Foundation

## فحوص منفذة
- فحص Syntax لكل ملفات JavaScript + Service Worker: ناجح.
- فحص JSON لكل ملفات الحزمة: ناجح.
- فحص تكرار IDs في `index.html`: لا يوجد تكرار.
- فحص رقم الإصدار النشط في index/core/ui/service-worker/manifest: 2.14.14.
- فحص إزالة استدعاء `cache.put()` الخاطئ متعدد المعاملات: تم.
- فحص تصدير `resetOperationalData()` وربطه بزر Reset: تم.
- فحص إزالة الكتابة المكررة للحجز بعد `commitBookingCustomer()`: تم.
- فحص مسارات Durable awaited للباقات والإعدادات والأيام المميزة والتنبيهات: تم.

## سلوك Reset الجديد
1. ينتظر الكتابات الجارية في Repository.
2. يحذف البيانات التشغيلية من IndexedDB أولًا.
3. يحذف الصفوف التابعة/Audit والـruntime المرتبط.
4. ينظف Sync Queue/Tombstones/Conflicts المرتبطة بالكيانات التشغيلية.
5. يحذف Snapshot لمساحة المستخدم كي لا تعيد نسخة طوارئ قديمة بيانات تم حذفها.
6. بعد نجاح العملية فقط يتم تفريغ RAM/UI.
7. عند فشل IndexedDB لا يتم مسح الواجهة، لحماية المستخدم من وهم نجاح الحذف.

## ملاحظة
الحزمة ما تزال Frontend/Offline وليست Laravel API. لم يتم تفعيل مزامنة خادم وهمية أو إنشاء Queue بدون Backend حقيقي.
