# Myfnt 2.9.8 — Refactor Step 20

## الهدف
إزالة الوصول المباشر إلى Domain state من طبقات الواجهة والأدوات والتصدير، والإبقاء على `state` كحالة UI وCompatibility Cache داخل الطبقات الداخلية فقط.

## الملفات المحولة إلى Repository access
- `assets/js/advanced.js`
- `assets/js/app.js`
- `assets/js/auth.js`
- `assets/js/calendar-tools.js`
- `assets/js/production-tools.js`
- `assets/js/secure-export.js`
- `assets/js/enhancements.js`
- `assets/js/receipt-image.js`
- `assets/js/bookings.js` (قراءات الدومين والتصدير/الاستيراد العادية)
- `assets/js/ui.js`
- `assets/js/auth-journey.js`
- `assets/js/info-pages.js`
- `assets/js/myfnt-notifications.js`

## النتيجة
هذه الوحدات لم تعد تقرأ مباشرة:
- `state.bookings`
- `state.customers`
- `state.receipts`
- `state.packages`
- `state.specialDays`
- `state.settings`

بدل ذلك تعتمد على `MyfntRepositories` وواجهات القراءة/الكتابة التابعة لها.

## ما بقي من Domain state عمدًا
الوصول المباشر محصور في طبقات التوافق الداخلية التالية:
- `core.js` — تحميل/حفظ Legacy cache وحالة التوافق.
- `myfnt-repositories.js` — Repository boundary نفسه.
- `myfnt-hydration.js` — مزامنة IndexedDB إلى Legacy cache.
- `myfnt-offline.js` — snapshot/reconcile compatibility.
- `myfnt-sequences.js` — migration وترقيم البيانات الحالية.
- `myfnt-finance.js` — المعاملات المالية الذرية وRollback.
- `myfnt-customers.js` — migration/directory compatibility.

هذا مقصود في Step 20 ولا يمثل وصول UI مباشر.

## state الذي يبقى في الواجهة
يبقى `state` لحالة الواجهة فقط مثل:
- `viewDate`
- `selectedDate`
- `viewFilter`
- `renderLimit`
- `windowStack`
- `activeBookingId`
- `lastCreatedBookingId`
- `notificationRead`
- flags/timers/caches المؤقتة

## تحسينات جانبية ضمن Step 20
- التصدير والنسخ الاحتياطي يأخذان snapshots من Repositories.
- صورة السند تقرأ الحجز والسند والشركة من Repositories.
- Calendar Tools تقرأ الحجوزات واسم الشركة من Repositories.
- Auth onboarding يطبق إعدادات الشركة والباقات عبر Repository بدل تعديل Domain state مباشرة.
- Rollback في Customer migration داخل `app.js` و`auth.js` أصبح عبر Repository snapshots/replaceLocal.
- UI notifications/calendar تستخدم Repository للبيانات مع بقاء حالة القراءة/التنقل داخل UI state.

## الإصدار
- App version: `2.9.8`
- Service Worker cache: `v2.9.8-r20-static`

## الفحص
- جميع ملفات JavaScript: Syntax OK.
- لا يوجد Domain state access خارج قائمة Compatibility Boundaries المعتمدة.
- Duplicate HTML IDs: 0.
- Missing HTML assets: 0.
- Missing Service Worker assets: 0.
- Runtime references to 2.9.7: 0.
