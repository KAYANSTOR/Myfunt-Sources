# Myfnt 2.14.5 — Communication Hardening

- Enforced SMS approval before transport.
- Added approval_required state and explicit approval flow.
- Quiet hours now defer normal SMS at the send boundary.
- Company preferred time is used only for company SMS reminder rules.
- Internal day-based reminders keep 09:00 independently.
- Fixed same-account multi-session notification visibility.
- Added actorSessionId support to remote activity.
- Split event templates into internal, company, and client templates while retaining legacy template fallback.
- Fixed communication presets for the current aria-pressed card UI.
- Preserved DEFAULT_ALERTS and Smart Notification Engine behavior.
