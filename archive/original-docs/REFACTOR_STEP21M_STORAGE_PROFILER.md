# Step 21M — Backend-gated Sync Queue + Storage Profiler

Version: 2.12.10

## Scope
This step is intentionally limited to storage amplification and observability. No booking, finance, notification, calendar, or receipt behavior is redesigned.

## Sync queue policy
- Domain data continues to be persisted in normalized IndexedDB stores.
- New sync_queue commands are created only when `MyfntSync.enabled()` reports a real non-mock API transport.
- The built-in Mock transport does not generate new sync_queue rows.
- Delete/archive paths use the same backend gate.
- Existing historical sync_queue rows are preserved; this release does not auto-delete user data.
- `keep_local` conflict resolution cannot create a fresh command while the backend is disconnected.
- When Laravel is introduced, baseline sync should upload existing local domain state first, then normal outbox/queue generation can continue for subsequent changes.

## Storage Profiler
Maintenance > Storage now shows:
- Cache Storage response bytes.
- Browser-reported total origin usage/quota.
- LocalStorage logical bytes.
- Main IndexedDB stores: record count + approximate logical content bytes.
- Binary media DB bytes for the current workspace.
- Existing sync_queue count/size and whether new queue generation is enabled.

Per-store size is deliberately labeled approximate/logical. Browsers do not expose exact physical disk allocation per IndexedDB object store; LevelDB pages, indexes, WAL and engine overhead are included only in the browser's total origin usage.

## Data safety
No existing sync_queue rows, bookings, customers, payments, receipts, notifications, media, or backups are deleted by this step.
