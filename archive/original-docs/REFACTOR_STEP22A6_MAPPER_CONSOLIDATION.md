# Myfnt 2.13.8 — Step 22A.6 Mapper Consolidation

## الهدف
توحيد التحويل بين UI legacy state وIndexedDB/API في عقد Mapper واحد، مع إبقاء fallbacks الانتقالية مؤقتًا لتجنب كسر السلوك القديم.

## الملف الجديد
`assets/js/myfnt-mappers.js`

## العقد المركزي
- IndexedDB هو المصدر الدائم.
- UUID المولّد على العميل هو الهوية القانونية.
- المال في IndexedDB/API بوحدة minor، وفي واجهة UI بوحدة major.
- التواريخ في الصفوف بصيغة ISO، وفي UI بالتنسيق القديم المطلوب.

## Mappers
- Package: `toRow()` / `fromRow()`
- Customer: `toRow()` / `fromRow()`
- Booking: `toRows()` / `fromRows()` لأن الحجز يتكون من `bookings + booking_details`
- Payment: `toRow()` / `fromRow()`
- API: `toApi()`

## المسارات التي أصبحت تستخدم العقد المركزي
1. `myfnt-local-db.js`
   - packages
   - customers
   - bookings + booking_details
   - payments
   - API payload filtering
2. `myfnt-hydration.js`
   - package hydration
   - customer hydration
   - booking hydration
   - payment hydration
3. `myfnt-query.js`
   - customer query shape
   - booking query shape
   - payment query shape

## حماية التوافق
التحويلات القديمة لم تحذف بعد. بقيت fallback خلف الـ Mapper فقط، حتى يمكن قياس السلوك ثم حذف التكرار في مرحلة لاحقة بدون كسر الاستيراد أو الشاشات القديمة.

## فحص Mapper
يمكن تنفيذ:
`MyfntMappers.audit()`

المتوقع:
`healthy: true`

## اختبار Round Trip المنفذ
تم اختبار عينات Package/Customer/Booking/Payment عبر:
UI -> canonical row -> UI

وحافظت النتيجة على:
- legacy display ID
- customerId
- packageId
- bookingId
- amount
- paid
- currency

## الإصدار
2.13.8
