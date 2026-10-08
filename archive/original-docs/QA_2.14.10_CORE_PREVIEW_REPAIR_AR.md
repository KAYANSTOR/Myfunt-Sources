# QA — Myfnt 2.14.11 Core Preview Repair

## سبب الخلل
`openPreview()` كان يعتمد على متغير `phoneDisplay` غير معرّف وقت التشغيل، لذلك استدعاء المعاينة من البطاقة يصل للدالة ثم ينهار بـ ReferenceError.

## الإصلاح الأساسي
- إعادة تنظيم معالجة الهاتف داخل `bookings.js` نفسه.
- إنشاء `bookingPhonePreviewModel(value)` كمصدر واحد لبيانات هاتف المعاينة.
- يعيد: `normalized`, `display`, `actions`.
- `openPreview()` يستهلك هذا العقد مباشرة.
- إزالة الاعتماد على `phoneDisplay` و`phoneActions` كمتغيرات مستقلة.
- `previewContactActions()` يستقبل الرقم الموحّد فقط ولا يعيد تطبيعه داخليًا.

## ما لم يتغير
- Event Registry.
- Recipient & Channel Resolver.
- Smart Notification Engine.
- منطق النقر على بطاقات الحجوزات.

## الفحص
- جميع JavaScript: PASS.
- جميع JSON: PASS.
- duplicate HTML IDs: 0.
- لا يوجد `phoneDisplay` معلّق في `bookings.js`.
- نسخة التطبيق: 2.14.11.
