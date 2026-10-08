# Myfnt 2.9.7 — Refactor Step 15

## الهدف
تحويل وحدة الحجوزات تدريجيًا إلى Repository Layer بدون تغيير الواجهة أو فك المعاملات المالية الذرية.

## ما تم
- توسيع `MyfntRepositories.bookings` بعمليات مخصصة:
  - `all / get / find / filter / exists`
  - `indexOf`
  - `mutate`
  - `removeLocal`
  - `replaceLocal`
- إضافة بوابة قراءة داخل `bookings.js`:
  - `bookingRepository()`
  - `allBookings()`
  - `bookingById()`
  - `filterBookings()`
- تحويل جميع قراءات `state.bookings` المباشرة داخل `bookings.js` إلى Repository، باستثناء fallback واحد داخل `allBookings()` للتوافق.
- تحويل التعديلات العادية إلى `BookingRepository.mutate()`:
  - تسجيل محاولة إرسال SMS/WhatsApp
  - تأكيد حجز مؤقت
  - نقل الحجز إلى المهملات
  - استعادة الحجز من المهملات
- تحويل الإزالة المحلية بعد الأرشفة إلى `BookingRepository.removeLocal()`.
- تحويل استيراد قائمة الحجوزات إلى `BookingRepository.replaceLocal(..., {persist:false})` مع إبقاء معاملة الاستيراد القديمة مسؤولة عن الحفظ/التراجع.
- تحويل بعض قراءات `core.js` العامة إلى Repository عند توفره، مع إبقاء `loadState/saveBookings` حد التوافق Legacy.

## ما لم يتم تحويله عمدًا
- `commitBookingCustomer()` في `myfnt-finance.js`؛ لأنه معاملة ذرية تشمل العميل والحجز والسند وسجل التدقيق والتراجع.
- `loadState()` و`saveBookings()` في `core.js`؛ ما زالا بوابة Legacy Cache أثناء مرحلة الانتقال.
- منطق Hydration/Sync/IndexedDB لم يتغير في هذه الخطوة.

## أمان المعرفات التسلسلية
لا تغيير على Step 14:
- bookingNo / customerNo / receiptNo / movementNo تبدأ من 1 وتتزايد.
- UUID الداخلي يبقى منفصلًا للعلاقات والمزامنة.

## نتيجة الفحص
- JavaScript syntax errors: 0
- Missing index assets: 0
- Missing Service Worker assets: 0
- الوصول المباشر إلى `state.bookings` داخل `bookings.js`: fallback واحد فقط.
- Cache revision: `v2.9.7-r15-static`.
