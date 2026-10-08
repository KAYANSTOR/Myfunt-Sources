# Refactor Step 16 — Customer Repository

## الهدف
تحويل دليل العملاء والقراءة/البحث/التصدير والملاحظات إلى CustomerRepository مع إبقاء state.customers كطبقة توافق مؤقتة فقط.

## ما تم
- توسيع `MyfntRepositories.customers` بعمليات:
  - `all/snapshot/get/find/filter/exists/indexOf`
  - `mutate`
  - `removeLocal`
  - `replaceLocal`
  - `record/remove`
- `myfnt-customers.js` أصبح يقرأ من CustomerRepository ويستخدم state فقط كـfallback.
- Migration الخاصة بالعملاء تستبدل القائمة عبر Repository عند توفره.
- `all()` يعيد Snapshot من Repository.
- الترقيم `nextCustomer()` أصبح يقرأ قائمة Repository.
- Export/Backup في `bookings.js`, `advanced.js`, `enhancements.js`, `secure-export.js` يقرأ Snapshot العملاء من Repository.
- Import JSON يمرر قائمة العملاء عبر `replaceLocal(..., {persist:false})` قبل المصالحة.
- Reset المحلي يمر عبر CustomerRepository كحد توافق.
- Finance أضيفت له بوابات `customerRepository/allCustomers/customerById`، وقراءة العميل الرئيسي في شاشة العملاء تمر منها.
- حفظ ملاحظات العميل يسجل Update عبر CustomerRepository بدل استدعاء Offline مباشرة.

## ما بقي مباشرًا عمدًا
الوصول المباشر إلى `state.customers` داخل `myfnt-finance.js` بقي فقط داخل معاملة `commitBookingCustomer()` وRollback الخاص بها. هذا مقصود لأن العميل + الحجز + السند يجب أن يظلوا Transaction ذرية واحدة ولا يجوز تحويلهم إلى Mutations مستقلة قبل بناء Finance Transaction Repository.

## السلوك غير المتغير
- مطابقة العميل = الاسم + الهاتف فقط.
- السماح بإنشاء عميل مستقل بنفس الاسم/الهاتف عند التأكيد.
- الأرقام التسلسلية للعملاء تبدأ من 1.
- ربط العميل بالحجز والسند لم يتغير.
- Journal/Rollback المالي لم يتغير.
- واجهة العملاء وتصميمها لم يتغيرا.

## التحقق
- JavaScript syntax: OK لكل الملفات.
- Missing index assets: 0.
- Missing Service Worker assets: 0.
- Cache: `v2.9.7-r16-static`.
- الوصول المباشر المتبقي في `myfnt-finance.js`: محصور في Transaction/Rollback.
