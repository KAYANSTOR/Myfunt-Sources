# Refactor Step 9 — Entity-level IndexedDB writes

هدف هذه الخطوة: تقليل إعادة بناء الـ normalized mirror الكامل بعد كل حفظ، مع إبقاء LocalStorage مصدر الكتابة المؤقت للواجهة في هذا الإصدار.

## ما تغير
- فصل Emergency Snapshot عن Full Mirror: إنشاء snapshot لم يعد يستدعي `scheduleMirror()` تلقائيًا.
- إضافة `MyfntOffline.reconcile()` للعمليات الجماعية الصريحة فقط.
- `commitBookingCustomer()` يكتب الآن العميل والحجز والدفعة الأولية كـ Entity-level writes بدل Full Mirror.
- مسار `commitInitialBooking()` القديم أصبح Entity-level أيضًا.
- حفظ/تعديل إعدادات الشركة يحدّث `company_settings` وبيانات الشركة المرتبطة فقط.
- تعديل باقة واحدة يحدّث `booking_packages` المحددة فقط.
- تأكيد/إلغاء/استعادة/فتح رسالة حجز يحدث الحجز المحدد فقط.
- تغييرات المالية تستمر بتسجيل payment + booking بشكل موجّه بعد نجاح الـ journal.
- ملاحظات عميل واحد تحدّث سجل العميل المحدد بدل Full Mirror.
- الاستيراد الجماعي، إعادة الضبط، ترحيل العملاء، واستعادة نسخة كاملة تستخدم `reconcile()` عمدًا.
- `rowsFromState(filter)` لم يعد يبني company/user/membership/settings أثناء تحديث booking/customer/payment/package واحد.

## ما لم يتغير
- LocalStorage ما زال مصدر الكتابة المؤقت للواجهة.
- IndexedDB schema لم يتغير.
- sync_queue format لم يتغير.
- idempotency/base_version/conflict behavior لم يتغير.
- Financial journal/rollback لم يتغير.
- لا يوجد Backend حقيقي بعد، وmock API لم يُستبدل في هذه الخطوة.
- Full Mirror ما زال موجودًا للفحص، الترحيل، الإصلاح، والاستيراد الجماعي.

## ملاحظة للخطوة التالية
الحذف الجماعي/حذف Entities يحتاج سياسة tombstone/delete صريحة قبل تحويل IndexedDB إلى Source of Truth؛ لا ينبغي حذف صفوف normalized بصمت لأن ذلك يحتاج عملية Sync قابلة للتدقيق على الخادم.
