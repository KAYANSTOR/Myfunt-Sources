# 09 — الاتصالات والإشعارات

## الإشعارات المحلية

تولد من:
- الحجوزات.
- الدفعات.
- تاريخ المناسبة.
- alert rules.

أمثلة من المرجع:
- تذكير قرب المناسبة.
- تغير الحجز.
- إلغاء.
- نقص البيانات.
- دفعات.
- أحداث الرسائل/المزامنة.

## إعلانات الإدارة

هذه ليست نفس local smart notifications.

في Flutter:
- `AdminAnnouncement`.
- `LocalNotification`.

لا تخلط الكيانين.

## الرسائل

المصدر يتعامل مع:
- created
- scheduled
- queued
- sending
- sent
- failed
- blocked

## Offline messaging

يمكن:
- إنشاء رسالة محليًا.
- إضافتها إلى Outbox عند تفعيل المزامنة.
- جدولة الرسالة محليًا حسب السياسة.

لكن الإرسال الخارجي الحقيقي:
- يحتاج API/Backend.
- Secrets بوابة SMS لا توضع في التطبيق.

## SMS

المسار الإنتاجي:

```text
Flutter
  ↓
Message Request
  ↓
Laravel
  ↓
Queue
  ↓
SMS Provider
  ↓
Delivery status
  ↓
Laravel
  ↓
Pull
  ↓
Flutter
```

## WhatsApp

واجهة المرجع تدعم التواصل عبر WhatsApp.

أي API WhatsApp حقيقي يجب أن يكون خلف Backend أو مزود مصرح به، وليس Secret ثابت داخل Flutter.

## Recipient Resolver

المصدر يملك طبقة لتحديد المستلم.

Flutter يجب أن يحافظ على فكرة:
- customer recipient.
- staff recipients.
- group of staff.

ولا يجعل recipient kind مساويًا تلقائيًا لصلاحية role.

## Templates

يجب دعم المتغيرات المرجعية مثل:

- `{name}`
- `{date}`
- `{package}`
- `{amount}`
- `{remaining}`

ويجب أن يكون استبدالها مركزيًا، لا مكررًا داخل كل شاشة.
