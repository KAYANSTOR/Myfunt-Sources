# Step 21C3.1 — Recipient Chips Stability Fix

Version: 2.10.6

## السبب
تم استبدال native `<details>/<summary>` و checkbox المخفي داخل labels في قسم المستلمين، لأنها كانت تتداخل مع window/focus/scroll layers على Android PWA عند فتح القسم أو لمس chips.

## الإصلاح
- Accordion مخصص بزر `aria-expanded` بدل `<details>`.
- أزرار مستلمين حقيقية `button` + `aria-pressed` بدل checkbox مخفي.
- لا يوجد re-render عند اختيار المستلمين.
- `collect()` يقرأ `.is-selected` فقط عند الحفظ.
- حماية handler إذا لم يكن `event.target` عنصر DOM.
- تحسين touch-action وmobile hit targets.

لا تغيير في IndexedDB أو المزامنة أو سياسات الرسائل نفسها.
