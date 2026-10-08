# Refactor Step 18 — Package + Settings Repository

## الهدف
- نقل إدارة الباقات إلى Repository واضح.
- فصل الإعدادات المتزامنة عن الإعدادات المحلية البحتة.
- الحفاظ على التصميم والسلوك الحاليين بدون تغيير الواجهة.

## Package Repository
تمت إضافة عمليات متخصصة إلى `MyfntRepositories.packages`:
- `all / snapshot / get / find / filter / exists`
- `add`
- `mutate`
- `removeLocal`
- `replaceLocal`

عمليات الإضافة/التعديل/الإخفاء أصبحت تجمع في مكان واحد:
1. تعديل الذاكرة الحالية.
2. الحفظ المحلي الدائم.
3. Rollback عند فشل الحفظ.
4. تسجيل Entity-level sync عند الحاجة.

حذف الباقة من الخادم ما زال يمر أولًا عبر Tombstone/Offline remove، وبعد نجاحه فقط يتم `removeLocal`.

## Settings Repository
تمت إضافة `MyfntRepositories.settings`:
- `all`
- `snapshot`
- `get(path)`
- `mutate()` للإعدادات القابلة للمزامنة
- `mutateLocal()` للإعدادات المحلية فقط

تم تحديث `saveSettings()` ليقبل:
- `sync: true/false`
- `profileEvent: true/false`

## فصل الإعدادات
### متزامنة
- بيانات الشركة الأساسية
- العملة
- نوع التقويم
- اللغة
- وضع المزامنة
- إعدادات الموسم
- إعدادات حقول الحجز التي تدخل في `company_settings`

### محلية فقط
- الثيم Light/Dark
- طي/فتح التقويم
- وقت النسخة الاحتياطية المحلية
- `alertTemplates` في الذاكرة المحلية عندما تتم مزامنة قواعد التنبيه نفسها كـ`alert_rules`

الهدف هو منع تغييرات الواجهة الشخصية من إنشاء أوامر Server Sync غير ضرورية.

## تحسينات إضافية
- تحويل إدارة الباقات في `advanced.js` إلى Package Repository.
- تحويل حذف الباقة وتسعير الموسم في `app.js` إلى Repository.
- تحويل قراءات الباقات الأساسية في `bookings.js` إلى بوابة موحدة.
- النسخ الاحتياطية تستخدم `snapshot()` للباقات والإعدادات حيث أمكن.

## ما لم يتغير
- شكل الباقات أو Chips.
- أسعار الحجوزات السابقة أو Pricing Snapshot.
- قواعد منع حذف باقة مرتبطة بحجوزات.
- Tombstone semantics.
- IndexedDB schema.
- أرقام الحجوزات/العملاء/السندات/الحركات التسلسلية.
- المعاملات المالية.

## Cache
تم رفع Cache revision فقط إلى `v2.9.7-r18-static`.
الإصدار المرئي ما زال `2.9.7`.

## فحص ثابت
- JavaScript syntax: OK
- Missing index assets: 0
- Missing service-worker assets: 0
