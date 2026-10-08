# Myfnt 2.14.19 — Laravel 13 Sync Contract

## الهدف
هذا العقد هو الحد الفاصل بين تطبيق Myfnt Offline-First وLaravel 13. لا يجوز للـBackend تغيير هذه القواعد بدون رفع `contract_version`.

## 1. الهوية
- `id` لكل كيان Domain هو UUID يولده العميل أو الخادم ويحافظ عليه الطرف الآخر كما هو.
- `booking_no` و`payment_no` أرقام عرض فقط وليست هوية مزامنة.
- كل عملية Push تحمل `op_id` فريدًا. إعادة نفس `op_id` لا تنفذ العملية مرتين.
- كل تعديل يحمل `base_version`. الخادم لا يكتب فوق نسخة أحدث؛ يعيد Conflict بدل ذلك.

## 2. عزل الشركة
- Laravel يستخرج `company_id` من الجلسة/الحساب الموثق على الخادم.
- لا يثق في `company_id` القادم من Body كسلطة.
- جميع استعلامات Tenant تكون داخل Company Scope.
- الشركة الجديدة يمكنها إكمال الإعدادات والباقات وأرقام الرسائل، لكن إنشاء حجز يرفض حتى `activation_status=approved`.

## 3. جهاز جديد — Bootstrap فقط
### Manifest
`GET /api/v1/bootstrap/manifest`

يعيد `bootstrap_id`, `company_revision`, `company`, `working_range`, وجدول counts.

### Batch
`GET /api/v1/bootstrap/batch?bootstrap_id=&table=&scope=&cursor=&limit=&from=&to=`

القواعد:
1. البيانات القادمة من Bootstrap تكتب في IndexedDB بواسطة Upsert بنفس UUID.
2. Bootstrap لا ينشئ `sync_queue` إطلاقًا.
3. البيانات الحرجة فقط: الشركة/الإعدادات/الباقات/قواعد التقويم ثم Working Set.
4. Working Set الافتراضي: من 1 يناير للسنة الحالية حتى 180 يومًا من تاريخ اليوم.
5. السجلات التاريخية القديمة وسجلات التعديل لا تنزل تلقائيًا؛ تحمل عند فتحها/البحث عنها.

## 4. المزامنة العادية
### Batch Push
`POST /api/v1/sync/push`

Body:
```json
{
  "commands": [
    {
      "op_id": "uuid",
      "entity_type": "bookings",
      "entity_id": "uuid",
      "operation": "create|update|delete|archive",
      "base_version": 0,
      "payload": {}
    }
  ]
}
```

- حد الدفعة في التطبيق: 50 افتراضيًا، والعقد يسمح حتى 100.
- كل Command ينفذ في Transaction مستقلة أو Savepoint واضح.
- قبل التنفيذ: Idempotency check على `op_id`.
- بعد نجاح الكتابة: زيادة `version` وكتابة صف واحد في `sync_changes`.
- Response يجب أن يعيد نتيجة لكل `op_id` مع `entity_id` نفسه و`server_version`.

### Cursor Pull
`GET /api/v1/sync/pull?cursor=123&limit=250`

- يعيد فقط التغييرات بعد Cursor.
- لا يعيد جدول الشركة كاملًا.
- التطبيق يطبق Remote Upsert/Delete بصمت ولا ينشئ Queue جديدًا.
- بعد نجاح تطبيق الدفعة فقط، يحفظ الجهاز `next_cursor`.

## 5. زر التحديث
زر Refresh في Myfnt يساوي فقط:
1. Push لكل pending operations كدفعة.
2. Pull بعد آخر Cursor.
3. تحديث الواجهة المحلية.

ولا يساوي Bootstrap أو Restore أو Import أو Recreate.

## 6. منع التكرار
أربع طبقات حماية:
1. UUID ثابت لكل كيان.
2. Bootstrap/Pull لا ينشئان Queue.
3. `op_id` Idempotency على الخادم.
4. Unique business numbers داخل الشركة مثل `UNIQUE(company_id, booking_no)`.

## 7. الجداول المطلوبة من Laravel للمزامنة
الحد الأدنى:
- `sync_changes`: sequence, company_id, entity_type, entity_id, operation, version, changed_at.
- `sync_idempotency`: op_id UNIQUE, company_id, result_json, created_at, expires_at.
- جداول Domain نفسها تحمل `version` و`updated_at` و`deleted_at` عند الحاجة.

`sync_queue` يبقى في IndexedDB على الجهاز ولا يتحول إلى جدول Domain مركزي.

## 8. سجلات التعديل
`booking_logs` و`payment_logs` لا تدخل Bootstrap التلقائي ولا Working Set. يتم طلبها فقط عند فتح شاشة السجل، ويمكن Cache محليًا بدون Queue.

## 9. الأخطاء المتفق عليها
- `409 VERSION_CONFLICT`
- `403 COMPANY_NOT_APPROVED`
- `422 PLAN_LIMIT_REACHED` أو Validation Error
- `429 RATE_LIMIT`
- `5xx` Retryable حسب نوع الخطأ

## 10. قاعدة الأداء
- لا يوجد Request لكل سجل عند المزامنة.
- لا يوجد تنزيل كامل لقاعدة الشركة عند Refresh.
- لا صور/Base64 داخل Sync Payload.
- الحقول الثقيلة والسجلات التاريخية Lazy.
