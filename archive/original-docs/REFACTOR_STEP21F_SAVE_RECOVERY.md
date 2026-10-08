# Myfnt 2.11.8 — Booking Save Recovery

Targeted patch based on the original 2.11.3 stable baseline.

- IndexedDB schema version moved forward to v5 (never backward) so devices that opened experimental v4 builds can recover safely.
- The normal upgrade loop recreates any missing object stores from the stable schema.
- Booking save overlay is cleared before awaiting an error dialog, preventing an unreachable modal / apparent infinite saving state.
- No account/session/notification architecture changes included.
