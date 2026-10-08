# 07 — المصادقة والشركات والصلاحيات

## الوضع المرجعي الحالي

المصدر الحالي يعتمد Local/Demo identity أكثر من مصادقة Server حقيقية.

هذا يعني أن Flutter الجديد يجب أن يفرق بوضوح بين:

1. Local session/runtime.
2. Server authenticated session عند ربط Laravel.

## نموذج الشركة

```text
User
  ↓
Company Membership
  ↓
Company
```

الاسم التقني canonical:

`company_memberships`

الاسم الظاهر للمستخدم:

`مستخدمو الشركة`

لا تستخدم `company_users` كاسم جدول جديد؛ التقرير الأخير استخدمه كمصطلح UI/contract wording بشكل غير متسق بينما SQL والعقد الحالي يعتمدان `company_memberships`.

## صلاحيات العضوية

المفهوم موجود في العقد:
- role
- permissions
- status

الأدوار الظاهرة في UI مثل:
- مالك
- مدير
- محاسب

يجب عدم خلطها مع مجموعات مستلمي الإشعارات.

## قواعد الشركة

- كل Domain data تحت Company.
- Company scope غير قابل للكسر من UI.
- بيانات شركة أخرى لا تظهر في Query أو Cache.
- أي background job يحمل company context.

## الحساب

يجب توفير:
- تسجيل الدخول.
- OTP.
- كلمة المرور عند الحاجة.
- جلسة محلية آمنة.
- تسجيل الخروج.
- تغيير كلمة المرور.
- طلب حذف الحساب.

## قاعدة Offline

بعد الحصول على بيانات المستخدم والشركة:
- التطبيق يعمل من Local.
- لا يجعل كل انتقال شاشة Authentication check شبكي.

## حساب تجريبي

النسخة المرجعية تحتوي Demo accounts محلية لأغراض الاختبار.

هذه التفاصيل لا تُنسخ إلى Production backend كبيانات ثابتة.
