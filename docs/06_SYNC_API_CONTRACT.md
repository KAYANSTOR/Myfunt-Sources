# 06 — عقد المزامنة وLaravel

## النسخة المرجعية

`FINAL-v1.1`

## قاعدة الهوية

`entity_id` هو UUID canonical.

الخادم يحافظ على UUID الذي يرسله العميل.

`op_id` هو معرف العملية.

`base_version` هو أساس optimistic concurrency.

## Tenant isolation

الخادم يحدد الشركة من العضوية الموثقة.

لا يسمح للعميل بفرض company scope من body.

## Bootstrap

```text
GET /api/v1/bootstrap/manifest
GET /api/v1/bootstrap/batch
```

الهدف:
- تجهيز جهاز جديد.
- إرسال الإعدادات.
- الباقات.
- working set.
- البيانات الحرجة.

Bootstrap لا ينشئ `sync_queue`.

### Working Set

السياسة المرجعية:
- السنة الحالية.
- حتى 180 يومًا مستقبلًا.
- التاريخ القديم Lazy / On-demand.

## Push

الـendpoint canonical:

```text
POST /api/v1/sync/push
```

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

- التطبيق يرسل Batch.
- الحد الأقصى في العقد: 100 command.
- يجب أن يرجع الخادم نتيجة لكل command.
- UUID الناتج يجب أن يطابق UUID المرسل.

## Pull

```text
GET /api/v1/sync/pull?cursor=&limit=
```

- Cursor متزايد من الخادم.
- التطبيق يطبق التغييرات محليًا.
- لا ينشئ Pull أو Bootstrap أوامر Push جديدة.
- يحفظ cursor بعد نجاح تطبيق الدفعة.

## Refresh

Refresh لا يعني Bootstrap.

```text
Push pending
   ↓
Pull after cursor
   ↓
Update local UI
```

## Conflict

إذا كان:

`base_version != server_version`

الخادم يرفض الكتابة بتعارض.

لا يجب اختيار نسخة عشوائية تلقائيًا.

يتم تخزين conflict metadata ويُعرض للمستخدم عندما تكون الحالة قابلة للعرض.

## Adoption

للجهاز الذي لديه Local data قبل ربط الخادم:

```text
/bootstrap/adoption/start
/bootstrap/adoption/batch
/bootstrap/adoption/complete
```

قاعدة الهوية:
- client UUID canonical.
- لا يسمح للخادم بتبديل UUID المقبول.

## أخطاء

| الحالة | المعنى |
|---|---|
| 403 | COMPANY_NOT_APPROVED عند الحاجة |
| 409 | VERSION_CONFLICT |
| 422 | Validation/Plan |
| 429 | Rate limit |
| 503 | Retryable server |

## ملاحظات تصحيحية

هذا العقد يعتمد `/sync/push` لأن:
- adapter الحالي في المصدر يستعمله.
- JSON contract الحالي يحدده صراحة.
- النسخ التي تستخدم `/sync/commands` تاريخية/انتقالية.

## Auth endpoints

العقد النهائي المنشور يملك مسارات Phone OTP:

```text
POST /api/v1/auth/phone/start
POST /api/v1/auth/phone/verify
```

أما `POST /api/v1/auth/login` الوارد في تقرير معماري أقدم فهو لا يُعتبر endpoint canonical لطبقة Flutter الجديدة؛ يمكن أن يضاف كطبقة داخلية لاحقًا دون كسر عقد OTP.
