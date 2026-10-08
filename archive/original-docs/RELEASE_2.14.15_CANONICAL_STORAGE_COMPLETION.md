# Myfnt 2.14.15 — Canonical Storage Completion

## الهدف
إكمال نقل سلطة البيانات التشغيلية من LocalStorage إلى IndexedDB قبل ربط Laravel/API، مع إبقاء LocalStorage كطبقة توافق/تهيئة قديمة فقط.

## ما تم تنفيذه
- رفع عقد `MyfntRepositories.authority()` إلى الإصدار 2.
- جعل الكتابة الدائمة للباقات `booking_packages` تبدأ بـ IndexedDB ثم تُحدّث Shadow LocalStorage بصورة غير حاكمة.
- جعل إعدادات الشركة والحجز `company_settings` تبدأ بـ IndexedDB ثم Shadow.
- جعل الأيام المميزة `calendar_blocks` تبدأ بـ IndexedDB ثم Shadow.
- جعل قواعد التنبيه `alert_rules` تبدأ بـ IndexedDB ثم Shadow.
- فشل Shadow LocalStorage بعد نجاح IndexedDB لا يؤدي إلى Rollback للبيانات القانونية.
- فشل IndexedDB يؤدي إلى Rollback للـ state ثم تحديث Shadow بالقيمة السابقة قدر الإمكان.
- إزالة التكرار غير الضروري `savePackages()` بعد نجاح محرر الباقات.
- تحويل استيراد JSON إلى تثبيت IndexedDB أولاً عبر مسار Restore، ثم تحديث Shadows بصورة Best-effort.
- تهيئة الشركة الجديدة أصبحت تنتظر تثبيت إعدادات الشركة وSeed الباقات في IndexedDB قبل وسم Onboarding كمكتمل.
- حالة طي التقويم أصبحت تستخدم `settings.mutateDurable()` عند الحفظ.
- ترحيل شعار الشركة من Data URL إلى Media IndexedDB يثبت مرجع الشعار في `company_settings` عبر المسار Durable.
- بيانات تحديث العرض المحلي الخاصة بالمزامنة تحفظ عبر Repository Durable بدل `saveSettings()` القديم.
- `saveSettings(sync=true)` أصبح Deprecated ولا ينشئ كتابة IndexedDB خفية.

## LocalStorage المتبقي
المفاتيح `ozan.settings.v2`, `ozan.packages.v1`, `ozan.special-days.v1` ما زالت تُقرأ عند Boot كمدخل توافق/ترحيل للنسخ القديمة، وتُكتب كـ Shadow. بعد اكتمال Hydration تكون IndexedDB هي السلطة القانونية.

## لماذا لم نحذف LocalStorage نهائياً؟
حذفه الآن سيكسر ترقية الأجهزة التي ما زالت تحمل بيانات من إصدارات أقدم قبل اكتمال Migration. الخطوة الحالية تمنع LocalStorage من اتخاذ قرار نجاح/فشل الحفظ، مع الاحتفاظ به فقط لعبور مرحلة الانتقال.

## الإصدار
2.14.15
