# Myfnt 2.9.7 — Refactor Step 6: Finance & Customers

Scope: finance/customer UI CSS ownership only. No financial calculations, storage, IDs, audit logic, customer matching, receipt saving, or HTML structure was changed.

## Changes
- Consolidated the shared finance modal scroll shell into one rule for receipt, payments, customers, customer detail, payment correction, and payment audit windows.
- Consolidated final header/button dimensions while preserving the audit window's distinct layer behavior.
- Consolidated receipt summary/history final text wrapping and sizing rules into their owning selectors.
- Removed confirmed-dead receipt rules targeting the former `.booking-form` / `.sticky-actions` structure. The current receipt form is `.mf-receipt-form` with `.mf-receipt-actions`.
- Kept the payment-correction `.sticky-actions` behavior and made it the sole owner of that finance sticky action rule.
- Preserved light/dark theme rules, mobile breakpoints, customer contact actions, audit presentation, content-visibility optimization, and payment/customer filters.
- Cache revision advanced to `v2.9.7-r6-static` and only `myfnt-finance.css` received `?v=2.9.7-r6`.

## Validation
- All JavaScript files pass `node --check`.
- HTML local asset references missing: 0.
- Service-worker local asset references missing: 0.
- Shared finance window-body shell definition: 1.
- Current receipt `.booking-form` rules: 0.
- Current receipt `.sticky-actions` rules: 0 (receipt uses `.mf-receipt-actions`).
- Payment correction sticky-action owner remains present.

The visible application version remains 2.9.7.
