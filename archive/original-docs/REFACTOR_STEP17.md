# REFACTOR STEP 17 — Finance / Payment Repository

## الهدف
فصل قراءة السندات والحركات المالية عن `state.receipts` مع الحفاظ على Journal وRollback والمعاملة المحاسبية الذرية.

## ما تم
- تطوير `MyfntRepositories.payments` ليكون بوابة قراءة موحدة للسندات.
- إضافة `byBooking()` و `activeByBooking()` و `indexOf()` و `replaceLocal()` و `transaction()`.
- `transaction()` يفوض الكتابة المالية إلى `MyfntFinance.transaction` ولا يعدل الرصيد بصورة مستقلة.
- إزالة مسار الحذف المحلي العام للسندات من PaymentRepository؛ السندات لا تُحذف محاسبيًا وإنما تُلغى مع Audit.
- تحويل `myfnt-finance.js` في مسارات العرض والبحث والإحصاءات والطباعة إلى `allPayments()/paymentById()`.
- إبقاء الوصول المباشر للمصفوفة داخل Transaction / Rollback / migration فقط، لأنه جزء من pre-image ذري متعدد السجلات.
- تحويل شاشة الحجز، معاينة السند، JSON/secure/daily backup، والاستهلاك إلى PaymentRepository حيث كان ذلك آمنًا.
- الاستيراد يستبدل قائمة السندات عبر `payments.replaceLocal(..., {persist:false})` ثم يحفظ المعاملة كما سابقًا.
- أرقام السند والحركة التسلسلية من Step 14 بقيت مستقلة وتبدأ من 1.

## حدود مقصودة
- `core.js` يبقى Legacy persistence boundary لتحميل/حفظ `state.receipts`.
- `myfnt-hydration.js` و `myfnt-offline.js` يتعاملان مع cache مباشرة لأنهما طبقات بنية لا UI.
- Finance Transaction ما زالت تمسك `state.receipts` مباشرة أثناء الـjournal/rollback؛ نقلها لنسخة منفصلة سيكسر استعادة مراجع الكائنات.

## سلامة محاسبية
لا يوجد مسار عام لـ `payments.mutate()` أو `payments.removeLocal()`. تعديل/تصحيح/إلغاء السند يمر من `MyfntFinance.transaction()` حتى تتغير معًا:
- السند
- `booking.paid`
- سجل التدقيق
- journal
- sync queue

## Revision
Cache: `v2.9.7-r17-static`
الإصدار المرئي: `2.9.7`
