/* OZAN v2.1.4 · Local-first identity. NOT server authentication; OAuth requires verified backend. */
'use strict';
(()=>{
 const D=window.OzanAuthData,$=id=>document.getElementById(id);
 const bookingRepo=()=>window.MyfntRepositories?.bookings||null;
 const paymentRepo=()=>window.MyfntRepositories?.payments||null;
 const packageRepo=()=>window.MyfntRepositories?.packages||null;
 const settingsRepo=()=>window.MyfntRepositories?.settings||null;
 const DEMOS=Array.isArray(D?.demoUsers)?D.demoUsers:[];
 const PRIMARY_DEMO=DEMOS[0]||D?.demoUser||null;
 if(!D){console.error('[OZAN/Auth] assets/js/auth-data.js لم يحمّل');return;}
 const STORAGE=Object.freeze({AUTH:'ozan.auth.demo.v1',SESSION:'ozan.auth.session.v1',COUNTRY:'ozan.country.v1',LOCKS:'ozan.auth.password-locks.v1',POST_LOGIN:'ozan.auth.postlogin.v1'});
 const COUNTRY_LOOKUP=Object.freeze({url:'https://ipwho.is/',timeoutMs:2400});
 const SESSION_CHECK_MS=60000;
 const {AUTH:STORE,SESSION,COUNTRY,LOCKS,POST_LOGIN:POST}=STORAGE;
 const normalize=v=>String(v||'').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[^+\d]/g,'');
 const digits=v=>normalize(v).replace(/\D/g,'');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
 const store=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));};
 const data=read(STORE,{users:[],companies:[]});
 if(!Array.isArray(data.users))data.users=[];
 if(!Array.isArray(data.companies))data.companies=[];
 if(!Array.isArray(data.accountDeletionRequests))data.accountDeletionRequests=[];
 // Step21L: invalidate retired secondary-user sessions; only the principal company account may authenticate.
 const bootSession=read(SESSION,null);if(bootSession?.userId&&bootSession?.companyId&&!data.companies.some(c=>c.id===bootSession.companyId&&c.userId===bootSession.userId)){try{localStorage.removeItem(SESSION);}catch{}}
 // Remove only the retired pre-2.9.8 demo fixture; never touch real accounts.
 const legacyDemoIds=new Set(['demo-1001']);
 const legacyDemoCompanies=new Set(['demo-company-1001']);
 const usersBefore=data.users.length,companiesBefore=data.companies.length;
 data.users=data.users.filter(u=>!(legacyDemoIds.has(u.id)&&u.isDemo));
 data.companies=data.companies.filter(c=>!(legacyDemoCompanies.has(c.id)||legacyDemoIds.has(c.userId)));
 if(data.users.length!==usersBefore||data.companies.length!==companiesBefore)store(STORE,data);
 let planMigration=false;for(const c of data.companies){if(!c.plan||String(c.plan).toLowerCase()==='free'){c.plan='ULTRA';planMigration=true;}}if(planMigration)store(STORE,data);
 // Seed/migrate demo fixtures without touching real user accounts.
 let demoChanged=false;
 const pendingDeletedDemoIds=new Set((data.accountDeletionRequests||[]).filter(r=>r&&r.status==='pending').map(r=>r.userId));
 for(const demo of DEMOS){
  if(pendingDeletedDemoIds.has(demo.id))continue;
  let u=data.users.find(x=>x.id===demo.id||x.phone===demo.phone);
  if(!u){u={id:demo.id,companyId:demo.companyId,phone:demo.phone,name:demo.name,isDemo:true};data.users.push(u);demoChanged=true;}
  else if(u.isDemo){u.id=demo.id;u.companyId=demo.companyId;u.phone=demo.phone;u.name=demo.name;u.isDemo=true;demoChanged=true;}
  let c=data.companies.find(x=>x.id===demo.companyId||x.userId===demo.id);
  const now=new Date(), end=new Date(now);end.setFullYear(end.getFullYear()+1);
  if(!c){c={id:demo.companyId,userId:demo.id};data.companies.push(c);demoChanged=true;}
  Object.assign(c,{id:demo.companyId,userId:demo.id,name:demo.businessName,type:demo.businessType,lockedType:true,plan:demo.plan||'ULTRA',planStartedAt:c.planStartedAt||now.toISOString(),planExpiresAt:c.planExpiresAt||end.toISOString(),isDemo:true,maxPackages:null,maxMembers:null});
 }
 if(demoChanged)store(STORE,data);
 const TYPES=new Map(D.businessTypes.map(t=>[t.id,t]));
 const otpSentAt=new Map();
 let country=D.countries.find(c=>c.iso===localStorage.getItem(COUNTRY))||D.countries[0];
 let step='phone',purpose='register',provider='',phone='',busy=false,sequence=0,controller=null,challenge=null,verified=false,resendTicker=null,autoCountryController=null;
 const error=$('ozAuthError'),note=$('ozAuthNote');
 function message(el,value){if(!el)return;el.textContent=value||'';el.hidden=!value;}
 const setError=s=>message(error,s),setNote=s=>message(note,s);
 const first=s=>String(s||'').trim().split(/\s+/)[0]||'بك';
 async function hash(password,salt){const bytes=new TextEncoder().encode(salt+password);const h=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 const gen=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const userByPhone=n=>data.users.find(u=>u.phone===n&&data.companies.some(c=>c.id===u.companyId&&c.userId===u.id));
 const companyByUser=u=>data.companies.find(c=>c.id===u?.companyId);
 function lockRecord(n){const records=read(LOCKS,{});return records[n]||{failures:0,until:0};}
 function lockLeft(n){return Math.max(0,lockRecord(n).until-Date.now());}
 function failPassword(n){const all=read(LOCKS,{}),old=all[n]||{failures:0,until:0};const failures=(old.until>Date.now()?old.failures:old.until?0:old.failures)+1;all[n]={failures,until:failures>=4?Date.now()+3600000:0};store(LOCKS,all);return all[n];}
 function clearPasswordFailures(n){const all=read(LOCKS,{});delete all[n];store(LOCKS,all);}
 function lockMessage(n){const left=lockLeft(n);return left?'تم إيقاف تسجيل الدخول لهذا الرقم لمدة ساعة بعد 4 محاولات غير صحيحة. المتبقي '+Math.ceil(left/60000)+' دقيقة.':'';}
 function normalizePhone(){let raw=normalize($('ozPhone').value),matched=null;
  if(raw.startsWith('+')){matched=[...D.countries].sort((a,b)=>b.dial.length-a.dial.length).find(c=>raw.startsWith('+'+c.dial));if(matched){raw=raw.slice(matched.dial.length+1);if(country.iso!==matched.iso)chooseCountry(matched.iso,false);}}
  let v=digits(raw);if(v.startsWith('00'+country.dial))v=v.slice(2+country.dial.length);if(v.startsWith(country.dial)&&v.length>country.length)v=v.slice(country.dial.length);if(v.startsWith('0')&&v.length===country.length+1)v=v.slice(1);
  return v;
 }
 function phoneValue(){const n=normalizePhone();if(window.libphonenumber?.parsePhoneNumberFromString){const p=window.libphonenumber.parsePhoneNumberFromString('+'+country.dial+n);return p?.isValid()?p.number:null;}return n.length===country.length?'+'+country.dial+n:null;}
 function updatePhone(){const value=phoneValue();$('ozAuthContinue').disabled=busy||!value;$('ozPhoneHelp').textContent=value?'الصيغة الدولية: '+value:'أدخل رقم هاتف صالحًا للدولة المختارة';}
 function chooseCountry(iso,manual=true){const c=D.countries.find(x=>x.iso===iso);if(!c)return;country=c;if(manual){localStorage.setItem(COUNTRY,c.iso);sequence++;autoCountryController?.abort();}$('ozCountryBtn').innerHTML=`<span>${c.flag}</span><b>+${c.dial}</b><i class="fa-solid fa-chevron-down"></i>`;$('ozCountryName').textContent=c.ar;$('ozPhone').placeholder=c.iso==='YE'?'775253244':`رقم الهاتف (${c.length} أرقام)`;updatePhone();}
 async function detectCountry(){if(localStorage.getItem(COUNTRY))return;const current=sequence;autoCountryController=new AbortController();const timeout=setTimeout(()=>autoCountryController.abort(),COUNTRY_LOOKUP.timeoutMs);try{const r=await fetch(COUNTRY_LOOKUP.url,{signal:autoCountryController.signal,cache:'no-store'});if(!r.ok)return;const countryIso=(await r.json()).country_code;if(current!==sequence||localStorage.getItem(COUNTRY))return;chooseCountry(countryIso,false);}catch{}finally{clearTimeout(timeout)}}
 function renderCountries(){const q=$('ozCountrySearch').value.trim().toLowerCase();const items=D.countries.filter(c=>[c.ar,c.en,c.dial,'+'+c.dial].join(' ').toLowerCase().includes(q));items.sort((a,b)=>Number(b.iso===country.iso)-Number(a.iso===country.iso));$('ozCountryList').innerHTML=items.map(c=>`<button type="button" class="oz-country-row ${c.iso===country.iso?'selected':''}" data-iso="${c.iso}"><span>${c.flag}</span><strong>${esc(c.ar)}<small>${esc(c.en)}</small></strong><b dir="ltr">+${c.dial}</b>${c.iso===country.iso?'<i class="fa-solid fa-check"></i>':''}</button>`).join('')||'<p>لا توجد دولة مطابقة</p>';}
 function closePicker(){$('ozCountryDialog').hidden=true;$('ozCountrySearch').value='';}
 const labels={phone:'متابعة',password:'تسجيل الدخول',otp:'التحقق من الرمز',setup:'إنشاء الحساب',reset:'حفظ كلمة المرور',provider:'متابعة'};
 function setBusy(value,label='جارٍ التحقق...'){
  busy=!!value;const b=$('ozAuthContinue');if(!b)return;
  const spinner=b.querySelector('.oz-auth-spinner');spinner.hidden=!value;b.querySelector('span').textContent=value?label:labels[step];b.setAttribute('aria-busy',String(value));b.disabled=value||(step==='phone'&&!phoneValue());
 }
 function stopFlow(){sequence++;controller?.abort();controller=null;setBusy(false);}
 function setStep(next){step=next;setError('');setNote('');$('ozAuth').dataset.step=next;
  for(const [name,id] of Object.entries({phone:'ozAuthPhoneBlock',password:'ozAuthPasswordBlock',otp:'ozAuthOtpBlock',setup:'ozAuthSetupBlock',reset:'ozAuthResetBlock',provider:'ozAuthProviderBlock'}))$(id).hidden=next!==name;
  $('ozConsentRow').hidden=next!=='setup';$('ozProviderChoices').hidden=next!=='phone';$('ozStepBack').hidden=next==='phone';$('ozAuthContinue').hidden=next==='provider';
  $('ozAuthSub').textContent=({phone:'رقم واحد للبداية، وسنوجّهك للخطوة المناسبة',password:'أدخل كلمة مرور حسابك أو اختر الدخول برمز التحقق',otp:purpose==='login'?'أدخل الرمز للدخول إلى حسابك المحلي':purpose==='reset'?'تحقق من الرقم لإعادة ضبط كلمة المرور':'أدخل رمز التحقق التجريبي',setup:'أكمل بيانات حسابك واختر نوع نشاطك مرة واحدة',reset:'اكتب كلمة مرور جديدة بعد التحقق من الرقم',provider:'اختر طريقة الدخول المناسبة'})[next];
  $('ozAuthShownPhone').textContent=window.MyfntPhone?.display?.(phone)||phone;setBusy(false);
  if(next==='otp')$('ozOtpInput').focus();if(next==='password')$('ozPassword').focus();if(next==='reset')$('ozResetPassword').focus();
 }
 function show(){stopFlow();$('ozPassword').value='';$('ozNewPassword').value='';$('ozOtpInput').value='';$('ozResetPassword').value='';$('ozResetConfirm').value='';$('ozConsent').checked=false;challenge=null;verified=false;phone='';$('ozAuth').hidden=false;document.body.classList.add('oz-auth-open');setStep('phone');updatePhone();}
 function hide(){stopFlow();clearInterval(resendTicker);$('ozAuth').hidden=true;document.body.classList.remove('oz-auth-open');closePicker();}
 function paintChips(host,value,locked=false){const el=$(host);el.dataset.selected=value||'';el.innerHTML=D.businessTypes.map(t=>`<button type="button" class="oz-business-chip" data-business="${t.id}" aria-pressed="${value===t.id}" ${locked?'disabled':''}><i class="fa-solid ${t.icon}"></i>${esc(t.label)}${locked&&t.id===value?' <i class="fa-solid fa-lock"></i>':''}</button>`).join('');}
 function paintProfile(){const s=window.OzanScope?.read(),u=data.users.find(u=>u.id===s?.userId),c=companyByUser(u);if(!u||!c)return;$('ozProfileName').value=u.name||'';$('ozProfileCompany').value=c.name||'';paintChips('ozProfileChips',c.type,true);}
 function renderSession(){const s=window.OzanScope?.read(),u=data.users.find(u=>u.id===s?.userId),phone=window.MyfntPhone?.display?.(s?.phone)||s?.phone||'';if($('ozLoginBtn'))$('ozLoginBtn').innerHTML=s?'<i class="fa-solid fa-user-gear"></i> ملفي الشخصي':'<i class="fa-solid fa-right-to-bracket"></i> تسجيل الدخول';$('ozAuthLogout').hidden=!s;if($('ozRequestDeleteAccount'))$('ozRequestDeleteAccount').hidden=!s;$('ozAccountState').textContent=s?`${u?.name||'المستخدم'} · ${phone} · محفوظ على هذا الجهاز`:'تصفح بحرية، وسجّل الدخول لاستخدام الميزات المتقدمة';$('ozMenuAuthNote').hidden=!!s;if(typeof refreshOzanMenu==='function')refreshOzanMenu();window.OzanJourney?.refresh?.();}
 function reloadWorkspace(){
  if(typeof loadState!=='function')return false;
  const check=window.MyfntFinance?.recoverBeforeLoad?.();
  if(check?.blocked){window.showToast?.('لم يكتمل استرجاع بيانات الحجز. أعد فتح التطبيق قبل التعديل.','warning');return false;}
  loadState();
  if(window.MyfntCustomers && window.MyfntFinance){
   const previousBookings=bookingRepo()?.snapshot?.()||[],previousReceipts=paymentRepo()?.snapshot?.()||[];
   try{
    const result=window.MyfntCustomers.migrate(bookingRepo()?.all?.()||[],paymentRepo()?.all?.()||[]);
    if(result.changed)window.MyfntFinance.commitCustomerMigration();
    if(result.duplicates.length)console.warn('[Myfnt customers] legacy duplicates pending manual review:',result.duplicates.length);
   }catch(error){
    bookingRepo()?.replaceLocal?.(previousBookings,{persist:false});paymentRepo()?.replaceLocal?.(previousReceipts,{persist:false});
    window.MyfntCustomers.invalidate();
    window.showToast?.('تعذّر تحميل دليل العملاء بأمان. أعد فتح التطبيق دون حذف بياناته.','warning');
    console.error('[Myfnt workspace customers]',error);return false;
   }
  }
  if(typeof loadEnhancementStateOnly==='function')loadEnhancementStateOnly();
  window.OzanAdvanced?.reloadWorkspace?.();
  if(typeof renderAll==='function')renderAll();
  if(typeof renderAppIdentity==='function')renderAppIdentity();
  if(typeof refreshOzanMenu==='function')refreshOzanMenu();
  if(typeof renderConnectionStatus==='function')renderConnectionStatus();
  return true;
 }
 async function verifyPassword(u,pass){if(u.isDemo&&!u.passwordHash){const demo=DEMOS.find(d=>d.id===u.id||d.phone===u.phone);return !!demo&&pass===demo.password;}if(u.passwordAlgo==='pbkdf2-v221'){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(u.salt),iterations:210000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')===u.passwordHash;}return (await hash(pass,u.salt))===u.passwordHash;}
 function otpGenerate(n,why){const now=Date.now();if(now-(otpSentAt.get(n)||0)<30000)throw Error('انتظر قبل إعادة إرسال الرمز');const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);const code=String(100000+(bytes[0]%900000));otpSentAt.set(n,now);challenge={phone:n,purpose:why,code,expires:now+300000,lastSend:now,tries:0};return {code,resendAfter:30};}
 function otpHint(sent){$('ozDemoOtp').textContent='وضع التجربة المحلي · رمز التحقق: '+sent.code;$('ozDemoOtp').hidden=false;clearInterval(resendTicker);const until=Date.now()+sent.resendAfter*1000;function update(){const secs=Math.max(0,Math.ceil((until-Date.now())/1000));$('ozResend').disabled=secs>0;$('ozResend').textContent=secs?`إعادة الإرسال خلال ${secs} ث`:'إعادة إرسال الرمز';if(!secs)clearInterval(resendTicker);}update();resendTicker=setInterval(update,1000);}
 async function sendOtp(why){const sent=otpGenerate(phone,why);purpose=why;setStep('otp');otpHint(sent);}
 function otpVerify(code){if(!challenge||challenge.phone!==phone||challenge.purpose!==purpose)throw Error('أعد طلب رمز التحقق');if(Date.now()>challenge.expires)throw Error('انتهت صلاحية رمز التحقق');if(++challenge.tries>5)throw Error('تجاوزت عدد المحاولات. اطلب رمزًا جديدًا');if(digits(code)!==challenge.code)throw Error('رمز التحقق غير صحيح');challenge=null;verified=true;}
 function logIn(u,kind='login'){
  if(!u||!companyByUser(u))throw Error('تعذر العثور على مساحة العمل المرتبطة بالحساب');
  const storedDeviceName=String(localStorage.getItem('myfnt.device.name.v1')||'').trim();const autoDeviceName=/Android/i.test(navigator.userAgent)?'هاتف Android':/iPhone|iPad/i.test(navigator.userAgent)?'iPhone / iPad':/Windows/i.test(navigator.userAgent)?'كمبيوتر Windows':'هذا الجهاز';const deviceId=localStorage.getItem('myfnt.device.id.v1')||gen();try{localStorage.setItem('myfnt.device.id.v1',deviceId);}catch{}const session={userId:u.id,companyId:u.companyId,phone:u.phone,token:gen(),sessionId:gen(),deviceId,deviceName:storedDeviceName||autoDeviceName,createdAt:Date.now(),lastSeenAt:Date.now(),expires:Date.now()+7*86400000,demo:true};
  store(SESSION,session);store(POST,{kind,userId:u.id,time:Date.now()});
  $('ozPassword').value='';$('ozNewPassword').value='';$('ozResetPassword').value='';hide();
  // Full reload resets all per-workspace JS state, notifications, and stale account closures.
  location.reload();
 }
 async function submit(){if(busy)return;const current=step;if(current==='provider')return;
  if(current==='phone'){const parsed=phoneValue();if(!parsed){setError('راجع رقم الهاتف');return;}phone=parsed;}
  const id=++sequence;controller?.abort();controller=new AbortController();setBusy(true,current==='phone'?'جارٍ فحص الحساب...':current==='password'?'جارٍ تسجيل الدخول...':current==='otp'?'جارٍ التحقق...':'جارٍ حفظ البيانات...');setError('');
  try{await new Promise(resolve=>setTimeout(resolve,210));if(id!==sequence)return;
   if(current==='phone'){if(userByPhone(phone)){setStep('password');const m=lockMessage(phone);if(m)setError(m);}else await sendOtp('register');}
   else if(current==='password'){
    const m=lockMessage(phone);if(m)throw Error(m);
    const password=$('ozPassword').value;if(!password)throw Error('أدخل كلمة المرور');const u=userByPhone(phone);
    if(!u||!(await verifyPassword(u,password))){const item=failPassword(phone);throw Error(item.until?lockMessage(phone):'كلمة المرور غير صحيحة. تبقى '+(4-item.failures)+' محاولات قبل الإيقاف المؤقت.');}
    if(id!==sequence)return;clearPasswordFailures(phone);logIn(u);
   }
   else if(current==='otp'){if(digits($('ozOtpInput').value).length!==6)throw Error('أدخل رمزًا من ستة أرقام');otpVerify($('ozOtpInput').value);$('ozOtpInput').value='';$('ozDemoOtp').hidden=true;if(purpose==='login'){if(lockLeft(phone))throw Error(lockMessage(phone));logIn(userByPhone(phone));}else if(purpose==='reset'){setStep('reset');}else{setStep('setup');}}
   else if(current==='reset'){
    if(!verified||purpose!=='reset')throw Error('تحقق من رقمك أولًا');const pass=$('ozResetPassword').value;if(pass.length<7||pass!==$('ozResetConfirm').value)throw Error('كلمة المرور 7 أحرف على الأقل ويجب أن يتطابق الحقلان');const u=userByPhone(phone);if(!u)throw Error('الحساب غير موجود');u.salt=gen();u.passwordHash=await hash(pass,u.salt);store(STORE,data);clearPasswordFailures(phone);verified=false;logIn(u);
   }
   else if(current==='setup'){
    if(!verified||purpose!=='register')throw Error('التحقق من رقم الهاتف مطلوب');
    const name=$('ozPersonName').value.trim(),businessName=$('ozBusinessName').value.trim(),type=$('ozBusinessType').value,pass=$('ozNewPassword').value;
    if(!name||!businessName||!TYPES.has(type)||pass.length<7)throw Error('أكمل الاسم واسم النشاط ونوعه، واستخدم كلمة مرور من 7 أحرف على الأقل');
    if(!$('ozConsent').checked)throw Error('يجب الموافقة على سياسة الخصوصية وشروط الاستخدام لإكمال التسجيل');
    if(userByPhone(phone))throw Error('رقم الهاتف مسجل بالفعل');
    const userId=gen(),companyId=gen(),salt=gen();const u={id:userId,companyId,phone,name,isDemo:false,localRole:'owner',salt,passwordHash:await hash(pass,salt),privacyAcceptedAt:new Date().toISOString(),termsAcceptedAt:new Date().toISOString(),dataProcessingAcceptedAt:new Date().toISOString(),legalConsentVersion:'2026-10-03'};
    data.users.push(u);data.companies.push({id:companyId,userId,name:businessName,type,lockedType:true,plan:'ULTRA',planStartedAt:new Date().toISOString(),planExpiresAt:new Date(Date.now()+365*86400000).toISOString(),createdAt:Date.now(),maxPackages:null,maxMembers:null});store(STORE,data);verified=false;logIn(u,'new');
   }
  }catch(e){if(id===sequence)setError(e?.message||'تعذر تنفيذ العملية');}
  finally{if(id===sequence)setBusy(false);}
 }
 function readLockOnReturn(){const m=lockMessage(phone);if(m)setError(m)}
 function openProvider(name){stopFlow();provider=name;setStep('provider');$('ozProviderSymbol').textContent=name==='google'?'G':'●';$('ozProviderTitle').textContent=name==='google'?'الدخول بواسطة Google':'الدخول بواسطة Apple';
  const enabled=!!window.OZAN_OAUTH?.[name]?.startUrl;
  $('ozProviderMessage').textContent=enabled?'ستنتقل إلى موفّر الهوية لإتمام المصادقة عبر خادم معتمد.':'لإتمام تسجيل دخول حقيقي عبر '+(name==='google'?'Google':'Apple')+' يلزم معرّف تطبيق موثّق وخادم OAuth. هذه النسخة محلية؛ يمكنك اختبار الواجهة باستخدام حساب مايفنت التجريبي دون الادعاء بأنه حساب '+(name==='google'?'Google':'Apple')+'.';
  $('ozProviderStart').hidden=!enabled;$('ozProviderDemo').hidden=enabled;
 }
 async function afterLogin(){const s=window.OzanScope?.renewDemoSession?.()||window.OzanScope?.read();if(!s)return;const post=read(POST,null);if(!post||post.userId!==s.userId||Date.now()-post.time>20000){localStorage.removeItem(POST);return;}
  localStorage.removeItem(POST);const u=data.users.find(x=>x.id===s.userId),c=companyByUser(u);if(!u||!c)return;
  if(post.kind==='new'){await applyCompany(c);$('ozWelcomeName').textContent=c.name;$('ozSetupWelcome').hidden=false;}
  else{
   if(window.MyfntBootstrap?.enabled?.()){window.MyfntBootstrap.startAfterLogin?.();return;}
   const panel=$('ozLocalSync');$('ozSyncName').textContent='أهلًا بعودتك، '+first(u.name);$('ozSyncStatus').textContent='جارٍ قراءة حجوزاتك وإعداداتك المحلية...';panel.hidden=false;$('ozSyncDone').disabled=true;
   requestAnimationFrame(()=>requestAnimationFrame(()=>{const loaded=reloadWorkspace();$('ozSyncStatus').textContent=loaded?`تم تحميل ${bookingRepo()?.all?.().length||0} حجز وباقاتك وإعداداتك وإشعاراتك الخاصة بهذا الحساب على الجهاز. لا توجد مزامنة بين الأجهزة دون خادم.`:'تحتاج مساحة العمل إلى استرجاع آمن للبيانات؛ أعد فتح التطبيق دون مسح بيانات المتصفح.';$('ozSyncDone').disabled=!loaded;window.OzanJourney?.refresh?.();}));
  }
 }
 async function applyCompany(c){if(!c||localStorage.getItem('ozan.onboarded.'+c.id)==='1')return;
  if(!settingsRepo()||!packageRepo()||!bookingRepo())return;
  const oldProfile=settingsRepo().get('company')||{},oldName=String(oldProfile.name||'').trim();
  const preserveExisting=Boolean((bookingRepo().all?.()||[]).length||(packageRepo().all?.()||[]).some(p=>p.price>0||p.seasonPrice>0));
  const companyName=!oldName||oldName==='ماي بوك برو للمناسبات'||oldName==='مايفنت'?c.name:oldName;
  await settingsRepo().mutateDurable(cfg=>{cfg.company={...oldProfile,name:companyName,phone:oldProfile.phone||data.users.find(u=>u.id===c.userId)?.phone||'',phone2:oldProfile.phone2||'',description:oldProfile.description||TYPES.get(c.type)?.description||`نشاط: ${TYPES.get(c.type)?.label||''}`,addresses:oldProfile.addresses||'الجمهورية اليمنية صنعاء',receiptNotes:oldProfile.receiptNotes||''};},{profileEvent:false});
  if(!preserveExisting){
   const defs=TYPES.get(c.type)?.packages||[];
   packageRepo().replaceLocal(defs.map((entry,i)=>{const item=typeof entry==='string'?{name:entry,icon:'fa-star'}:entry;return {id:'p'+(i+1),name:item.name,icon:item.icon||'fa-star',price:0,seasonPrice:0,deposit:0,status:'active',builtIn:true,allowDoubleBooking:false,allowDiscount:true};}),{persist:false,reconcile:false});
   const seeded=await window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});if(!seeded)throw Error('تعذر تثبيت باقات البداية في IndexedDB');
   try{savePackages();}catch(error){console.warn('[onboarding package shadow]',error);}
  }
  renderAll?.();renderAppIdentity?.();localStorage.setItem('ozan.onboarded.'+c.id,'1');
 }
 const required=['ozAuth','ozAuthForm','ozPhone','ozAuthContinue','ozLoginBtn'];const missing=required.filter(id=>!$(id));if(missing.length){console.error('[OZAN/Auth] عناصر واجهة أساسية غير موجودة: '+missing.join(', '));return;}
 // Events
 $('ozLoginBtn')?.addEventListener('click',()=>{if(window.OzanScope?.read()){window.OzanProfilePage?.open?.();paintProfile();}else show();});
 $('ozAuthDismiss')?.addEventListener('click',hide);$('ozAuth')?.addEventListener('click',e=>{if(e.target===$('ozAuth'))hide();});$('ozAuthForm')?.addEventListener('submit',e=>{e.preventDefault();submit();});
 $('ozStepBack')?.addEventListener('click',()=>{stopFlow();if(step==='setup')setStep('otp');else if(step==='reset')setStep('otp');else setStep('phone');});
 $('ozPhone')?.addEventListener('input',()=>{stopFlow();updatePhone();});
 for(const [id,input] of [['ozPasswordEye','ozPassword'],['ozNewPasswordEye','ozNewPassword']])$(id)?.addEventListener('click',()=>{const el=$(input);el.type=el.type==='password'?'text':'password';});
 $('ozCountryBtn')?.addEventListener('click',()=>{$('ozCountryDialog').hidden=false;renderCountries();$('ozCountrySearch').focus();});$('ozCountrySearch')?.addEventListener('input',renderCountries);
 $('ozCountryList')?.addEventListener('click',e=>{const b=e.target.closest('[data-iso]');if(!b)return;const previous=normalizePhone();chooseCountry(b.dataset.iso);$('ozPhone').value=previous;updatePhone();closePicker();if(!phoneValue())setError('راجع الرقم المحلي للدولة الجديدة');});
 $('ozCountryDismiss')?.addEventListener('click',closePicker);$('ozCountryDialog')?.addEventListener('click',e=>{if(e.target===$('ozCountryDialog'))closePicker();});
 $('ozForgot')?.addEventListener('click',()=>{if(!userByPhone(phone)){setError('لا يوجد حساب محلي بهذا الرقم');return;}stopFlow();try{sendOtp('reset')}catch(e){setError(e.message)}});
 $('ozOtpLogin')?.addEventListener('click',()=>{if(lockLeft(phone)){setError(lockMessage(phone));return;}if(!userByPhone(phone)){setError('لا يوجد حساب محلي بهذا الرقم');return;}stopFlow();try{sendOtp('login')}catch(e){setError(e.message)}});
 $('ozResend')?.addEventListener('click',()=>{if($('ozResend').disabled||busy)return;try{otpHint(otpGenerate(phone,purpose));setError('')}catch(e){setError(e.message)}});
 $('ozGoogle')?.addEventListener('click',()=>openProvider('google'));$('ozApple')?.addEventListener('click',()=>openProvider('apple'));
 $('ozProviderStart')?.addEventListener('click',()=>{const url=window.OZAN_OAUTH?.[provider]?.startUrl;if(!url)return;try{const target=new URL(url,location.href);if(target.origin!==location.origin||target.protocol!=='https:')throw Error();location.assign(target.href);}catch{setError('عنوان موفّر المصادقة غير آمن أو لم يُضبط بعد')}});
 $('ozProviderDemo')?.addEventListener('click',()=>{phone=PRIMARY_DEMO?.phone||'';chooseCountry('YE',false);$('ozPhone').value=phone.replace(/^\+967/,'');stopFlow();setStep('password');setNote('للتجربة المحلية: أدخل كلمة المرور الخاصة بحساب الاختبار. هذا ليس دخولًا بواسطة '+(provider==='google'?'Google':'Apple')+'.');});
 $('ozBusinessChips')?.addEventListener('click',e=>{const chip=e.target.closest('[data-business]');if(!chip)return;$('ozBusinessType').value=chip.dataset.business;paintChips('ozBusinessChips',chip.dataset.business)});
 $('ozConsent')?.addEventListener('change',()=>{if($('ozConsent').checked&&step==='setup')setError('');});
 $('ozPrivacyLink')?.addEventListener('click',()=>openLegal('privacy'));$('ozTermsLink')?.addEventListener('click',()=>openLegal('terms'));
 function openLegal(type){const url=type==='terms'?'./terms.html':'./privacy.html';window.open(url,'_blank','noopener,noreferrer');}
 $('ozPrivacyClose')?.addEventListener('click',()=>{$('ozPrivacyDialog').hidden=true;});
 $('ozAccountClose')?.addEventListener('click',()=>{window.OzanProfilePage?.close?.();});
 $('ozProfileSave')?.addEventListener('click',()=>{const s=window.OzanScope?.read(),u=data.users.find(x=>x.id===s?.userId),c=companyByUser(u);if(!u||!c)return;const n=$('ozProfileName').value.trim(),company=$('ozProfileCompany').value.trim();if(!n||!company){showToast?.('الاسم واسم النشاط مطلوبان','warning');return;}u.name=n;c.name=company;store(STORE,data);settingsRepo()?.mutate?.(cfg=>{cfg.company.name=company;});renderAppIdentity();renderSession();window.OzanJourney?.refresh?.();paintProfile();showToast?.('تم تحديث الملف الشخصي');});
 $('ozProfileSettings')?.addEventListener('click',()=>{window.OzanProfilePage?.close?.();openWindow('companySettingsWindow');fillCompanyForm?.();});
 $('ozProfileBackup')?.addEventListener('click',()=>{window.OzanProfilePage?.close?.();openWindow('backupCenterWindow');});
 async function requestAccountDeletion(){
  const session=window.OzanScope?.read(),user=data.users.find(x=>x.id===session?.userId),company=data.companies.find(x=>x.id===session?.companyId);if(!session||!user||!company)return showToast?.('لا توجد جلسة حساب صالحة','warning');
  const ok=await (window.ozConfirm?.('سيتم إنشاء طلب حذف لحساب الدخول ثم تسجيل خروجك. لن تُحذف بيانات الشركة أو الحجوزات أو السندات. هل تريد المتابعة؟',{title:'طلب حذف حسابي',confirmLabel:'إنشاء الطلب وحذف الحساب',danger:true})??Promise.resolve(confirm('حذف حساب الدخول بدون حذف بيانات الشركة؟')));if(!ok)return;
  const req={id:crypto.randomUUID(),companyId:company.id,userId:user.id,sessionId:session.sessionId||'',phone:user.phone||session.phone||'',status:'pending',requestedAt:new Date().toISOString(),preserveCompanyData:true};data.accountDeletionRequests.push(req);
  company.accountDeletionRequestedAt=req.requestedAt;company.deletedAccountId=user.id;company.userId='';
  data.users=data.users.filter(x=>x.id!==user.id);store(STORE,data);try{await window.MyfntLocal?.setUiMeta?.(`account-deletion-request:${req.id}`,req);}catch{}
  localStorage.removeItem(SESSION);localStorage.removeItem(POST);showToast?.('تم إنشاء طلب حذف الحساب. بيانات الشركة بقيت محفوظة.');setTimeout(()=>location.reload(),250);
 }
 $('ozAuthLogout')?.addEventListener('click',()=>{localStorage.removeItem(SESSION);localStorage.removeItem(POST);location.reload();});
 $('ozRequestDeleteAccount')?.addEventListener('click',()=>requestAccountDeletion().catch(e=>showToast?.(e.message||'تعذر إنشاء طلب حذف الحساب','warning')));
 $('ozWelcomeContinue')?.addEventListener('click',()=>{$('ozSetupWelcome').hidden=true;fillCompanyForm?.();openWindow('companySettingsWindow');});$('ozWelcomeSkip')?.addEventListener('click',()=>{$('ozSetupWelcome').hidden=true;window.OzanJourney?.refresh?.();setTimeout(()=>window.OzanJourney?.showTour?.(),450);});
 $('ozSyncDone')?.addEventListener('click',()=>{$('ozLocalSync').hidden=true;window.OzanJourney?.refresh?.();setTimeout(()=>window.OzanJourney?.showTour?.(),450);});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('ozPrivacyDialog').hidden){$('ozPrivacyDialog').hidden=true;return}if(!$('ozCountryDialog').hidden){closePicker();return}if(!$('ozAuth').hidden)hide();});
 let hadSession=Boolean(window.OzanScope?.read());
 window.addEventListener('storage',e=>{if([SESSION,STORE].includes(e.key))location.reload();});
 setInterval(()=>{if(hadSession){const s=window.OzanScope?.renewDemoSession?.()||window.OzanScope?.read();if(!s)location.reload();}else hadSession=Boolean(window.OzanScope?.read());},SESSION_CHECK_MS);
 document.addEventListener('DOMContentLoaded',async()=>{try{if(window.OzanScope?.read()){const s=window.OzanScope.read(),u=data.users.find(u=>u.id===s.userId),c=companyByUser(u);if(c&&localStorage.getItem('ozan.onboarded.'+c.id)!=='1')await applyCompany(c);}renderSession();await afterLogin();}catch(error){console.error('[auth canonical onboarding]',error);showToast?.('تعذر تثبيت إعدادات بدء الحساب في التخزين الدائم','warning');}});
 chooseCountry(country.iso,false);paintChips('ozBusinessChips','');paintChips('ozProfileChips','',true);setStep('phone');renderSession();detectCountry();
 window.OzanAuth={open:show,session:()=>window.OzanScope?.read()||null,data,lockLeft,authMode:'local-demo',
  async changeLocalPassword(oldPass,newPass){const session=window.OzanScope?.read();const user=data.users.find(x=>x.id===session?.userId);if(!user)throw Error('يرجى تسجيل الدخول');if(!await verifyPassword(user,oldPass))throw Error('كلمة المرور الحالية غير صحيحة');if(typeof newPass!=='string'||newPass.length<12)throw Error('كلمة المرور الجديدة أقل من 12 حرفًا');user.salt=gen();user.passwordHash=await hash(newPass,user.salt);delete user.passwordAlgo;user.isDemo=false;store(STORE,data);}
 };
})();
