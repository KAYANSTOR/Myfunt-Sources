# MYFNT 2.9.7 — Pre-Step20 Feature Additions

هذه الحزمة مبنية فوق Refactor Step 19، قبل بدء Step 20، وتضيف الوظائف المطلوبة بدون إزالة Legacy Domain Cache بعد.

## 1) قواعد الباقات
- `allowDoubleBooking`: السماح بأكثر من حجز لنفس الباقة في نفس التاريخ.
- `allowDiscount`: السماح باستخدام خصم مبلغ على حجوزات الباقة.
- الحقلان محفوظان في `booking_packages` ويعودان عبر Hydration.
- القواعد تُطبق فعليًا في التحقق من الحجز وأداة تعديل السعر.

## 2) إعدادات الدفع
أضيف إلى Booking UI settings:
- `allowBookingOverpayment`: السماح بالمدفوع الأولي الأكبر من إجمالي الحجز.
- `allowReceiptOverRemaining`: السماح بسند قبض لاحق أكبر من المتبقي.

تم ربطهما بإنشاء الحجز، إنشاء السند، تعديل السند، إلغاء السند، ومعاينة السند.

## 3) حالة مزامنة الحجز
`booking.syncStatus` يدعم:
- local
- pending
- sending
- synced
- failed
- conflict

تظهر الحالة في بطاقة الحجز وفي المعاينة. نجاح/فشل/تعارض Push يعيد تحديث حالة الحجز عند توفر الـlegacy id.

## 4) طابور المزامنة
تم تحسين نافذة الطابور لعرض:
- ملخص pending / sending / failed / conflict.
- حالة Transport.
- بطاقات حقيقية لأوامر الطابور.
- تغطية الجداول التي ستدخل المزامنة.

الـMock transport لا يزال ممنوعًا من تفريغ الطابور.

## 5) تغطية المزامنة المستقبلية
أصبحت الأنواع التالية مشمولة في البنية:
- bookings
- booking_details
- customers
- payments (create/correct/reverse semantics)
- booking_audit
- payment_audit
- booking_packages
- company_settings
- calendar_blocks
- alert_rules

تمت ترقية IndexedDB إلى version 7 لإضافة audit entities إلى مسار المزامنة.

## 6) فئات النشاط والباقات الافتراضية
تم اعتماد 10 فئات:
1. قاعة
2. شالية
3. فنان
4. فنانة
5. مصورة
6. استديو تصوير
7. مكتب كوش
8. تنسيق حفلات
9. مخبز
10. أخرى

كل فئة تحصل على عددها الحقيقي من الباقات الافتراضية وأيقونات Font Awesome مناسبة، ولم يعد النظام يفرض 5 باقات افتراضية على كل فئة.

## 7) خطط الاشتراك
ملف المصدر:
`assets/config/subscription-plans.json`

الخطط:
- BASIC — الافتراضية
- PLUS
- SUPER
- MAX
- ULTRA

BASIC:
- شهري 3000 YER
- سنوي 30000 YER
- 100 حجز
- 400 SMS سنويًا
- 100MB
- 20 مرفق / 2MB للملف
- نسخة محفوظة واحدة
- 3 قوالب رسائل
- لا حملات SMS
- لا إعلانات
- لا Excel import/export
- لا مستخدمين إضافيين
- لا تنزيل صور
- لا نسخ احتياطي يدوي
- لا تقارير
- لا إشعارات ذكية
- تخصيص فورم مستوى 1

أسعار PLUS/SUPER/MAX/ULTRA لم تكن محددة في الطلب، لذلك بقيت `null` لتحديدها من الإدارة بدل اختراع أسعار.

مستويات Form Customization:
- BASIC = 1
- PLUS = 2
- SUPER = 3
- MAX = 4
- ULTRA = 5

حدود الخطط ليست مكتوبة في منطق الواجهة، وإنما تُقرأ من plan registry. التصميم جاهز لاحقًا لاستبدال الملف بتعريف قادم من Admin/PHP API.

## 8) تطبيق بعض قيود الخطة فعليًا
BASIC يمنع حاليًا في الواجهة الموجودة:
- إضافة مستخدم إضافي.
- Excel import.
- Excel export / Excel template.
- النسخة الاحتياطية اليدوية والاستعادة اليدوية.
- تنزيل صورة السند.
- تنزيل صورة نجاح الحجز.

ميزات غير موجودة أصلًا في هذه الحزمة (مثل إدارة الإعلانات الكاملة أو حملات SMS الجماعية أو المرفقات السحابية) تمت إضافة حدودها وCapabilities في تعريف الخطة لتطبيقها عند بناء الوحدات الخاصة بها.

## 9) ثبات المعرفات
لم يتغير نظام Step 14:
- bookingNo: 1,2,3...
- customerNo: 1,2,3...
- receiptNo: 1,2,3...
- movementNo: 1,2,3...
مع بقاء UUID داخلي للمزامنة.

## 10) فحوصات البناء
- كل JavaScript يمر `node --check`.
- `subscription-plans.json` صالح JSON.
- لا توجد مراجع HTML مفقودة.
- لا توجد مراجع Service Worker مفقودة.
- plan loader وplan JSON موجودان في precache.
- CSS braces متوازنة.

Cache revision: `v2.9.7-r19b-static`.
Visible application version: `2.9.7`.
