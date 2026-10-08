# Myfnt 2.13.7 — Step 22A.5 Data Authority Cleanup

## الهدف
تثبيت IndexedDB كمصدر البيانات الدائم الوحيد لبيانات النطاق أثناء التشغيل، مع إبقاء `state` كذاكرة توافق/واجهة فقط.

## ما تغير

### 1. منع Bulk Mirror التلقائي
`MyfntLocal.mirrorAll()` لم يعد يقبل استدعاءً عامًا. يجب تمرير سبب صريح من القائمة:
- migration
- restore
- import
- repair
- seed
- finance-recovery
- manual-repair

أي استدعاء بدون سبب يرمي:
- `MyfntAuthorityViolation`
- `BULK_STATE_WRITE_BLOCKED`

### 2. إيقاف scheduleMirror ككاتب بيانات
`scheduleMirror()` أصبح no-op مقصودًا. الحفظ الطبيعي يجب أن يمر عبر:
- `recordOne()`
- `commitBookingAggregate()`
- المعاملات المتخصصة في IndexedDB

### 3. تغيير reconcile الافتراضي
`MyfntOffline.reconcile()` بدون سبب لا يكتب `state` إلى IndexedDB. بدلاً من ذلك يقوم بـ Hydration من IndexedDB إلى واجهة التطبيق.

الاتجاه الطبيعي الآن:
`IndexedDB -> Hydration -> state/UI`

وليس:
`state -> full mirror -> IndexedDB`

### 4. الاستيراد/الاستعادة/Seed فقط تستخدم Bulk Write
تم تعليم مسارات CSV/Excel/Calendar Import وRestore وFinance Recovery وSeed بأسباب صريحة.

### 5. إيقاف fallbacks الصامتة
`recordOne()` لم يعد يحول نوع كيان غير معروف إلى `mirrorAll()` كامل. النوع غير المدعوم يرمي `UNSUPPORTED_ENTITY_WRITE` بدلاً من إعادة بناء كل قاعدة البيانات.

### 6. إزالة جدولة Full Mirror من saveBookings/saveReceipts
هذه الدوال لم تعد تطلب Bulk Mirror خلفيًا. الحفظ الدائم يتم قبل نجاح العملية من خلال بوابات IndexedDB المحددة.

### 7. Authority Audit
أضيف:
`MyfntLocal.authorityAudit()`

يعرض:
- المصدر الرسمي (`indexeddb`)
- دور `state` (`ui-compatibility`)
- عدد السجلات في Cache
- عدد السجلات الدائمة
- أي فروقات بينهما

كما أضيف:
`MyfntLocal.authority()`

لعرض عقد السلطة الحالي.

## قواعد المرحلة الحالية
1. IndexedDB = Durable Domain Authority.
2. state = UI compatibility cache.
3. Query/Repository يمكنها تغذية state للعرض، لكن هذا لا يجعل state مخزنًا دائمًا.
4. الكتابة الجماعية من state مسموحة فقط في عمليات ترحيل صريحة.
5. Laravel لاحقًا يصبح Remote Authority، بينما IndexedDB يظل Local Durable Replica للعمل Offline.

## فحوصات
- فحص Syntax لجميع ملفات JS: ناجح.
- لا يوجد `mirrorAll()` غير محمي.
- لا يوجد `reconcile()` عام بدون سبب يكتب إلى IndexedDB.
- `scheduleMirror()` لا ينفذ Bulk Write.
- الإصدار والكاش: 2.13.7 / Step22A5.
