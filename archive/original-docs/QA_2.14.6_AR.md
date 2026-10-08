# QA — Myfnt 2.14.6

- All JavaScript files passed `node --check`.
- All JSON files parsed successfully.
- Runtime test verified Arabic variables: #اسم_الشركة, #موعد_المناسبة, #نوع_الباقة, #المتبقي.
- Runtime output verified Arabic weekday name for 2026-10-08: الخميس.
- Runtime test verified rule-only cancellation: reminder row cancelled while booking-created row remained approval_required.
- Cancelled reminder rows are excluded from SMS reservation accounting.
- Service Worker and index references bumped to 2.14.6.
