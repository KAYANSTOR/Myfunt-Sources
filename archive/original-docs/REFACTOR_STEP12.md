# REFACTOR STEP 12 — Conflict Resolution + Pull/Apply Pipeline

## الهدف
تجهيز مزامنة ثنائية الاتجاه بدون سحق تعديلات Offline. هذه الخطوة لا تفعل Backend حقيقيًا ولا تغير واجهة المستخدم.

## ما تم
- ترقية IndexedDB داخليًا من 5 إلى 6 بدون Reset.
- توسيع سجل `sync_conflicts` ليحفظ النسخة المحلية، payload المحلي، نسخة الخادم، `remote_version` ومصدر التعارض.
- إضافة `MyfntLocal.conflicts()` لقراءة التعارضات المفتوحة.
- إضافة `MyfntLocal.resolveConflict(id, strategy)` باستراتيجيتين آمنتين:
  - `keep_local`: إعادة إنشاء أمر مزامنة جديد فوق `remote_version` الحالي.
  - `accept_remote`: قبول نسخة الخادم وإغلاق الأمر المحلي المتعارض.
- إضافة `MyfntLocal.applyRemoteChanges()` لمسار Pull.
- أي Entity لديها pending/sending/failed/conflict أو Tombstone غير مُرسل لا تُستبدل تلقائيًا؛ ينشأ Pull Conflict بدل overwrite.
- تجاهل Remote versions الأقدم أو المساوية للنسخة المحلية النظيفة.
- دعم Remote delete/archive مع Tombstone متزامن محليًا.
- تخزين Pull cursor في `local_meta` لكل workspace.
- إضافة `MyfntSync.pull()` و `MyfntSync.syncCycle()`.
- عند 409 Push يتم تمرير `remote_payload` و `server_version` إلى سجل التعارض.
- لوحة التشخيص تعرض عدد التعارضات المفتوحة.
- Mock transport ما زال معطلًا عمدًا ولا ينفذ Push أو Pull.

## ملاحظات أمان البيانات
- لا يتم تطبيق Remote change فوق تعديل محلي غير محسوم.
- Tombstone محلي غير مُرسل يمنع Remote resurrection ويولد Conflict.
- `keep_local` مع Delete/Archive يحتفظ بنوع العملية الأصلي.
- `accept_remote` لحذف الخادم ينشئ Tombstone متزامن بدل مجرد حذف الصف.

## ما لم يتم بعد
- لا توجد شاشة UI نهائية لحل التعارضات؛ الـAPI المحلي جاهز فقط.
- لا يتم Hydrate للـlegacy `state/localStorage` من Pull بعد؛ التغييرات البعيدة تطبق على normalized IndexedDB فقط في هذه المرحلة الآمنة.
- لا يوجد Backend PHP فعلي بعد.
- لا يوجد auth token أو server membership validation بعد.

## Cache
- Revision: `v2.9.7-r12-static`
- الإصدار المرئي: `2.9.7`
