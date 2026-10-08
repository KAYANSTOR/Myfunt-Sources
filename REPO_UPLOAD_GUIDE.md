# دليل رفع الحزمة إلى GitHub

## اسم مقترح للمستودع

`mivent-source-of-truth`

## ما ترفعه

ارفع **محتويات هذه الحزمة** كما هي إلى جذر المستودع الجديد.

## بعد الرفع

اجعل أول ملف يقرأه وكيل البرمجة:

`AGENT_CONTEXT.md`

ثم اتبع ترتيب `README.md`.

## لا تضع في المستودع

- API keys.
- passwords production.
- OAuth secrets.
- SMS gateway secrets.
- service account files.
- `.env`.
- ملفات جلسات.

## سياسة التطوير

كل قرار جديد يجب أن يضاف إلى `docs/16_DOCUMENT_DECISIONS_AND_CONFLICTS.md` إذا غيّر عقدًا قائمًا.

أي تغيير في DB/API يجب أن يحدث أولًا في `contracts/` ثم تنعكس نتيجته في docs.

أي تعديل UI كبير يجب أن يحافظ على `docs/03_UI_UX_SPEC.md`.
