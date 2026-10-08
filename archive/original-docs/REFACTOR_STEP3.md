# Myfnt 2.9.7 — Refactor Step 3

## Scope
تنظيف بطاقات الحجوزات فقط مع المحافظة على التصميم والسلوك النهائي كما كان في Step 2.

## What changed
- دمج تعريف `.booking-card` الأساسي مع القيم النهائية التي كانت موزعة في ترقيع متأخر داخل `app.css`.
- إزالة pseudo-elements القديمة `::before` و`::after` لأنهما كانا يُنشآن أولًا ثم يتم تعطيلهما لاحقًا بـ `content:none`.
- توحيد موضع وحجم زر `.booking-card__action` داخل تعريف واحد، وإزالة ترقيع `!important` المتأخر.
- دمج padding النهائي لـ `.booking-card__main` و`.booking-card__meta`.
- دمج الشكل النهائي لأيقونات صفوف البطاقة في المصدر الأساسي.
- حذف hover قديم كان يتم تجاوزه بالكامل بتعريف أحدث.
- إبقاء قواعد الهاتف (`max-width:360px`)، الحالات (`is-past`, `is-today`)، Dark Mode، وSearch Window كما هي لأنها سياقات فعلية وليست ترقيعات ميتة.

## Deliberately unchanged
- HTML markup للبطاقة.
- `createBookingCard()` ومنطق بيانات الباقة والحالة.
- فتح المعاينة وأحداث النقر.
- ارتفاع البطاقة responsive.
- ألوان Dark Mode.
- حالات اليوم/المنتهي.
- تصميم البحث الذي يستخدم نفس بطاقة الحجز.

## Verification
- مقارنة Cascade قبل/بعد على 360px و800px، Light/Dark، والبطاقة العادية/اليوم/المنتهية.
- لا تغيير في القيم النهائية المستهدفة.
- JavaScript syntax check لكل الملفات.
- CSS parse check.
- فحص مراجع HTML وService Worker.

## Cache
تم رفع revision الداخلي من r2 إلى r3 فقط لمنع بقاء CSS القديم في PWA. رقم إصدار المنتج الظاهر ما زال 2.9.7.
