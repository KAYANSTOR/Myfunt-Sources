/* Myfnt 2.10.7 Step 21C4 — IndexedDB -> in-memory UI hydration bridge.
 * Remote/pull data is applied silently to the current legacy UI state without creating a new push command.
 * This file is transitional and can be removed once the UI reads repositories directly.
 */
'use strict';
(()=>{
 const JOURNAL_KEY='ozan.hydration.journal.v1'; // obsolete compatibility key, removed on startup
 const FINANCE_NOTES_KEY='ozan.finance.customers.v1';
 let running=null,rerun=false,bound=false;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const ms=(v,fallback=0)=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:Number(fallback||0);};
 const money=v=>Number(v||0)/100;
 const legacyId=row=>String(row?.legacy_id||row?.id||'');
 const time=v=>{if(!v)return '';const m=String(v).match(/(?:T|^)(\d{2}:\d{2})/);return m?m[1]:String(v).slice(0,5);};
 function recoverJournal(){try{safeStorage.remove(JOURNAL_KEY);}catch{}return true;}
 function mutateList(current,next){
  const old=new Map((current||[]).map(x=>[String(x.id),x])),out=[];
  for(const item of next){const prev=old.get(String(item.id));if(prev){for(const k of Object.keys(prev))if(!Object.hasOwn(item,k))delete prev[k];Object.assign(prev,item);out.push(prev);}else out.push(item);}
  current.splice(0,current.length,...out);return current;
 }
 function pkgFrom(row){
  const mapped=window.MyfntMappers?.package?.fromRow?.(row);if(mapped)return mapped;
  const raw=row.legacy_raw&&typeof row.legacy_raw==='object'?clone(row.legacy_raw):{};
  return {...raw,id:legacyId(row),name:row.name||raw.name||'باقة',icon:row.icon||raw.icon||'fa-star',
   price:money(row.regular_price_minor),seasonPrice:money(row.season_price_minor),deposit:money(row.default_deposit_minor),
   status:row.status==='hidden'?'hidden':'active',allowDoubleBooking:!!row.allow_double_booking,allowDiscount:row.allow_discount!==false,
   builtIn:row.built_in_local??raw.builtIn??/^p[1-5]$/.test(legacyId(row)),version:Number(row.package_version||raw.version||1)};
 }
 function customerFrom(row){
  const mapped=window.MyfntMappers?.customer?.fromRow?.(row);if(mapped)return mapped;
  return {id:legacyId(row),customerNo:String(row.customer_no||''),name:String(row.name||'').trim(),phone:String(row.phone_e164||''),
   address:String(row.address||''),createdAt:ms(row.created_at||row.local_created_at),updatedAt:ms(row.updated_at||row.local_updated_at)};
 }
 function bookingFrom(row,detail,customers,packages){
  const mapped=window.MyfntMappers?.booking?.fromRows?.(row,detail,{customersByUuid:customers,packagesByUuid:packages,syncStatus:'synced'});if(mapped)return mapped;
  const raw=row.legacy_raw&&typeof row.legacy_raw==='object'?clone(row.legacy_raw):{};
  const c=customers.get(String(row.customer_id||'')),p=detail?.package_id?packages.get(String(detail.package_id)):null;
  const status=row.status==='archived'?'archived':row.status==='cancelled'?'cancelled':row.status==='completed'?'completed':row.confirmation==='temporary'?'pending':'confirmed';
  const id=legacyId(row),created=ms(row.local_created_at||row.created_at),updated=ms(row.local_updated_at||row.updated_at);
  const next={...raw,id,bookingNo:String(row.booking_no||raw.bookingNo||''),customerId:c?.id||raw.customerId||'',
   name:String(detail?.customer_name_snapshot||c?.name||raw.name||'').trim(),phone:String(detail?.customer_phone_snapshot||c?.phone||raw.phone||''),
   address:String(detail?.address_snapshot||c?.address||raw.address||''),date:String(row.event_date||raw.date||''),
   type:String(detail?.package_name_snapshot||p?.name||raw.type||'مناسبة خاصة'),packageId:p?.id||raw.packageId||'',status,
   hasTime:Boolean(row.starts_at||row.ends_at),timeFrom:time(row.starts_at)||raw.timeFrom||'09:00',timeTo:time(row.ends_at)||raw.timeTo||'21:00',
   amount:detail?money(detail.agreed_total_minor):Number(raw.amount||0),notes:String(detail?.description??raw.notes??''),currency:String(detail?.currency||raw.currency||'YER'),
   temporaryExpiresAt:row.temporary_expires_at?ms(row.temporary_expires_at):Number(raw.temporaryExpiresAt||0),depositPending:status==='pending'&&Number(detail?.deposit_minor_snapshot||0)>0,
   depositRequired:detail?money(detail.deposit_minor_snapshot):Number(raw.depositRequired||0),serverVersion:Number(row.server_version??row.version??raw.serverVersion??0),syncStatus:'synced',
   createdById:row.created_by_id||raw.createdById||'',createdBy:row.created_by_name||raw.createdBy||'مستخدم',updatedById:row.updated_by_id||raw.updatedById||row.created_by_id||'',updatedBy:row.updated_by_name||raw.updatedBy||row.created_by_name||'مستخدم',createdAt:created,updatedAt:updated};
  if(detail){next.pricingSnapshot={...(raw.pricingSnapshot||{}),packageId:next.packageId,packageName:next.type,listPrice:money(detail.package_price_minor_snapshot),
   depositRequired:money(detail.deposit_minor_snapshot),currency:next.currency,source:detail.legacy_snapshot_unverified?'server-legacy-unverified':'server',effectiveAt:updated};
   const adjustments=[];if(Number(detail.discount_minor)>0)adjustments.push({kind:'discount',value:money(detail.discount_minor),reason:detail.adjustment_reason||'',at:updated});
   if(Number(detail.surcharge_minor)>0)adjustments.push({kind:'add',value:money(detail.surcharge_minor),reason:detail.adjustment_reason||'',at:updated});
   if(adjustments.length)next.adjustments=adjustments;
  }
  return normalizeBooking(next)||null;
 }
 function receiptFrom(row,bookingByUuid,customerByUuid){
  const mapped=window.MyfntMappers?.payment?.fromRow?.(row,{bookingByUuid,customerByUuid});if(mapped)return mapped;
  const raw=row.legacy_raw&&typeof row.legacy_raw==='object'?clone(row.legacy_raw):{},b=bookingByUuid.get(String(row.booking_id||'')),c=customerByUuid.get(String(row.customer_id||''));
  return {...raw,id:legacyId(row),receiptNo:String(row.receipt_no||raw.receiptNo||legacyId(row)),movementNo:String(row.movement_no||raw.movementNo||''),bookingId:b?.id||raw.bookingId||'',customerId:c?.id||raw.customerId||'',
   direction:row.direction==='out'?'out':'in',amount:money(row.amount_minor),currency:String(row.currency||raw.currency||'YER'),method:row.payment_method||raw.method||'cash',
   reference:row.external_reference||raw.reference||'',note:row.memo??raw.note??'',tag:row.tag??raw.tag??'',date:String(row.posted_at||raw.date||'').slice(0,10),
   status:row.status==='reversed'?'voided':'active',voidReason:row.reversal_reason||raw.voidReason||'',createdById:row.created_by_id||raw.createdById||'',createdBy:row.created_by_name||row.edited_by_name_snapshot||raw.createdBy||'مستخدم',editedById:row.edited_by_id||raw.editedById||'',editedByName:row.edited_by_name_snapshot||raw.editedByName||'',createdAt:ms(row.posted_at||raw.createdAt),updatedAt:ms(row.updated_at||row.posted_at||raw.updatedAt)};
 }
 function specialFrom(row){const raw=row.legacy_raw&&typeof row.legacy_raw==='object'?clone(row.legacy_raw):{};return {...raw,id:legacyId(row),date:row.block_date||raw.date||'',kind:row.kind||raw.kind||'busy',label:row.title||raw.label||raw.name||''};}
 function alertFrom(row){const raw=row.legacy_raw&&typeof row.legacy_raw==='object'?clone(row.legacy_raw):{};return {...raw,id:legacyId(row),name:row.name||raw.name||legacyId(row),trigger:row.event_code||raw.trigger||'',when:row.when_kind||raw.when||'before',unit:row.interval_unit||raw.unit||'days',value:Number(row.interval_value||raw.value||0),recipient:row.recipient_kind==='customer'?'client':row.recipient_kind==='both'?'both':'staff',channels:Array.isArray(row.channels)?row.channels:raw.channels||['inApp'],clientMessage:row.customer_template||raw.clientMessage||'',staffMessage:row.staff_template||raw.staffMessage||'',priority:row.priority||raw.priority||'normal',enabled:row.enabled!==false};}
 function cleanupLegacyDomainStorage(tables){
  // Step 21G: large booking/payment/customer JSON blobs are obsolete after IndexedDB
  // hydration. Remove them only when the normalized table proves a durable copy exists
  // (or the legacy value is already empty), never when it could be the only surviving copy.
  const pairs=[['ozan.bookings.v1','bookings'],['ozan.receipts.v1','payments'],['ozan.customers.directory.v1','customers']];
  for(const [key,table] of pairs){
   try{const scoped=window.OzanScope?.scopedKey?.(key)||key,raw=localStorage.getItem(scoped);if(raw==null)continue;
    let empty=false;try{const parsed=JSON.parse(raw);empty=Array.isArray(parsed)&&parsed.length===0;}catch{}
    if((tables?.[table]?.length||0)>0||empty)localStorage.removeItem(scoped);
   }catch(error){console.warn('[Myfnt legacy storage cleanup]',key,error?.name||error);}
  }
 }
 function mergeSettings(base,setting,company,alerts){
  const next=clone(base);if(setting){
   next.preferences={...next.preferences,currency:setting.currency||next.preferences.currency,calendar:setting.calendar_kind||next.preferences.calendar,language:setting.language_tag||next.preferences.language,syncMode:setting.sync_mode||next.preferences.syncMode};
   next.company={...next.company,notifyTime:setting.preferred_notification_time||next.company.notifyTime};
   next.bookingUi={...next.bookingUi,requireExactDeposit:setting.deposit_policy==='minimum',allowBookingOverpayment:!!setting.allow_booking_overpayment,allowReceiptOverRemaining:!!setting.allow_receipt_over_remaining,showAddress:!!setting.show_location_field,requiredFields:{...next.bookingUi.requiredFields,...(setting.required_fields||{})}};
   const year=new Date().getFullYear(),toDate=mmdd=>/^\d{2}-\d{2}$/.test(String(mmdd||''))?`${year}-${mmdd}`:'';
   next.season={...next.season,enabled:setting.season_enabled!==false,name:setting.season_name||next.season.name,start:toDate(setting.season_start_mmdd)||next.season.start,end:toDate(setting.season_end_mmdd)||next.season.end};
   if(Array.isArray(setting.reminder_days)&&setting.reminder_days.length)next.reminders=setting.reminder_days.map(Number);if(setting.communication_policy&&typeof setting.communication_policy==='object')next.communication={...(next.communication||{}),...clone(setting.communication_policy)};
  }
  if(company)next.company={...next.company,name:company.name||next.company.name,description:company.description??next.company.description,addresses:company.address??next.company.addresses,phone:company.phone_1??next.company.phone,phone2:company.phone_2??next.company.phone2,sms:company.sms_phone??next.company.sms,whatsapp:company.whatsapp_phone??next.company.whatsapp,terms:company.booking_receipt_terms??next.company.terms,receiptNotes:company.receipt_notes??next.company.receiptNotes};
  if(alerts)next.alertTemplates=alerts;return next;
 }
 async function hydrate({reason='remote'}={}){
  if(running){rerun=true;return running;}
  running=(async()=>{
   if(window.MyfntFinance?.isRecoveryBlocked?.())throw Error('تأجل تحديث البيانات لأن استرجاع معاملة مالية لم يكتمل.');
   const snap=await window.MyfntLocal?.hydrationSnapshot?.();if(!snap)return {changed:false};
   const t=snap.tables||{},customerByUuid=new Map((t.customers||[]).map(r=>[String(r.id),customerFrom(r)])),packageByUuid=new Map((t.booking_packages||[]).map(r=>[String(r.id),pkgFrom(r)]));
   const details=new Map((t.booking_details||[]).map(r=>[String(r.booking_id),r]));
   const uiMeta=new Map((snap.ui_meta||[]).map(row=>[String(row.key||''),row.value]));
   const bookings=[],bookingByUuid=new Map();for(const r of t.bookings||[]){const b=bookingFrom(r,details.get(String(r.id)),customerByUuid,packageByUuid);if(b){const meta=uiMeta.get(`booking-message:${b.id}`);if(meta&&Array.isArray(meta.attempts))b.manualMessageAttempts=meta.attempts;bookings.push(b);bookingByUuid.set(String(r.id),b);}}
   const keepHydratedPayment=r=>Boolean(r&&r.id);
   const receipts=(t.payments||[]).map(r=>receiptFrom(r,bookingByUuid,customerByUuid)).filter(keepHydratedPayment);
   const paid=new Map();for(const r of receipts)if(r.status!=='voided')paid.set(r.bookingId,(paid.get(r.bookingId)||0)+(r.direction==='out'?-1:1)*Number(r.amount||0));
   for(const b of bookings)b.paid=Math.max(0,paid.get(b.id)||0);
   const customers=[...customerByUuid.values()].filter(c=>c.id&&c.name),packages=normalizePackages([...packageByUuid.values()]);
   const special=(t.calendar_blocks||[]).map(specialFrom),alerts=(t.alert_rules||[]).map(alertFrom);
   const settings=mergeSettings(state.settings,(t.company_settings||[])[0],(t.companies||[])[0],alerts.length?alerts:null);
   const notes={};for(const row of t.customers||[])if(String(row.notes||''))notes[legacyId(row)]=String(row.notes);
   // Step 21B: IndexedDB is authoritative for domain data. Hydration updates RAM only;
   // it never recreates full booking/customer/payment arrays in localStorage.
   mutateList(state.bookings,bookings);mutateList(state.packages,packages);mutateList(state.receipts,receipts);mutateList(state.specialDays,special);mutateList(state.customers,customers);state.settings=settings;
   cleanupLegacyDomainStorage(t);
   // Step 21B.1: hydration mutates the existing bookings array in place so repository
   // references remain stable. Explicitly advance the revision so month/query caches
   // cannot retain the pre-hydration empty result rendered during shell startup.
   window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;
   document.documentElement.dataset.theme=state.settings.theme;window.MyfntFinance?.reloadFromHydration?.(notes);
   document.dispatchEvent(new CustomEvent('myfnt:hydrated',{detail:{reason,bookings:bookings.length,customers:customers.length,receipts:receipts.length,lazy:Boolean(snap.lazy?.enabled),counts:snap.lazy?.counts||{}}}));
   if(typeof renderAll==='function')renderAll();
   queueMicrotask(()=>window.MyfntMonthData?.refresh?.({force:true}));
   queueMicrotask(()=>{document.dispatchEvent(new CustomEvent('ozan:packages-updated'));document.dispatchEvent(new Event('ozan:profile-updated'));});
   return {changed:true,bookings:bookings.length,customers:customers.length,receipts:receipts.length,packages:packages.length};
  })().finally(async()=>{running=null;if(rerun){rerun=false;try{await hydrate({reason:'coalesced-remote'});}catch(e){console.error('[Myfnt hydration rerun]',e);}}});
  return running;
 }
 function init(){if(bound)return;bound=true;recoverJournal();document.addEventListener('myfnt:remote-applied',()=>hydrate({reason:'remote-pull'}).catch(e=>{console.error('[Myfnt hydration]',e);window.showToast?.('وصل تحديث من الخادم لكن تعذر تحديث الواجهة محليًا. أعد فتح التطبيق بعد فحص التخزين.','warning');}));}
 window.MyfntHydration=Object.freeze({init,hydrate,recoverJournal,contract:()=>({authority:'indexeddb',standalonePaymentsPreserved:true,mutatesStateInPlace:true}),testHooks:Object.freeze({keepHydratedPayment:r=>Boolean(r&&r.id)})});
 document.addEventListener('DOMContentLoaded',init,{once:true});
})();
