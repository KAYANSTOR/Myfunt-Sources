/* Myfnt 2.14.0 Step 22B — Repository Authority Cleanup.
   IndexedDB/Query is canonical. state is a synchronous UI compatibility cache only. */
'use strict';
(()=>{
 const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
 const byId=(list,id)=>list.find(x=>String(x?.id)===String(id))||null;
 const metrics={legacyCacheReads:0,durableReads:0,durableWrites:0,writeFailures:0};
 const pendingWrites=new Set();
 const trackCache=value=>{metrics.legacyCacheReads++;return value;};
 const trackWrite=promise=>{if(!promise||typeof promise.then!=='function')return promise;metrics.durableWrites++;pendingWrites.add(promise);promise.catch(()=>metrics.writeFailures++).finally(()=>pendingWrites.delete(promise));return promise;};
 const durableRecord=(entity,id,operation='update',payload=null)=>trackWrite(Promise.resolve(window.MyfntOffline?.record?.(entity,id,operation,payload)));
 const durableRemove=(entity,id,options)=>trackWrite(Promise.resolve(window.MyfntOffline?.remove?.(entity,id,options)));
 const query=()=>window.MyfntQuery;
 const shadow=(fn,...args)=>{try{if(typeof fn!=='function')return true;const ok=fn(...args);if(ok===false)console.warn('[Myfnt shadow cache] compatibility write skipped; IndexedDB remains authoritative');return ok!==false;}catch(error){console.warn('[Myfnt shadow cache]',error);return false;}};
 const rollbackObject=(target,before)=>{Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,before);};
 const entityRepo=(key,entity)=>Object.freeze({
  all:()=>trackCache(state[key]),
  allCache:()=>state[key],
  snapshot:()=>clone(trackCache(state[key])),
  get:id=>trackCache(byId(state[key],id)),
  getCache:id=>byId(state[key],id),
  exists:id=>Boolean(trackCache(byId(state[key],id))),
  filter:predicate=>trackCache(state[key].filter(predicate)),
  find:predicate=>trackCache(state[key].find(predicate)||null),
  record:(id,operation='update',payload=null)=>durableRecord(entity,id,operation,payload||byId(state[key],id)),
  remove:(id,options)=>durableRemove(entity,id,options)
 });
 const baseBookings=entityRepo('bookings','bookings');
 const baseCustomers=entityRepo('customers','customers');
 const basePayments=entityRepo('receipts','payments');
 const customers=Object.freeze({
  ...baseCustomers,
  indexOf:id=>state.customers.findIndex(x=>String(x?.id)===String(id)),
  mutate(id,mutator,{persist=true,sync=true,operation='update'}={}){
   const item=byId(state.customers,id);
   if(!item)return null;
   const before=clone(item);
   mutator?.(item);
   if(persist&&window.MyfntCustomers?.save?.()===false){Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,before);throw Error('تعذر حفظ العميل محليًا');}
   if(sync)durableRecord('customers',item.id,operation,item);
   return item;
  },
  removeLocal(id,{persist=true}={}){
   const index=state.customers.findIndex(x=>String(x?.id)===String(id));
   if(index<0)return null;
   const [removed]=state.customers.splice(index,1);
   if(persist&&window.MyfntCustomers?.save?.()===false){state.customers.splice(index,0,removed);throw Error('تعذر حفظ حذف العميل محليًا');}
   return removed;
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const previous=state.customers;state.customers=Array.isArray(list)?list:[];
   if(persist&&window.MyfntCustomers?.save?.()===false){state.customers=previous;throw Error('تعذر حفظ دليل العملاء محليًا');}
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});
   return state.customers;
  }
 });
 const payments=Object.freeze({
  ...basePayments,
  indexOf:id=>state.receipts.findIndex(x=>String(x?.id)===String(id)),
  byBooking:bookingId=>state.receipts.filter(x=>String(x?.bookingId)===String(bookingId)),
  activeByBooking:bookingId=>state.receipts.filter(x=>String(x?.bookingId)===String(bookingId)&&x?.status!=='voided'),
  transaction(...args){
   if(!window.MyfntFinance?.transaction)throw Error('وحدة المعاملات المالية غير جاهزة');
   return window.MyfntFinance.transaction(...args);
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const previous=state.receipts;state.receipts=Array.isArray(list)?list:[];
   if(persist&&typeof saveReceipts==='function'&&saveReceipts()===false){state.receipts=previous;throw Error('تعذر حفظ قائمة السندات محليًا');}
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});
   return state.receipts;
  }
 });
 const bookings=Object.freeze({
  ...baseBookings,
  indexOf:id=>state.bookings.findIndex(x=>String(x?.id)===String(id)),
  mutate(id,mutator,{persist=true,sync=true,pending=true,operation='update'}={}){
   const item=byId(state.bookings,id);
   if(!item)return null;
   const before=clone(item);
   mutator?.(item);
   if(persist&&typeof saveBookings==='function'&&saveBookings()===false){Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,before);throw Error('تعذر حفظ الحجز محليًا');}
   if(pending&&typeof markBookingPending==='function')markBookingPending(item);
   if(sync)durableRecord('bookings',item.id,operation,item);
   return item;
  },
  removeLocal(id,{persist=true}={}){
   const index=state.bookings.findIndex(x=>String(x?.id)===String(id));
   if(index<0)return null;
   const [removed]=state.bookings.splice(index,1);
   if(persist&&typeof saveBookings==='function'&&saveBookings()===false){state.bookings.splice(index,0,removed);throw Error('تعذر حفظ حذف الحجز محليًا');}
   return removed;
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const previous=state.bookings;state.bookings=Array.isArray(list)?list:[];
   if(persist&&typeof saveBookings==='function'&&saveBookings()===false){state.bookings=previous;throw Error('تعذر حفظ قائمة الحجوزات محليًا');}
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});
   return state.bookings;
  }
 });
 const basePackages=entityRepo('packages','booking_packages');
 const packages=Object.freeze({
  ...basePackages,
  indexOf:id=>state.packages.findIndex(x=>String(x?.id)===String(id)),
  mutate(id,mutator,{persist=true,sync=true,operation='update'}={}){
   const item=byId(state.packages,id);if(!item)return null;const before=clone(item);mutator?.(item);
   if(persist&&typeof savePackages==='function'&&savePackages()===false){Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,before);throw Error('تعذر حفظ الباقة محليًا');}
   if(sync)durableRecord('booking_packages',item.id,operation,item);
   return item;
  },
  async mutateDurable(id,mutator,{persist=true,operation='update'}={}){
   const item=byId(state.packages,id);if(!item)return null;const before=clone(item);mutator?.(item);
   try{await durableRecord('booking_packages',item.id,operation,item);if(persist)shadow(typeof savePackages==='function'?savePackages:null);return item;}
   catch(e){rollbackObject(item,before);if(persist)shadow(typeof savePackages==='function'?savePackages:null);throw e;}
  },
  add(item,{persist=true,sync=true}={}){
   if(!item?.id)throw Error('معرف الباقة مطلوب');state.packages.push(item);
   if(persist&&typeof savePackages==='function'&&savePackages()===false){state.packages.pop();throw Error('تعذر حفظ الباقة محليًا');}
   if(sync)durableRecord('booking_packages',item.id,'create',item);return item;
  },
  async addDurable(item,{persist=true}={}){
   if(!item?.id)throw Error('معرف الباقة مطلوب');state.packages.push(item);
   try{await durableRecord('booking_packages',item.id,'create',item);if(persist)shadow(typeof savePackages==='function'?savePackages:null);return item;}
   catch(e){const i=state.packages.findIndex(x=>String(x?.id)===String(item.id));if(i>=0)state.packages.splice(i,1);if(persist)shadow(typeof savePackages==='function'?savePackages:null);throw e;}
  },
  removeLocal(id,{persist=true}={}){
   const i=state.packages.findIndex(x=>String(x?.id)===String(id));if(i<0)return null;const [removed]=state.packages.splice(i,1);
   if(persist)shadow(typeof savePackages==='function'?savePackages:null);
   return removed;
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const previous=state.packages;state.packages=Array.isArray(list)?list:[];
   if(persist)shadow(typeof savePackages==='function'?savePackages:null);
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});return state.packages;
  }
 });
 const settings=Object.freeze({
  all:()=>state.settings,
  snapshot:()=>clone(state.settings),
  get(path=''){if(!path)return state.settings;return String(path).split('.').reduce((v,k)=>v?.[k],state.settings);},
  mutate(mutator,{persist=true,sync=true,profileEvent=true}={}){
   const before=clone(state.settings);mutator?.(state.settings);
   if(persist&&typeof saveSettings==='function'&&saveSettings({sync,profileEvent})===false){state.settings=before;throw Error('تعذر حفظ الإعدادات محليًا');}
   return state.settings;
  },
  async mutateDurable(mutator,{persist=true,profileEvent=true}={}){
   const before=clone(state.settings);mutator?.(state.settings);const companyId=window.OzanScope?.read?.()?.companyId;
   try{if(companyId)await durableRecord('company_settings',companyId,'update',state.settings);if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent});return state.settings;}
   catch(e){state.settings=before;if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent});throw e;}
  },
  mutateLocal(mutator,options={}){return this.mutate(mutator,{...options,sync:false});}
 });
 const baseSpecialDays=entityRepo('specialDays','calendar_blocks');
 const specialDays=Object.freeze({
  ...baseSpecialDays,
  indexOf:id=>state.specialDays.findIndex(x=>String(x?.id)===String(id)),
  add(item,{persist=true,sync=true}={}){
   if(!item?.id)throw Error('معرف اليوم المميز مطلوب');state.specialDays.push(item);
   if(persist&&typeof saveSpecialDays==='function'&&saveSpecialDays()===false){state.specialDays.pop();throw Error('تعذر حفظ اليوم المميز محليًا');}
   if(sync)durableRecord('calendar_blocks',item.id,'create',item);return item;
  },
  async addDurable(item,{persist=true}={}){
   if(!item?.id)throw Error('معرف اليوم المميز مطلوب');state.specialDays.push(item);
   try{await durableRecord('calendar_blocks',item.id,'create',item);if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);return item;}
   catch(e){const i=state.specialDays.findIndex(x=>String(x?.id)===String(item.id));if(i>=0)state.specialDays.splice(i,1);if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);throw e;}
  },
  mutate(id,mutator,{persist=true,sync=true,operation='update'}={}){
   const item=byId(state.specialDays,id);if(!item)return null;const before=clone(item);mutator?.(item);
   if(persist&&typeof saveSpecialDays==='function'&&saveSpecialDays()===false){Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,before);throw Error('تعذر حفظ اليوم المميز محليًا');}
   if(sync)durableRecord('calendar_blocks',item.id,operation,item);return item;
  },
  async mutateDurable(id,mutator,{persist=true,operation='update'}={}){
   const item=byId(state.specialDays,id);if(!item)return null;const before=clone(item);mutator?.(item);
   try{await durableRecord('calendar_blocks',item.id,operation,item);if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);return item;}
   catch(e){rollbackObject(item,before);if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);throw e;}
  },
  removeLocal(id,{persist=true}={}){
   const i=state.specialDays.findIndex(x=>String(x?.id)===String(id));if(i<0)return null;const [removed]=state.specialDays.splice(i,1);
   if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);
   return removed;
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const previous=state.specialDays;state.specialDays=Array.isArray(list)?list:[];
   if(persist)shadow(typeof saveSpecialDays==='function'?saveSpecialDays:null);
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});return state.specialDays;
  }
 });
 const alerts=Object.freeze({
  all:()=>Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[],
  snapshot:()=>clone(Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[]),
  get:id=>byId(Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[],id),
  exists:id=>Boolean(byId(Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[],id)),
  add(item,{persist=true,sync=true}={}){
   if(!item?.id)throw Error('معرف قاعدة التنبيه مطلوب');const list=Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:(state.settings.alertTemplates=[]);list.push(item);
   if(persist&&typeof saveSettings==='function'&&saveSettings({sync:false,profileEvent:false})===false){list.pop();throw Error('تعذر حفظ قاعدة التنبيه محليًا');}
   if(sync)durableRecord('alert_rules',item.id,'create',item);return item;
  },
  async addDurable(item,{persist=true}={}){
   if(!item?.id)throw Error('معرف قاعدة التنبيه مطلوب');const list=Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:(state.settings.alertTemplates=[]);list.push(item);
   try{await durableRecord('alert_rules',item.id,'create',item);if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});return item;}
   catch(e){const i=list.findIndex(x=>String(x?.id)===String(item.id));if(i>=0)list.splice(i,1);if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});throw e;}
  },
  mutate(id,mutator,{persist=true,sync=true}={}){
   const list=Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[];const item=byId(list,id);if(!item)return null;const before=clone(item);mutator?.(item);
   if(persist&&typeof saveSettings==='function'&&saveSettings({sync:false,profileEvent:false})===false){Object.keys(item).forEach(k=>delete item[k]);Object.assign(item,before);throw Error('تعذر حفظ قاعدة التنبيه محليًا');}
   if(sync)durableRecord('alert_rules',item.id,'update',item);return item;
  },
  async mutateDurable(id,mutator,{persist=true}={}){
   const list=Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[];const item=byId(list,id);if(!item)return null;const before=clone(item);mutator?.(item);
   try{await durableRecord('alert_rules',item.id,'update',item);if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});return item;}
   catch(e){rollbackObject(item,before);if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});throw e;}
  },
  removeLocal(id,{persist=true}={}){
   const list=Array.isArray(state.settings.alertTemplates)?state.settings.alertTemplates:[];const i=list.findIndex(x=>String(x?.id)===String(id));if(i<0)return null;const [removed]=list.splice(i,1);
   if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});
   return removed;
  },
  replaceLocal(list,{persist=true,reconcile=false}={}){
   const before=state.settings.alertTemplates;state.settings.alertTemplates=Array.isArray(list)?list:[];
   if(persist)shadow(typeof saveSettings==='function'?saveSettings:null,{sync:false,profileEvent:false});
   if(reconcile)window.MyfntOffline?.reconcile?.({reason:'seed',enqueue:false});return state.settings.alertTemplates;
  }
 });
 const durable=Object.freeze({
  bookings:Object.freeze({get:async id=>{metrics.durableReads++;return (await query()?.bookingContext?.(id))?.booking||null;},search:async(term,opts)=>{metrics.durableReads++;return query()?.searchBookings?.(term,opts)||[];},month:async(date,opts)=>{metrics.durableReads++;return query()?.bookingsMonthView?.(date,opts)||[];}}),
  customers:Object.freeze({get:async id=>{metrics.durableReads++;return (await query()?.customerContext?.(id))?.customer||null;},matches:async(term,opts)=>{metrics.durableReads++;return query()?.customerMatches?.(term,opts)||[];},page:async opts=>{metrics.durableReads++;return query()?.customerPage?.(opts)||{items:[],total:0};}}),
  payments:Object.freeze({byBooking:async(id,opts)=>{metrics.durableReads++;return query()?.paymentsByBooking?.(id,opts)||[];},page:async opts=>{metrics.durableReads++;return query()?.paymentPage?.(opts)||{items:[],total:0};},stats:async()=>{metrics.durableReads++;return query()?.paymentStats?.()||null;}})
 });
 async function flush(){await Promise.allSettled([...pendingWrites]);return {pending:pendingWrites.size,...metrics};}
 function authority(){return {version:2,domain:'indexeddb',query:'MyfntQuery',uiCache:'state',legacySyncReads:'compatibility-only',writes:'MyfntOffline -> MyfntLocal',apiReadyBoundary:'repository durable namespace + flush'};}
 function audit(){return {healthy:Boolean(window.MyfntLocal&&window.MyfntQuery&&window.MyfntOffline),authority:authority(),metrics:{...metrics,pendingWrites:pendingWrites.size},capabilities:{durableBookings:Boolean(query()?.bookingContext),durableCustomers:Boolean(query()?.customerContext),durablePayments:Boolean(query()?.paymentPage),flush:true}};}
 window.MyfntRepositories=Object.freeze({bookings,customers,packages,payments,settings,specialDays,alerts,durable,flush,authority,audit,resetMetrics:()=>{for(const k of Object.keys(metrics))metrics[k]=0;}});
})();
