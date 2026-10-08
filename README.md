# Mivent — Flutter Source of Truth

هذا المستودع هو **حزمة مرجعية موحّدة لبناء تطبيق Flutter الخاص بـ Mivent / مايفنت** انطلاقًا من المصدر الأصلي الموجود حاليًا في نسخة الويب.

## ما الذي يقدمه هذا المستودع؟

المستودع يجمع بين:

1. وثائق Canonical منظّمة ومختصرة من الصفر.
2. العقود الأصلية الآلية: JSON / SQL.
3. لقطات الواجهة المرجعية.
4. أرشيف الوثائق القديمة كما وصلت، للاحتفاظ بسجل القرارات بدون أن تصبح مصدرًا للتنفيذ.

## قاعدة المصدر

**الأولوية في البناء:**

`docs/` → المصدر التنفيذي المنظّم.

`contracts/` → العقود التقنية والبيانات.

`reference-assets/` → مرجع بصري.

`archive/` → تاريخ فقط، لا يُنفذ منه شيء مباشرة.

## الاسم المعتمد

الاسم التجاري داخل Flutter:

**Mivent — مايفنت**

الأسماء `Myfnt` و`Ozan*` الموجودة في المصدر القديم هي أسماء داخلية/تاريخية. لا تستخدم في واجهة Flutter ولا في أسماء Domain الجديدة إلا داخل طبقة توافق عند الحاجة.

## المرجع البصري والوظيفي

الموقع المرجعي الأصلي:

`https://ozan.fun/novwh/`

المصدر المرفوع لهذه الحزمة هو snapshot من نسخة الويب، إصدار 2.14.21.

## ترتيب القراءة الإلزامي للوكيل البرمجي

1. `AGENT_CONTEXT.md`
2. `docs/00_SOURCE_OF_TRUTH.md`
3. `docs/01_PRODUCT_SPEC.md`
4. `docs/02_SCREEN_MAP_AND_FLOWS.md`
5. `docs/03_UI_UX_SPEC.md`
6. `docs/04_DOMAIN_DATA_MODEL.md`
7. `docs/05_LOCAL_FIRST_ARCHITECTURE.md`
8. `docs/06_SYNC_API_CONTRACT.md`
9. `docs/07_AUTH_COMPANY_AND_ACCESS.md`
10. `docs/08_PLANS_AND_FEATURE_GATES.md`
11. `docs/09_COMMUNICATIONS_AND_NOTIFICATIONS.md`
12. `docs/10_BACKUP_RESTORE_IMPORT_EXPORT.md`
13. `docs/11_PERFORMANCE_AND_FLUTTER_TARGET.md`
14. `docs/12_CURRENT_STATE_AND_GAPS.md`
15. `docs/13_ACCEPTANCE_TESTS.md`
16. `docs/14_SOURCE_CODE_MAP.md`
17. `docs/15_FLUTTER_PORTING_SEQUENCE.md`
18. `docs/16_DOCUMENT_DECISIONS_AND_CONFLICTS.md`

## قاعدة أساسية

لا يتم اختراع سلوك غير موجود في المرجع.

عند وجود تعارض بين وثيقة قديمة ووثيقة Canonical، تُستخدم الوثيقة Canonical ويُذكر التعارض في `docs/16_DOCUMENT_DECISIONS_AND_CONFLICTS.md`.

## الهدف النهائي

بناء تطبيق Flutter RTL سريع، Local-First، بنفس منطق المنتج وواجهته ووظائفه الأساسية، مع فصل واضح بين:

- UI
- State
- Domain
- Local Database
- Repository
- Sync/API

حتى لا تنتقل فوضى المصدر التاريخي إلى مشروع Flutter الجديد.
