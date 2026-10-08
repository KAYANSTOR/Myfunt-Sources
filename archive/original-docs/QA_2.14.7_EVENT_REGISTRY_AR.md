# QA — Myfnt 2.14.7 Event Registry + Communication Contract

## نتيجة الفحص
تم إنشاء سجل أحداث مركزي دون تغيير طريقة حفظ الحجوزات أو الدفعات ودون حذف Smart Notification Engine.

## اختبارات منفذة
- Node syntax check لكل ملفات JavaScript في `assets/js`: ناجح.
- JSON parsing لكل ملفات JSON: ناجح.
- Runtime bridge test:
  - `ozan:booking-saved` -> `booking.created`: ناجح.
  - إنشاء عميل مع الحجز -> `customer.created`: ناجح.
  - `myfnt:finance-changed` create -> `payment.created`: ناجح.
- Communication Policy يستمد 10 أحداث قابلة للتحكم من Event Registry نفسه: ناجح.
- عقود Smart موجودة مثل `booking.overpaid`, `booking.amount_missing`, `booking.unpaid_after_event`, `booking.temporary_expired`: ناجح.
- Load order في `index.html`: Registry ثم Communication Policy ثم Notifications: صحيح.
- Service Worker precache يحتوي Registry والسياسة والإشعارات بالإصدار 2.14.7.
- لا توجد Migration مدمرة أو تعديل على بيانات IndexedDB.

## التوافق
المستمعات القديمة للحجز/الدفعات داخل Notification Center أصبحت fallback فقط وتعمل حصراً إذا لم يوجد `MyfntEventRegistry`. لذلك لا يوجد تشغيل مزدوج في النسخة الطبيعية.

## ما لم يتم نقله عمدًا في هذه المرحلة
- Smart Notification detection ما زال يعمل من محركه المستقر الحالي. تم فقط إعطاء كل Smart Issue كود Event رسمي لتجهيز النقل التدريجي لاحقًا.
- نتائج SMS sent/failed ما زالت تُعرض في مركز الإشعارات من المسار المستقر الحالي، رغم أنها أصبحت أيضًا معرفة في Event Registry.
