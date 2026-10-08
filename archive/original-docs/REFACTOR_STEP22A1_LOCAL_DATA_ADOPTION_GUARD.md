# Myfnt 2.13.3 — Step 22A.1 Local Data Adoption Guard

## الهدف
منع Bootstrap/Laravel من حذف أو استبدال بيانات الجهاز المحلية لمجرد أن `sync_queue` فارغة.

## الإصلاح الأساسي
- إضافة `MyfntLocal.localAdoptionGuard()` لفحص بيانات الشركة قبل `replaceLocal`.
- اعتبار الصف Server-adopted فقط عند وجود دليل إيجابي: `bootstrap_source` أو `server_version > 0` أو علم اعتماد صريح.
- فحص أوامر المزامنة النشطة وLocal Tombstones كذلك.
- إضافة `assertBootstrapReplaceSafe()` كقفل دفاعي داخل طبقة التخزين.
- `clearBootstrapCompanyData()` لم يعد يستطيع المسح من دون تقرير Guard آمن.
- `myfnt-bootstrap.js` يوقف التهيئة بالكامل قبل تنزيل أي Batch إذا كانت البيانات تحتاج Adoption.
- حالة التوقف الجديدة: `pausedReason = local-adoption` و`phase = adoption-required`.
- إطلاق حدث `myfnt:bootstrap-adoption-required` للتكامل مع شاشة Migration القادمة.

## ما لم يتم تنفيذه عمداً في هذه الخطوة
- لم يتم إنشاء Backfill/Adoption Queue بعد.
- لم يتم دمج Local + Server أو حل التعارضات تلقائياً.
- لم يتم تغيير تصميم الواجهة أو نماذج البيانات.

## سياسة الأمان
عند الشك: لا حذف ولا استبدال. الخطوة التالية هي بناء Local-to-Server Adoption/Reconciliation.
