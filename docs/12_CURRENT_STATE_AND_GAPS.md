# 12 — الحالة الحالية والفجوات

## تم التحقق من snapshot المرفوع

- النسخة المرجعية: 2.14.21.
- ملفات JavaScript: 55.
- ملفات CSS: 20.
- ملفات config: 3.
- صور مرجعية: 12.
- هناك عدد كبير من وثائق release/refactor/QA في الجذر.

## نضج Domain

### قوي/مطبق
- bookings.
- customers.
- payments.
- booking packages.
- settings.
- local storage.
- repository boundary.
- mapper boundary.
- feature gates.
- notifications engine.
- backup/restore local.
- sync queue mechanics.
- bootstrap/adoption mechanics.

### جزئي
- server sync.
- cloud backup.
- advanced reports.
- multi-user client management.
- attachments.
- storage quota.
- some integrations.

### غير مكتمل/مستقبلي
- Google Calendar OAuth/API.
- Google Drive live integration.
- Production Laravel connection.
- Production authentication.
- real SMS provider server flow.
- full server notification job execution.
- server-generated cloud backups.
- ads domain.
- real multi-device sync until backend exists.

## أهم الاختلافات الداخلية التي لا يجب إخفاؤها

### 1. Local schema vs final architecture
المصدر المحلي ما زال يحتفظ بكيانات انتقالية مثل:
- `company_memberships`.
- `booking_details`.
- `booking_audit`.
- `payment_audit`.
- `sms_templates`.
- `sms_messages`.

لا تحذفها في Flutter لأن التقرير القديم قال ذلك؛ استخدم Canonical contract الفعلي في `contracts/`.

### 2. API endpoint legacy
هناك وثائق قديمة تشير إلى:

`/api/v1/sync/commands`

لكن adapter وJSON contract الحاليان يعتمدان:

`/api/v1/sync/push`

Flutter الجديد يستخدم `sync/push`.

### 3. Auth legacy
تقرير معماري قديم يقترح `/auth/login`.

العقد النهائي الحالي يعرض Phone OTP endpoints.

Flutter يحافظ على flow OTP ويعزل API layer.

### 4. company_users wording
تقارير parity اللاحقة استخدمت `company_users` في النص.

الـSQL والعقد المنظم يستخدمان:

`company_memberships`

هذا هو الاسم التقني المعتمد.

### 5. Release numbering
بعض ملفات Release/QA تحمل عنوانًا برقم لا يطابق اسم الملف.

هذه الملفات وضعت في `archive/` كي لا تؤثر على التنفيذ.

## القرار

لا نحاول "تنظيف" التاريخ عبر حذف الملفات.

نُبقي:
- Canonical docs للقرار.
- Archive للسجل.

هذا يحافظ على traceability دون خلق مصدرين متنافسين.
