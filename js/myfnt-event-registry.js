/* Myfnt 2.14.7 — Canonical Event Registry + Communication Contract */
'use strict';
(()=>{
 const VERSION=1;
 const defs=[
  {code:'booking.created',domain:'booking',label:'إنشاء حجز',icon:'fa-calendar-check',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:true,client:true,urgent:false,roles:['owner','manager']}},
  {code:'booking.updated',domain:'booking',label:'تعديل الحجز',icon:'fa-pen-to-square',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:false,roles:['owner','manager']}},
  {code:'booking.confirmed',domain:'booking',label:'تأكيد الحجز',icon:'fa-circle-check',target:'booking',configurable:false,communication:false},
  {code:'booking.temporary',domain:'booking',label:'حجز مؤقت',icon:'fa-hourglass-half',target:'booking',configurable:false,communication:false},
  {code:'booking.cancelled',domain:'booking',label:'إلغاء الحجز',icon:'fa-calendar-xmark',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:true,client:true,urgent:true,roles:['owner','manager']}},
  {code:'customer.created',domain:'customer',label:'إنشاء عميل',icon:'fa-user-plus',target:'customer',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:false,roles:['owner','manager']}},
  {code:'payment.created',domain:'payment',label:'إنشاء دفعة / حركة',icon:'fa-file-invoice-dollar',target:'payment',configurable:true,communication:true,defaults:{inApp:true,sms:true,client:true,urgent:false,roles:['owner','manager','accountant']}},
  {code:'payment.updated',domain:'payment',label:'تعديل حركة مالية',icon:'fa-pen-to-square',target:'payment',configurable:false,communication:false},
  {code:'payment.voided',domain:'payment',label:'إلغاء حركة مالية',icon:'fa-ban',target:'payment',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:true,roles:['owner','manager','accountant']}},
  {code:'event.approaching',domain:'reminder',label:'اقتراب موعد المناسبة',icon:'fa-clock',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:true,client:true,urgent:false,roles:['owner','manager']}},
  {code:'balance.remaining',domain:'finance',label:'المبلغ المتبقي',icon:'fa-hand-holding-dollar',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:false,roles:['owner','accountant']}},
  {code:'custom.alert',domain:'system',label:'تنبيه مخصص / قاعدة إشعار',icon:'fa-bell',target:'booking',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:false,roles:['owner','manager']}},
  {code:'message.sent',domain:'message',label:'تم إرسال رسالة',icon:'fa-comment-circle-check',target:'messages',configurable:false,communication:false},
  {code:'message.failed',domain:'message',label:'فشل إرسال رسالة',icon:'fa-triangle-exclamation',target:'messages',configurable:true,communication:true,defaults:{inApp:true,sms:false,client:false,urgent:true,roles:['owner','manager']}},
  {code:'booking.amount_missing',domain:'smart',label:'قيمة الحجز غير محددة',icon:'fa-triangle-exclamation',target:'booking',configurable:false,communication:false},
  {code:'booking.phone_missing',domain:'smart',label:'رقم هاتف العميل غير موجود',icon:'fa-phone-slash',target:'booking',configurable:false,communication:false},
  {code:'booking.package_missing',domain:'smart',label:'الباقة غير محددة',icon:'fa-box-open',target:'booking',configurable:false,communication:false},
  {code:'booking.no_payment',domain:'smart',label:'لا توجد دفعة مسجلة',icon:'fa-wallet',target:'booking',configurable:false,communication:false},
  {code:'booking.overpaid',domain:'smart',label:'المدفوع أكبر من قيمة الحجز',icon:'fa-scale-unbalanced-flip',target:'booking',configurable:false,communication:false},
  {code:'booking.today',domain:'smart',label:'المناسبة اليوم',icon:'fa-calendar-day',target:'booking',configurable:false,communication:false},
  {code:'booking.tomorrow',domain:'smart',label:'المناسبة غدًا',icon:'fa-calendar-plus',target:'booking',configurable:false,communication:false},
  {code:'booking.two_days',domain:'smart',label:'المناسبة بعد يومين',icon:'fa-calendar',target:'booking',configurable:false,communication:false},
  {code:'booking.unpaid_after_event',domain:'smart',label:'مناسبة منتهية عليها رصيد',icon:'fa-money-bill-transfer',target:'booking',configurable:false,communication:false},
  {code:'booking.temporary_expired',domain:'smart',label:'انتهت مدة الحجز المؤقت',icon:'fa-hourglass-end',target:'booking',configurable:false,communication:false},
  {code:'booking.temporary_soon',domain:'smart',label:'الحجز المؤقت سينتهي قريبًا',icon:'fa-hourglass-half',target:'booking',configurable:false,communication:false},
  {code:'daily.summary',domain:'smart',label:'الملخص اليومي',icon:'fa-chart-line',target:'system',configurable:false,communication:false},
  {code:'admin.custom_notification',domain:'admin',label:'إشعار مخصص من الإدارة',icon:'fa-bullhorn',target:'system',configurable:false,communication:false},
  {code:'sync.failed',domain:'system',label:'فشل المزامنة',icon:'fa-cloud-circle-xmark',target:'system',configurable:false,communication:false}
 ];
 const MAP=new Map(defs.map(x=>[x.code,Object.freeze({...x,defaults:x.defaults?Object.freeze({...x.defaults,roles:Object.freeze([...(x.defaults.roles||[])])}):undefined})]));
 const subscribers=new Map();
 const allSubscribers=new Set();
 let seq=0;
 const scope=()=>window.OzanScope?.read?.()||{};
 const repo=n=>window.MyfntRepositories?.[n];
 function definition(code){return MAP.get(String(code||''))||null;}
 function definitions(){return [...MAP.values()];}
 function communicationEvents(){return definitions().filter(x=>x.communication===true&&x.configurable===true);}
 function targetOf(code,payload={}){const def=definition(code),b=payload.booking||{},p=payload.payment||{},c=payload.customer||{};if(def?.target==='payment')return {kind:'payment',id:String(p.id||payload.paymentId||''),bookingId:String(b.id||p.bookingId||payload.bookingId||'')};if(def?.target==='customer')return {kind:'customer',id:String(c.id||b.customerId||payload.customerId||''),bookingId:String(b.id||payload.bookingId||'')};if(def?.target==='messages')return {kind:'messages',id:String(payload.message?.id||payload.messageId||''),bookingId:String(b.id||payload.bookingId||payload.message?.bookingId||'')};if(def?.target==='system')return {kind:'system',id:String(payload.id||code),bookingId:''};return {kind:'booking',id:String(b.id||payload.bookingId||''),bookingId:String(b.id||payload.bookingId||'')};}
 function versionOf(payload={}){return payload.version??payload.payment?.updatedAt??payload.payment?.createdAt??payload.booking?.updatedAt??payload.booking?.createdAt??payload.occurredAt??Date.now();}
 function actorOf(payload={}){const s=scope();return {actorId:String(payload.actorId||payload.userId||s.userId||''),actorName:String(payload.actorName||payload.userName||'مستخدم'),actorSessionId:String(payload.actorSessionId||s.sessionId||'')};}
 function envelope(code,payload={},meta={}){const def=definition(code);if(!def)throw new Error(`Unknown Myfnt event: ${code}`);const target=targetOf(code,payload),actor=actorOf(payload),version=versionOf(payload),occurredAt=Number(payload.occurredAt||Date.now());return Object.freeze({contractVersion:VERSION,eventId:String(meta.eventId||`${code}:${target.kind}:${target.id||target.bookingId||'global'}:${version}:${++seq}`),code,domain:def.domain,target,version,occurredAt,companyId:String(payload.companyId||scope().companyId||''),source:String(meta.source||payload.source||'app'),...actor,payload:Object.freeze({...payload,...actor,version,occurredAt})});}
 function notify(env){for(const fn of allSubscribers){try{fn(env);}catch(err){console.error('[event registry subscriber]',err);}}for(const fn of subscribers.get(env.code)||[]){try{fn(env);}catch(err){console.error(`[event registry ${env.code}]`,err);}}document.dispatchEvent(new CustomEvent('myfnt:event',{detail:env}));}
 function emit(code,payload={},meta={}){const env=envelope(code,payload,meta);notify(env);return env;}
 function on(code,fn){if(typeof fn!=='function')return()=>{};if(code==='*'){allSubscribers.add(fn);return()=>allSubscribers.delete(fn);}if(!MAP.has(code))throw new Error(`Unknown Myfnt event: ${code}`);if(!subscribers.has(code))subscribers.set(code,new Set());subscribers.get(code).add(fn);return()=>subscribers.get(code)?.delete(fn);}
 function bridgeBooking(detail={}){const b=repo('bookings')?.get?.(detail.id);if(!b)return null;const customer=repo('customers')?.get?.(b.customerId)||null,initialPayment=detail.paymentId?repo('payments')?.get?.(detail.paymentId):null,common={booking:b,customer,initialPayment,bookingId:b.id,customerId:b.customerId||detail.customerId||'',companyId:detail.companyId||'',version:b.updatedAt||b.createdAt,actorId:detail.userId||b.updatedById||b.createdById||'',actorName:detail.userName||b.updatedBy||b.createdBy||'مستخدم'};const main=b.status==='cancelled'?'booking.cancelled':detail.kind==='update'?'booking.updated':'booking.created';const out=[emit(main,common,{source:'ozan:booking-saved'})];if(detail.customerCreated)out.push(emit('customer.created',{...common,version:b.createdAt||common.version},{source:'ozan:booking-saved'}));return out;}
 function latestPayment(bookingId){return (repo('payments')?.byBooking?.(bookingId)||[]).filter(x=>x).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0))[0]||null;}
 function bridgeFinance(detail={}){const b=repo('bookings')?.get?.(detail.bookingId);const p=detail.paymentId?repo('payments')?.get?.(detail.paymentId):latestPayment(detail.bookingId);if(!b&&!p)return null;const action=String(detail.action||'create'),code=action==='void'?'payment.voided':action==='edit'?'payment.updated':'payment.created';return emit(code,{booking:b,payment:p,paymentId:p?.id||detail.paymentId||'',bookingId:b?.id||detail.bookingId||'',version:p?.updatedAt||p?.editedAt||p?.createdAt||Date.now(),actorId:detail.userId||p?.editedById||p?.createdById||'',actorName:detail.userName||p?.editedByName||p?.createdBy||'مستخدم'},{source:'myfnt:finance-changed'});}
 function bridgeMessage(detail={}){const row=detail.row;if(!row||!['sent','failed'].includes(String(row.status||'')))return null;const code=row.status==='failed'?'message.failed':'message.sent';return emit(code,{message:row,messageId:row.id,bookingId:row.bookingId||'',version:row.updatedAt||row.sentAt||row.createdAt||Date.now(),actorId:'system',actorName:'Myfnt'},{source:'myfnt:messages-changed'});}
 function init(){document.addEventListener('ozan:booking-saved',e=>bridgeBooking(e.detail||{}));document.addEventListener('myfnt:finance-changed',e=>bridgeFinance(e.detail||{}));document.addEventListener('myfnt:messages-changed',e=>bridgeMessage(e.detail||{}));}
 window.MyfntEventRegistry=Object.freeze({version:VERSION,definitions,definition,communicationEvents,targetOf,envelope,emit,on,bridgeBooking,bridgeFinance,bridgeMessage});
 init();
})();
