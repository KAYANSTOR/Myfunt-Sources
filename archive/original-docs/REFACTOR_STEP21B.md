# Myfnt 2.10.1 — Refactor Step 21B

## الهدف
تحويل معاملات الحجوزات والدفعات الأساسية إلى IndexedDB-authoritative writes بدون نسخ Domain كاملة في localStorage أو Finance Journal.

## ما تغيّر
- قاعدة محلية نظيفة `myfnt-local-3.1`.
- إنشاء/تعديل الحجز مع العميل يُحفظ كـ IndexedDB transaction على الصفوف المنظمة.
- الحجز الجديد مع العربون: العميل + الحجز + booking_details + payment + audit + sync commands في معاملة محلية واحدة.
- القبض/الصرف/تصحيح/إلغاء السند: booking + payment + audit + outbox في معاملة IndexedDB واحدة.
- `recordOne()` لم يعد يقسم aggregate الواحد إلى دفعات 50 صفًا؛ العملية الخاصة بالكيان أصبحت ذرية.
- إزالة Finance Journal القائم على نسخ كل الحجوزات/السندات/العملاء.
- إيقاف كتابة مصفوفات الحجوزات والسندات الكاملة إلى localStorage.
- Hydration من IndexedDB يحدث إلى RAM فقط ولا يعيد إنشاء Domain JSON في localStorage.
- لا Full Snapshot تلقائي عند بدء التطبيق أو عند الحفظ العادي.
- إزالة مفاتيح Domain القديمة من localStorage عند التشغيل لأن هذه حزمة Fresh Start.

## ما بقي متعمدًا للخطوات التالية
- الباقات والإعدادات وبعض تفضيلات UI ما زالت تستخدم localStorage مؤقتًا.
- الاستيراد/الاستعادة القديمة ما زالت مسارًا انتقاليًا وسيعاد بناؤها فوق IndexedDB في Step 21C/21D.
- الواجهة ما زالت تحتفظ بصفوف الشاشة في RAM؛ Query Layer والفهارس الشهرية/البحث المباشر تأتي في Step 21C.
- Transport إلى Laravel غير متصل؛ عقد outbox/version/cursor يبقى جاهزًا للربط لاحقًا.

## اختبار مقترح
1. امسح بيانات الموقع مرة واحدة قبل تثبيت هذه الحزمة (Fresh Start).
2. أنشئ 20 حجزًا بدون عربون.
3. أنشئ 20 حجزًا بعربون.
4. أضف قبض وصرف وعدّل سندًا وألغِ سندًا.
5. أغلق التطبيق وافتحه وتأكد من عودة البيانات من IndexedDB.
6. راقب Application > Storage: لا يجب أن تنمو مفاتيح `ozan.bookings.v1` أو `ozan.receipts.v1` أو `ozan.finance.journal.v1`.
7. راقب `myfnt-local-3.1`: النمو يجب أن يكون بحسب الصفوف والتدقيق/outbox لا بحسب نسخ كاملة من النظام.
