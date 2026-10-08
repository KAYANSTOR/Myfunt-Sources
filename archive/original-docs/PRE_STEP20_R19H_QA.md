# PRE_STEP20 r19h — QA + UI Consistency

## المنفذ
- سجل الرسائل أصبح جدول Excel-like بترقيم ديناميكي وصفحات 25 سجلًا.
- بحث وفلتر حالة وترقيم صفوف وأزرار صفحات.
- أيقونات لإحصاءات الرسائل: الكل، الناجح، الفاشل، المنتظر.
- إصلاح Dark Mode للخطط، نافذة الترقية، وبطاقات باقات الشركة.
- إضافة طلب إلغاء الترقية بحالة `cancel_requested` بدل حذف الطلب.
- توحيد نظام ظل 3D للأيقونات الضرورية باستخدام Tokens مشتركة للفاتح والداكن.

## فحص شامل ثابت
- JavaScript files: 41
- JavaScript syntax errors: 0
- Duplicate HTML IDs: 0
- Missing index assets: 0
- Missing Service Worker assets: 0
- CSS brace errors: 0
- Service Worker cache: `v2.9.7-r19h-static`

## ملاحظة تقنية
لا يزال في CSS القديم عدد كبير من `!important` المتراكمة من الإصدارات السابقة. لم يتم حذفها جماعيًا في هذه المرحلة لأن ذلك قد يغير الـCascade والتصميم. يتم التعامل معها تدريجيًا ضمن خطة الـRefactor. أكثر الملفات: prestep20-r19d.css=161, app.css=152, production-tools.css=93, advanced.css=81, prestep20-r19g.css=66, myfnt-finance.css=59.

## طلب إلغاء الترقية
الطلب لا يُحذف مباشرة. يتحول من `pending` إلى `cancel_requested` مع `cancelRequestedAt`، وتبقى الخطط مقفلة حتى المراجعة المستقبلية من الخادم/الإدارة.
