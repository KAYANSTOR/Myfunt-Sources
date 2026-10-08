# Step 21D3 — Global Communication Chip Stabilization

- Removed hidden-checkbox label chips from communication event options.
- Event controls (enabled / in-app / SMS / client / urgent) are now real buttons using aria-pressed.
- Recipient role editor remains isolated and button-based.
- No event-option toggle writes storage or re-renders the policy page on tap; values are collected only on Save.
- Added Android/PWA-safe touch handling and removed active transforms for these controls.
- Cache/version bumped to 2.11.2 / step21d3.
