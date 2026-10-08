# Myfnt 2.14.19 — Laravel Sync Foundation

- Batch Push عبر `/sync/push` بدل Request لكل Command.
- Pull بواسطة Cursor كما هو، بعد Push مباشرة.
- Refresh أصبح Sync حقيقي عند توفر Transport حقيقي ولا يستدعي Bootstrap.
- Initial Device Bootstrap لا ينزل الأرشيف تلقائيًا.
- Working Set: السنة الحالية + 180 يومًا مستقبلية.
- سجلات التدقيق التاريخية خارج Bootstrap التلقائي.
- Bootstrap/Pull يظلان Server -> Local فقط ولا ينشئان Queue.
- أضيف عقد Laravel 13 رسمي بصيغة Markdown وJSON.
