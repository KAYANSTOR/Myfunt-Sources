# تقرير تدقيق وتنظيف وثائق Mivent

## نطاق التدقيق

تم تحليل snapshot المرفوع:

`Myfnt_2.14.21_Admin_App_Parity_Audit_Root-2.zip`

النسخة المرجعية: **2.14.21**

الهدف: تحويل مجموعة الوثائق التاريخية الكبيرة إلى مصدر واضح يمكن لوكيل Flutter الاعتماد عليه بدون أن يخلط بين القرارات الحالية والمراحل القديمة.

## ما وجدته

المصدر يحتوي:
- 111 ملف Markdown تاريخيًا.
- 55 ملف JavaScript.
- 20 ملف CSS.
- 3 ملفات config JSON.
- عقود DB/API إضافية بصيغ JSON/SQL/XLSX.
- واجهة Web/PWA كاملة داخل `index.html` و`assets/`.

المشكلة الرئيسية ليست نقص الوثائق؛ المشكلة هي **تعدد المصادر والتداخل الزمني**.

## المشكلات التي تم حلها في طبقة Canonical

### API
التوثيق التاريخي يذكر `/api/v1/sync/commands` في مواضع قديمة، بينما مصدر التنفيذ الحالي والعقد الآلي يعتمدان `/api/v1/sync/push`.

تم اعتماد `/sync/push`.

### الهوية
تم فصل UUID canonical عن أرقام العرض.

### Users/Memberships
تم اعتماد `company_memberships` كاسم الجدول التقني، مع `مستخدمو الشركة` كاسم UI.

### Booking Details
تم الإبقاء على `bookings` + `booking_details` وفق SQL المرجعي المنظم.

### Audit
تم اعتماد `booking_audit` و`payment_audit`.

### Auth
تم اعتماد Phone/OTP كواجهة العميل، مع عزل API عن UI.

### Backup
تم فصل Local Backup عن Cloud Backup.

### Feature Gates
تم توضيح أن Client Gate للـUX وأن Server Gate للسلطة الأمنية.

### Branding
تم اعتماد Mivent/مايفنت، وعدم نقل Myfnt/Ozan إلى واجهة Flutter.

## النتيجة

أصبح لدينا:
- 17 وثيقة Canonical.
- مجلد `contracts/` للعقود المنظمة.
- `reference-assets/` للصور المرجعية.
- `archive/` يحفظ التاريخ بدون حذفه أو تشويهه.
- `AGENT_CONTEXT.md` كنقطة بداية للوكيل.

## قاعدة المستقبل

أي قرار جديد يغير:
- DB.
- API.
- plan/feature.
- auth.
- sync.

يجب أن ينعكس أولًا في العقد المناسب ثم في الوثيقة Canonical، ولا يتم دفنه داخل ملف Release تاريخي.
