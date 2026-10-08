# Step 22B — Repository Authority Cleanup

## Authority contract
- Canonical durable data: IndexedDB (`MyfntLocal`).
- Canonical indexed read layer: `MyfntQuery`.
- `state`: synchronous UI compatibility cache only.
- Repository writes: one durable gateway through `MyfntOffline -> MyfntLocal`.

## Repository changes
- Added explicit cache methods: `allCache()` / `getCache()`.
- Existing `all()` / `get()` remain compatibility reads and are measured as legacy cache reads.
- Added `MyfntRepositories.durable`:
  - bookings: get/search/month
  - customers: get/matches/page
  - payments: byBooking/page/stats
- Added tracked durable writes and `MyfntRepositories.flush()` for future API boundaries.
- Added `MyfntRepositories.authority()` and `audit()` for Diagnostics.
- Repository write failures and pending writes are measurable instead of silent.

## Remaining transition work
Legacy synchronous UI callers still use `all()/get()` in several screens. They are intentionally preserved in 2.13.9 to avoid changing UI behavior. Subsequent Step 22B iterations can move heavy screens to the `durable` namespace one domain at a time, then remove compatibility cache reads after regression coverage is complete.
