# Myfnt 2.13.9 — Hydration / Bootstrap Progress / Diagnostics / Regression

## Hydration
- IndexedDB remains authoritative; `state` is an in-place UI compatibility cache.
- Standalone payments/receipts with no booking are preserved during hydration.
- Payment mapping supports `booking_id = null` and optional independent customer linkage.
- Query `ensurePayment()` now returns standalone payments instead of dropping them.
- Restore validation accepts standalone payments and only validates booking/customer consistency when a booking exists.

## Bootstrap Progress
- Progress is split into `config`, `working`, and `archive` scopes.
- `configProcessed/configTotal`, `workingProcessed/workingTotal`, and `archiveProcessed/archiveTotal` are recalculated from persisted table cursors after every batch.
- Batch-reported totals update the global progress totals instead of leaving stale manifest totals.
- Final replacement is allowed only when every table is done and reconciliation has no `local-newer`, `conflict`, or `identity-conflict`.

## Diagnostics
`OzanDiagnostics.runAudit()` now runs and includes:
- `MyfntLocal.identityAudit()`
- `MyfntLocal.storageHealth()`
- `MyfntRepositories.audit()`
- current Bootstrap progress state
- Myfnt 2.13.9 regression suite

`storageHealth()` combines IndexedDB Store-by-Store profile, identity health, authority health, queue state and browser storage quota when available.
Lazy Hydration cache subsets are valid; only cache rows ahead of IndexedDB are an authority violation.

## Regression suite
`assets/js/myfnt-regression-tests.js` is non-destructive and verifies:
1. A receipt without a booking survives the Hydration contract.
2. A canonical UUID is never regenerated.
3. Restore policy uses `enqueue:false` and creates no Sync Queue work.
4. Bootstrap replacement cannot prune local data while a reconciliation conflict exists.
