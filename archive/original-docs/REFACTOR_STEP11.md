# MYFNT Refactor Step 11 — Sync Queue State Machine

الإصدار المرئي بقي 2.9.7. هذه الخطوة تنظّم طابور المزامنة وتفصل النقل الشبكي عن IndexedDB بدون تشغيل Backend حقيقي.

## الحالات المعتمدة

- pending: جاهز للمحاولة.
- sending: محجوز بواسطة محاولة واحدة وله lease زمني.
- synced: أكد الخادم الاستلام.
- failed: فشل إرسال؛ قد يكون قابلًا أو غير قابل لإعادة المحاولة.
- conflict: تعارض إصدار 409 يحتاج حلًا صريحًا.
- superseded: استبدلته عملية محلية أحدث قبل الإرسال.

## الانتقالات

- pending -> sending عبر claimNext().
- failed -> sending فقط عندما retryable=true و next_attempt_at مستحق.
- sending -> synced عبر finishCommand().
- sending -> failed عبر failCommand().
- sending -> conflict عند 409.
- sending منتهي الـlease -> failed ثم backoff.
- pending/failed -> superseded عند وجود تغيير محلي أحدث لنفس entity.

## Retry / Backoff

Backoff تصاعدي يبدأ من 5 ثوانٍ ويصل بحد أقصى إلى 15 دقيقة. الحد الافتراضي للمحاولات 8. فشل غير قابل لإعادة المحاولة لا تتم مطالبته مرة أخرى تلقائيًا.

## منع الازدواج

عند حفظ Entity جديد لنفس entity_key، يتم supersede للـpending/failed السابق قبل إنشاء الأمر الجديد. لا يتم لمس sending لأن الخادم قد يكون استلمه بالفعل.

إذا كان هناك conflict مفتوح، لا يتم إنشاء أمر موازٍ يتجاوزه. يتم حفظ آخر local payload/operation داخل سجل الـconflict الحالي حتى تتم معالجته صراحةً.

## Tombstones

Delete/Archive يتبع نفس القواعد. إذا كان هناك conflict مفتوح لا يتم إنشاء DELETE/ARCHIVE منافس؛ تحفظ نية المستخدم على سجل التعارض الحالي.

## Sync Adapter

أضيف `assets/js/myfnt-sync-adapter.js` كطبقة النقل الوحيدة فوق MyfntLocal.

- لا يعرف IndexedDB تفاصيل HTTP.
- الـAdapter يرسل command contract موحّدًا إلى `/sync/commands` عند توفر Transport حقيقي.
- 409 يتحول إلى conflict.
- 408/429/5xx تعتبر retryable.
- أخطاء 4xx الأخرى لا يعاد إرسالها تلقائيًا.
- metadata المخزنة من الرد محدودة ولا يتم تخزين Response كامل عشوائيًا.

## حماية نسخة Mock الحالية

`mock-api.js` ما زال موجودًا للحفاظ على السلوك التجريبي القديم، لكن MyfntSync يكتشف `mode: mock` ويمنع تفريغ sync_queue. لا يمكن لنجاح وهمي من mock API تحويل أوامر حقيقية إلى synced.

## واجهة التشخيص

نافذة المزامنة تعرض الآن توزيع الحالات pending/sending/failed/conflict وحالة موصل النقل، وتوضح أن Mock transport معطل عمدًا.

## لم يتغير

- تصميم الواجهة.
- LocalStorage keys.
- IndexedDB schema/store names في هذه الخطوة.
- Tombstone schema.
- Financial journal.
- Payment correct/reverse semantics.
- CRUD الأساسي.
- لا يوجد Auto Sync إلى خادم حقيقي بعد.
