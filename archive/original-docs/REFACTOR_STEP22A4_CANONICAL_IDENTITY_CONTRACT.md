# Step 22A.4 — Canonical ID & Identity Contract

Version: 2.13.6

## الهدف
منع انقسام هوية السجل بين Offline وLaravel. الـ UUID الذي ينشأ محليًا أو يصل من الخادم هو الهوية القانونية الوحيدة للكيان. `legacy_id` مرجع ترحيل/عرض فقط ولا يجوز استخدامه كـ Primary Key جديد على الخادم.

## القاعدة النهائية
1. أي قيمة UUID قانونية تدخل `uuidFor()` تعاد كما هي ولا يعاد Hash لها.
2. السجلات المحلية القديمة ذات الأرقام/المعرفات القديمة تستمر في الحصول على deterministic UUIDv8 نفسه.
3. Laravel يجب أن يقبل `entity_id` الذي يرسله العميل ويحفظه كما هو.
4. رد `/sync/commands` يجب أن يعيد `entity_id` أو `canonical_id` نفسه؛ غياب تأكيد الهوية أو اختلافه يتحول إلى conflict ولا يتم إنهاء أمر المزامنة.
5. Adoption يرسل `identity_contract_version=1` و `identity_policy=client_uuid_is_canonical`.
6. نتائج Adoption التي تحاول تغيير UUID يتم رفضها.
7. Bootstrap وSync Pull يقبلان UUID قانونيًا فقط للكيانات الخادمية.
8. إذا ظهر `legacy_id` محليًا تحت UUID ثم أرسله الخادم تحت UUID مختلف، التصنيف يصبح `identity-conflict` وتتوقف الدفعة بدون كتابة.

## Laravel contract المختصر
### POST /api/v1/sync/commands
Request:
- op_id
- company_id
- entity_type
- entity_id (canonical UUID)
- operation
- base_version
- payload

Successful response MUST contain:
- ok: true
- entity_id OR canonical_id = exactly request.entity_id
- server_version

Laravel MUST NOT generate a replacement UUID when `entity_id` is supplied.

### Adoption
`/bootstrap/adoption/start`, `/batch`, `/complete` receive:
- identity_contract_version: 1
- identity_policy: client_uuid_is_canonical

For every accepted row, returned `entity_id`/`canonical_id` must match the submitted entity_id.

### Bootstrap / Pull
Every row/change must carry a canonical UUID. If both `id` and `entity_id` exist, they must refer to the same UUID.

## legacy_id
`legacy_id` remains only for:
- showing old 6-digit booking/receipt/customer identifiers where required by UI;
- migration lookup during the transition;
- diagnosing collisions.

It must not be used as the relational primary key between new Laravel tables.

## Identity Audit
`MyfntLocal.identityAudit()` now checks without modifying data:
- invalid canonical IDs;
- duplicate legacy identity (one legacy_id -> multiple UUIDs);
- orphan booking_details.booking_id/package_id;
- orphan bookings.customer_id;
- orphan payments.booking_id/customer_id;
- orphan payment_audit.payment_id.

`healthy: true` means no identity issue was found in the local company dataset at audit time.

## Important compatibility fix
Before this step, if Hydration exposed a server UUID as the UI id, `uuidFor(table, id)` could hash that UUID again and create a second deterministic UUID. Step 22A.4 fixes this at the source: canonical UUIDs pass through unchanged.

## Reconciliation addition
New blocking classification:
- `identity-conflict`

This is stronger than `local-newer/server-newer`: neither side wins automatically because the server and client disagree about which UUID owns the same migration identity.

## Files changed
- assets/js/myfnt-local-db.js
- assets/js/myfnt-adoption.js
- assets/js/myfnt-sync-adapter.js
- assets/js/myfnt-bootstrap.js
- assets/js/core.js
- index.html
- manifest.json
- service-worker.js
