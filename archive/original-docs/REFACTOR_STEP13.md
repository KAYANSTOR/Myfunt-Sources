# Myfnt 2.9.7 — Refactor Step 13
## Hydration Bridge: IndexedDB -> Legacy UI State

هذه الخطوة لا تغيّر تصميم الواجهة. هدفها جعل التغييرات النظيفة القادمة من Pull تظهر في state/localStorage والواجهة الحالية بدون Reload وبدون توليد Push جديد.

### ما أضيف
- `assets/js/myfnt-hydration.js`
- `MyfntLocal.hydrationSnapshot()` لقراءة الجداول اللازمة في Snapshot متسق.
- Hydration Journal باسم `ozan.hydration.journal.v1` لحماية الكتابة متعددة المفاتيح.
- استرجاع تلقائي للـPre-image عند اكتشاف Hydration انقطع أثناء الكتابة.

### ما يتم Hydrate له
- bookings + booking_details
- customers
- booking_packages
- payments -> receipts
- calendar_blocks -> specialDays
- company_settings + companies -> merge into settings
- alert_rules -> alertTemplates
- customer notes -> finance notes storage

### قواعد الأمان
1. الجسر يعمل بعد `myfnt:remote-applied` فقط، ولا ينشئ أوامر sync جديدة.
2. الكتابة إلى localStorage صامتة عبر `safeStorage` ولا تستدعي saveBookings/saveReceipts/saveSettings.
3. إعدادات UI المحلية مثل theme/طي التقويم لا تُستبدل عميًا؛ إعدادات الخادم يتم Merge لها فقط في الحقول المتزامنة.
4. صفوف الحجوزات والعملاء الحالية تُحدّث In-place قدر الإمكان للمحافظة على مراجع الكائنات في النماذج المفتوحة.
5. إذا كان سجل الاسترجاع المالي غير مكتمل، يتوقف Hydration بدل الكتابة فوق معاملة قيد الاسترجاع.
6. قبول نسخة الخادم عند Conflict يشغّل Hydration فورًا؛ keep_local لا يحتاج تغيير واجهة.

### إصلاح concurrency مهم
- `normalizeBooking()` أصبح يحتفظ بـ `serverVersion`.
- writer المحلي للحجز يستخدم `server_version` بدل `version` في الصف المنظم.
- `saveBatch()` يحافظ على `server_version` السابق عند الكتابة المحلية ولا يسمح بمسحه بعد Push/Pull ناجح.

### PWA
- أضيف ملف hydration إلى precache.
- تم توحيد Revision للملفات المعدلة في index وService Worker إلى r13.
- cache name: `v2.9.7-r13-static`.

### ما لم يتغير
- تصميم الواجهة وCSS.
- شكل بيانات LocalStorage العامة للمستخدم.
- Sync adapter transport (ما زال mock معطل للإرسال الحقيقي).
- Conflict policy نفسها.
- IndexedDB schema stores (لا Store جديد في هذه الخطوة).

### الفحوصات
- جميع ملفات JavaScript: Syntax OK.
- مراجع index: لا ملفات مفقودة.
- مراجع Service Worker: لا ملفات مفقودة.
- Revision للـcore/local-db/offline/hydration متطابق بين index وSW.
- اختبار Chromium headless داخل بيئة البناء لم يكتمل بسبب قيود تشغيل Chromium في البيئة؛ لذلك يلزم Runtime UI QA على متصفح عادي قبل اعتماد إنتاجي.
