# Step 22A.2 — First Server Adoption

الإصدار: 2.13.4

## الهدف
منع تحويل بيانات ما قبل Laravel إلى أوامر مزامنة عادية، واعتمادها على الخادم عبر مسار مستقل وآمن قبل السماح لأي replaceLocal.

## التنفيذ
- إضافة `assets/js/myfnt-adoption.js`.
- إضافة Local Adoption API داخل `myfnt-local-db.js`:
  - `localAdoptionSummary()`
  - `localAdoptionBatch()`
  - `markAdoptionResults()`
  - `settleLocalOnlyTombstones()`
- لا يتم اعتبار السجل معتمدًا إلا بعد ACK صريح من الخادم.
- يتم إرسال UUID المحلي نفسه لمنع إنشاء نسخة ثانية من السجل.
- كل دفعة تحمل مفتاح idempotency ثابتًا للجلسة/الجدول/النطاق.
- الحالات المقبولة من الخادم: `adopted`, `already_exists`, `accepted`.
- `conflict` أو `rejected` يوقف العملية بدون حذف البيانات المحلية.
- إذا تغيّر fingerprint محليًا أثناء الرفع، لا يتم اعتماد النسخة القديمة ويُوقف المسار.
- تأكيد `/bootstrap/adoption/complete` شرط مستقل قبل السماح لـ Bootstrap بالتنظيف.
- Bootstrap يستدعي `MyfntAdoption.ensureReady()` قبل `clearBootstrapCompanyData()`.
- حفظ server/adoption evidence عند أي إعادة كتابة محلية لاحقة.

## عقد Laravel المقترح
### POST /bootstrap/adoption/start
يرجع `adoption_id` ويمكن أن يرجع `accepted_tables`.

### POST /bootstrap/adoption/batch
المدخلات: `adoption_id`, `table`, `idempotency_key`, `rows`.
كل row يحتوي `entity_id`, `legacy_id`, `local_fingerprint`, `local_updated_at`, `payload`.
الاستجابة يجب أن تعيد نتيجة لكل entity_id مع status وserver_version.

### POST /bootstrap/adoption/complete
يؤكد أن جلسة الاعتماد اكتملت على الخادم.

## قواعد أمان
- لا يتم إنشاء sync_queue جماعية للبيانات التاريخية.
- لا يتم حذف أي بيانات عند API غير مدعوم أو 404 أو استجابة جزئية.
- لا يتم تجاوز تعارض أو رفض من الخادم.
- لا يتم اعتبار نجاح رفع الدفعات كافيًا إذا لم يؤكد الخادم اكتمال الجلسة.
