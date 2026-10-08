# Step 21D4.1 — Preferences Runtime Fix

- Restored `fillPrefs()` as the single initializer for `#ozPrefsForm`.
- Reads preferences only from `MyfntRepositories.settings` and applies safe defaults.
- Fixed `APP_VERSION` runtime constant to 2.11.3.
- Diagnostics now reads the canonical version from `<meta name="ozan-app-version">` instead of hardcoded 2.7.0.
- Updated cache namespace and asset revisions to 2.11.3.
