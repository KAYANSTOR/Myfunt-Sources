/* Myfnt 2.14.0 Step 21N — Smart Notification Engine v3 / bounded transient timeline. */
'use strict';
(()=>{
 const tz='Asia/Aden', q=id=>document.getElementById(id), esc=s=>escapeHtml(String(s??''));
 const scope=()=>window.OzanScope?.read?.(), storageKey=()=>`myfnt.alert.approvals.v25.${encodeURIComponent(scope()?.companyId||'no-company')}`;
 const companyReminderTime=()=>window.MyfntCommunicationPolicy?.policy?.().preferredSendTime||state?.settings?.communication?.preferredSendTime||state?.settings?.company?.notifyTime||'09:00';
 const INTERNAL_DAY_TIME='09:00';
 const lazyNotificationState={bookings:[],loadedAt:0,loading:null};
 const notificationBookings=()=>window.MyfntDomainRuntime?.lazy&&lazyNotificationState.bookings.length?lazyNotificationState.bookings:(window.MyfntRepositories?.bookings?.all?.()||state?.bookings||[]);
 function notificationWindow(){
   const today=todayInZone(),alerts=reminders(),prefDays=Number(window.ozPreferences?.reminderDays||1),settingDays=Math.max(0,...((state?.settings?.reminders||[]).map(Number).filter(Number.isFinite)),prefDays,10);
   let before=Math.max(14,settingDays),after=45;
   for(const r of alerts){const v=Math.max(0,Number(r?.value||0)),days=r?.unit==='hours'?Math.ceil(v/24):r?.unit==='minutes'?Math.ceil(v/1440):v;if(r?.direction==='after')after=Math.max(after,Math.min(days+2,36500));else before=Math.max(before,Math.min(days+2,36500));}
   const base=Date.parse(today+'T00:00:00+03:00'),fmt=ms=>new Date(ms).toISOString().slice(0,10);
   return {from:fmt(base-after*86400000),to:fmt(base+before*86400000)};
 }
 async function refreshLazyNotificationBookings({force=false}={}){
   if(!window.MyfntDomainRuntime?.lazy||!window.MyfntQuery?.notificationBookingCandidates)return notificationBookings();
   const now=Date.now();if(!force&&lazyNotificationState.bookings.length&&now-lazyNotificationState.loadedAt<30000)return lazyNotificationState.bookings;
   if(lazyNotificationState.loading)return lazyNotificationState.loading;
   lazyNotificationState.loading=(async()=>{const range=notificationWindow(),rows=await window.MyfntQuery.notificationBookingCandidates({...range,pastLimit:180,limit:20000});lazyNotificationState.bookings=rows;lazyNotificationState.loadedAt=Date.now();state._notificationCache=null;return rows;})().catch(error=>{console.warn('[notifications lazy query]',error);return lazyNotificationState.bookings;}).finally(()=>{lazyNotificationState.loading=null;});
   return lazyNotificationState.loading;
 }


 // Persistent in-app event notifications (bookings/payments/messages/sync).
 // Smart reminders remain computed in ui.js; these rows make the inbox useful even when no reminder is due now.
 const eventStorageKey=()=>`myfnt.notifications.events.v1.${encodeURIComponent(scope()?.companyId||'no-company')}`;
 const metaStorageKey=()=>`myfnt.notifications.meta.v2.${encodeURIComponent(scope()?.companyId||'no-company')}`;
 function readMeta(){try{const m=JSON.parse(safeStorage.get(metaStorageKey())||'{}')||{};return {snoozes:m.snoozes&&typeof m.snoozes==='object'?m.snoozes:{}};}catch{return {snoozes:{}};}}
 function writeMeta(m){safeStorage.set(metaStorageKey(),JSON.stringify({snoozes:m?.snoozes||{}}));}
 function notificationKey(n){return String(n?.dedupeKey||n?.id||'');}
 function isSnoozed(n,now=Date.now()){const key=notificationKey(n),until=Number(readMeta().snoozes[key]||0);return !!key&&until>now;}
 function snoozeUntil(mode){const now=new Date();if(mode==='hour')return Date.now()+3600000;if(mode==='evening'){const d=new Date();d.setHours(19,0,0,0);if(d.getTime()<=Date.now())d.setDate(d.getDate()+1);return d.getTime();}const d=new Date();d.setDate(d.getDate()+1);d.setHours(9,0,0,0);return d.getTime();}
 function snooze(n,mode='hour'){const key=notificationKey(n);if(!key)return false;const m=readMeta();m.snoozes[key]=snoozeUntil(mode);writeMeta(m);state._notificationCache=null;try{renderNotificationBadge?.();renderNotifications?.();}catch{}return true;}
 function clearExpiredSnoozes(){const m=readMeta(),now=Date.now();let changed=false;for(const [k,v] of Object.entries(m.snoozes))if(Number(v)<=now){delete m.snoozes[k];changed=true;}if(changed)writeMeta(m);}
 function readEventRows(){try{const rows=JSON.parse(safeStorage.get(eventStorageKey())||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}}
 function writeEventRows(rows){
   const now=Date.now(),cutoff=now-30*86400000;
   const timelineAt=x=>Number(x?.updatedAt||x?.createdAt||0);
   const cleaned=(Array.isArray(rows)?rows:[]).filter(x=>{
     if(x?.type==='smart.bundle'&&!x?.resolvedAt)return true;
     if(x?.type==='smart.digest'&&String(x?.date||'')===todayInZone())return true;
     const expires=Number(x?.expiresAt||0);if(expires>0&&expires<=now)return false;return Number(x?.createdAt||0)>=cutoff||Number(x?.resolvedAt||0)>=now-86400000;
   }).sort((a,b)=>timelineAt(b)-timelineAt(a)||Number(a?.priority||0)-Number(b?.priority||0)).slice(0,500);
   safeStorage.set(eventStorageKey(),JSON.stringify(cleaned));
   return cleaned;
 }
 async function mirrorEvent(){
   // Step 21C: generated inbox events are device-local/transient and intentionally NOT mirrored
   // into domain IndexedDB or sync outbox. Alert rules are the shared configuration entity.
   return false;
 }
 function eventItems(){
   clearExpiredSnoozes();
   const now=Date.now(),rows=readEventRows(),keep=[],out=[],currentUserId=String(scope()?.userId||'');let readChanged=false;
   for(const row of rows){
     const scheduled=Date.parse(row?.scheduledAt||'');if(Number.isFinite(scheduled)&&scheduled>now){keep.push(row);continue;}
     if(row?.resolvedAt&&now-Number(row.resolvedAt)>86400000)continue;
     let readAt=Number(state?.notificationReadAt?.[row.id]?.at||0);
     if(row.type==='smart.bundle'&&!row.resolvedAt&&readAt&&now-readAt>=86400000){state.notificationRead.delete(row.id);delete state.notificationReadAt[row.id];readAt=0;readChanged=true;}
     keep.push(row);
     if(Array.isArray(row.recipientUserIds)&&row.recipientUserIds.length&&!row.recipientUserIds.map(String).includes(currentUserId))continue;
     if(isSnoozed(row,now))continue;
     out.push({...row,date:row.date||'',eventNotification:true,resolved:!!row.resolvedAt});
   }
   if(keep.length!==rows.length)writeEventRows(keep);if(readChanged)try{saveNotificationRead?.();}catch{}
   return out;
 }
 function bootstrapEvents(){
   if(readEventRows().length)return;
   const rows=[],now=Date.now(),cutoff=now-7*86400000;
   const bookings=(window.MyfntRepositories?.bookings?.all?.()||booked()).filter(Boolean).sort((a,b)=>Number(b.createdAt||b.updatedAt||0)-Number(a.createdAt||a.updatedAt||0));
   for(const b of bookings){const at=Number(b.createdAt||b.updatedAt||0);if(!at||at<cutoff)continue;rows.push({id:`event:bootstrap:booking:${b.id}`,dedupeKey:`bootstrap:booking:${b.id}`,type:'booking',bookingId:String(b.id||''),priority:3,tone:'primary',icon:'fa-calendar-check',title:'حجز مسجل',text:`${b.name||'عميل'} · حجز #${b.bookingNo||b.id} · ${b.date||''}`,date:b.date||'',createdAt:at});if(rows.length>=12)break;}
   const payments=(window.MyfntRepositories?.payments?.all?.()||[]).filter(x=>x&&x.status!=='voided').sort((a,b)=>Number(b.createdAt||b.created_at||0)-Number(a.createdAt||a.created_at||0));
   for(const r of payments){const at=Number(r.createdAt||r.created_at||0);if(!at||at<cutoff)continue;const b=window.MyfntRepositories?.bookings?.get?.(r.bookingId||r.booking_id);rows.push({id:`event:bootstrap:payment:${r.id}`,dedupeKey:`bootstrap:payment:${r.id}`,type:'payment',bookingId:String(r.bookingId||r.booking_id||''),priority:3,tone:'success',icon:'fa-file-invoice-dollar',title:'حركة مالية مسجلة',text:`${b?.name||'عميل'} · ${r.direction==='out'?'صرف':'قبض'} ${Number(r.amount||0).toLocaleString('en-US')} · سند #${r.receiptNo||r.receipt_no||r.id||''}`,date:b?.date||'',createdAt:at});if(rows.length>=20)break;}
   if(rows.length)writeEventRows(rows.sort((a,b)=>b.createdAt-a.createdAt));
 }
 function addEvent({id='',type='system',bookingId='',priority=3,tone='primary',icon='fa-bell',title='إشعار',text='',date='',dedupeKey='',target=null,scheduledAt='',urgent=false,recipientUserIds=null,actorId='',actorName='',expiresAt=0}){
   const rows=readEventRows(),key=dedupeKey||id||`${type}:${bookingId}:${title}:${text}`;
   const existing=rows.find(x=>x.dedupeKey===key);
   if(existing)return existing;
   const row={id:id||`event:${crypto.randomUUID()}`,dedupeKey:key,type,bookingId:String(bookingId||target?.bookingId||''),target:target||null,priority:Number.isFinite(Number(priority))?Number(priority):3,tone,icon,title:String(title||'إشعار'),text:String(text||''),date:String(date||''),scheduledAt:String(scheduledAt||''),urgent:!!urgent,recipientUserIds:Array.isArray(recipientUserIds)?[...new Set(recipientUserIds.map(String).filter(Boolean))]:null,actorId:String(actorId||''),actorName:String(actorName||''),createdAt:Date.now(),expiresAt:Number(expiresAt||0)||0};
   writeEventRows([row,...rows]);mirrorEvent(row);state._notificationCache=null;try{renderNotificationBadge?.();}catch{};try{if(q('notificationsWindow')?.classList.contains('is-open'))renderNotifications?.();}catch{};
   document.dispatchEvent(new CustomEvent('myfnt:notification-created',{detail:{id:row.id,type:row.type,bookingId:row.bookingId}}));
   return row;
 }
 function latestPaymentForBooking(bookingId){try{return (window.MyfntRepositories?.payments?.byBooking?.(bookingId)||[]).filter(x=>x.status!=='voided').sort((a,b)=>Number(b.createdAt||b.created_at||0)-Number(a.createdAt||a.created_at||0))[0]||null;}catch{return null;}}
 function addOperationalActivity(kind,{booking=null,payment=null,actorId='',actorName='مستخدم',version='',initialPayment=null}={}){if(kind==='booking.created'&&booking){const first=initialPayment||null,paid=Number(first?.amount||0),extra=paid>0?` · دفعة أولى ${paid.toLocaleString('en-US')}`:'';return addEvent({type:'booking.activity',bookingId:booking.id,priority:1,tone:'primary',icon:'fa-calendar-check',title:`أنشأ ${actorName} حجزًا جديدًا`,text:`${booking.name||'عميل'} · حجز #${booking.bookingNo||booking.id} · ${booking.date||''}${extra}`,date:booking.date||'',dedupeKey:`company-activity:booking:${booking.id}:${version||booking.createdAt||''}`,target:{kind:'booking',id:booking.id,bookingId:booking.id},actorId,actorName});}if(kind==='payment.created'&&payment)return addEvent({type:'payment.activity',bookingId:booking?.id||payment.bookingId||'',priority:1,tone:'success',icon:'fa-file-invoice-dollar',title:`سجّل ${actorName} حركة مالية`,text:`${booking?.name||'عميل'} · ${payment.direction==='out'?'صرف':'قبض'} ${Number(payment.amount||0).toLocaleString('en-US')} · سند #${payment.receiptNo||payment.movementNo||payment.id||''}`,date:booking?.date||'',dedupeKey:`company-activity:payment:${payment.id}:${version||payment.createdAt||''}`,target:{kind:'payment',id:payment.id,bookingId:booking?.id||payment.bookingId||''},actorId,actorName});return null;}
 function todayInZone(){const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}),parts=Object.fromEntries(f.formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
 function dayDiff(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day||'')))return null;const a=Date.parse(todayInZone()+'T00:00:00+03:00'),b=Date.parse(String(day)+'T00:00:00+03:00');return Math.round((b-a)/86400000);}
 function severityMeta(level){return ({critical:{priority:-6,tone:'danger'},high:{priority:-2,tone:'warning'},normal:{priority:1,tone:'primary'},low:{priority:3,tone:'primary'}})[level]||{priority:2,tone:'primary'};}
 function smartIssue(code,{level='normal',title,text,action='preview',label='فتح الحجز'}={}){const eventCode=({
   'missing-price':'booking.amount_missing','missing-phone':'booking.phone_missing','missing-package':'booking.package_missing','no-payment':'booking.no_payment','overpaid':'booking.overpaid','balance':'balance.remaining','event-today':'booking.today','event-tomorrow':'booking.tomorrow','event-two-days':'booking.two_days','past-balance':'booking.unpaid_after_event','temporary-expired':'booking.temporary_expired','temporary-soon':'booking.temporary_soon'
  })[code]||`smart.${code}`;return {code,eventCode,eventDefinition:window.MyfntEventRegistry?.definition?.(eventCode)||null,level,title:String(title||'تنبيه'),text:String(text||''),action,label};}
 function upsertSmartBundle(booking,issues){
   const rows=readEventRows(),key=`smart:bundle:${booking.id}`,existing=rows.find(x=>x.dedupeKey===key),now=Date.now();
   const order={critical:0,high:1,normal:2,low:3},sorted=[...issues].sort((a,b)=>(order[a.level]??9)-(order[b.level]??9));
   const top=sorted[0]||smartIssue('general'),sev=severityMeta(top.level),label=booking.bookingNo?`#${booking.bookingNo}`:`#${String(booking.id||'').slice(-6)}`;
   const title=sorted.length>1?`${label} يحتاج انتباه`:top.title;
   const text=sorted.length>1?sorted.slice(0,4).map(x=>x.title).join(' · '):top.text;
   const signature=JSON.stringify({title,text,date:String(booking.date||''),severity:top.level,issues:sorted.map(x=>[x.code,x.level,x.title,x.text])}),previousSignature=existing?.contentSignature||'';
   const next={id:existing?.id||`event:${crypto.randomUUID()}`,dedupeKey:key,type:'smart.bundle',bookingId:String(booking.id||''),target:{kind:'booking',id:booking.id,bookingId:booking.id},priority:sev.priority,tone:sev.tone,icon:top.level==='critical'?'fa-triangle-exclamation':'fa-wand-magic-sparkles',title,text,date:String(booking.date||''),scheduledAt:'',urgent:top.level==='critical',recipientUserIds:null,actorId:'system',actorName:'Myfnt',issues:sorted,severity:top.level,attention:true,status:'active',resolvedAt:0,createdAt:existing?.createdAt||now,updatedAt:existing&&previousSignature===signature?Number(existing.updatedAt||existing.createdAt||now):now,contentSignature:signature};
   if(existing){const i=rows.indexOf(existing);rows[i]={...existing,...next};writeEventRows(rows);}else writeEventRows([next,...rows]);return next;
 }
 function resolveInactiveBundles(activeBookingIds){
   const rows=readEventRows(),now=Date.now();let changed=false;
   for(const row of rows){if(row.type!=='smart.bundle'||row.resolvedAt||activeBookingIds.has(String(row.bookingId||'')))continue;row.resolvedAt=now;row.status='resolved';row.priority=8;row.tone='success';row.icon='fa-circle-check';row.title='تمت معالجة تنبيهات الحجز';row.text='اختفت الأسباب التي كانت تحتاج انتباهًا.';row.updatedAt=now;changed=true;}
   if(changed)writeEventRows(rows);return changed;
 }
 function buildDigest(bookings,bundles){
   const dayKey=todayInZone(),rows=readEventRows(),key=`smart:digest:${dayKey}`,existing=rows.find(x=>x.dedupeKey===key),activeBookings=bookings.filter(b=>!['cancelled','archived'].includes(b.status)),todayCount=activeBookings.filter(b=>dayDiff(b.date)===0).length;
   const active=bundles.filter(Boolean),critical=active.filter(x=>x.severity==='critical').length,high=active.filter(x=>x.severity==='high').length;
   const totalRemaining=activeBookings.reduce((sum,b)=>sum+Math.max(0,Number(b.amount||0)-Number(b.paid||0)),0);
   if(!active.length&&!todayCount)return null;
   const now=Date.now(),meta=critical?severityMeta('critical'):high?severityMeta('high'):severityMeta('normal');
   const text=[todayCount?`${todayCount} مناسبة اليوم`:'',critical?`${critical} عاجل`:'',high?`${high} أولوية عالية`:'',totalRemaining>0?`متبقي ${totalRemaining.toLocaleString('en-US')}`:''].filter(Boolean).join(' · ');
   const signature=JSON.stringify({text,critical,high,todayCount,totalRemaining}),previousSignature=existing?.contentSignature||'';
   const next={id:existing?.id||`event:${crypto.randomUUID()}`,dedupeKey:key,type:'smart.digest',bookingId:'',target:null,priority:meta.priority,tone:meta.tone,icon:'fa-chart-line',title:'ملخص اليوم',text,date:dayKey,scheduledAt:'',urgent:critical>0,recipientUserIds:null,actorId:'system',actorName:'Myfnt',attention:critical>0||high>0,severity:critical?'critical':high?'high':'normal',createdAt:existing?.createdAt||now,updatedAt:existing&&previousSignature===signature?Number(existing.updatedAt||existing.createdAt||now):now,contentSignature:signature};
   if(existing){const i=rows.indexOf(existing);rows[i]={...existing,...next};writeEventRows(rows);}else writeEventRows([next,...rows]);return next;
 }
 function reconcileSmartInsights(){
   const now=Date.now(),bookings=booked().filter(Boolean),activeIds=new Set(),bundles=[];
   // Remove v1 granular smart rows once v2 becomes authoritative.
   let rows=readEventRows();const currentDigest=`smart:digest:${todayInZone()}`;const cleaned=rows.filter(r=>{const t=String(r.type||'');if(!t.startsWith('smart.'))return true;if(t==='smart.bundle')return true;if(t==='smart.digest')return r.dedupeKey===currentDigest;return false;});if(cleaned.length!==rows.length)writeEventRows(cleaned);
   for(const b of bookings){
     if(['cancelled','archived'].includes(b.status))continue;
     const issues=[],label=b.bookingNo?`#${b.bookingNo}`:(b.id?`#${String(b.id).slice(-6)}`:'الحجز'),remaining=Math.max(0,Number(b.amount||0)-Number(b.paid||0)),diff=dayDiff(b.date),amount=Number(b.amount||0),paid=Number(b.paid||0);
     const add=(code,opts)=>issues.push(smartIssue(code,opts));
     if(!String(b.bookingNo||'').trim())add('missing-number',{level:'high',title:'رقم الحجز غير مكتمل',text:`${b.name||'عميل'} · راجع ترقيم ${label}`,action:'preview',label:'إكمال البيانات'});
     if(!String(b.phone||'').replace(/\D/g,''))add('missing-phone',{level:diff!==null&&diff>=0&&diff<=2?'high':'normal',title:'رقم هاتف العميل غير موجود',text:`${b.name||'عميل'} · أضف الرقم لتفعيل الرسائل`,action:'phone',label:'إضافة الهاتف'});
     if(amount<=0)add('missing-price',{level:'critical',title:'قيمة الحجز غير محددة',text:`${b.name||'عميل'} · ${label}`,action:'preview',label:'إضافة السعر'});
     if(!String(b.packageId||b.type||'').trim())add('missing-package',{level:'high',title:'الباقة غير محددة',text:`${b.name||'عميل'} · ${label}`,action:'preview',label:'اختيار الباقة'});
     if(amount>0&&paid<=0&&!(diff!==null&&diff<0))add('no-payment',{level:diff!==null&&diff>=0&&diff<=2?'high':'normal',title:'لا توجد دفعة مسجلة',text:`قيمة الحجز ${amount.toLocaleString('en-US')}`,action:'receipt',label:'تسجيل دفعة'});
     if(paid>amount&&amount>0)add('overpaid',{level:'critical',title:'المدفوع أكبر من قيمة الحجز',text:`المدفوع ${paid.toLocaleString('en-US')} · القيمة ${amount.toLocaleString('en-US')}`,action:'receipt',label:'مراجعة المالية'});
     if(remaining>0&&(diff===null||(diff>=0&&diff<=10))){const level=diff!==null&&diff<=1?'critical':diff!==null&&diff<=3?'high':'normal';add('balance',{level,title:'يوجد مبلغ متبقٍ',text:`المتبقي ${remaining.toLocaleString('en-US')}`,action:'receipt',label:'تسجيل دفعة'});}
     if(diff===0)add('event-today',{level:remaining>0?'critical':'high',title:'المناسبة اليوم',text:`${b.name||'عميل'} · ${label}`,action:'preview',label:'فتح الحجز'});
     else if(diff===1)add('event-tomorrow',{level:remaining>0?'critical':'high',title:'المناسبة غدًا',text:`${b.name||'عميل'} · ${label}`,action:'preview',label:'فتح الحجز'});
     else if(diff===2)add('event-two-days',{level:remaining>0?'high':'normal',title:'المناسبة بعد يومين',text:`${b.name||'عميل'} · ${label}`,action:'preview',label:'فتح الحجز'});
     if(diff!==null&&diff<0&&remaining>0)add('past-balance',{level:'critical',title:'مناسبة منتهية عليها رصيد',text:`المتبقي ${remaining.toLocaleString('en-US')}`,action:'receipt',label:'تسوية الرصيد'});
     if(b.status==='pending'&&Number(b.temporaryExpiresAt||0)>0){const left=Number(b.temporaryExpiresAt)-now;if(left<=0)add('temporary-expired',{level:'critical',title:'انتهت مدة الحجز المؤقت',text:'يحتاج تأكيدًا أو معالجة',action:'preview',label:'مراجعة الحجز'});else if(left<=6*3600000)add('temporary-soon',{level:'high',title:'الحجز المؤقت سينتهي قريبًا',text:`متبقي ${Math.max(1,Math.ceil(left/3600000))} ساعة`,action:'preview',label:'مراجعة الحجز'});}
     if(issues.length){activeIds.add(String(b.id));bundles.push(upsertSmartBundle(b,issues));}
   }
   resolveInactiveBundles(activeIds);buildDigest(bookings,bundles);
   state._notificationCache=null;try{renderNotificationBadge?.();}catch{};try{if(q('notificationsWindow')?.classList.contains('is-open'))renderNotifications?.();}catch{};return bundles.length;
 }
 function mergeItems(items){
   const list=Array.isArray(items)?items:[],bundleBookings=new Set(list.filter(x=>x.type==='smart.bundle'&&!x.resolved).map(x=>String(x.bookingId||''))),legacy=new Set(['balance','overdue','pending','today','phone']);
   const seen=new Set();return list.filter(n=>{if(bundleBookings.has(String(n.bookingId||''))&&legacy.has(n.type))return false;const key=notificationKey(n);if(key&&seen.has(key))return false;if(key)seen.add(key);return !isSnoozed(n);});
 }
 function needsAttention(n){return !n?.resolved&&(n?.attention===true||n?.type==='smart.bundle'||Number(n?.priority)<=1||n?.tone==='danger'||n?.type==='message'&&String(n?.title||'').includes('فشل'));}
 const reminders=()=>window.MyfntRepositories?.alerts?.all?.()||[];
 const booked=()=>notificationBookings();
 const pad=n=>String(n).padStart(2,'0');
 const validTime=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));
 function offsetMs(utc,zone=tz){
   // Resolve UTC offset via Intl, including DST if server config later changes timezone.
   try{const f=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset',year:'numeric'});
     const raw=f.formatToParts(new Date(utc)).find(x=>x.type==='timeZoneName')?.value||'';
     const match=raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
     if(!match)return raw==='GMT'?0:3*3600000;
     return (match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0))*60000;
   }catch{return 3*3600000;}
 }
 function zonedEpoch(day,time,zone=tz){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!validTime(time))return null;
   const [y,m,d]=day.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
   const local=Date.UTC(y,m-1,d,hh,mm);if(new Date(local).toISOString().slice(0,10)!==day)return null;
   let utc=local-offsetMs(local,zone);utc=local-offsetMs(utc,zone);return utc;
 }
 function eventTimes(b){
   const dates=typeof bookingOccurrences==='function'?bookingOccurrences(b):[b.date];
   return (Array.isArray(dates)?dates:[b.date]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(0,30);
 }
 function scheduleOne(rule,b,eventDay){
   if(rule?.enabled===false)return null;
   const unit=({days:86400000,hours:3600000,minutes:60000})[rule.unit]||86400000;
   const value=Number(rule.value||0);if(!Number.isFinite(value)||value<0||value>36500)return null;
   const preferred=INTERNAL_DAY_TIME;
   const usesDay=rule.unit==='days'||!rule.unit;
   const event=zonedEpoch(eventDay,b.hasTime&&validTime(b.timeFrom)?b.timeFrom:preferred);if(event===null)return null;
   const relative=event+(rule.direction==='after'?1:-1)*value*unit;
   if(!usesDay)return relative; // الساعات/الدقائق دقيقة؛ قواعد الأيام الداخلية لا تعتمد على وقت SMS المفضل للشركة.
   const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
   const parts=Object.fromEntries(f.formatToParts(new Date(relative)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
   return zonedEpoch(`${parts.year}-${parts.month}-${parts.day}`,preferred);
 }
 function sameRuleDayAtCompanySmsTime(epoch){const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}),parts=Object.fromEntries(f.formatToParts(new Date(epoch)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value])),time=validTime(companyReminderTime())?companyReminderTime():'09:00';return zonedEpoch(`${parts.year}-${parts.month}-${parts.day}`,time);}
 function smsDueEpoch(rule,baseEpoch){if(baseEpoch==null)return null;const mode=String(rule?.recipient||'staff'),dayBased=!rule?.unit||rule.unit==='days';if(!dayBased||!['staff','both'].includes(mode))return baseEpoch;const staff=sameRuleDayAtCompanySmsTime(baseEpoch);return staff==null?baseEpoch:Math.min(baseEpoch,staff);}
 function due(now=Date.now()){
   if(!scope()||!Array.isArray(reminders()))return [];
   const items=[];
   for(const b of booked()){
     if(['cancelled','archived'].includes(b.status))continue;
     for(const rule of reminders()){
       const ruleEvent=String(rule.id||'').startsWith('default-before')||String(rule.id||'')==='default-event-day'?'event.approaching':'custom.alert';
       const communicationGate=window.MyfntCommunicationPolicy?.policy?.().events?.[ruleEvent];
       if(communicationGate&&(communicationGate.enabled===false||communicationGate.inApp===false))continue;
       if(!rule||rule.enabled===false||!['staff','both'].includes(rule.recipient)||!rule.channels?.includes('inApp'))continue;
       for(const eventDay of eventTimes(b)){
         const scheduled=scheduleOne(rule,b,eventDay);
         if(scheduled==null||now<scheduled||now-scheduled>86400000)continue;
         const title=String(rule.name||'تنبيه');
         const message=window.MyfntCommunicationPolicy?.formatTemplate?.('custom.alert',rule.staffMessage||title,{booking:b,message:title},'staff')||String(rule.staffMessage||title);
         items.push({id:`preferred:${rule.id}:${b.id}:${eventDay}`,type:'reminder',bookingId:b.id,priority:rule.priority==='critical'?-6:rule.priority==='high'?-2:3,date:eventDay,
           icon:rule.priority==='critical'?'fa-triangle-exclamation':'fa-bell',tone:rule.priority==='critical'?'danger':'primary',title,text:message,scheduledAt:scheduled,
           localOnly:true,target:{kind:'booking',id:b.id,bookingId:b.id},createdAt:scheduled});
       }
     }
   }
   return items;
 }
 const approvalId=(r,b,d)=>`${r.id}:${b.id}:${d}`;
 function readApprovals(){try{return JSON.parse(safeStorage.get(storageKey())||'{}')||{};}catch{return {};}}
 function pendingApprovalItems(now=Date.now()){
   const approvals=readApprovals(),out=[];
   for(const b of booked()){
     if(['cancelled','archived'].includes(b.status))continue;
     for(const r of reminders()){
       if(!r||r.enabled===false||r.priority!=='critical'||!r.channels?.includes('sms')||!['client','both'].includes(r.recipient))continue;
       for(const day of eventTimes(b)){
         const scheduled=scheduleOne(r,b,day);
         if(scheduled==null||now<scheduled||now-scheduled>86400000)continue;
         const id=approvalId(r,b,day);out.push({id,rule:r,booking:b,day,scheduled,approved:approvals[id]||null});
       }
     }
   }
   return out;
 }
 function renderApprovals(){const host=q('myfntCriticalApprovals');if(!host)return;
   const list=pendingApprovalItems();host.innerHTML=`<div class="mf-approval-card"><strong><i class="fa-solid fa-shield-halved"></i> إذن التنبيهات ذات الأولوية القصوى</strong><p>يتطلب SMS الخارجي موافقة صريحة على كل رسالة. تُسجّل الموافقة في الجهاز فقط حتى يتم توصيل خادم الرسائل والتحقق من الصلاحيات والرصيد.</p><p>وقت تذكيرات SMS لأرقام الرسائل: ${esc(validTime(companyReminderTime())?companyReminderTime():'09:00')} · ${tz} · الدقة أثناء فتح التطبيق فقط.</p></div>${list.map(x=>`<div class="mf-approval-card"><strong>${esc(x.rule.name)} — ${esc(x.booking.name||'عميل')} · #${esc(x.booking.bookingNo)}</strong><span>الموعد: ${new Date(x.scheduled).toLocaleString('ar-YE',{timeZone:tz})} · ${esc(window.MyfntPhone?.display?.(x.booking.phone)||x.booking.phone||'بدون رقم')}</span>${x.approved?`<span>تم تسجيل الموافقة في ${new Date(x.approved.at).toLocaleString('ar-YE')} وربطها بطابور الإرسال.</span>`:`<button type="button" class="primary-btn" data-mf-approve="${esc(x.id)}" ${!x.booking.phone?'disabled':''}>مراجعة ومنح الإذن</button>`}</div>`).join('')}${!list.length?'<p class="mf-footnote">لا توجد حاليًا طلبات SMS قصوى تستدعي موافقة.</p>':''}`;
 }
 async function approve(id){const item=pendingApprovalItems().find(x=>x.id===id);if(!item||item.approved)return;
   if(window.MyfntAccess?.requireWrite?.()||window.OzanPermissions?.denied?.('messages.approve'))return;
   if(!item.booking.phone){showToast('لم يُسجل رقم هاتف للعميل','warning');return;}
   const yes=await ozConfirm(`الموافقة على تنبيه «${item.rule.name}» إلى ${item.booking.phone}؟ بعد الموافقة يصبح مسموحًا للطابور بإرساله عند توفر بوابة SMS والرصيد.`,{title:'موافقة خاصة على تنبيه خارجي',confirmLabel:'تسجيل الموافقة'});
   if(!yes)return;
   const approvals=readApprovals();approvals[id]={at:Date.now(),userId:scope()?.userId,companyId:scope()?.companyId,bookingId:item.booking.id,ruleId:item.rule.id};
   if(safeStorage.set(storageKey(),JSON.stringify(approvals))===false){showToast('فشل حفظ الموافقة؛ لا تتابع الإرسال','warning');return;}
   try{await window.MyfntLocal?.saveSmsApproval?.({id,bookingId:item.booking.id,ruleId:item.rule.id,scheduledAt:new Date(item.scheduled).toISOString(),recipient:item.booking.phone,actorId:scope()?.userId});}
   catch(e){console.error('Local SMS approval mirror failed',e);showToast('حُفظت الموافقة، لكن تعذرت كتابة مرآة IndexedDB؛ تحقق من التخزين','warning');}
   try{await window.MyfntMessages?.approveWhere?.({ruleApprovalId:id,bookingId:item.booking.id,ruleId:item.rule.id});}catch(e){console.warn('[rule approval bridge]',e);}
   renderApprovals();showToast('تم تسجيل الموافقة وربطها بطابور الرسائل');
 }
 async function processDueRuleSms(now=Date.now()){
   if(!window.MyfntCommunicationPolicy?.processRuleSms)return;
   for(const b of booked()){
    if(['cancelled','archived'].includes(b.status))continue;
    for(const r of reminders()){
     if(!r||r.enabled===false||!r.channels?.includes('sms'))continue;
     for(const day of eventTimes(b)){const scheduled=scheduleOne(r,b,day),dueAt=smsDueEpoch(r,scheduled);if(scheduled==null||dueAt==null||now<dueAt||now-dueAt>86400000)continue;try{await window.MyfntCommunicationPolicy.processRuleSms(r,b,day,scheduled);}catch(e){console.warn('[rule sms request]',e);}}
    }
   }
 }
 let timer=null;
 async function reschedule(){
   await refreshLazyNotificationBookings();reconcileSmartInsights();processDueRuleSms().catch(console.error);state._notificationCache=null;try{renderNotificationBadge?.();}catch{}try{if(q('notificationsWindow')?.classList.contains('is-open'))renderNotifications?.();}catch{}renderApprovals();}
 function init(){if(timer)return;
   // Step 21N: prune expired transient inbox rows/snoozes on every startup before rendering.
   try{writeEventRows(readEventRows().filter(x=>!(x?.type==='message'&&['queued','scheduled','created','sending','blocked'].includes(String(x?.status||x?.messageStatus||'')))&&!String(x?.title||'').includes('بانتظار الإرسال')));clearExpiredSnoozes();}catch(e){console.warn('[notification transient cleanup]',e);}
   bootstrapEvents();
   q('myfntCriticalApprovals')?.addEventListener('click',e=>{const btn=e.target.closest('[data-mf-approve]');if(btn)approve(btn.dataset.mfApprove).catch(console.error);});
   timer=setInterval(()=>{if(document.visibilityState==='visible')reschedule().catch(console.error);},60000);
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reschedule().catch(console.error);});
   const consumeCanonicalEvent=env=>{
     const code=String(env?.code||''),d=env?.payload||{},b=d.booking||null,r=d.payment||null,actorId=env?.actorId||d.actorId||'',actorName=env?.actorName||d.actorName||'مستخدم';let handled=false;
     if(['booking.created','booking.updated','booking.cancelled'].includes(code)){
       handled=true;
       if(b&&['booking.updated','booking.cancelled'].includes(code))window.MyfntMessages?.cancelPendingForBooking?.(b.id,{ruleOnly:true,reason:code==='booking.cancelled'?'booking_cancelled':'booking_rescheduled'}).catch(console.error);
       if(code==='booking.created'&&b)addOperationalActivity('booking.created',{booking:b,initialPayment:d.initialPayment||null,actorId,actorName,version:env.version||b.createdAt});
       if(window.MyfntCommunicationPolicy?.handle)window.MyfntCommunicationPolicy.handle(code,{...d,version:env.version,actorId,actorName,actorSessionId:env.actorSessionId}).catch(console.error);
     }else if(['payment.created','payment.voided'].includes(code)){
       handled=true;
       if(code==='payment.created'&&b&&r)addOperationalActivity('payment.created',{booking:b,payment:r,actorId,actorName,version:env.version||r.createdAt});
       if(window.MyfntCommunicationPolicy?.handle)window.MyfntCommunicationPolicy.handle(code,{...d,version:env.version,actorId,actorName,actorSessionId:env.actorSessionId}).catch(console.error);
     }else if(code==='customer.created'){handled=true;if(window.MyfntCommunicationPolicy?.handle)window.MyfntCommunicationPolicy.handle(code,{...d,version:env.version,actorId,actorName,actorSessionId:env.actorSessionId}).catch(console.error);}
     if(handled)reschedule().catch(console.error);
   };
   document.addEventListener('myfnt:event',e=>consumeCanonicalEvent(e.detail));
   // Compatibility fallback only if the canonical registry failed to load.
   if(!window.MyfntEventRegistry){
     document.addEventListener('ozan:booking-saved',e=>{const b=window.MyfntRepositories?.bookings?.get?.(e.detail?.id);if(!b)return;const code=b.status==='cancelled'?'booking.cancelled':e.detail?.kind==='update'?'booking.updated':'booking.created';consumeCanonicalEvent({code,version:b.updatedAt||b.createdAt,actorId:e.detail?.userId||'',actorName:e.detail?.userName||'مستخدم',payload:{booking:b,customer:window.MyfntRepositories?.customers?.get?.(b.customerId),initialPayment:e.detail?.paymentId?window.MyfntRepositories?.payments?.get?.(e.detail.paymentId):null}});});
     document.addEventListener('myfnt:finance-changed',e=>{const b=window.MyfntRepositories?.bookings?.get?.(e.detail?.bookingId),r=e.detail?.paymentId?window.MyfntRepositories?.payments?.get?.(e.detail.paymentId):latestPaymentForBooking(e.detail?.bookingId);if(!b)return;const code=e.detail?.action==='void'?'payment.voided':e.detail?.action==='edit'?'payment.updated':'payment.created';consumeCanonicalEvent({code,version:r?.updatedAt||r?.createdAt||Date.now(),actorId:e.detail?.userId||'',actorName:e.detail?.userName||'مستخدم',payload:{booking:b,payment:r,paymentId:r?.id||e.detail?.paymentId}});});
   }
   document.addEventListener('myfnt:messages-changed',e=>{
     const row=e.detail?.row;if(!row)return reschedule().catch(console.error);
     if(row.status==='sent'||row.status==='failed'){const rows=readEventRows().filter(x=>!String(x.dedupeKey||'').startsWith(`message:${row.id}:`));writeEventRows(rows);}
     // مركز الإشعارات يعرض فقط نتيجة الإرسال، لا حالات الانتظار/الجدولة.
     if(row.status==='sent'||row.status==='failed')addEvent({type:'message',bookingId:row.bookingId||'',priority:row.status==='failed'?0:3,tone:row.status==='sent'?'success':'danger',icon:row.status==='sent'?'fa-comment-circle-check':'fa-message-xmark',title:row.status==='sent'?'تم إرسال رسالة':'فشل إرسال رسالة',text:`${row.clientName||row.phone||'عميل'} · ${row.error||row.message||''}`.slice(0,180),dedupeKey:`message:${row.id}:${row.status}`,target:row.target||{kind:'messages',id:row.id,bookingId:row.bookingId||''}});
     reschedule().catch(console.error);
   });

   document.addEventListener('myfnt:remote-activity',e=>{const d=e.detail||{},currentSession=String(scope()?.sessionId||'');if(d.actorSessionId&&currentSession&&String(d.actorSessionId)===currentSession)return;const recipients=Array.isArray(d.recipientUserIds)?d.recipientUserIds:null;addEvent({type:d.type||'remote.activity',bookingId:d.bookingId||'',priority:Number(d.priority??2),tone:d.tone||'primary',icon:d.icon||'fa-bell',title:d.title||'نشاط جديد في الشركة',text:d.text||'',dedupeKey:d.dedupeKey||`remote:${d.eventId||d.entityType||'activity'}:${d.entityId||''}:${d.version||''}`,target:d.target||null,recipientUserIds:recipients,actorId:d.actorId||'',actorName:d.actorName||''});reschedule().catch(console.error);});
   document.addEventListener('myfnt:sync-command-synced',e=>{addEvent({type:'sync',priority:4,tone:'success',icon:'fa-cloud-arrow-up',title:'تمت مزامنة عملية',text:`${e.detail?.entityType||'بيانات'} · ${e.detail?.legacyId||e.detail?.entityId||''}`,dedupeKey:`sync:ok:${e.detail?.id||crypto.randomUUID()}`,expiresAt:Date.now()+86400000});reschedule().catch(console.error);});
   document.addEventListener('myfnt:sync-command-failed',e=>{addEvent({type:'sync',priority:0,tone:'danger',icon:'fa-triangle-exclamation',title:'فشلت عملية مزامنة',text:String(e.detail?.error||'تعذر إرسال العملية إلى الخادم'),dedupeKey:`sync:fail:${e.detail?.id||crypto.randomUUID()}`});reschedule().catch(console.error);});
   document.addEventListener('myfnt:sync-conflict',e=>{addEvent({type:'sync',priority:-1,tone:'danger',icon:'fa-code-compare',title:'تعارض مزامنة يحتاج مراجعة',text:`عدد التعارضات: ${Number(e.detail?.count||1)}`,dedupeKey:`sync:conflict:${e.detail?.source||'sync'}:${Date.now()}`});reschedule().catch(console.error);});
   reschedule().catch(console.error);
 }
 window.MyfntNotificationCenter=Object.freeze({items:eventItems,add:addEvent,addOperationalActivity,reconcileSmartInsights,mergeItems,needsAttention,isSnoozed,snooze,clear:()=>{writeEventRows([]);writeMeta({snoozes:{}});state._notificationCache=null;reschedule().catch(console.error);}});
 window.MyfntAlertScheduler=Object.freeze({init,due,pendingApprovalItems,renderApprovals,reschedule,refreshLazyNotificationBookings,scheduleOne,zonedEpoch});
})();
