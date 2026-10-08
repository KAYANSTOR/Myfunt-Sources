# Myfnt 2.13.2 — Step21N.2 Initial Company Bootstrap + Sync Progress UI

## الهدف
بناء مسار تهيئة أولية لشركة موجودة مسبقًا على الخادم قبل تنفيذ Laravel، بحيث يستطيع جهاز جديد استقبال شركة صغيرة أو ضخمة بدون تحميل كامل التاريخ في RAM، مع استئناف آمن بعد انقطاع الشبكة أو إغلاق التطبيق.

## السلوك المعتمد

### 1) Manifest أولًا
العقد المتوقع:

`GET /api/v1/bootstrap/manifest`

ويرجع على الأقل:
- `bootstrap_id`
- `company_revision`
- `company.id`
- `company.name`
- `working_range.from`
- `working_range.to`
- counts لكل جدول مقسمة إلى `config`, `working`, `archive`
- اختياريًا `replace_local=true` عند الحاجة إلى إعادة بناء كاملة آمنة

### 2) دفعات قابلة للاستئناف
العقد المتوقع:

`GET /api/v1/bootstrap/batch?bootstrap_id=&table=&scope=&cursor=&limit=&from=&to=`

الرد:
- `ok`
- `items` أو `rows`
- `next_cursor`
- `done`
- `total`

لا يتم استعمال offset على العميل. الـCursor opaque ويصدر من الخادم.

### 3) مرحلتان
#### Critical / Working
يتم تنزيل:
- الشركات والإعدادات
- الباقات وأنواع الحجوزات
- قواعد التنبيه وأيام التقويم
- العملاء المرتبطون بالسنتين
- الحجوزات للسنة الحالية + السنة التالية
- تفاصيل الحجوزات
- كل سندات ودفعات هذه الحجوزات

بعد اكتمال هذه المرحلة:
- `workingReady=true`
- Hydration للواجهة
- إغلاق شاشة التهيئة تلقائيًا
- المستخدم يستطيع بدء العمل

#### Archive
يستمر في الخلفية إلى IndexedDB فقط:
- العملاء التاريخيون
- الحجوزات الأقدم
- التفاصيل
- السندات
- booking_audit
- payment_audit

لا يتم Hydration للأرشيف القديم إلى RAM.

## حدود الدفعة
- Save-Data: 100 سجل
- أجهزة منخفضة الذاكرة: 120 سجل
- أجهزة متوسطة: 200 سجل
- الأجهزة الأخرى: 300 سجل

بالتالي الذاكرة المؤقتة للـBootstrap لا تحتاج مصفوفة 100,000 سجل؛ فقط دفعة واحدة + بنية الواجهة الحالية.

## الاستئناف
الحالة تحفظ في IndexedDB `local_meta` من خلال `setUiMeta` بالمفتاح:

`initial-company-bootstrap-v2`

وتشمل:
- bootstrapId
- manifestRevision
- phase
- processed / totals
- cursor مستقل لكل `scope:table`
- workingReady
- complete
- startedAt / updatedAt / completedAt
- pausedReason / lastError

بعد كل دفعة ناجحة يتم تحديث الـCursor قبل الانتقال للدفعة التالية.

## Offline
إذا انقطع الإنترنت:
- لا يتم حذف ما تم تنزيله.
- status يصبح `paused`.
- pausedReason = `offline`.
- عند عودة الإنترنت يتم الاستئناف من Cursor المحفوظ.

## Retry / Backoff
للأخطاء المؤقتة:
- network / status 0
- 408
- 429
- 5xx

يتم حتى 5 محاولات مع exponential backoff، مع احترام `retryAfterMs` إذا أعاده الخادم.

## IndexedDB Ingestion
تمت إضافة:
- `MyfntLocal.ingestBootstrapBatch(table, rows, options)`
- `MyfntLocal.clearBootstrapCompanyData(options)`

الكتابة:
- مباشرة إلى الجدول الطبيعي
- `enqueue=false` ضمنيًا لأن هذا ليس Local Mutation
- لا ينشئ Sync Queue
- يحافظ على `server_version`
- يثبت `company_id` المحلي للمساحة الحالية
- يحتفظ بـ `server_company_id` عند توفره

## الحماية من replace_local
إذا طلب الخادم `replace_local=true`:
- يتم أولًا فحص Sync Queue.
- إذا توجد عمليات pending/sending/failed/conflict لا يتم مسح بيانات الشركة تلقائيًا.
- هذا يمنع فقد تغييرات محلية غير مرفوعة.

## واجهة Sync Progress
تمت إضافة لوحة داخل نافذة المزامنة تعرض:
- حالة Laravel/API
- السنتان الحالية والتالية: processed / total / %
- الأرشيف القديم: processed / total / %
- الخطأ الأخير
- بدء/استئناف
- إيقاف مؤقت

وتمت إضافة Overlay للتهيئة الأولى يعرض:
- الإجمالي
- المرحلة الحالية
- تقدم السنتين
- تقدم الأرشيف
- رسالة أن الإغلاق/انقطاع الشبكة آمن

بعد اكتمال Working Set تختفي الـOverlay تلقائيًا ويستمر Archive في الخلفية.

## تسجيل الدخول
في `auth.js`:
- إذا كان `MyfntBootstrap.enabled()` = true، فإن الحساب السابق يبدأ Bootstrap بدل شاشة Local-only.
- في Mock الحالي تبقى الشاشة القديمة ولا يتم ادعاء وجود مزامنة سحابية.

## Service Worker
- Cache version: `v2.13.2-step21n2-bootstrap-static`
- تمت إضافة Bootstrap JS/CSS إلى precache.
- تم تغيير query version للملفات المعدلة `auth.js` و `myfnt-local-db.js` لمنع تشغيل نسخة قديمة من الكاش.

## الملفات الجديدة
- `assets/js/myfnt-bootstrap.js`
- `assets/css/myfnt-bootstrap.css`

## الملفات المعدلة
- `assets/js/myfnt-local-db.js`
- `assets/js/auth.js`
- `index.html`
- `service-worker.js`

## اختبار الحجم النظري
عند batch=300:
- 100 سجل: دفعة واحدة تقريبًا.
- 10,000 سجل: نحو 34 دفعة لكل stream ذي 10k.
- 100,000 سجل: نحو 334 دفعة لكل stream ذي 100k.

الهدف ليس تقليل عدد طلبات HTTP فقط، بل منع long tasks ومنع وجود عشرات آلاف الكائنات في ذاكرة JavaScript دفعة واحدة.

## ما ينتظر Laravel
لا تزال هذه النسخة تستخدم Mock Transport، لذلك لا يبدأ Bootstrap الحقيقي. Laravel يجب أن ينفذ endpointين أعلاه بنفس العقد، مع:
- Auth token
- membership authorization
- company isolation
- opaque cursor
- stable entity UUIDs
- server_version
- deterministic ordering
- pagination snapshot ثابت مرتبط بـ bootstrap_id/company_revision
