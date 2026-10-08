# Myfnt 2.14.11 — Core Preview Repair

- إصلاح أساسي مباشر لمسار معاينة الحجز، وليس طبقة Hotfix.
- توحيد معالجة هاتف العميل داخل bookingPhonePreviewModel().
- الرقم الموحّد يستخدم للاتصال/SMS/WhatsApp، والرقم المعروض يمر عبر MyfntPhone.display().
- openPreview() لم يعد يعتمد على متغيرات phoneDisplay/phoneActions المنفصلة.
- لا تغيير على Event Registry أو Recipient Resolver أو Smart Notifications.
