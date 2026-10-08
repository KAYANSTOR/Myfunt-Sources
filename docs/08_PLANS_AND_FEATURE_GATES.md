# 08 — الخطط والميزات والحدود

## الخطط المرجعية

| الخطة | شهري | سنوي | الحجوزات | المستخدمون | SMS شهري | SMS سنوي | أرقام الرسائل | الباقات |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BASIC | 3000 | 30000 | 100 | 1 | 40 | 400 | 1 | 5 |
| PLUS | 5000 | 50000 | 1000 | 3 | 150 | 1500 | 3 | 15 |
| SUPER | 6000 | 60000 | 5000 | 6 | 400 | 4000 | 5 | 30 |
| ULTRA | 8000 | 80000 | غير محدود | غير محدود | غير محدود | غير محدود | غير محدود | غير محدود |

العملة المرجعية: YER.

## Default

الحساب الجديد في المرجع:

`ULTRA`

## مبدأ Feature Gate

هناك مستويان:

### Client
لتحسين UX:
- إخفاء/تعطيل.
- رسائل مبكرة.
- عدادات.

### Server
للأمان:
- يجب إعادة فرض الحد/الميزة في Laravel.

الـClient ليس سلطة نهائية.

## Resolved Entitlement

النموذج المفاهيمي:

```text
feature_code
enabled
limit
period_type
used
remaining
config
source
```

## مصادر القرار

بالترتيب:

1. Company activation.
2. Active subscription.
3. Plan features.
4. Company feature overrides.
5. Usage/direct count.

## الحدود

### Count based
- bookings.
- users.
- message numbers.
- packages.
- integrations.
- backup retention.

### Periodic usage
- SMS monthly.
- SMS yearly.
- exports monthly.

### Storage
- backup storage.

## قاعدة المستندات

لا تستخدم "26 features" كأنها العدد الكلي لكل flags الداخلية.

المرجع يميز بين:
- canonical user-facing feature labels.
- internal aliases / compatibility keys.

Flutter يجب أن يعتمد أسماء Domain واضحة مستقلة عن أسماء legacy aliases.
