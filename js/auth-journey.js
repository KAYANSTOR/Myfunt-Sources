/* OZAN v2.1.4 · account-specific onboarding, delayed hints, visitor discovery */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const allowGuest=new Set(['menuWindow','searchWindow','monthPickerWindow','availableDatesWindow','dayBookingsWindow','previewWindow','ozInfoWindow']);
 const TOUR_IDLE_MS=Number(window.MyfntDefaults?.helpDelayMs||80000),TICK_MS=1000;
 function guestPrompt(feature=''){
  const panel=$('ozGuestGate');if(!panel)return;
  if($('ozGuestHint'))$('ozGuestHint').textContent=`يمكنك تصفح التقويم والبحث دون تسجيل. لاستخدام ${feature||'هذه الميزة'} وحفظ بياناتك في مساحة خاصة، سجل الدخول أو أنشئ حسابًا.`;
  panel.hidden=false;
 }
 const logged=()=>Boolean(window.OzanScope?.read());
 window.OzanGate={
  require(feature){if(logged())return false;guestPrompt(feature);return true;},
  blockedWindow(id){if(logged()||allowGuest.has(id))return false;guestPrompt($(id)?.getAttribute('aria-label')||'الميزات المتقدمة');return true;}
 };
 function dataForSession(){
  const s=window.OzanScope?.read(),auth=window.OzanAuth;if(!s||!auth)return null;
  const u=auth.data.users.find(x=>x.id===s.userId),c=auth.data.companies.find(x=>x.id===s.companyId);
  return u&&c?{s,u,c}:null;
 }
 const completionKey=companyId=>'ozan.onboarding-first-booking.v214.'+encodeURIComponent(companyId);
 const packageReviewedKey=companyId=>'ozan.packages-reviewed.v1.'+encodeURIComponent(companyId);
 function progress(){
  const current=dataForSession();if(!current||typeof state==='undefined')return null;
  const {s,c}=current,settings=window.MyfntRepositories?.settings?.all?.()||{},profile=settings.company||{},prefs=settings.preferences||{},packages=window.MyfntRepositories?.packages?.all?.()||[];
  // Existing bookings are already proof of using the service; migration will not annoy established accounts.
  const bookingStarted=localStorage.getItem(completionKey(s.companyId))==='1'||
   ((window.MyfntRepositories?.bookings?.all?.()||[]).some(b=>b.status!=='cancelled'));
  const currencyChosen=!!localStorage.getItem('ozan.currency-chosen.'+s.companyId)||Boolean(prefs.currency&&prefs.currency!=='YER');
  const active=packages.filter(p=>p.status!=='hidden');
  const priced=active.length>0&&active.every(p=>Number(p.price)>0);
  const packagesReviewed=localStorage.getItem(packageReviewedKey(s.companyId))==='1';
  const items=[
   {key:'name',title:'اسم النشاط',hint:'أضف اسمًا واضحًا يظهر في الحجوزات والسندات',done:!!profile.name?.trim()&&profile.name!=='ماي بوك برو للمناسبات'&&profile.name!=='مايفنت',target:'companySettingsWindow',icon:'fa-building'},
   {key:'phone',title:'هاتف النشاط',hint:'سجل رقمًا يتواصل به عملاؤك',done:!!profile.phone?.replace(/\D/g,'').length,target:'companySettingsWindow',icon:'fa-phone'},
   {key:'logo',title:'شعار النشاط',hint:'ارفع شعارًا يظهر على سنداتك',done:!!profile.logo,target:'companySettingsWindow',icon:'fa-image'},
   {key:'currency',title:'العملة',hint:'حدد العملة المستخدمة في الحجز والدفعات',done:currencyChosen,target:'advancedPrefsWindow',icon:'fa-coins'},
   {key:'packages',title:'الباقات',hint:active.length?`راجع ${active.length} باقات افتراضية ثم سمّها وسعّرها لاحقًا`:'جهّز باقات نشاطك',done:packagesReviewed||priced,target:'packagesWindow',icon:'fa-box-open'}
  ];
  return {items,company:c,bookingStarted,percent:bookingStarted?100:items.filter(x=>x.done).length*20};
 }
 function closeProgress(){if($('ozSetupProgress'))$('ozSetupProgress').hidden=true;}
 function refresh(){
  const pill=$('ozProgressPill');if(!pill)return;
  const p=progress();document.body.classList.toggle('oz-is-logged',!!p);
  // Hide the pill AND close the checklist at 100%, including persisted 100% after reload.
  pill.hidden=!p||p.percent===100;
  if(!p){closeProgress();return;}
  pill.dataset.percent=String(p.percent);
  pill.setAttribute('aria-label',`اكتمال ملف النشاط ${p.percent} بالمئة`);
  if(p.percent===100){closeProgress();return;}
  const next=p.items.find(x=>!x.done);
  $('ozProgressRing').textContent=p.percent+'٪';
  $('ozProgressRing').style.setProperty('--oz-progress',p.percent+'%');
  $('ozProgressSmall').textContent=next?'التالي: '+next.title:'يمكنك بدء إضافة الحجوزات';
  $('ozProgressChecklist').innerHTML=p.items.map(item=>`<button class="oz-progress-task ${item.done?'is-done':''}" data-progress-target="${item.target}" type="button"><span class="oz-task-icon"><i class="fa-solid ${item.done?'fa-check':item.icon}"></i></span><span class="oz-task-label"><strong>${item.title}</strong><small>${item.done?'مكتمل':item.hint}</small></span><span>${item.done?'✓':'←'}</span></button>`).join('');
 }
 function openProgress(){
  if(window.OzanGate.require('تخصيص نشاطك'))return;
  refresh();if(progress()?.percent===100)return;$('ozSetupProgress').hidden=false;
 }
 $('ozProgressPill')?.addEventListener('click',openProgress);
 $('ozProgressClose')?.addEventListener('click',closeProgress);
 $('ozProgressLater')?.addEventListener('click',closeProgress);
 $('ozSetupProgress')?.addEventListener('click',e=>{if(e.target===$('ozSetupProgress'))closeProgress();});
 const quick=()=>$('ozQuickSetup');
 function quickClose(){if(quick())quick().hidden=true;}
 function quickBase({title,caption,icon='fa-wand-magic-sparkles',step='خطوة سريعة',body=''}){
  if(!quick())return;
  $('ozQuickSetupTitle').textContent=title;$('ozQuickSetupCaption').textContent=caption;$('ozQuickStep').textContent=step;
  $('ozQuickIcon').innerHTML=`<i class="fa-solid ${icon}"></i>`;$('ozQuickSetupBody').innerHTML=body;quick().hidden=false;
  requestAnimationFrame(()=>quick().querySelector('.oz-quick-card')?.classList.add('is-ready'));
 }
 function openCurrencyQuick(){
  const current=String(window.MyfntRepositories?.settings?.get?.('preferences.currency')||'YER');
  const currencies=[['YER','ريال يمني','ر.ي','fa-coins'],['SAR','ريال سعودي','ر.س','fa-money-bill-wave'],['USD','دولار أمريكي','$','fa-dollar-sign']];
  quickBase({title:'اختر عملة نشاطك',caption:'اختيار واحد فقط، وسيتم اعتماده مباشرة للحجوزات والسندات.',icon:'fa-coins',step:'العملة',body:`<div class="oz-quick-currency-grid">${currencies.map(([code,name,symbol,icon])=>`<button type="button" class="oz-quick-choice ${code===current?'is-current':''}" data-quick-currency="${code}"><span class="oz-quick-choice-icon"><i class="fa-solid ${icon}"></i></span><strong>${name}</strong><small>${code} · ${symbol}</small><i class="fa-solid fa-circle-check oz-quick-check"></i></button>`).join('')}</div>`});
 }
 function openPackagesQuick(){
  const s=window.OzanScope?.read();const list=(window.MyfntRepositories?.packages?.all?.()||[]).filter(p=>p.status!=='hidden');
  const first=list[0];
  quickBase({title:'باقات نشاطك جاهزة',caption:list.length?`جهزنا لك ${list.length} باقات مناسبة لنوع نشاطك. ابدأ بالخيار الأول ثم عدّل الأسماء والأسعار وقتما تريد.`:'يمكنك إنشاء أول باقة لنشاطك الآن.',icon:'fa-box-open',step:'الباقات',body:first?`<div class="oz-quick-package-preview"><span class="oz-quick-package-icon"><i class="fa-solid ${first.icon||'fa-calendar-check'}"></i></span><div><small>الخيار الافتراضي الأول</small><strong>${first.name||'الباقة الأولى'}</strong><span>${list.length>1?`+ ${list.length-1} باقات إضافية جاهزة`: 'جاهزة للتسمية والتسعير'}</span></div><i class="fa-solid fa-check"></i></div><button type="button" class="oz-quick-primary" id="ozAcceptPackages"><i class="fa-solid fa-sparkles"></i> اعتماد الباقات الافتراضية</button>`:`<button type="button" class="oz-quick-primary" id="ozOpenPackagesDirect"><i class="fa-solid fa-plus"></i> إنشاء الباقات</button>`});
 }
 function showQuickDone(kind){
  const title=kind==='packages'?'اكتملت الخطوات الأساسية':'تم اعتماد العملة';
  const caption=kind==='packages'?'يمكنك بدء استخدام مايفنت الآن، أو إكمال تسمية وتسعير الباقات قبل أول حجز.':'تم حفظ العملة بنجاح ويمكنك متابعة تجهيز نشاطك.';
  quickBase({title,caption,icon:'fa-circle-check',step:'تم بنجاح',body:kind==='packages'?`<div class="oz-quick-finish-actions"><button type="button" class="oz-quick-primary" id="ozExploreSystem"><i class="fa-solid fa-compass"></i> استكشاف النظام</button><button type="button" class="oz-quick-secondary" id="ozFinishPackages"><i class="fa-solid fa-tags"></i> إكمال تسمية وتسعير الباقات</button></div>`:`<button type="button" class="oz-quick-primary" id="ozQuickContinue"><i class="fa-solid fa-arrow-left"></i> متابعة الخطوات</button>`});
 }
 $('ozProgressChecklist')?.addEventListener('click',e=>{
  const row=e.target.closest('[data-progress-target]');if(!row)return;
  const id=row.dataset.progressTarget;closeProgress();
  if(id==='companySettingsWindow'&&typeof fillCompanyForm==='function'){fillCompanyForm();openWindow(id);return;}
  if(id==='advancedPrefsWindow'){openCurrencyQuick();return;}
  if(id==='packagesWindow'){openPackagesQuick();return;}
  openWindow(id);
 });
 $('ozQuickClose')?.addEventListener('click',quickClose);quick()?.addEventListener('click',e=>{if(e.target===quick())quickClose();});
 $('ozQuickSetupBody')?.addEventListener('click',e=>{
  const currency=e.target.closest('[data-quick-currency]');
  if(currency){const code=currency.dataset.quickCurrency;const scope=window.OzanScope?.read();try{window.MyfntRepositories?.settings?.mutate?.(st=>{st.preferences=st.preferences||{};st.preferences.currency=code;},{sync:true,profileEvent:true});if(scope)localStorage.setItem('ozan.currency-chosen.'+scope.companyId,'1');showToast?.('تم اعتماد العملة','success');refresh();currency.closest('.oz-quick-card')?.classList.add('is-complete');setTimeout(()=>showQuickDone('currency'),360);}catch(err){showToast?.('تعذر حفظ العملة','error');}return;}
  if(e.target.closest('#ozAcceptPackages')){const scope=window.OzanScope?.read();if(scope)localStorage.setItem(packageReviewedKey(scope.companyId),'1');refresh();quick()?.querySelector('.oz-quick-card')?.classList.add('is-complete');setTimeout(()=>showQuickDone('packages'),360);return;}
  if(e.target.closest('#ozOpenPackagesDirect')||e.target.closest('#ozFinishPackages')){quickClose();if(typeof renderPackagesAdmin==='function')renderPackagesAdmin();openWindow('packagesWindow');return;}
  if(e.target.closest('#ozExploreSystem')){quickClose();closeProgress();setTimeout(()=>showTour({force:true,restart:true}),280);return;}
  if(e.target.closest('#ozQuickContinue')){quickClose();refresh();setTimeout(openProgress,220);}
 });
 $('ozGuestClose')?.addEventListener('click',()=>{$('ozGuestGate').hidden=true;});
 $('ozGuestContinue')?.addEventListener('click',()=>{$('ozGuestGate').hidden=true;});
 $('ozGuestGate')?.addEventListener('click',e=>{if(e.target===$('ozGuestGate'))$('ozGuestGate').hidden=true;});
 $('ozGuestLogin')?.addEventListener('click',()=>{$('ozGuestGate').hidden=true;window.OzanAuth?.open?.();});
 document.addEventListener('ozan:packages-updated',refresh);
 document.addEventListener('ozan:profile-updated',refresh);
 document.addEventListener('ozan:booking-saved',e=>{
  const s=window.OzanScope?.read();
  if(!s||e.detail?.companyId!==s.companyId||e.detail?.userId!==s.userId)return;
  try{localStorage.setItem(completionKey(s.companyId),'1');}catch(error){console.warn('[OZAN] تعذر تثبيت حالة إعداد النشاط',error);}
  refresh();
 });
 $('ozPrefsForm')?.addEventListener('submit',()=>{
  const s=window.OzanScope?.read();if(s)localStorage.setItem('ozan.currency-chosen.'+s.companyId,'1');queueMicrotask(refresh);
 });
 $('companyForm')?.addEventListener('submit',()=>queueMicrotask(refresh));
 $('companyLogo')?.addEventListener('change',()=>setTimeout(refresh,120));

 const tips=[
  'اسحب التقويم يمينًا أو يسارًا للتنقل بين الأشهر، ويمكنك استخدام الأسهم أيضًا.',
  'انقر يومًا في التقويم لاستعراض حجوزاته أو معرفة إن كان متاحًا.',
  'بعد تسجيل الدخول، اضغط زر + لإضافة حجز وحدد الباقة والتاريخ.',
  'اضغط مطولًا على يوم للوصول السريع إلى إضافة حجز لذلك التاريخ.',
  'اضغط بطاقة أي حجز لمعاينة التفاصيل والدفعات والتواصل مع العميل.'
 ];
 let tip=0,activeMs=0,lastTick=performance.now(),tourForced=false;
 const tourKey=()=> 'ozan.tour.v21413.'+(window.OzanScope?.read()?.userId||'guest');
 const inForeground=()=>document.visibilityState==='visible'&&document.hasFocus();
 const blockedTour=()=>window.MyfntUiState?.blockingSurfaceOpen?.(['ozTourHint'])??(Boolean(document.querySelector('.window.is-open'))||['ozAuth','ozSetupWelcome','ozLocalSync','ozGuestGate','ozAuthAccount','ozSetupProgress','ozCountryDialog','ozPrivacyDialog'].some(id=>$(id)&&!$(id).hidden));
 function closeTour(done){if($('ozTourHint'))$('ozTourHint').hidden=true;if(done)try{localStorage.setItem(tourKey(),'1');}catch{};tourForced=false;}
 function showTour(options={}){
  const force=options===true||Boolean(options?.force);if(!$('ozTourHint')||!$('ozTourText')||!$('ozTourNext'))return false;
  if(force){if(options?.restart)tip=0;tourForced=true;}
  if(!force&&activeMs<TOUR_IDLE_MS)return false;
  if(!force&&localStorage.getItem(tourKey()))return false;
  if(!inForeground()||blockedTour())return false;
  $('ozTourHint').hidden=false;
  $('ozTourText').textContent=`تلميح ${tip+1} من ${tips.length} · ${tips[tip]}`;
  $('ozTourNext').textContent=tip===tips.length-1?'فهمت':'التالي';
  return true;
 }
 $('ozTourNext')?.addEventListener('click',()=>{if(++tip>=tips.length){closeTour(true);return;}showTour({force:tourForced});});
 $('ozTourSkip')?.addEventListener('click',()=>closeTour(true));
 $('ozReplayTour')?.addEventListener('click',()=>{
  if(typeof closeWindow==='function')closeWindow('menuWindow',{skipHistory:true});
  // Opening the tour is explicitly user initiated; no one-minute wait here.
  queueMicrotask(()=>showTour({force:true,restart:true}));
 });
 function tick(){
  const now=performance.now();
  const blocked=blockedTour();
  if(inForeground()&&!blocked)activeMs+=Math.min(Math.max(now-lastTick,0),2000);
  lastTick=now;
  if(blocked&&$('ozTourHint')&&!$('ozTourHint').hidden){closeTour(false);return;}
  if(activeMs>=TOUR_IDLE_MS&&$('ozTourHint')?.hidden)showTour();
 }
 document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(!document.hidden&&activeMs>=TOUR_IDLE_MS)showTour();});
 window.addEventListener('focus',()=>{lastTick=performance.now();if(activeMs>=TOUR_IDLE_MS)showTour();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeProgress();$('ozGuestGate').hidden=true;if($('ozTourHint')&&!$('ozTourHint').hidden)closeTour(true);}});
 window.OzanJourney={refresh,openProgress,showTour,checklist:progress,usageSeconds:()=>Math.floor(activeMs/1000)};
 function initJourney(){
  refresh();lastTick=performance.now();setInterval(tick,TICK_MS);
  const firstTour=()=>{if(!localStorage.getItem(tourKey()))showTour();};
  if(window.MyfntUiState?.scheduleWhenClear)window.MyfntUiState.scheduleWhenClear({key:'guided-tour',delayMs:TOUR_IDLE_MS,excludeIds:['ozTourHint'],callback:()=>{activeMs=TOUR_IDLE_MS;firstTour();},pollMs:500});
  else setTimeout(()=>{activeMs=TOUR_IDLE_MS;firstTour();},TOUR_IDLE_MS);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initJourney,{once:true});else initJourney();
})();
