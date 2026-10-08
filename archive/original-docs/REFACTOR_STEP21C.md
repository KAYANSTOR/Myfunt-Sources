# Myfnt 2.10.2 — Step 21C

## Scope
This step intentionally changes only two architectural areas:

1. Notification/sync separation.
2. IndexedDB query/index foundation for the next RAM-reduction steps.

## Notification and sync rules
- Generated in-app notifications are device-local transient UI data.
- Generated notifications never create sync queue commands.
- `notifications`, `notification_jobs`, and `error_logs` are explicitly device-only at the storage coordinator level.
- `alert_rules` remain company-scoped and syncable because they are shared company configuration.
- SMS approvals remain company/server-scoped future API operations; no SMS gateway is contacted in this frontend-only build.

## IndexedDB schema upgrade
Database: `myfnt-local-3.1`
Schema version: `2`

Added indexes:

### bookings
- `company_date` => `[company_id, event_date]`
- `company_customer` => `[company_id, customer_id]`
- `company_status` => `[company_id, status]`
- `company_booking_no` => `[company_id, booking_no]`

### booking_details
- `booking_id`

### payments
- `company_posted` => `[company_id, posted_at]`
- `company_booking` => `[company_id, booking_id]`
- `company_customer` => `[company_id, customer_id]`
- `company_status` => `[company_id, status]`

### notifications
- `company_created`
- `company_user`

## New Query Layer
`assets/js/myfnt-query.js`

Read-only APIs:
- `bookingsRange({from,to,status,limit})`
- `bookingsMonth(year,month,{status,limit})`
- `bookingByNumber(bookingNo)`
- `bookingsByCustomer(customerLegacyId,{limit})`
- `bookingDetails(bookingLegacyId)`
- `paymentsByBooking(bookingLegacyId,{limit})`
- `customerByPhone(phone)`
- `customerByName(name)`

The current UI is not switched wholesale to these asynchronous queries yet. This is deliberate. Screens will move one at a time after validation so a regression can be isolated precisely.

## Cache/version
- App version: `2.10.2`
- Service worker cache: `v2.10.2-step21c-static`

## Manual test checklist
1. Existing bookings still appear on home and calendar.
2. Create a booking and payment; both survive app restart.
3. Create/edit/delete alert rules; only `alert_rules` should appear in sync queue.
4. Trigger booking/payment in-app notifications; they must NOT add `notifications` rows to sync queue.
5. Open sync center and verify no generated notification entries are listed.
6. Existing IndexedDB `myfnt-local-3.1` upgrades without clearing current test data.
