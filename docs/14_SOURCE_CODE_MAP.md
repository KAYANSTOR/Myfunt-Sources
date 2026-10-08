# 14 — خريطة المصدر الأصلي

هذه الخريطة تربط الوظائف في snapshot الأصلي بالمكونات التي يجب أن تتحول إلى Flutter.

## Shell/UI

| الملف | الدور |
|---|---|
| `index.html` | shell + windows + forms + script order |
| `assets/js/app.js` | orchestration/UI startup |
| `assets/js/ui.js` | UI utilities/interactions |
| `assets/js/core.js` | app core |
| `assets/css/app.css` | global visual language |

## Booking / Calendar

| الملف | الدور |
|---|---|
| `assets/js/bookings.js` | booking behavior |
| `assets/js/calendar.js` | calendar state/rendering |
| `assets/js/calendar-tools.js` | calendar helpers/import/export |
| `assets/js/deposit-dialog.js` | deposit flow |
| `assets/js/myfnt-sequences.js` | display sequences |
| `assets/js/invoice-canvas.js` | invoice preview |
| `assets/js/receipt-image.js` | receipt image |
| `assets/css/booking-refinement.css` | booking UI |
| `assets/css/myfnt-form-v294.css` | form styling |

## Data / Storage

| الملف | الدور |
|---|---|
| `myfnt-local-db.js` | IndexedDB normalized data |
| `myfnt-query.js` | durable read/query layer |
| `myfnt-repositories.js` | repository facade |
| `myfnt-mappers.js` | canonical mapping |
| `myfnt-hydration.js` | local → UI hydration |
| `myfnt-offline.js` | offline/outbox behavior |

## Sync / Bootstrap

| الملف | الدور |
|---|---|
| `myfnt-sync-adapter.js` | Push/transport |
| `myfnt-bootstrap.js` | server bootstrap |
| `myfnt-adoption.js` | local data adoption |
| `myfnt-offline.js` | queue/local boundary |

## Finance

| الملف | الدور |
|---|---|
| `myfnt-finance.js` | finance domain/UI |
| `receipt-image.js` | receipt rendering |
| `invoice-canvas.js` | invoice rendering |
| `secure-export.js` | encrypted export |

## Customers

`assets/js/myfnt-customers.js`

## Auth / Profile

| الملف | الدور |
|---|---|
| `auth-data.js` | local/demo auth data |
| `auth.js` | auth flow |
| `auth-journey.js` | auth UI journey |
| `profile-tab.js` | account/profile |
| `scope.js` | company/user workspace |
| `myfnt-access.js` | access/subscription state |

## Plans / Feature Gates

| الملف | الدور |
|---|---|
| `myfnt-plans.js` | plan registry |
| `myfnt-feature-gate.js` | client gate |
| `assets/config/subscription-plans.json` | plan values |
| `assets/config/feature-catalog.json` | feature catalog |

## Messages / Notifications

| الملف | الدور |
|---|---|
| `myfnt-event-registry.js` | events |
| `myfnt-recipient-resolver.js` | recipients |
| `myfnt-communication-policy.js` | send policy |
| `myfnt-messages.js` | messages |
| `myfnt-template-tools.js` | templates |
| `myfnt-notifications.js` | local notifications |

## Backup / Maintenance / Export

| الملف | الدور |
|---|---|
| `myfnt-backup.js` | local backups |
| `maintenance.js` | storage/maintenance |
| `excel-export.js` | export |
| `production-tools.js` | diagnostics/release tooling |
| `diagnostics.js` | diagnostics |

## Visitor / Onboarding

| الملف | الدور |
|---|---|
| `visitor-experience.js` | public/visitor UI |
| `onboard-guide.js` | onboarding/tour |

## Flutter translation rule

لا تنقل أسماء الملفات أو globals.

حوّلها إلى Modules/Services/Repositories/Providers.

مثال:

```text
bookings.js
→ BookingRepository
→ BookingController
→ BookingListScreen
→ BookingFormScreen
→ BookingDetailsScreen
```

## حجم المصدر المرجعي

- JavaScript: 55 files.
- CSS: 20 files.
- Root index: `index.html`.
- Manifest: `manifest.json`.
