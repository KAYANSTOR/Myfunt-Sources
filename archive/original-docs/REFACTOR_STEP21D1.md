# Step 21D1 — Communication Chips Stability Patch

Version: 2.10.9

- Isolated recipient/template accordion controls from delegated window handlers.
- Recipient chips use direct button listeners with preventDefault + stopPropagation.
- Removed obsolete native details/summary CSS from communication policy.
- Aligned Service Worker precache URLs with the exact Step 21D asset revisions from index.html.
- New cache namespace: v2.10.9-step21d1-static.
- No changes to booking storage, finance, sync schema, SMS queue, or month-query behavior.
