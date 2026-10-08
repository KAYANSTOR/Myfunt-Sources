/* Myfnt 2.14.8 — communication policy using canonical recipient/channel resolver. */
'use strict';
(()=>{
 const q=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const scope=()=>window.OzanScope?.read?.();
 const repo=n=>window.MyfntRepositories?.[n];
 const EVENTS=Object.freeze(window.MyfntEventRegistry?.communicationEvents?.()||[]);
 if(!EVENTS.length)console.error('[communication policy] Event Registry is unavailable; communication events are disabled for safety.');
 const EVENT_MAP=new Map(EVENTS.map(x=>[x.code,x]));
 const roleLabels={owner:'المالك',manager:'مدير',accountant:'محاسب'};

 const SMS_GATEWAY_DEFAULT='https://sms.arsi.fun/api/sms';
 function gatewayUsers(){return companyMembers(['owner','manager','accountant']);}
 function gatewayMetaKey(userId){return `sms-gateway:${String(userId||'')}`;}
 async function getGatewayProfile(userId){
  const raw=await window.MyfntLocal?.getUiMeta?.(gatewayMetaKey(userId));
  const value=raw&&typeof raw==='object'?raw:{};
  return {provider:'arsi_sms',endpoint:String(value.endpoint||SMS_GATEWAY_DEFAULT),deviceId:String(value.deviceId||''),simSubscriptionId:String(value.simSubscriptionId||''),hasSecret:!!value.secret,secret:String(value.secret||''),updatedAt:value.updatedAt||null};
 }
 async function saveGatewayProfile(userId,{endpoint,deviceId,simSubscriptionId,secret}){
  if(!userId)throw Error('اختر المستخدم المرتبط بالبوابة');
  endpoint=String(endpoint||'').trim();deviceId=String(deviceId||'').trim();simSubscriptionId=String(simSubscriptionId||'').trim();secret=String(secret||'').trim();
  if(!/^https:\/\//i.test(endpoint))throw Error('رابط البوابة يجب أن يبدأ بـ https://');
  if(!/^\d+$/.test(deviceId)||Number(deviceId)<1)throw Error('معرف الجهاز غير صالح');
  if(!/^\d+$/.test(simSubscriptionId)||Number(simSubscriptionId)<1)throw Error('معرف الشريحة غير صالح');
  const prev=await getGatewayProfile(userId);const finalSecret=secret||prev.secret;
  if(!finalSecret)throw Error('أدخل المفتاح السري للبوابة');
  const value={provider:'arsi_sms',endpoint,deviceId,simSubscriptionId,secret:finalSecret,updatedAt:new Date().toISOString(),localOnlySecret:true};
  await window.MyfntLocal?.setUiMeta?.(gatewayMetaKey(userId),value);return {...value,hasSecret:true,secret:''};
 }
 async function fillGatewayForm(userId){
  const profile=await getGatewayProfile(userId),host=q('mfGatewayStatus');
  const endpoint=q('mfGatewayEndpoint'),device=q('mfGatewayDeviceId'),sim=q('mfGatewaySimId'),secret=q('mfGatewaySecret');
  if(endpoint)endpoint.value=profile.endpoint;if(device)device.value=profile.deviceId;if(sim)sim.value=profile.simSubscriptionId;if(secret){secret.value='';secret.placeholder=profile.hasSecret?'•••••••• محفوظ لهذا المستخدم':'ألصق المفتاح السري';}
  if(host){host.className=`mf-gateway-status ${profile.hasSecret&&profile.deviceId&&profile.simSubscriptionId?'is-ready':'is-empty'}`;host.innerHTML=profile.hasSecret&&profile.deviceId&&profile.simSubscriptionId?'<i class="fa-solid fa-circle-check"></i><span>البوابة مهيأة محليًا لهذا المستخدم</span>':'<i class="fa-regular fa-circle"></i><span>لم تكتمل تهيئة البوابة لهذا المستخدم</span>';}
 }
 function renderGatewaySection(){const users=gatewayUsers(),selected=users[0]?.userId||'';return `<section class="mf-comms-section mf-gateway-section"><div class="mf-comms-section-head"><div><strong>بوابة SMS</strong><small>بوابة مرتبطة بالحساب الرئيسي. إعداد الجهاز الحالي يدير الربط، والمفتاح السري لا يدخل إعدادات الشركة أو طابور المزامنة.</small></div><span class="mf-gateway-provider">ARSI SMS</span></div><div class="mf-gateway-grid"><label class="mf-gateway-field mf-gateway-field--user"><span>الحساب</span><select id="mfGatewayUser">${users.map(u=>`<option value="${esc(u.userId)}">${esc(u.name)} · ${esc(roleLabels[u.role]||u.role)}</option>`).join('')}</select></label><label class="mf-gateway-field mf-gateway-field--wide"><span>رابط API</span><input id="mfGatewayEndpoint" type="url" inputmode="url" autocomplete="off" value="${esc(SMS_GATEWAY_DEFAULT)}" placeholder="https://sms.arsi.fun/api/sms"></label><label class="mf-gateway-field"><span>Device ID</span><input id="mfGatewayDeviceId" type="number" min="1" step="1" inputmode="numeric" placeholder="1"></label><label class="mf-gateway-field"><span>SIM Subscription ID</span><input id="mfGatewaySimId" type="number" min="1" step="1" inputmode="numeric" placeholder="1"></label><label class="mf-gateway-field mf-gateway-field--wide"><span>المفتاح السري</span><input id="mfGatewaySecret" type="password" autocomplete="new-password" placeholder="ألصق المفتاح السري"><small>في النسخة الحالية يُحفظ محليًا لهذا الجهاز فقط. عند Laravel سيُنقل إلى الخادم ويُخزن مشفرًا ولا يعود إلى المتصفح.</small></label></div><div class="mf-gateway-actions"><div id="mfGatewayStatus" class="mf-gateway-status is-empty"><i class="fa-regular fa-circle"></i><span>جاري قراءة الإعداد...</span></div><button id="mfGatewayValidate" type="button" class="secondary-btn"><i class="fa-solid fa-shield-halved"></i><span>فحص الإعداد</span></button><button id="mfGatewaySave" type="button" class="primary-btn"><i class="fa-solid fa-key"></i><span>حفظ الربط</span></button></div><p class="mf-gateway-security"><i class="fa-solid fa-lock"></i><span>لن يتم تنفيذ طلب SMS مباشر من المتصفح. مستقبلًا يرسل Myfnt طلبًا إلى Laravel، وLaravel وحده يضيف Authorization Bearer ويرسل إلى البوابة.</span></p></section>`;}
 function settings(){return repo('settings')?.get?.()||state?.settings||{};}
 function companyPolicy(){
  const s=settings(),cur=s.communication&&typeof s.communication==='object'?s.communication:{};
  const events={};
  for(const e of EVENTS){const saved=cur.events?.[e.code]||{},legacy=String(saved.template||'');events[e.code]={enabled:saved.enabled!==false,inApp:saved.inApp??e.defaults.inApp,sms:saved.sms??e.defaults.sms,client:saved.client??e.defaults.client,urgent:saved.urgent??e.defaults.urgent,roles:Array.isArray(saved.roles)?saved.roles:[...e.defaults.roles],inAppTemplate:String(saved.inAppTemplate??legacy),staffTemplate:String(saved.staffTemplate??legacy),clientTemplate:String(saved.clientTemplate??legacy)};}
  const preferred=String(cur.preferredSendTime||s.company?.notifyTime||'09:00');
  const stagger=Number(cur.staggerSeconds||12);
  const messageNumbers=window.MyfntRecipientResolver?.all?.()||[];
  return {enabled:cur.enabled!==false,requireExplicitSend:cur.requireExplicitSend!==false,preferredSendTime:/^([01]\d|2[0-3]):[0-5]\d$/.test(preferred)?preferred:'09:00',staggerSeconds:[5,10,12,15,20,30,60].includes(stagger)?stagger:12,urgentBypass:cur.urgentBypass!==false,quietStart:String(cur.quietStart||'22:00'),quietEnd:String(cur.quietEnd||'08:00'),messageNumbers,events};
 }
 function savePolicy(next){
  const resolver=window.MyfntRecipientResolver,check=resolver?.validate?.(next.messageNumbers||[])||{ok:true,rows:next.messageNumbers||[]};
  const numberGate=window.MyfntFeatureGate?.checkCount?.('message_numbers_limit',0,{delta:check.rows.length,message:'عدد أرقام الرسائل يتجاوز الحد المسموح في خطتك'});if(numberGate&&!numberGate.ok)throw Error(numberGate.message);
  if(!check.ok)throw Error(check.invalid?.length?'يوجد رقم رسائل غير صالح':'لا يمكن تكرار نفس الرقم على نفس القناة');
  next.messageNumbers=check.rows;
  repo('settings')?.mutate?.(s=>{s.communication=structuredClone(next);s.company=s.company||{};s.company.sms=check.rows.find(x=>x.active&&x.channel==='sms')?.phone||'';s.company.whatsapp=check.rows.find(x=>x.active&&x.channel==='whatsapp')?.phone||'';s.company.notifyTime=next.preferredSendTime||s.company.notifyTime||'09:00';});
  document.dispatchEvent(new CustomEvent('myfnt:communication-policy-changed',{detail:{companyId:scope()?.companyId||null}}));
 }
 function companyMembers(roles=['owner','manager','accountant']){
  const s=scope(),data=window.OzanAuth?.data;if(!s||!data)return [];
  const company=data.companies?.find(c=>c.id===s.companyId),u=(data.users||[]).find(x=>x.id===company?.userId&&x.companyId===s.companyId);if(!u||!roles.includes('owner'))return [];return [{kind:'staff',userId:u.id,role:'owner',name:u.name||'الحساب الرئيسي',phone:String(u.phone||'').replace(/[^\d+]/g,'')}];
 }
 function memberRecipients(roles=[]){return window.MyfntRecipientResolver?.company?.('sms')||[];}
 function recipientUserIds(roles=[]){const id=String(scope()?.userId||'');return id?[id]:[];} // Single-principal mode: all device sessions of the company share the same principal id.
 function clientRecipient(booking){return window.MyfntRecipientResolver?.client?.(booking,'sms')||null;}
 function eventDayName(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return '';try{return new Intl.DateTimeFormat('ar-YE',{timeZone:ZONE,weekday:'long'}).format(new Date(`${date}T12:00:00+03:00`));}catch{return '';}}
 function eventLongDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return String(date||'');try{return new Intl.DateTimeFormat('ar-YE',{timeZone:ZONE,weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date(`${date}T12:00:00+03:00`));}catch{return String(date||'');}}
 const VARIABLE_CATALOG=Object.freeze([
  {key:'name',hash:'اسم_العميل',label:'اسم العميل',group:'العميل'},
  {key:'phone',hash:'رقم_العميل',label:'رقم العميل',group:'العميل'},
  {key:'number',hash:'رقم_الحجز',label:'رقم الحجز',group:'الحجز'},
  {key:'date',hash:'تاريخ_المناسبة',label:'تاريخ المناسبة',group:'المناسبة'},
  {key:'day',hash:'يوم_المناسبة',label:'اسم يوم المناسبة',group:'المناسبة'},
  {key:'event_date',hash:'موعد_المناسبة',label:'اليوم + تاريخ المناسبة',group:'المناسبة'},
  {key:'time',hash:'وقت_المناسبة',label:'وقت المناسبة',group:'المناسبة'},
  {key:'package',hash:'نوع_الباقة',label:'نوع الباقة',group:'الحجز'},
  {key:'event_type',hash:'نوع_المناسبة',label:'نوع المناسبة',group:'المناسبة'},
  {key:'amount',hash:'اجمالي_السعر',label:'إجمالي السعر',group:'المالية'},
  {key:'payment_amount',hash:'قيمة_الدفعة',label:'قيمة الدفعة الحالية',group:'المالية'},
  {key:'paid',hash:'المدفوع',label:'إجمالي المدفوع',group:'المالية'},
  {key:'remaining',hash:'المتبقي',label:'المبلغ المتبقي',group:'المالية'},
  {key:'receipt',hash:'رقم_السند',label:'رقم السند',group:'المالية'},
  {key:'company',hash:'اسم_الشركة',label:'اسم الشركة',group:'الشركة'},
  {key:'company_phone1',hash:'هاتف_الشركة_1',label:'هاتف الشركة 1',group:'الشركة'},
  {key:'company_phone2',hash:'هاتف_الشركة_2',label:'هاتف الشركة 2',group:'الشركة'},
  {key:'today_date',hash:'تاريخ_اليوم',label:'تاريخ اليوم',group:'الوقت'},
  {key:'today_day',hash:'يوم_اليوم',label:'اسم يوم اليوم',group:'الوقت'},
  {key:'current_time',hash:'الوقت_الحالي',label:'الوقت الحالي',group:'الوقت'},
  {key:'message',hash:'النص',label:'النص المخصص',group:'أخرى'}
 ]);
 const HASH_TOKEN_MAP=Object.freeze(Object.fromEntries(VARIABLE_CATALOG.map(x=>[x.hash,x.key])));
 const HASH_TOKEN_RE=new RegExp('#('+Object.keys(HASH_TOKEN_MAP).sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|\[\]\\]/g,'\\$&')).join('|')+')','g');
 function vars(ctx={}){
  const b=ctx.booking||{},r=ctx.payment||{},company=settings().company||{},remaining=Math.max(0,Number(b.amount||0)-Number(b.paid||0)),date=String(b.date||''),now=new Date(),today=zoneDay(now.getTime()),time=b.hasTime?[b.timeFrom,b.timeTo].filter(Boolean).join(' - '):String(b.timeFrom||'');
  return {name:b.name||ctx.customer?.name||'',phone:window.MyfntPhone?.display?.(b.phone||ctx.customer?.phone)||b.phone||ctx.customer?.phone||'',number:b.bookingNo||b.id||'',date,day:eventDayName(date),event_date:eventLongDate(date),time,package:b.type||b.packageName||'',event_type:b.eventType||b.occasionType||'',amount:Number(b.amount??0).toLocaleString('en-US'),payment_amount:Number(r.amount??0).toLocaleString('en-US'),paid:Number(b.paid||0).toLocaleString('en-US'),remaining:remaining.toLocaleString('en-US'),receipt:r.receiptNo||r.movementNo||r.id||'',company:company.name||'مايفنت',company_phone1:window.MyfntPhone?.display?.(company.phone)||company.phone||'',company_phone2:window.MyfntPhone?.display?.(company.phone2)||company.phone2||'',today_date:today,today_day:eventDayName(today),current_time:new Intl.DateTimeFormat('ar-YE',{timeZone:ZONE,hour:'2-digit',minute:'2-digit'}).format(now),message:String(ctx.message||'')};
 }
 const DEFAULT_INAPP_TEMPLATES={
  'booking.created':'تم إنشاء حجز #{number} للعميل {name} · {event_date} · {package}.',
  'booking.updated':'تم تحديث الحجز #{number} للعميل {name} · {event_date}.',
  'booking.cancelled':'تم إلغاء الحجز #{number} للعميل {name}.',
  'payment.created':'تم تسجيل دفعة {payment_amount} للحجز #{number}. المتبقي {remaining}.',
  'customer.created':'تم إنشاء ملف عميل جديد: {name}.',
  'event.approaching':'تذكير بالحجز #{number} · {event_date} · {package}.',
  'balance.remaining':'المتبقي على الحجز #{number}: {remaining}.',
  'custom.alert':'{message}',
  'payment.voided':'تم إلغاء حركة مالية مرتبطة بالحجز #{number}.',
  'message.failed':'تعذر إرسال رسالة مرتبطة بالحجز #{number}.'
 };
 const DEFAULT_STAFF_TEMPLATES={
  'booking.created':'حجز جديد #{number}\n{event_date}\nالباقة: {package}\nالإجمالي: {amount}\nالمدفوع: {paid}\nالمتبقي: {remaining}',
  'booking.updated':'تم تعديل الحجز #{number} · {event_date} · {package}.',
  'booking.cancelled':'تم إلغاء الحجز #{number} للعميل {name} · {event_date}.',
  'payment.created':'دفعة جديدة للحجز #{number} · قيمة الدفعة {payment_amount} · المدفوع {paid} · المتبقي {remaining}.',
  'customer.created':'تم إنشاء عميل جديد: {name}.',
  'event.approaching':'تذكير مناسبة: {event_date} · الحجز #{number} · {package}.',
  'balance.remaining':'المتبقي على الحجز #{number}: {remaining}.',
  'custom.alert':'{message}',
  'payment.voided':'تم إلغاء حركة مالية مرتبطة بالحجز #{number}.',
  'message.failed':'تعذر إرسال رسالة مرتبطة بالحجز #{number}.'
 };
 const DEFAULT_CLIENT_TEMPLATES={
  'booking.created':'من {company}، تم تأكيد حجزكم بتاريخ {event_date}. الباقة: {package}. الإجمالي {amount}، المدفوع {paid}، المتبقي {remaining}.',
  'booking.updated':'من {company}، تم تحديث حجزكم #{number} بتاريخ {event_date}.',
  'booking.cancelled':'من {company}، تم إلغاء حجزكم #{number}.',
  'payment.created':'من {company}، تم استلام دفعة {payment_amount} للحجز #{number}. المتبقي {remaining}.',
  'event.approaching':'تذكير من {company}: موعد مناسبتكم {event_date}. الباقة: {package}.',
  'custom.alert':'{message}'
 };
 const TOKEN_RE=/\{([a-z_]+)\}/g;
 function formatTemplate(code,template,ctx,kind='inApp'){const data=vars(ctx),defaults=kind==='client'?DEFAULT_CLIENT_TEMPLATES:kind==='staff'?DEFAULT_STAFF_TEMPLATES:DEFAULT_INAPP_TEMPLATES;return String(template||defaults[code]||DEFAULT_INAPP_TEMPLATES[code]||'{message}').replace(TOKEN_RE,(m,k)=>Object.prototype.hasOwnProperty.call(data,k)?String(data[k]??''):m).replace(HASH_TOKEN_RE,(m,k)=>String(data[HASH_TOKEN_MAP[k]]??''));}
 function sampleContext(){const b=repo('bookings')?.all?.()?.find?.(x=>x&&!['cancelled','archived'].includes(x.status))||{id:'sample',bookingNo:'482913',name:'محمد أحمد',phone:'777123456',date:'2026-10-08',timeFrom:'09:00',timeTo:'21:00',hasTime:true,type:'مقيل وسمرة',eventType:'زفاف',amount:300000,paid:100000};const p=repo('payments')?.byBooking?.(b.id)?.[0]||{id:'sample-payment',receiptNo:'593821',amount:100000};return {booking:b,payment:p,customer:{name:b.name,phone:b.phone},message:'تذكير تجريبي'};}
 function isTransactional(code){return ['booking.created','booking.updated','booking.cancelled','payment.created','payment.voided','customer.created'].includes(String(code||''));}
 function targetFor(code,ctx){const def=EVENT_MAP.get(code),b=ctx.booking||{},r=ctx.payment||{},c=ctx.customer||{};if(def?.target==='payment')return {kind:'payment',id:r.id||ctx.paymentId||'',bookingId:b.id||r.bookingId||''};if(def?.target==='customer')return {kind:'customer',id:c.id||b.customerId||'',bookingId:b.id||''};if(def?.target==='messages')return {kind:'messages',id:ctx.messageId||'',bookingId:b.id||''};return {kind:'booking',id:b.id||ctx.bookingId||'',bookingId:b.id||ctx.bookingId||''};}
 function eventIdentity(code,ctx){const t=targetFor(code,ctx),version=ctx.version||ctx.payment?.updatedAt||ctx.payment?.createdAt||ctx.booking?.updatedAt||ctx.booking?.createdAt||ctx.occurredAt||'';return `${code}:${t.kind}:${t.id||t.bookingId||'global'}:${version||'once'}`;}
 const ZONE='Asia/Aden';
 function zoneDay(now=Date.now()){const f=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}),x=Object.fromEntries(f.formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}`;}
 function zoneOffsetMs(utc){try{const f=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,timeZoneName:'shortOffset',year:'numeric'}),raw=f.formatToParts(new Date(utc)).find(x=>x.type==='timeZoneName')?.value||'',m=raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);if(!m)return raw==='GMT'?0:3*3600000;return (m[1]==='-'?-1:1)*(Number(m[2])*60+Number(m[3]||0))*60000;}catch{return 3*3600000;}}
 function atCompanyTime(day,time){const [y,m,d]=day.split('-').map(Number),[hh,mm]=time.split(':').map(Number),local=Date.UTC(y,m-1,d,hh,mm);let utc=local-zoneOffsetMs(local);utc=local-zoneOffsetMs(utc);return utc;}
 function nextCompanyDay(day){const [y,m,d]=day.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d)+86400000);return x.toISOString().slice(0,10);}
 function localClockParts(now=Date.now()){const f=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),x=Object.fromEntries(f.formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return {day:`${x.year}-${x.month}-${x.day}`,minutes:Number(x.hour)*60+Number(x.minute)};}
 function timeMinutes(v,fallback){const m=String(v||fallback||'').match(/^([01]\d|2[0-3]):([0-5]\d)$/);return m?Number(m[1])*60+Number(m[2]):0;}
 function nextAllowedEpoch({urgent=false,now=Date.now()}={}){const p=companyPolicy();if(urgent&&p.urgentBypass)return now;const start=timeMinutes(p.quietStart,'22:00'),end=timeMinutes(p.quietEnd,'08:00');if(start===end)return now;const part=localClockParts(now),min=part.minutes;let blocked=false,targetDay=part.day;if(start<end){blocked=min>=start&&min<end;}else{blocked=min>=start||min<end;if(blocked&&min>=start)targetDay=nextCompanyDay(part.day);}if(!blocked)return now;const hh=String(Math.floor(end/60)).padStart(2,'0'),mm=String(end%60).padStart(2,'0');return atCompanyTime(targetDay,`${hh}:${mm}`);}
 function slotFromBase(base,ordinal=0){const p=companyPolicy(),rows=window.MyfntMessages?.all?.()||[],spacing=Math.max(5,Number(p.staggerSeconds||12))*1000;let occupied=0;for(const r of rows){const t=Date.parse(r.scheduledAt||'');if(Number.isFinite(t)&&Math.abs(t-base)<12*3600000)occupied++;}return base+(occupied+Math.max(0,ordinal))*spacing;}
 function nextDeliverySlot({urgent=false,ordinal=0,now=Date.now()}={}){return slotFromBase(nextAllowedEpoch({urgent,now}),ordinal);}
 function nextCompanyReminderSlot({urgent=false,ordinal=0,now=Date.now(),day=''}={}){const p=companyPolicy();if(urgent&&p.urgentBypass)return slotFromBase(now,ordinal);const targetDay=day||zoneDay(now),preferred=atCompanyTime(targetDay,p.preferredSendTime),base=nextAllowedEpoch({urgent:false,now:Math.max(now,preferred)});return slotFromBase(base,ordinal);}
 function reminderDayAtPreferred(epoch){const p=companyPolicy(),day=zoneDay(epoch);return atCompanyTime(day,p.preferredSendTime);}
 async function createSmsRequests(code,ctx,cfg){if(!cfg.sms||!window.MyfntMessages?.createRequest)return [];
  const policy=companyPolicy(),recipients=[...memberRecipients(cfg.roles)],client=cfg.client?clientRecipient(ctx.booking):null;if(client)recipients.push(client);
  const unique=[],seen=new Set();for(const r of recipients){const key=String(r.phone||'').replace(/\D/g,'');if(!key||seen.has(key))continue;seen.add(key);unique.push(r);}
  const eventKey=eventIdentity(code,ctx),target=targetFor(code,ctx),out=[],transactional=isTransactional(code);
  for(let i=0;i<unique.length;i++){const r=unique[i],kind=r.kind==='client'?'client':'staff',template=kind==='client'?cfg.clientTemplate:cfg.staffTemplate,message=formatTemplate(code,template,ctx,kind),scheduledAt=new Date(nextDeliverySlot({urgent:!!cfg.urgent,ordinal:i,now:Date.now()})).toISOString(),row=await window.MyfntMessages.createRequest({kind:code,eventCode:code,booking:ctx.booking||null,receipt:ctx.payment||ctx.initialPayment||null,recipient:r,message,idempotencyKey:`${eventKey}:sms:${r.phone}`,target,requiresApproval:policy.requireExplicitSend,scheduledAt,urgent:!!cfg.urgent,immediate:transactional});if(row)out.push(row);}
  return out;
 }
 async function handle(code,ctx={}){
  const policy=companyPolicy(),cfg=policy.events[code],def=EVENT_MAP.get(code);if(!policy.enabled||!cfg||cfg.enabled===false)return {skipped:true,reason:'disabled'};
  const message=formatTemplate(code,cfg.inAppTemplate,ctx,'inApp'),target=targetFor(code,ctx),eventKey=eventIdentity(code,ctx);
  let notification=null;const actorId=ctx.actorId||ctx.userId||'',actorName=ctx.actorName||'مستخدم';const operational=code==='booking.created'||code==='payment.created';if(cfg.inApp&&!operational&&window.MyfntNotificationCenter?.add){const roles=operational?['owner','manager','accountant']:cfg.roles;const recipients=recipientUserIds(roles);if(recipients.length){const title=code==='booking.created'?`أنشأ ${actorName} حجزًا جديدًا`:code==='payment.created'?`سجّل ${actorName} حركة مالية`:code==='booking.updated'?`عدّل ${actorName} حجزًا`:code==='booking.cancelled'?`ألغى ${actorName} حجزًا`:code==='payment.voided'?`ألغى ${actorName} حركة مالية`:(def?.label||'إشعار');const scheduledAt='';notification=window.MyfntNotificationCenter.add({type:code,bookingId:target.bookingId||'',priority:code==='booking.cancelled'||code==='message.failed'?0:2,tone:code==='booking.cancelled'||code==='message.failed'?'danger':code.startsWith('payment.')?'success':'primary',icon:def?.icon||'fa-bell',title,text:message,date:ctx.booking?.date||'',dedupeKey:`policy:${eventKey}`,target,scheduledAt,urgent:!!cfg.urgent,recipientUserIds:recipients,actorId,actorName,actorSessionId:String(ctx.actorSessionId||'')});}}
  const sms=await createSmsRequests(code,ctx,cfg);return {notification,sms};
 }
 async function processRuleSms(rule,booking,eventDay,scheduledAt){
  const eventCode=String(rule?.id||'').startsWith('default-before')||String(rule?.id||'')==='default-event-day'?'event.approaching':'custom.alert',p=companyPolicy(),gate=p.events[eventCode];if(!p.enabled||!gate?.enabled||!rule?.channels?.includes('sms'))return [];
  const mode=String(rule.recipient||'staff'),recipients=[];
  if(mode==='staff'||mode==='both')recipients.push(...memberRecipients(gate.roles));
  if(mode==='client'||mode==='both'){const c=clientRecipient(booking);if(c)recipients.push(c);}
  const seen=new Set(),out=[],dayBased=!rule.unit||rule.unit==='days',approvalKey=`${rule.id}:${booking.id}:${eventDay}`;
  for(let i=0;i<recipients.length;i++){const r=recipients[i],phone=String(r.phone||'').replace(/[^\d+]/g,''),key=phone.replace(/\D/g,'');if(!key||seen.has(key))continue;seen.add(key);const template=r.kind==='client'?rule.clientMessage:rule.staffMessage,message=formatTemplate(eventCode,template,{booking,message:rule.name||'تنبيه'},r.kind==='client'?'client':'staff'),target={kind:'booking',id:booking.id,bookingId:booking.id};let epoch=Math.max(Date.now(),Number(scheduledAt)||Date.now());if(r.kind==='staff'&&dayBased)epoch=reminderDayAtPreferred(epoch);epoch=nextAllowedEpoch({urgent:rule.priority==='critical',now:epoch});const deliveryAt=new Date(epoch+i*Math.max(5,Number(p.staggerSeconds||12))*1000).toISOString(),row=await window.MyfntMessages?.createRequest?.({kind:eventCode,eventCode,booking,recipient:r,message,idempotencyKey:`rule:${rule.id}:${booking.id}:${eventDay}:${scheduledAt}:sms:${phone}`,target,requiresApproval:p.requireExplicitSend||rule.priority==='critical',scheduledAt:deliveryAt,urgent:rule.priority==='critical',ruleId:rule.id,ruleApprovalId:approvalKey});if(row)out.push(row);}return out;
 }
 function quota(){const plans=window.MyfntPlans,code=plans?.companyCode?.()||'ULTRA',annual=Number(plans?.limit?.('sms_annual_limit',code)),monthly=Number(plans?.limit?.('sms_monthly_limit',code));const rows=window.MyfntMessages?.all?.()||[],now=new Date(),sent=rows.filter(x=>x.status==='sent'),usedAnnual=sent.filter(x=>new Date(x.sentAt||x.createdAt).getFullYear()===now.getFullYear()).length,usedMonthly=sent.filter(x=>{const d=new Date(x.sentAt||x.createdAt);return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}).length;return {code,annual,monthly,usedAnnual,usedMonthly};}
 function renderEventCard(e,p){const c=p.events[e.code],smsOn=c.sms?' is-sms':'',clientOn=c.client?' is-client':'';const chip=(field,on,icon,label,extra='')=>`<button type="button" class="mf-choice-btn${extra}" data-event-toggle="${field}" aria-pressed="${on?'true':'false'}"><i class="fa-solid ${icon}"></i><span>${label}</span></button>`;return `<article class="mf-comms-event${smsOn}${clientOn}" data-event="${esc(e.code)}"><div class="mf-comms-event-head"><span class="mf-comms-event-icon"><i class="fa-solid ${e.icon}"></i></span><div class="mf-comms-event-title"><strong>${esc(e.label)}</strong><small>${esc(e.code)}</small></div><button type="button" class="mf-event-enable" data-event-toggle="enabled" aria-pressed="${c.enabled?'true':'false'}"><span>${c.enabled?'فعال':'متوقف'}</span></button></div><div class="mf-comms-options">${chip('inApp',c.inApp,'fa-bell','داخل التطبيق')}${chip('sms',c.sms,'fa-message','SMS')}${chip('client',c.client,'fa-user','العميل')}${chip('urgent',c.urgent,'fa-bolt','عاجل',' mf-choice-btn--urgent')}</div><div class="mf-comms-details mf-comms-details--launcher"><input type="hidden" data-field="roles" value="${esc((Array.isArray(c.roles)?c.roles:[]).join(','))}"><textarea data-field="inAppTemplate" hidden>${esc(c.inAppTemplate||'')}</textarea><textarea data-field="staffTemplate" hidden>${esc(c.staffTemplate||'')}</textarea><textarea data-field="clientTemplate" hidden>${esc(c.clientTemplate||'')}</textarea><button class="mf-comms-details-launch" type="button" data-edit-event="${esc(e.code)}"><span><i class="fa-solid fa-users-gear"></i> المستلمون والقالب</span><small>${esc((Array.isArray(c.roles)?c.roles:[]).map(r=>roleLabels[r]||r).join('، ')||'بدون مستلمين')}</small><i class="fa-solid fa-chevron-left"></i></button></div></article>`;}
 const GROUPS=[
  {id:'booking',label:'الحجوزات والمواعيد',icon:'fa-calendar-days',codes:['booking.created','booking.updated','booking.cancelled','event.approaching']},
  {id:'finance',label:'المالية والمدفوعات',icon:'fa-coins',codes:['payment.created','payment.voided','balance.remaining']},
  {id:'customers',label:'العملاء',icon:'fa-users',codes:['customer.created']},
  {id:'system',label:'التنبيهات والنظام',icon:'fa-bell',codes:['custom.alert','message.failed']}
 ];
 const PRESETS={
  balanced:{label:'متوازن',desc:'إشعارات داخلية واسعة وSMS للأحداث المهمة فقط'},
  economy:{label:'اقتصادي',desc:'تقليل SMS مع إبقاء التنبيهات داخل التطبيق'},
  customer:{label:'خدمة عملاء',desc:'رسائل أوضح للعميل في مراحل الحجز والدفع'},
  finance:{label:'محاسبي صارم',desc:'تركيز على الدفعات والمتبقي والإلغاءات المالية'}
 };
 function applyPreset(name){document.querySelectorAll('.mf-comms-event[data-event]').forEach(card=>{const code=card.dataset.event;const set=(f,v)=>{const el=card.querySelector(`[data-event-toggle="${f}"]`);if(!el)return;el.setAttribute('aria-pressed',String(!!v));if(f==='enabled'){const span=el.querySelector('span');if(span)span.textContent=v?'فعال':'متوقف';}};let roleSet=new Set(String(card.querySelector('[data-field="roles"]')?.value||'').split(',').filter(Boolean));const role=(r,v)=>{if(v)roleSet.add(r);else roleSet.delete(r);const el=card.querySelector('[data-field="roles"]');if(el)el.value=[...roleSet].join(',');const note=card.querySelector('.mf-comms-details-launch small');if(note)note.textContent=[...roleSet].map(x=>roleLabels[x]||x).join('، ')||'بدون مستلمين';};set('enabled',true);set('inApp',true);set('urgent',code==='booking.cancelled'||code==='payment.voided'||code==='message.failed');for(const r of ['owner','manager','accountant'])role(r,false);
   if(name==='economy'){set('sms',['booking.created','booking.cancelled','event.approaching'].includes(code));set('client',['booking.created','booking.cancelled','event.approaching'].includes(code));role('owner',true);if(code.startsWith('booking.'))role('manager',true);if(code.startsWith('payment.')||code==='balance.remaining')role('accountant',true);}
   else if(name==='customer'){set('sms',['booking.created','booking.updated','booking.cancelled','payment.created','event.approaching'].includes(code));set('client',['booking.created','booking.updated','booking.cancelled','payment.created','event.approaching'].includes(code));role('owner',true);role('manager',true);if(code.startsWith('payment.')||code==='balance.remaining')role('accountant',true);}
   else if(name==='finance'){set('sms',['payment.created','payment.voided','booking.cancelled'].includes(code));set('client',['payment.created','booking.cancelled'].includes(code));role('owner',true);if(code.startsWith('payment.')||code==='balance.remaining')role('accountant',true);if(code==='booking.cancelled')role('manager',true);}
   else {const def=EVENT_MAP.get(code)?.defaults||{};set('sms',!!def.sms);set('client',!!def.client);set('urgent',!!def.urgent);for(const r of (def.roles||[]))role(r,true);}
  });document.querySelectorAll('.mf-comms-preset').forEach(b=>b.classList.toggle('is-active',b.dataset.preset===name));showToast(`تم تطبيق وضع ${PRESETS[name]?.label||name} — احفظ لاعتماد التغييرات`);}
 function renderMessageNumbersSection(){
  const rows=window.MyfntRecipientResolver?.all?.()||[];
  const card=(row,index)=>`<article class="mf-message-number" data-message-number="${esc(row.id||`message-${index}`)}"><div class="mf-message-number__head"><span><i class="fa-solid ${row.channel==='whatsapp'?'fa-comments':'fa-message'}"></i></span><div><strong>${esc(row.label||'رقم الرسائل')}</strong><small>${row.channel==='whatsapp'?'WhatsApp':'SMS'}</small></div><button type="button" class="icon-btn" data-remove-message-number aria-label="حذف رقم الرسائل"><i class="fa-solid fa-trash"></i></button></div><div class="mf-message-number__fields"><label><span>الرقم</span><input data-msg-field="phone" inputmode="tel" value="${esc(window.MyfntPhone?.display?.(row.phone)||row.phone||'')}" placeholder="777123456"></label><label><span>القناة</span><select data-msg-field="channel"><option value="sms" ${row.channel==='sms'?'selected':''}>SMS</option><option value="whatsapp" ${row.channel==='whatsapp'?'selected':''}>WhatsApp</option></select></label><label class="mf-message-number__label"><span>التسمية</span><input data-msg-field="label" maxlength="60" value="${esc(row.label||'')}" placeholder="مثال: رقم الإدارة"></label><label class="mf-message-number__active"><span>فعال</span><input data-msg-field="active" type="checkbox" ${row.active!==false?'checked':''}></label></div></article>`;
  return `<section class="mf-comms-section"><div class="mf-comms-section-head"><div><strong>أرقام الرسائل</strong><small>هذه الأرقام مخصصة للمراسلات فقط. هاتف الشركة ١ و٢ يبقيان للسندات والعقود والفواتير ولا يستخدمهما محرك الرسائل.</small></div><button type="button" class="secondary-btn" id="mfAddMessageNumber"><i class="fa-solid fa-plus"></i><span>إضافة رقم</span></button></div><div id="mfMessageNumbers" class="mf-message-numbers">${rows.map(card).join('')||'<div class="mf-message-numbers-empty"><i class="fa-regular fa-message"></i><span>لا توجد أرقام رسائل بعد. أضف رقمًا وحدد قناته SMS أو WhatsApp.</span></div>'}</div></section>`;
 }
 function collectMessageNumbers(){
  return [...document.querySelectorAll('#mfMessageNumbers [data-message-number]')].map((card,index)=>({id:card.dataset.messageNumber||`message-${Date.now()}-${index}`,phone:String(card.querySelector('[data-msg-field="phone"]')?.value||''),channel:String(card.querySelector('[data-msg-field="channel"]')?.value||'sms'),label:String(card.querySelector('[data-msg-field="label"]')?.value||'').trim(),active:!!card.querySelector('[data-msg-field="active"]')?.checked,primary:false}));
 }
 function appendMessageNumber(){
  const host=q('mfMessageNumbers');if(!host)return;
  const lim=window.MyfntFeatureGate?.limit?.('message_numbers_limit');const count=host.querySelectorAll('[data-message-number]').length;if(Number.isFinite(lim)&&count>=lim){showToast(`وصلت للحد المسموح لأرقام الرسائل في خطتك (${lim})`,'warning');return;}
  host.querySelector('.mf-message-numbers-empty')?.remove();
  const id=`message-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  host.insertAdjacentHTML('beforeend',`<article class="mf-message-number" data-message-number="${id}"><div class="mf-message-number__head"><span><i class="fa-solid fa-message"></i></span><div><strong>رقم رسائل جديد</strong><small>حدد القناة</small></div><button type="button" class="icon-btn" data-remove-message-number aria-label="حذف رقم الرسائل"><i class="fa-solid fa-trash"></i></button></div><div class="mf-message-number__fields"><label><span>الرقم</span><input data-msg-field="phone" inputmode="tel" placeholder="777123456"></label><label><span>القناة</span><select data-msg-field="channel"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></label><label class="mf-message-number__label"><span>التسمية</span><input data-msg-field="label" maxlength="60" placeholder="مثال: رقم الإدارة"></label><label class="mf-message-number__active"><span>فعال</span><input data-msg-field="active" type="checkbox" checked></label></div></article>`);
  const card=host.lastElementChild;card?.querySelector('[data-msg-field="phone"]')?.focus();
 }
 function renderSettings(){const host=q('myfntCommunicationPolicyBody');if(!host)return;const p=companyPolicy(),qt=quota();const lim=n=>Number.isFinite(n)&&n>=0?String(n):'∞';const pct=(used,limit)=>Number.isFinite(limit)&&limit>0?Math.min(100,Math.round((used/limit)*100)):0;host.innerHTML=`<div class="mf-comms-page"><section class="mf-comms-hero"><div class="mf-comms-hero__main"><span class="mf-comms-hero__icon"><i class="fa-solid fa-satellite-dish"></i></span><div><strong>مركز الرسائل والتنبيهات</strong><small>واجهة واحدة للأحداث والإشعارات الداخلية وSMS وقواعد التذكير، بدون تغيير مراقبات النظام الذكية.</small></div></div><div class="mf-comms-quota"><div><b>${esc(qt.code)}</b><span>${qt.usedMonthly}/${lim(qt.monthly)} هذا الشهر</span></div><div class="mf-comms-progress"><i style="width:${pct(qt.usedMonthly,qt.monthly)}%"></i></div><small>السنوي ${qt.usedAnnual}/${lim(qt.annual)}</small></div></section><section class="mf-comms-section"><div class="mf-comms-section-head"><div><strong>وضع التشغيل</strong><small>اختر إعدادًا جاهزًا ثم عدّل التفاصيل حسب احتياجك.</small></div></div><div class="mf-comms-presets">${Object.entries(PRESETS).map(([k,v])=>`<button type="button" class="mf-comms-preset${k==='balanced'?' is-active':''}" data-preset="${k}"><b>${v.label}</b><small>${v.desc}</small></button>`).join('')}</div></section><section class="mf-comms-section"><div class="mf-comms-section-head"><div><strong>الإعدادات العامة</strong><small>إعدادات الشركة التي تطبق على كل الأحداث.</small></div></div><div class="mf-comms-global"><label class="mf-setting-row"><span><b>مركز الاتصالات</b><small>تشغيل أو إيقاف جميع سياسات الرسائل</small></span><input id="mfCommsEnabled" type="checkbox" ${p.enabled?'checked':''}></label><label class="mf-setting-row"><span><b>اعتماد SMS قبل الإرسال</b><small>يُنشأ طلب إرسال واضح ولا يرسل مباشرة</small></span><input id="mfCommsApproval" type="checkbox" ${p.requireExplicitSend?'checked':''}></label><label class="mf-setting-row mf-comms-time"><span><b>وقت SMS لتذكيرات المناسبات للشركة</b><small>يطبق على تذكيرات المناسبات المرسلة إلى أرقام الرسائل التي قناتها SMS فقط</small></span><input id="mfCommsPreferredTime" type="time" value="${esc(p.preferredSendTime)}"></label><label class="mf-setting-row"><span><b>الفاصل بين الرسائل</b><small>منع الإرسال الجماعي في نفس الثانية</small></span><select id="mfCommsStagger">${[5,10,12,15,20,30,60].map(n=>`<option value="${n}" ${p.staggerSeconds===n?'selected':''}>${n} ثانية</option>`).join('')}</select></label><label class="mf-setting-row"><span><b>تجاوز الأحداث الحرجة</b><small>الإلغاء والفشل يمكنهما تجاوز ساعات الهدوء</small></span><input id="mfCommsUrgentBypass" type="checkbox" ${p.urgentBypass?'checked':''}></label><div class="mf-setting-row mf-setting-row--times"><span><b>ساعات الهدوء</b><small>لا تُرسل الأحداث العادية خلالها</small></span><div><input id="mfCommsQuietStart" type="time" value="${esc(p.quietStart)}"><em>إلى</em><input id="mfCommsQuietEnd" type="time" value="${esc(p.quietEnd)}"></div></div></div></section>${renderMessageNumbersSection()}${renderGatewaySection()}<section class="mf-comms-section"><div class="mf-comms-section-head"><div><strong>الأحداث</strong><small>كل مجموعة مستقلة؛ افتح «المستلمون والقالب» عند الحاجة فقط.</small></div></div><div class="mf-comms-groups">${GROUPS.map(g=>`<section class="mf-comms-group"><header><span><i class="fa-solid ${g.icon}"></i></span><div><strong>${g.label}</strong><small>${g.codes.length} أحداث</small></div></header><div class="mf-comms-events">${g.codes.map(code=>renderEventCard(EVENT_MAP.get(code),p)).join('')}</div></section>`).join('')}</div></section><div class="mf-comms-savebar"><button id="mfCommsSave" class="primary-btn" type="button"><i class="fa-solid fa-floppy-disk"></i><span>حفظ سياسة الرسائل</span></button></div></div>`;bindPolicyControls(host);requestAnimationFrame(()=>fillGatewayForm(q('mfGatewayUser')?.value||gatewayUsers()[0]?.userId||''));}
 function bindPolicyControls(host){
  if(!host)return;
 }
 let editingEventCode='';
 function eventCard(code){return document.querySelector(`.mf-comms-event[data-event="${CSS.escape(String(code||''))}"]`);}
 function openEventEditor(code){
  const card=eventCard(code),def=EVENT_MAP.get(code);if(!card||!def)return;
  editingEventCode=code;
  const roles=String(card.querySelector('[data-field="roles"]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
  q('mfEventEditorTitle').textContent=def.label;
  q('mfEventEditorCode').textContent=def.code;
  q('mfEventInAppTemplate').value=String(card.querySelector('[data-field="inAppTemplate"]')?.value||'');q('mfEventStaffTemplate').value=String(card.querySelector('[data-field="staffTemplate"]')?.value||'');q('mfEventClientTemplate').value=String(card.querySelector('[data-field="clientTemplate"]')?.value||'');
  document.querySelectorAll('#communicationEventEditorWindow [data-event-role]').forEach(btn=>{const on=roles.includes(btn.dataset.eventRole);btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',String(on));});
  window.openWindow?.('communicationEventEditorWindow');
 }
 function saveEventEditor(){
  const card=eventCard(editingEventCode);if(!card)return;
  const roles=[...document.querySelectorAll('#communicationEventEditorWindow [data-event-role][aria-pressed="true"]')].map(x=>x.dataset.eventRole).filter(Boolean);
  const rolesInput=card.querySelector('[data-field="roles"]'),inApp=card.querySelector('[data-field="inAppTemplate"]'),staff=card.querySelector('[data-field="staffTemplate"]'),client=card.querySelector('[data-field="clientTemplate"]');
  if(rolesInput)rolesInput.value=roles.join(',');if(inApp)inApp.value=String(q('mfEventInAppTemplate')?.value||'').trim();if(staff)staff.value=String(q('mfEventStaffTemplate')?.value||'').trim();if(client)client.value=String(q('mfEventClientTemplate')?.value||'').trim();
  const launch=card.querySelector('.mf-comms-details-launch small');if(launch)launch.textContent=roles.map(r=>roleLabels[r]||r).join('، ')||'بدون مستلمين';
  window.closeWindow?.('communicationEventEditorWindow',{skipHistory:true});editingEventCode='';
 }
 function collect(){const next=companyPolicy();next.messageNumbers=collectMessageNumbers();next.enabled=!!q('mfCommsEnabled')?.checked;next.requireExplicitSend=!!q('mfCommsApproval')?.checked;next.preferredSendTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(q('mfCommsPreferredTime')?.value||''))?String(q('mfCommsPreferredTime').value):'09:00';next.staggerSeconds=Number(q('mfCommsStagger')?.value||12);next.urgentBypass=!!q('mfCommsUrgentBypass')?.checked;next.quietStart=q('mfCommsQuietStart')?.value||'22:00';next.quietEnd=q('mfCommsQuietEnd')?.value||'08:00';document.querySelectorAll('.mf-comms-event[data-event]').forEach(card=>{const code=card.dataset.event,c=next.events[code];if(!c)return;const pressed=f=>card.querySelector(`[data-event-toggle="${f}"]`)?.getAttribute('aria-pressed')==='true';c.enabled=pressed('enabled');c.inApp=pressed('inApp');c.sms=pressed('sms');c.client=pressed('client');c.urgent=pressed('urgent');c.roles=String(card.querySelector('[data-field="roles"]')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);c.inAppTemplate=String(card.querySelector('[data-field="inAppTemplate"]')?.value||'').trim();c.staffTemplate=String(card.querySelector('[data-field="staffTemplate"]')?.value||'').trim();c.clientTemplate=String(card.querySelector('[data-field="clientTemplate"]')?.value||'').trim();});return next;}
 function init(){const host=q('myfntCommunicationPolicyBody');host?.addEventListener('click',e=>{const target=e.target instanceof Element?e.target:null;if(!target)return;const toggle=target.closest('[data-event-toggle]');if(toggle){e.preventDefault();e.stopPropagation();const on=toggle.getAttribute('aria-pressed')==='true';toggle.setAttribute('aria-pressed',String(!on));if(toggle.classList.contains('mf-event-enable')){const span=toggle.querySelector('span');if(span)span.textContent=!on?'فعال':'متوقف';}return;}const preset=target.closest('.mf-comms-preset[data-preset]');if(preset){e.preventDefault();applyPreset(preset.dataset.preset);return;}const edit=target.closest('[data-edit-event]');if(edit){e.preventDefault();e.stopPropagation();openEventEditor(edit.dataset.editEvent);return;}if(target.closest('#mfAddMessageNumber')){e.preventDefault();appendMessageNumber();return;}const removeNumber=target.closest('[data-remove-message-number]');if(removeNumber){e.preventDefault();removeNumber.closest('[data-message-number]')?.remove();const list=q('mfMessageNumbers');if(list&&!list.querySelector('[data-message-number]'))list.innerHTML='<div class="mf-message-numbers-empty"><i class="fa-regular fa-message"></i><span>لا توجد أرقام رسائل بعد. أضف رقمًا وحدد قناته SMS أو WhatsApp.</span></div>';return;}if(target.closest('#mfGatewayValidate')){e.preventDefault();try{const endpoint=String(q('mfGatewayEndpoint')?.value||'').trim(),device=String(q('mfGatewayDeviceId')?.value||'').trim(),sim=String(q('mfGatewaySimId')?.value||'').trim();if(!/^https:\/\//i.test(endpoint))throw Error('رابط API غير صالح');if(!/^\d+$/.test(device)||!/^\d+$/.test(sim))throw Error('Device ID و SIM Subscription ID يجب أن يكونا أرقامًا صحيحة');showToast('الإعدادات الأساسية صحيحة. لم يتم إرسال رسالة اختبار.','success');}catch(err){showToast(err.message||'الإعداد غير صالح','warning');}return;}if(target.closest('#mfGatewaySave')){e.preventDefault();if(window.OzanPermissions?.denied?.('settings.write'))return;(async()=>{try{await saveGatewayProfile(q('mfGatewayUser')?.value,{endpoint:q('mfGatewayEndpoint')?.value,deviceId:q('mfGatewayDeviceId')?.value,simSubscriptionId:q('mfGatewaySimId')?.value,secret:q('mfGatewaySecret')?.value});await fillGatewayForm(q('mfGatewayUser')?.value);showToast('تم حفظ بوابة SMS لهذا المستخدم محليًا');}catch(err){showToast(err.message||'تعذر حفظ البوابة','warning');}})();return;}if(!target.closest('#mfCommsSave'))return;e.preventDefault();if(window.OzanPermissions?.denied?.('settings.write'))return;try{savePolicy(collect());showToast('تم حفظ سياسة الرسائل والإشعارات وأرقام الرسائل');renderSettings();}catch(err){showToast(err?.message||'تعذر حفظ إعدادات الرسائل','warning');}});host?.addEventListener('change',e=>{const target=e.target instanceof Element?e.target:null;if(target?.id==='mfGatewayUser')fillGatewayForm(target.value).catch(console.warn);});document.querySelectorAll('#communicationEventEditorWindow [data-event-role]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const on=btn.getAttribute('aria-pressed')==='true';btn.setAttribute('aria-pressed',String(!on));btn.classList.toggle('is-selected',!on);}));q('mfEventEditorSave')?.addEventListener('click',e=>{e.preventDefault();saveEventEditor();});document.addEventListener('myfnt:open-communication-settings',()=>{renderSettings();window.OzanAdvanced?.renderAlerts?.();window.MyfntAlertScheduler?.renderApprovals?.();});}
 window.MyfntCommunicationPolicy=Object.freeze({events:EVENTS,variables:VARIABLE_CATALOG,policy:companyPolicy,handle,processRuleSms,renderSettings,quota,formatTemplate,vars,sampleContext,targetFor,memberRecipients,companyMembers,recipientUserIds,nextAllowedEpoch,nextDeliverySlot,nextCompanyReminderSlot,getGatewayProfile,saveGatewayProfile});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
