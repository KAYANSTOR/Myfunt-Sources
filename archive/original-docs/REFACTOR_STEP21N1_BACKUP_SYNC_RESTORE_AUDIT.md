# Myfnt 2.13.1 — Step21N.1 Backup / Sync / Restore Audit

- Local daily backups retained: 5 (previously 7).
- Backup history UI lists last 5 copies with date, approximate size, booking/payment/customer counts and actions.
- Local daily restore reuses the same SHA-256 verified restore path as imported JSON backups.
- Local daily restore works offline.
- Restored datasets are normalized into IndexedDB with `enqueue:false`; a real API will not receive thousands of automatic push commands merely because a local backup was restored.
- Cloud/server restore is intentionally a separate future Laravel operation.
- Daily backups remain isolated by browser/device + user + company. They are not company-wide cloud backups.
