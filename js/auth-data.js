/* Myfnt activity catalogue + local demo identity data. */
'use strict';
window.OzanAuthData={
 mode:'demo', demoOtp:'246810',
 // حسابات تجريبية محلية فقط لاختبار خطط الاشتراك. ليست حسابات خادم حقيقية.
 demoUsers:[
  {id:'demo-basic', companyId:'demo-company-basic', name:'مدير بيسك', phone:'+967770000001', password:'Myfnt@Basic1', businessName:'قاعة مايفنت', businessType:'hall', plan:'BASIC'},
  {id:'demo-plus', companyId:'demo-company-plus', name:'مدير بلس', phone:'+967770000002', password:'Myfnt@Plus2', businessName:'قاعة مايفنت بلس', businessType:'hall', plan:'PLUS'},
  {id:'demo-super', companyId:'demo-company-super', name:'مدير سوبر', phone:'+967770000003', password:'Myfnt@Super3', businessName:'قاعة مايفنت سوبر', businessType:'hall', plan:'SUPER'},
  {id:'demo-ultra', companyId:'demo-company-ultra', name:'مدير الترا', phone:'+967770000004', password:'Myfnt@Ultra4', businessName:'قاعة مايفنت الترا', businessType:'hall', plan:'ULTRA'},
 ],
 businessTypes:[
  {id:'hall',label:'قاعة',icon:'fa-building',description:'قاعة مناسبات لتنظيم الأعراس والحفلات والمناسبات الخاصة مع خيارات متعددة للجلسات والخدمات.',packages:[
   {name:'كراسي وطاولات',icon:'fa-utensils'},{name:'مجلس نساء',icon:'fa-users'},{name:'مقيل',icon:'fa-mug-hot'},{name:'مقيل وسمرة',icon:'fa-moon'},{name:'حفل تخرج',icon:'fa-graduation-cap'},{name:'عزاء',icon:'fa-dove'}]},
  {id:'chalet',label:'شالية',icon:'fa-house',description:'شالية مخصص للمناسبات والجلسات الخاصة والحفلات العائلية بخيارات حجز مرنة.',packages:[
   {name:'الباقة الأولى',icon:'fa-star'},{name:'الباقة الثانية',icon:'fa-gem'},{name:'الباقة الثالثة',icon:'fa-crown'},{name:'الباقة الرابعة',icon:'fa-gift'},{name:'الباقة الخامسة',icon:'fa-calendar-check'}]},
  {id:'male_singer',label:'فنان',icon:'fa-microphone-lines',description:'خدمات فنية للمقيل والسمرات والزفات والحفلات الخاصة.',packages:[
   {name:'مقيل',icon:'fa-mug-hot'},{name:'مقيل وسمرة',icon:'fa-moon'},{name:'مقيل وسمرة وزفة',icon:'fa-music'},{name:'حفلة خاصة',icon:'fa-microphone'}]},
  {id:'female_singer',label:'فنانة',icon:'fa-microphone',description:'خدمات غنائية للمناسبات في الصالات والشاليهات والمنازل والحفلات الخاصة.',packages:[
   {name:'غناء صالة',icon:'fa-microphone'},{name:'غناء شالية',icon:'fa-house'},{name:'غناء بيت',icon:'fa-house'},{name:'حفلة خاصة',icon:'fa-music'}]},
  {id:'photographer',label:'مصورة',icon:'fa-camera',description:'تصوير وتوثيق المناسبات والجلسات والفعاليات بباقات متنوعة.',packages:[
   {name:'الأول',icon:'fa-camera'},{name:'الثاني',icon:'fa-image'},{name:'الثالث',icon:'fa-images'},{name:'الرابع',icon:'fa-star'},{name:'الخامس',icon:'fa-gem'},{name:'السادس',icon:'fa-crown'},{name:'مناسبات صغيرة',icon:'fa-camera-retro'}]},
  {id:'photo_studio',label:'استديو تصوير',icon:'fa-camera-retro',description:'استديو للتصوير والجلسات الخاصة وتغطية المناسبات بخيارات متعددة.',packages:[
   {name:'الباقة الأولى',icon:'fa-camera'},{name:'الباقة الثانية',icon:'fa-image'},{name:'الباقة الثالثة',icon:'fa-images'},{name:'الباقة الرابعة',icon:'fa-star'},{name:'الباقة الخامسة',icon:'fa-gem'},{name:'جلسة تصوير',icon:'fa-camera-retro'},{name:'حفلة خاصة',icon:'fa-wand-magic-sparkles'}]},
  {id:'decor_office',label:'مكتب كوش',icon:'fa-wand-magic-sparkles',description:'تصميم وتنفيذ الكوش والديكورات للمناسبات في القاعات والشاليهات والمنازل.',packages:[
   {name:'قاعة',icon:'fa-building'},{name:'شالية',icon:'fa-house'},{name:'بيت',icon:'fa-house'},{name:'حفلة خاصة',icon:'fa-gift'}]},
  {id:'event_planning',label:'تنسيق حفلات',icon:'fa-calendar-check',description:'تنسيق وإدارة تفاصيل المناسبات والحفلات في القاعات والشاليهات والمنازل.',packages:[
   {name:'قاعة',icon:'fa-building'},{name:'شالية',icon:'fa-house'},{name:'بيت',icon:'fa-house'}]},
  {id:'bakery',label:'مخبز',icon:'fa-cake-candles',description:'تجهيز المخبوزات والحلويات والطلبات الخاصة بالمناسبات والحفلات.',packages:[
   {name:'قاعة',icon:'fa-building'},{name:'شالية',icon:'fa-house'},{name:'بيت',icon:'fa-house'}]},
  {id:'other',label:'أخرى',icon:'fa-box-open',description:'نشاط خدمات مناسبات قابل للتخصيص بحسب طبيعة العمل والخدمات المقدمة.',packages:[
   {name:'قاعة',icon:'fa-building'},{name:'بيت',icon:'fa-house'},{name:'خاص',icon:'fa-star'},{name:'عام',icon:'fa-globe'}]}
 ],
 countries:[
 ['YE','اليمن','Yemen','967','🇾🇪',9],['SA','السعودية','Saudi Arabia','966','🇸🇦',9],['AE','الإمارات','United Arab Emirates','971','🇦🇪',9],['OM','عُمان','Oman','968','🇴🇲',8],['QA','قطر','Qatar','974','🇶🇦',8],['KW','الكويت','Kuwait','965','🇰🇼',8],['BH','البحرين','Bahrain','973','🇧🇭',8],['EG','مصر','Egypt','20','🇪🇬',10],['JO','الأردن','Jordan','962','🇯🇴',9],['IQ','العراق','Iraq','964','🇮🇶',10],['SY','سوريا','Syria','963','🇸🇾',9],['LB','لبنان','Lebanon','961','🇱🇧',8],['PS','فلسطين','Palestine','970','🇵🇸',9],['SD','السودان','Sudan','249','🇸🇩',9],['MA','المغرب','Morocco','212','🇲🇦',9],['DZ','الجزائر','Algeria','213','🇩🇿',9],['TN','تونس','Tunisia','216','🇹🇳',8],['LY','ليبيا','Libya','218','🇱🇾',9],['TR','تركيا','Turkey','90','🇹🇷',10],['GB','بريطانيا','United Kingdom','44','🇬🇧',10],['US','الولايات المتحدة','United States','1','🇺🇸',10],['IN','الهند','India','91','🇮🇳',10],['PK','باكستان','Pakistan','92','🇵🇰',10],['DE','ألمانيا','Germany','49','🇩🇪',11],['FR','فرنسا','France','33','🇫🇷',9]
 ].map(([iso,ar,en,dial,flag,length])=>({iso,ar,en,dial,flag,length}))
};