# Step 21C4 — Owner authority, company activity, and per-user SMS gateway

## Final company roles
- owner: principal company account and sole manager of sensitive settings.
- manager: operational booking/customer/package access only.
- accountant: booking read + finance/payment operations only.

Sensitive areas are owner-only: system/company settings, communication policies, messages, subscriptions/upgrades, users/roles, backups/exports, sync/cache/cloud controls.

## Company activity notifications
Booking/payment creation records actor id/name. Other company users receive an activity notification containing the actor name and a deep-link to the booking/payment. The actor does not receive their own copy. The remote sync adapter exposes a future Laravel hook so server accepted changes can recreate the same activity for users who were offline.

## Per-user SMS gateway profile
The communication settings page now includes an ARSI SMS gateway profile selector for each company user.
Fields:
- API endpoint (default https://sms.arsi.fun/api/sms)
- secret/Bearer key
- device_id
- sim_subscription_id

Security boundary:
- No credential is hard-coded in the PWA.
- The secret is not placed in company communication_policy, sync_queue, exports, or SMS payloads.
- In this frontend-only build the secret is local-device metadata for testing/configuration only.
- Production Laravel will store credentials encrypted server-side and the browser will receive only a profile id/status.
- Browser does not directly call the SMS gateway. Laravel will perform the authenticated request.

No existing IndexedDB schema migration is required because frontend-only gateway credentials use local_meta.
