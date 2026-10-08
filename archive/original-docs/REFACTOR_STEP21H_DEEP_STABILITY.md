# Myfnt 2.12.5 — Step 21H Deep Stability Audit

## هدف الخطوة
فحص عميق بعد Step 21G لطبقة IndexedDB / hydration / cache / تعدد التبويبات وحالات دورة حياة الحجز، مع إصلاحات من المصدر دون تغيير عقود الحفظ المالي أو المزامنة.

## الإصلاحات المنفذة

### 1) إصلاح حالة archived التي كانت تعود confirmed
- قاعدة IndexedDB تحفظ الحجز المؤرشف بالحالة `archived`.
- طبقة hydration و normalizeBooking لم تكن تعتبر `archived` حالة صحيحة، فكانت قد تعيده `confirmed`.
- تمت إضافة حالة `archived` للنواة وحفظها في hydration/query.
- تم استبعاد المؤرشف من التقويم، الأيام المتاحة، الحجز المكرر، القوائم النشطة، والتنبيهات النشطة.
- تبقى بياناته في IndexedDB والسجلات المالية/التدقيقية ولا يتم حذفها كبيانات تاريخية.

### 2) إزالة مسار O(n²) من hydration
- الربط السابق كان ينفذ `bookings.find(...)` لكل سجل IndexedDB أثناء بناء خريطة UUID.
- أصبح الربط يبنى مباشرة أثناء المرور الأول باستخدام Map.
- التعقيد أصبح خطيًا بالنسبة لعدد الحجوزات بدل تربيعي.

### 3) تثبيت timestamps أثناء hydration
- القيم التاريخية المفقودة/غير الصالحة كانت تتحول إلى `Date.now()` في كل hydration.
- هذا كان يجعل السجل القديم يبدو وكأنه تم إنشاؤه/تحديثه الآن ويغيّر الفرز بلا سبب.
- أصبحت القيمة الاحتياطية 0 بدل توليد وقت وهمي جديد.

### 4) حماية IndexedDB بين التبويبات
- الحارس القديم اعتمد أساسًا على `storage`، بينما بيانات الدومين انتقلت إلى IndexedDB.
- أضيف BroadcastChannel باسم `myfnt-domain-v1`.
- أضيف fallback بإشارة LocalStorage للمتصفحات التي لا تدعم BroadcastChannel.
- بعد أي كتابة Domain حقيقية / Remote apply / archive / delete، يتم إخطار بقية تبويبات نفس الشركة.
- التبويب القديم يصبح read-only ويطلب إعادة التحميل بدل overwrite صامت.

### 5) تنظيف sync_queue بدون تحميله كاملًا في RAM
- `compactLocal()` كان يجمع كل synced/superseded في مصفوفة ثم يفرزها.
- أصبح يستخدم index `workspace_updated` وCursor عكسي.
- يحتفظ بأحدث 300 Terminal operations ويحذف الأقدم أثناء المرور دون مصفوفة ضخمة.

### 6) تقليل الكتابة الجماعية عند تغيير العملة
- `applyWorkspaceCurrency()` كان يعيد `put()` لكل package/detail/payment/wallet حتى لو العملة مطابقة.
- أصبح يتجاوز الصفوف المطابقة ويكتب فقط ما يحتاج تغييرًا.

### 7) Cache/version consistency
- الإصدار: 2.12.5.
- Service Worker cache مستقل باسم Step21H.
- query strings للملفات المعدلة تغيرت لضمان عدم تشغيل ملفات Step21G من الكاش.

## فحوصات الإصدار
- Node syntax check لجميع ملفات assets/js/*.js.
- فحص duplicate IDs في index.html.
- فحص مراجع الملفات في index.html وService Worker وعدم وجود ملفات مفقودة.
- فحص اتساق الإصدار بين core/index/manifest/service-worker.

## ملاحظة للمرحلة التالية
الواجهة ما زالت تحتفظ بمصفوفات Domain كاملة في RAM بعد hydration لأجل التوافق مع الشاشات القديمة. Query layer الشهرية موجودة، لكن الانتقال النهائي إلى Windowed/Lazy domain reads يحتاج مرحلة مستقلة حتى لا تتأثر التقارير والمالية والإشعارات.
