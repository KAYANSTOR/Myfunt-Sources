# Myfnt 2.9.7 — Refactor Step 10

## Scope
Tombstones, delete/archive semantics, and sync-queue cleanup. No visual redesign.

## Changes
- IndexedDB schema upgraded in-place from version 4 to version 5; database name unchanged.
- Added `entity_tombstones` store with company/workspace/entity indexes.
- Added `MyfntLocal.tombstone()` and `MyfntOffline.remove()`.
- Delete flow now materializes the current normalized row before deletion so older installations cannot lose delete intent.
- Pending local create/upsert + delete before first server commit collapses locally: prior command becomes superseded and no impossible remote DELETE is queued.
- Remote-backed rows create explicit `delete` commands with `base_version`.
- Permanent booking archive records an `archive` tombstone. A booking created and archived before its first remote commit cancels its pending create instead of producing an impossible archive command.
- Package deletes (both legacy and advanced admin paths) now use the same tombstone API before removing from `state`.
- Calendar/special-day deletes now use tombstones; single special-day writes can be normalized through `recordOne()`.
- Alert-rule create/update/delete now have entity-level normalized writes. Reset-to-default remains a deliberate full reconcile because it changes a set.
- Package hide/show remains an update, not a delete.
- Diagnostic normalized export includes tombstones and schema label advances to `myfnt-local-relational-v2.6`.
- Local stats include tombstone count.

## Intentionally unchanged
- UI design and layout.
- Booking trash stage (`cancelled`) before permanent archive.
- Financial payment reversal semantics.
- Sync transport remains mock/no real backend in this build.
- Reset-device-data remains a local reset operation and does not imply remote mass deletion.

## Validation
- All JavaScript files pass `node --check`.
- Missing index assets: 0.
- Missing service-worker assets: 0.
- Service Worker cache revision: `v2.9.7-r10-static`.
- IndexedDB database name unchanged; upgrade is in-place.
