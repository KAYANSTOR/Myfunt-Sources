# QA 2.14.19

## اختبارات العقد
- [x] `claimBatch` يحجز حتى 100 عمليات محليًا في Lease واحد.
- [x] Batch Push يستخدم Endpoint واحدًا.
- [x] كل نتيجة Push مرتبطة بـ `op_id`.
- [x] UUID المعاد من الخادم يجب أن يطابق UUID المحلي.
- [x] Refresh لا يستدعي Bootstrap.
- [x] Pull يطبق Remote rows بدون enqueue.
- [x] Bootstrap الافتراضي لا يحمل Archive.
- [x] جهاز أصبح `workingReady` لا يعيد Bootstrap عند الدخول التالي.
- [x] التاريخ القديم متاح كتحميل اختياري/Lazy.
