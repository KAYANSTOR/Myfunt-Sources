# Step 21C1 — Local Message UI State + Currency Authority

Version: 2.10.3

- `manualMessageAttempts` is no longer treated as booking/domain data. It is persisted in `local_meta` per workspace and restored during hydration. It never enters the sync outbox.
- Preview wording now says the messaging app was opened; it does not claim delivery.
- Company/workspace currency is the single local currency authority. Changing it updates in-memory packages/bookings/payments and the IndexedDB company settings, booking packages, booking details, payments and wallet rows.
- Financial views initialize from the workspace currency instead of hard-coded YER.
- No database reset and no loss of Step 21C test data.
