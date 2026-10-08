# Myfnt Refactor — Step 2

## النطاق
تنظيف يدوي لقواعد التقويم وقائمة الحجوزات فقط، مع المحافظة على التصميم والسلوك النهائي كما كان قبل التنظيف.

## ما تم
1. إزالة قواعد التقويم/قائمة الحجوزات من `ozan-v210.css` التي كانت تعمل كترقيع متأخر فوق `app.css`.
2. تثبيت النتيجة الفعلية السابقة للـ cascade داخل `app.css` كمصدر أساسي واحد لقواعد spacing/scroll الخاصة بقائمة الحجوزات المثبتة.
3. إزالة التعارض القديم: `scroll-snap-type:y proximity` ثم إلغاؤه لاحقًا بـ `scroll-snap-type:none`. القيمة النهائية السابقة (`none`) أصبحت معرفة مرة واحدة.
4. الحفاظ على Safe Area السفلي تمامًا: `padding-bottom` و `scroll-padding-bottom` ما زالا يستخدمان `max(6px, env(safe-area-inset-bottom)) !important`.
5. دمج تعريفات `.calendar-card` المتفرقة في تعريف واحد بدون تغيير القيم النهائية.
6. دمج الخصائص المتفرقة لـ `.calendar-weekdays,.calendar-grid` في تعريفها الأساسي بدون تغيير القيم النهائية.
7. توحيد تعريفات `.booking-filters` و `.bookings-list` النهائية وإزالة تعريفات superseded داخل نفس الملف.
8. لم يتم حذف `ozan-v210.css` بالكامل لأنه ما زال يحتوي قواعد غير مرتبطة بالتقويم (المعاينة/البحث/الأيام المتاحة/About). تنظيفها سيكون في خطواتها الخاصة.

## تحقق المحافظة على السلوك
تمت مقارنة الـ CSS cascade قبل/بعد للقواعد التالية:
- `.booking-filters`
- `.bookings-list`
- `body.calendar-pinned .booking-filters`
- `body.calendar-pinned .bookings-list`
- `body.calendar-pinned .bookings-section`
- `body.calendar-pinned .bookings-list>.booking-card:last-child`
- `.calendar-card`
- `.calendar-weekdays`
- `.calendar-grid`

النتيجة: القيم الفعلية النهائية متطابقة قبل/بعد للتعريفات المستهدفة.

## لم يتم تغييره
- HTML structure
- JavaScript behavior
- Calendar 42-cell rendering
- booking cards UI
- dark/light theme values
- responsive breakpoints
- add booking form
- finance/customers/auth
- visible app version (يبقى 2.9.7)

## Cache
تم تغيير cache revision الداخلي فقط من `r1` إلى `r2` وتحديث cache-buster للملفين المعدلين حتى لا تُعرض نسخة CSS قديمة بعد الرفع. رقم الإصدار المرئي بقي 2.9.7.
