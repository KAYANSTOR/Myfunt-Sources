# Myfnt 2.9.7 — Refactor Step 19
## Special Days + Alert Rules repositories / Legacy state boundary

### Goal
Continue the behavior-preserving refactor by moving calendar special days and alert-rule CRUD behind the repository layer, while explicitly separating UI state from the temporary legacy domain cache.

### Special Days
`MyfntRepositories.specialDays` now owns:
- `all`, `snapshot`, `get`, `find`, `filter`, `exists`, `indexOf`
- `add`
- `mutate`
- `removeLocal`
- `replaceLocal`

The advanced editor and the older admin delete path both use the same repository. Tombstone creation still happens before local removal.

### Alert Rules
Added `MyfntRepositories.alerts` for `settings.alertTemplates` / `alert_rules`:
- `all`, `snapshot`, `get`, `exists`
- `add`
- `mutate`
- `removeLocal`
- `replaceLocal`

Alert CRUD no longer manually edits the settings object and separately calls the offline layer. Repository writes persist the local cache without creating a duplicate `company_settings` sync command, while `alert_rules` receives its own entity command.

### Reset semantics
Restoring the five default alert rules now:
1. tombstones alert rules that disappear from the replacement set;
2. replaces the local rule set;
3. records create/update operations for the default rules;
4. reschedules the alert scheduler.

An intentionally empty alert list remains empty. It is no longer mistaken for an uninitialized list and silently repopulated.

### Backup / import / offline checkpoint
Special days are now obtained through repository snapshots in JSON backup, daily backup, encrypted export and emergency snapshot paths where the repository is available.
Import uses `specialDays.replaceLocal(..., {persist:false})` before the existing durable commit/reconcile boundary.

### Legacy `state` boundary
`state` is not removed in this step. It now has two explicit roles:

**UI runtime state (legitimate long-term state)**
- `viewDate`, `selectedDate`, `viewFilter`
- `windowStack`, `activeBookingId`, `lastCreatedBookingId`
- render/transition/search flags
- notification read UI metadata

**Domain compatibility cache (temporary)**
- `bookings`
- `customers`
- `receipts`
- `packages`
- `specialDays`
- synchronized portions of `settings`

Direct mutation of the domain compatibility cache should remain limited to repository/core/hydration/transaction boundaries. Step 20 will migrate remaining readers in advanced/app/auth/calendar/export helpers to repositories without touching legitimate UI state.

### Safety
No visual markup or CSS was changed.
No IndexedDB schema was changed.
No booking/payment/customer IDs were changed.
Sequential visible IDs from Step 14 remain intact.
Finance transaction/journal/rollback behavior is unchanged.
Mock transport remains disabled for real synchronization.

### Verification
- All JavaScript files pass `node --check`.
- HTML asset references missing: 0.
- Service Worker precache references missing: 0.
- Cache revision: `v2.9.7-r19-static`.
- Visible application version remains `2.9.7`.
