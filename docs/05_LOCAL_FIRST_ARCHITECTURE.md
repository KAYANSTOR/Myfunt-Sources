# 05 — المعمارية Local-First

## الهدف

فتح التطبيق وعرض البيانات بسرعة حتى في حالة انقطاع الإنترنت، مع جعل الشبكة طبقة مزامنة وليست طبقة تشغيل أساسية.

## معمارية Flutter المستهدفة

```text
Screens / Widgets
        ↓
Riverpod Providers / Controllers
        ↓
Domain Services
        ↓
Repositories
        ↓
Drift / SQLite
        ↓
Local durable state

                     ↘
                      Sync Engine
                       ↓
                      API
                       ↓
                    Laravel
                       ↓
                     MySQL
```

## المسؤوليات

### Presentation
- Widget composition.
- Navigation.
- Local transient UI state.
- Accessibility.

### Riverpod
- Feature state.
- Async state.
- Derived state.
- Cache coordination.
- Dependency injection.

### Domain
- Booking rules.
- Payment rules.
- Plan checks.
- Notification generation rules.
- Validation.

### Repository
- القراءة والكتابة.
- إخفاء Drift عن UI.
- توفير streams/watch.
- واجهة موحدة يمكن ربطها بـAPI لاحقًا.

### Drift
- التخزين المحلي.
- Transactions.
- Queries.
- Indexes.
- reactive streams.

### Sync
- Outbox.
- Push.
- Pull.
- Conflict handling.
- Checkpoints.

## قاعدة الكتابة

لا تكتب:

```text
Widget -> Drift
```

اكتب:

```text
Widget
 -> Controller/Provider
 -> Repository
 -> Transaction
```

## قاعدة القراءة

```text
Drift stream
 -> Riverpod provider
 -> minimal widget rebuild
```

## Transaction الحجز

حفظ الحجز يجب أن يكون Atomic بقدر Domain:

- العميل أو الربط.
- الحجز.
- Booking Details.
- الدفعة عند وجودها.
- Audit.
- Sync command عند تفعيل المزامنة.

إما تنجح المعاملة أو لا يتم عرض نجاح العملية.

## Cache

يمكن استخدام memory cache كمسرع فقط.

لا يصبح cache مصدر الحقيقة.

## البيانات القديمة

Flutter الجديد لا يجب أن يعتمد على schema compatibility العشوائية من الويب.

عند الحاجة لاستيراد نسخة قديمة:
- Adapter منفصل.
- Migration versioned.
- Validation.
- لا تغيير بصمت في Domain.

## فصل التشغيل

المسار المحلي يجب أن يعمل دون:
- Login network call لكل فتح.
- API لكل query.
- API لكل booking.
- API لكل payment.
