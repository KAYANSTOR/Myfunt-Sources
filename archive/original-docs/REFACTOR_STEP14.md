# Myfnt Refactor Step 14 — Repository Layer + Sequential Display IDs

## Goal
Introduce a repository facade and replace legacy six-digit visible identifiers with simple sequential display references starting at 1, while preserving opaque internal IDs/UUID mappings for offline sync and relationships.

## Sequential display identifiers
Per workspace/company:
- Booking number: `1, 2, 3, ...`
- Customer number: `1, 2, 3, ...`
- Receipt number: `1, 2, 3, ...`
- Financial movement number: `1, 2, 3, ...`

The receipt and movement counters are intentionally separate. A payment record keeps both `receiptNo` and `movementNo`.

## Important architecture rule
The visible sequential number is NOT the sync identity. Existing opaque legacy IDs and IndexedDB UUID mapping remain the relation/sync identity. This avoids relationship breakage and makes future multi-device synchronization safe.

## One-time migration
`MyfntSequences.migrate()` renumbers current display references in creation order and stores a workspace-scoped migration marker. It does not close numbering gaps on every startup. New records use max+1.

Bulk restore/import paths can request `migrate({force:true})` so imported legacy six-digit references are normalized into the new numbering model.

## New files
- `assets/js/myfnt-sequences.js`
- `assets/js/myfnt-repositories.js`

## Repository facade
`MyfntRepositories` introduces a stable access surface for bookings, customers, packages, payments, and special days. It is intentionally additive in this step: legacy modules are not rewritten all at once.

## Compatibility updates
Removed six-digit-only validation from customer/backup/diagnostic paths. Booking display-number validation now accepts positive sequential integers.

## Finance
All newly created payments receive:
- opaque internal `id`
- sequential `receiptNo`
- sequential `movementNo`

`movementNo` is included in normalized IndexedDB payment rows and Hydration, and is displayed in finance records/receipt output.

## PWA
Cache revision: `v2.9.7-r14-static`.
Visible application version remains `2.9.7`.
