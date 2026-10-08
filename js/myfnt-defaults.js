/*
 * إعدادات Myfnt الافتراضية المركزية
 * عدّل القيم هنا يدويًا لتغيير السلوك الافتراضي للحسابات/الأجهزة الجديدة.
 * لا تضع أسرار بوابات SMS أو مفاتيح API في هذا الملف لأنه يصل إلى المتصفح.
 */
'use strict';
(()=>{
 const year=new Date().getFullYear();
 window.MyfntDefaults=Object.freeze({
  // الهوية والخطة
  defaultPlan:'ULTRA',
  defaultAddress:'الجمهورية اليمنية صنعاء',
  currency:'YER', language:'ar', calendar:'gregorian', theme:'light',
  // الموسم الافتراضي: 10 مارس إلى 30 سبتمبر من كل سنة
  season:{enabled:true,name:'موسم',start:`${year}-03-10`,end:`${year}-09-30`},
  // الإشعارات
  notifyTime:'09:00', reminderDays:[10,7,3,1,0],
  // ظهور تعليمات الاستخدام تلقائيًا بعد 80 ثانية من الاستخدام الفعلي
  helpDelayMs:80000,
  // المزامنة
  syncMode:'manual', apiEndpoint:'/api/v1',
  // الحجز
  booking:{requireExactDeposit:false,allowBookingOverpayment:false,allowReceiptOverRemaining:false,showAddress:false,pinCalendarByDefault:true,enablePackageFieldByDefault:true},
  // الرسائل: تنشأ الرسالة آليًا بعد الحجز/الدفعة، ولا تعتبر مرسلة إلا إذا أكد Transport حقيقي النجاح.
  messaging:{autoBooking:false,autoPayment:false,retryLimit:5},
  // الدفع عند الترقية (خيارات عرض محلية حاليًا)
  upgradePaymentMethods:[
   {id:'floosak',label:'فلوسك',icon:'fa-wallet',account:'828338',accountLabel:'رقم حساب فلوسك'},
   {id:'cash',label:'كاش',icon:'fa-money-bill-wave',account:'929383',accountLabel:'رقم حساب كاش'},
   {id:'mobile_money',label:'موبايل موني',icon:'fa-sim-card',account:'938383',accountLabel:'رقم حساب موبايل موني'},
   {id:'kuraimi',label:'كريمي حاسب',icon:'fa-building-columns',account:'928383',accountLabel:'رقم حساب كريمي'},
   {id:'jawali',label:'جوالي',icon:'fa-mobile-screen-button',account:'393873',accountLabel:'رقم حساب جوالي'},
   {id:'jeeb',label:'جيب',icon:'fa-wallet',account:'8383733',accountLabel:'رقم حساب جيب'}
  ]
 });
})();
