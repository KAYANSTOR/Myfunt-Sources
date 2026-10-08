# Myfnt 2.12.6 — Step21I Large Data Runtime

## Goal
تقليل عمليات المسح الشامل للبيانات أثناء عرض التقويم وقائمة الحجوزات، وتقوية استعلامات IndexedDB للبيانات الكبيرة بدون كسر الواجهات الحالية أو Offline-First.

## Changes
- ترقية IndexedDB من Schema 6 إلى Schema 7.
- إضافة فهارس مركبة للحجوزات:
  - `company_date_status`
  - `company_status_date`
- إضافة فهرس مركب للدفعات:
  - `company_booking_status`
- `bookingsRange()` يستخدم فهرس الحالة + التاريخ مباشرة عند وجود status بدل القراءة ثم الفلترة في الذاكرة.
- رفع الحد الداخلي الآمن لاستعلامات الشهر مع clamp واضح لمنع استعلام غير محدود.
- `bookingsMonthView()` أصبح يجلب تفاصيل الحجز ودفعاته من IndexedDB داخل transaction واحد ويحسب `paid` فعليًا بدل قيمة مؤقتة صفرية.
- توحيد سلوك الشهر بين fallback وIndexedDB: استبعاد `cancelled` و`archived` من العرض النشط.
- كاش الشهر أصبح يحتفظ بفهرسين داخل الذاكرة:
  - `byDate` للوصول المباشر لحجوزات اليوم.
  - `byId` للوصول المباشر للبطاقة.
- `MyfntMonthData.forDate()` لم يعد يفلتر الشهر كاملًا في كل استدعاء بعد اكتمال الكاش.
- `markTimelineCards()` لم يعد يبني Map من كل حجوزات الشركة في كل render؛ يستخدم فهرس الشهر ثم fallback محدود.
- تحديث الإصدار والكاش إلى 2.12.6 / Step21I.

## Important architectural note
لم يتم في هذه الخطوة حذف `state.bookings/state.customers/state.receipts` من RAM بالكامل، لأن أجزاء المالية والتحرير والتصدير ما تزال تعتمد عليها كواجهة توافق. الانتقال إلى Lazy Hydration كامل يجب أن يتم على مراحل حتى لا يكسر الذمم المالية أو التحرير أو السندات.

## Verification
- جميع ملفات JavaScript اجتازت `node --check`.
- لا توجد Duplicate IDs في `index.html`.
- كل ملفات Service Worker المشار إليها موجودة.
- الإصدار موحد بين `core.js`, `index.html`, `manifest.json`, وService Worker.
- الحزمة Root بدون مجلد رئيسي.
