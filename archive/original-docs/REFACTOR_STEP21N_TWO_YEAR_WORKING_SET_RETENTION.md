# Myfnt 2.13.0 — Step 21N

## Two-Year Working Set + Transient Retention

### Working Set policy
- Normal startup hydration is now bounded to **two complete calendar years**:
  - January 1 of the current year.
  - December 31 of the following year.
- The current year is resolved using `Asia/Aden` when available.
- There is **no 5,000-booking truncation** in this two-year window.
- Older/future domain history is **not deleted** from IndexedDB; it remains queryable/exportable on demand.
- `forceFull:true` remains available for explicit full-dataset operations.

### Financial completeness
The in-memory two-year payment working set is the union of:
1. **Every payment linked to any booking in the two-year booking window**, even if the payment itself was posted outside the two-year dates.
2. **Every payment posted during the two-year dates**, including standalone/unlinked movements.

Customers referenced by either loaded bookings or loaded payments are hydrated.

### Payment performance
- Removed the lazy hydration full scan over every company payment.
- Uses the existing `company_booking` index for booking-linked receipts.
- Uses the existing `company_posted` index for the two-year payment date range.

### Sync queue retention
- After a real Laravel/API request is acknowledged successfully, `finishCommand()` updates the entity server version / tombstone state and **deletes the completed queue command in the same IndexedDB transaction**.
- Completed queue commands are therefore transient work, not permanent history.
- Idle maintenance also removes historical `synced` / `superseded` rows left by older versions.
- Pending, sending, failed, and conflict rows are never removed by this cleanup.

### Notification/transient cleanup
- Notification timeline retains its existing bounded 30-day / 500-row policy.
- Rows carrying `expiresAt` are removed once expired.
- Successful sync notification events expire after **24 hours**.
- Startup runs notification/snooze cleanup before rendering.
- IndexedDB transient stores are cleaned during idle maintenance:
  - `notifications`: 30 days.
  - terminal `notification_jobs`: 7 days.
  - `error_logs`: 14 days.
- Accounting/domain stores are not touched by transient cleanup.

### IndexedDB schema
- DB name remains `myfnt-local-3.1`.
- Schema version increased from **8 → 9** to guarantee the upgraded runtime is recognized safely.

### Public application version
- `APP_VERSION`: **2.13.0**.
- HTML version metadata/footer/cache-busting moved to 2.13.0.
- Service Worker cache key: `v2.13.0-step21n-two-year-retention-static`.

### Validation
- All JavaScript files and the Service Worker pass `node --check` after the changes.
