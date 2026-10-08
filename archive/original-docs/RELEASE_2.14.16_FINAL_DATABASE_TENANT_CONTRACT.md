# Release 2.14.16 — Final Database & Tenant Isolation Contract

- ثبت العقد النهائي للجداول المركزية والمحلية.
- ثبت قواعد Tenant isolation وUUID/version/soft-delete/idempotency.
- أضيفت جداول الخادم الناقصة: company_message_numbers, user_sessions, usage_counters, sync_change_log, sync_idempotency.
- أضيف مخطط JSON وSQL مرجعي لمرحلة Laravel.
- لم يتم تغيير IndexedDB schema version لأن هذه الخطوة عقد/حماية وليست ترحيل بيانات محلي خطير.
