# 11 — الأداء وهدف Flutter

## الهدف

سرعة فتح التطبيق وسلاسة التفاعل أهم من كثرة المؤثرات.

## State Management

الاختيار المستهدف:

**Riverpod**

السبب:
- فصل UI عن الحالة.
- providers قابلة للاختبار.
- granular rebuild.
- dependency injection.
- مناسب للـfeature modules.

## Local Database

الاختيار المستهدف:

**Drift + SQLite**

السبب:
- local relational model.
- transactions.
- typed queries.
- streams/watch.
- مناسب لنمو البيانات.

## بنية المشروع

```text
lib/
├── app/
│   ├── router/
│   ├── theme/
│   └── bootstrap/
├── core/
│   ├── database/
│   ├── network/
│   ├── sync/
│   ├── errors/
│   └── utils/
├── features/
│   ├── home/
│   ├── bookings/
│   ├── customers/
│   ├── finance/
│   ├── notifications/
│   ├── messages/
│   ├── settings/
│   ├── backup/
│   ├── auth/
│   └── plans/
└── shared/
    ├── widgets/
    └── models/
```

## Performance rules

- `const` حيث يمكن.
- لا query داخل build.
- لا JSON parse ضخم داخل UI.
- لا تحميل جميع الحجوزات لعرض شهر واحد.
- لا rerender للتطبيق كله عند تعديل عنصر.
- Lazy list.
- Pagination عند الحاجة.
- Streams محددة بالنطاق.
- Memory cache كمسرع فقط.
- Heavy work في isolate/background mechanism عند الحاجة.

## الأداء في التقويم

يجب الاستعلام عن:
- الشهر.
- والنطاق المرئي.

بدل:
- تحميل كل الحجوزات ثم تصفيتها في build.

## الأداء في المالية

- page/limit.
- indexes على date/status/booking/customer.
- aggregates محسوبة في query أو service.

## الأداء في البحث

البحث يجب أن يستخدم query/index مناسبًا، لا حلقة على كل records في كل key stroke.

## قياس لا تخمين

يجب اختبار:
- cold start.
- warm start.
- 1k booking.
- 10k booking.
- 100k booking عند مرحلة DB scalability.
- scrolling.
- calendar.
- search.

لا يوجد وعد حقيقي بـ"صفر تأخير" بدون قياس.
