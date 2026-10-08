# Step 21D2 — Isolated Communication Event Editor

Version: 2.11.0

## Problem
The communication policy screen could become unstable on Android/PWA when opening the inline recipients/template area. Multiple fixes to the chip interaction itself did not eliminate the issue, which indicated the failure path was tied to the large inline DOM/layout section rather than the role values.

## Change
- Removed inline expandable recipients/template editor from every communication event card.
- Event cards now keep only lightweight hidden values for `roles` and `template` plus a launcher button.
- Added a dedicated `communicationEventEditorWindow` that edits one event at a time.
- The dedicated editor contains only three role buttons (owner/manager/accountant) and one template textarea.
- Saving the editor updates the originating event card draft only; the company policy is still persisted only by the main Save Policy button.
- Presets update the lightweight role value and summary without opening/rendering role controls.
- New cache namespace: `v2.11.0-step21d2-static`.

## Safety
No changes to bookings, finance, IndexedDB schema, outbox, sync protocol, SMS queue, or month query logic.
