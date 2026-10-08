# Refactor Step 5 — Window system, drawer, header

هدف الخطوة: تنظيم طبقات النوافذ والقائمة الجانبية والهيدر بدون تغيير التصميم أو سلوك التنقل.

## ما تم
- دمج القيم النهائية الفعلية لحركة `.window` في تعريفها الأساسي وحذف override متأخر كان يعيد تعريف transform/transition/will-change.
- إبقاء حالات `.is-open`, `.is-closing`, `.is-under` بنفس القيم النهائية السابقة.
- إزالة طبقة حركة `.drawer-window` العامة القديمة؛ المشروع يملك drawer واحدًا فقط (`#menuWindow`) وهو يملك قواعده النهائية الأقوى أصلًا.
- توحيد backdrop في تعريف واحد مع نفس z-index والخلفية والـblur والانتقال النهائي 280ms.
- إبقاء `#menuWindow.drawer-window` كمصدر واحد لحركة السايدبار RTL.
- دمج تخصيصات v1.7 الخاصة بالهيدر في `.app-header` الأساسي: minmax للوسط، min-width للجانبين، ومحاذاة right/left والوسط.
- حذف قاعدة هاتف قديمة `.drawer-window{width:78vw}` لأنها كانت ميتة أمام `#menuWindow` الأقوى والأحدث.
- تجميع مستويات النوافذ 500/510/520 داخل `WINDOW_LAYER` بدل أرقام سحرية داخل `syncWindowLayers()`.
- لم يتغير window stack أو history/back behavior أو aria/inert behavior.

## لم يتم تغييره عمدًا
- ألوان backdrop والـDark Mode.
- أبعاد القائمة الفعلية `min(82vw,360px)`.
- طريقة إخفاء الخلفية عند وجود نافذة `body.has-window`.
- مدة حركة القائمة 280ms.
- ترتيب history والرجوع لثلاث خطوات.
- أي نافذة مالية/حجز/عميل أو محتواها الداخلي.

## Cache
- app.css: `2.9.7-r5`
- ui.js: `2.9.7-r5`
- Service Worker cache: `v2.9.7-r5-static`
- الإصدار المرئي للتطبيق ما زال 2.9.7.
