# Myfnt 2.14.13 — Release Readiness, Privacy & Startup

- Added standalone `privacy.html` and `terms.html` for public store URLs.
- Updated account consent wording and persisted legal consent timestamps/version.
- Added 3 temporary phone screenshots to the PWA manifest.
- App icon paths remain unchanged until the user supplies the final icon artwork.
- Fixed first-run IndexedDB false alarm: database readiness is checked independently from company hydration.
- Hydration is skipped safely when no authenticated workspace exists, and resumes after auth/scope change.
- Visitor trial schedules at 10 seconds and waits for a clear UI.
- Install banner schedules at 40 seconds and waits for a clear UI.
- Guided hints schedule at 80 seconds and wait for a clear UI, with existing focus/spotlight behavior preserved.
- Updated service-worker cache/version to 2.14.13.
