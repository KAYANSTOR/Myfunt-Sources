# QA 2.14.16

## شروط النجاح
- كل جدول Tenant في العقد يحمل company_id.
- الأرقام التجارية Unique مركب مع company_id.
- الجداول المالية غير قابلة للحذف النهائي.
- sync_queue/entity_tombstones/local_meta تبقى Local-only.
- users/plans فقط Global؛ memberships/subscriptions هي حدود الربط بالشركة.
- MySQL blueprint وJSON contract متطابقان أسماءً على مستوى الجداول.
