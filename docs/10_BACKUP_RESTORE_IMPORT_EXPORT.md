# 10 — النسخ والاستعادة والاستيراد والتصدير

## النسخ المحلية

المرجع يحتوي أكثر من مفهوم:

### Emergency Snapshot
للإنقاذ المحلي.

### Daily Backup
نسخة محلية مستقلة مرتبطة بـworkspace.

الاحتفاظ الحالي:
- آخر 5 نسخ.

### Manual JSON Backup
نسخة أعمال قابلة للاستعادة للواجهة الحالية.

### Secure Export
تنسيق مضغوط/مشفر محليًا.

## ما تعنيه النسخة الحالية

النسخة التاريخية `ozan-backup-v1` ليست Full normalized DB dump.

لا تعتبر وجود النسخة دليلًا على اكتمال كل الكيانات.

## قاعدة Flutter

أنشئ Backup service منفصل:

```text
BackupService
 ├─ createSnapshot()
 ├─ listLocalBackups()
 ├─ validate()
 ├─ restore()
 └─ secureExport()
```

والتعامل مع schema version يجب أن يكون صريحًا.

## Restore

Offline:
- Validate.
- checksum.
- schema.
- relationships.
- user confirmation.
- replace/rebuild local data.

لا ترفع نسخة قديمة للخادم تلقائيًا بمجرد وجود الإنترنت.

## Cloud backup

المفهوم المستقبلي:
- الخادم ينشئ snapshot للشركة من MySQL.
- لا تعتمد على جهاز واحد لتمثيل حالة الشركة.

## V2 Backup

الخطة المرجعية تميل إلى:

```text
backup.zip
  ├─ manifest.json
  ├─ tables/*.jsonl
  └─ media/*
```

المحتوى:
- schema version.
- app version.
- company UUID.
- createdBy.
- timestamp.
- counts.
- checksums.

## ممنوع داخل backup business

- Password.
- Access Token.
- Refresh Token.
- SMS gateway secret.
- sync lease.
- transient queue state.
- UI caches.

## Export

المصدر يدعم/يعرف:
- CSV.
- XLSX.
- ICS.
- PDF.
- Receipt/booking image.

Flutter يطبق فقط ما تسمح به الخطة الحالية، بينما server re-enforcement يبقى لاحقًا.
