# Myfnt Refactor — Step 8: Local Data Coordination

Version shown to users remains **2.9.7**. Internal cache revision: **r8**.

## Goal
Clean the transition layer between localStorage, IndexedDB, emergency snapshots, and the future sync queue without changing the current UI or switching the source of truth yet.

## Current ownership after this step
- **Legacy localStorage/state**: temporary UI write source in this transitional build.
- **MyfntOffline**: one coordinator for emergency checkpoints and persistence requests.
- **MyfntLocal / IndexedDB**: normalized relational mirror + sync queue + normalized export.
- **Finance transaction journal**: remains independently durable and keeps its explicit post-commit snapshot.
- **Domain events** (`ozan:booking-saved`, `myfnt:package-saved`, `myfnt:finance-changed`): UI/service notifications only, not a second persistence trigger.

## Changes
1. Added semantic `MyfntOffline.requestCheckpoint` alias for the single persistence gateway.
2. `core.js` durable save helpers now request checkpoints through that gateway.
3. Customer directory uses the same gateway.
4. Removed duplicate checkpoint subscriptions in `MyfntOffline.init()` for booking/package/finance domain events.
5. Removed duplicate finance event listener that took another snapshot after the finance transaction had already checkpointed explicitly.
6. Kept `scheduleSnapshot` public for backwards compatibility.
7. No database schema, keys, object stores, queue commands, UUID mapping, or financial transaction semantics were changed.

## Intentionally NOT changed yet
- IndexedDB is not the primary write source yet.
- `mirrorAll()` still exists as a compatibility fallback.
- localStorage arrays are not deleted.
- sync queue format is unchanged.
- mock API is unchanged.
- no PHP/server sync was enabled.

## Validation
- All JavaScript files pass `node --check`.
- Missing index assets: 0.
- Missing service-worker assets: 0.
- Service worker cache revision: `v2.9.7-r8-static`.

## Next architectural step
Move high-volume entities (booking/package/customer/payment) from full-workspace mirror fallback toward entity-scoped normalized writes, while retaining a repair/full-mirror command for migration and diagnostics.
