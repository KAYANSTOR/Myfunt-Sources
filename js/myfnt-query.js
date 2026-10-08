/* Myfnt 2.12.8 Step 21K — Lazy notification/query runtime.
 * Index-backed reads for month/range/customer/payment views.
 * Keeps current UI facade intact while removing repeated full-array scans.
 */
'use strict';
(()=>{
 const local=()=>window.MyfntLocal;
 const scope=()=>window.OzanScope?.read?.()||null;
 const once=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const assertDate=v=>{v=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(v))throw Error('تاريخ الاستعلام غير صالح');return v;};
 const clampLimit=(limit,fallback=500,max=10000)=>Math.max(1,Math.min(Number(limit)||fallback,max));
 async function ctx(){const s=scope();if(!s?.companyId||!s?.userId)throw Error('لا توجد مساحة شركة نشطة');const api=local();if(!api?.open||!api?.uuidFor)throw Error('قاعدة Myfnt المحلية غير جاهزة');return {db:await api.open(),companyId:await api.uuidFor('companies',s.companyId)};}
 function bounded(index,range,limit=500,{direction='next'}={}){return new Promise((resolve,reject)=>{const out=[],req=index.openCursor(range,direction);req.onsuccess=()=>{const cur=req.result;if(!cur||out.length>=limit)return resolve(out);out.push(cur.value);cur.continue();};req.onerror=()=>reject(req.error);});}
 async function bookingsRange({from,to,status=null,limit=500}={}){
   from=assertDate(from);to=assertDate(to);if(to<from)throw Error('نهاية نطاق الحجوزات تسبق بدايته');
   const {db,companyId}=await ctx(),tx=db.transaction('bookings','readonly'),store=tx.objectStore('bookings'),safeLimit=clampLimit(limit,500);
   let rows;
   if(status&&store.indexNames.contains('company_status_date')){
     const range=IDBKeyRange.bound([companyId,String(status),from],[companyId,String(status),to]);
     rows=await bounded(store.index('company_status_date'),range,safeLimit);
   }else{
     const range=IDBKeyRange.bound([companyId,from],[companyId,to]);
     rows=await bounded(store.index('company_date'),range,safeLimit);
     if(status)rows=rows.filter(x=>x.status===status);
   }
   return rows;
 }
 async function bookingsMonth(year,month,{status=null,limit=5000}={}){
   year=Number(year);month=Number(month);if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12)throw Error('شهر الاستعلام غير صالح');
   const last=new Date(Date.UTC(year,month,0)).getUTCDate(),m=String(month).padStart(2,'0');
   return bookingsRange({from:`${year}-${m}-01`,to:`${year}-${m}-${String(last).padStart(2,'0')}`,status,limit});
 }
 async function bookingsMonthView(year,month,{limit=5000}={}){
   const rows=(await bookingsMonth(year,month,{limit:clampLimit(limit,5000)})).filter(row=>!['cancelled','archived'].includes(row.status));
   if(!rows.length)return [];
   const {db,companyId}=await ctx();
   const tx=db.transaction(['booking_details','payments'],'readonly'),detailIdx=tx.objectStore('booking_details').index('booking_id'),paymentIdx=tx.objectStore('payments').index('company_booking');
   // Fire all indexed requests inside one transaction before awaiting, so IndexedDB can schedule them together.
   const detailReqs=rows.map(row=>once(detailIdx.get(row.id)).catch(()=>null));
   const paymentReqs=rows.map(row=>once(paymentIdx.getAll([companyId,row.id])).catch(()=>[]));
   const [details,paymentLists]=await Promise.all([Promise.all(detailReqs),Promise.all(paymentReqs)]);
   const packageIds=[...new Set(details.map(d=>d?.package_id).filter(Boolean))],packageLegacy=new Map();for(const id of packageIds){const pr=await once(db.transaction('booking_packages','readonly').objectStore('booking_packages').get(id));if(pr)packageLegacy.set(String(id),legacyId(pr));}
   return rows.map((row,i)=>{
     const d=details[i]||{},payments=paymentLists[i]||[];
     let paidMinor=0;
     for(const p of payments){if(p.status==='reversed'||p.status==='voided')continue;paidMinor+=(p.direction==='out'?-1:1)*Number(p.amount_minor||0);}
     const normalizedStatus=row.status==='archived'?'archived':row.status==='cancelled'?'cancelled':row.status==='completed'?'completed':row.confirmation==='temporary'?'pending':'confirmed';
     return {
       id:String(row.legacy_id||row.id),
       bookingNo:String(row.booking_no||''),
       customerId:null,
       packageId:d.package_id?(packageLegacy.get(String(d.package_id))||String(d.package_id)):null,
       name:String(d.customer_name_snapshot||''),
       phone:String(d.customer_phone_snapshot||''),
       address:String(d.address_snapshot||''),
       date:String(row.event_date||''),
       hasTime:Boolean(row.starts_at&&row.ends_at),
       timeFrom:row.starts_at||'',timeTo:row.ends_at||'',
       type:String(d.package_name_snapshot||'مناسبة'),
       amount:Number(d.agreed_total_minor||0)/100,
       paid:Math.max(0,paidMinor/100),
       currency:String(d.currency||'YER'),
       notes:String(d.description||''),
       status:normalizedStatus,
       createdAt:row.local_created_at?Date.parse(row.local_created_at)||0:0,
       updatedAt:row.local_updated_at?Date.parse(row.local_updated_at)||0:0,
       createdById:row.created_by_id||null,createdBy:row.created_by_name||null,
       updatedById:row.updated_by_id||null,updatedBy:row.updated_by_name||null,
       serverVersion:Number(row.server_version)||0,
       syncStatus:'local',
       __queryRow:true
     };
   });
 }
 async function bookingByNumber(bookingNo){
   const {db,companyId}=await ctx(),tx=db.transaction('bookings','readonly'),idx=tx.objectStore('bookings').index('company_booking_no');
   const row=await once(idx.get([companyId,String(bookingNo||'')]));return row||null;
 }
 async function bookingsByCustomer(customerLegacyId,{limit=500}={}){
   const {db,companyId}=await ctx(),customerId=await local().uuidFor('customers',customerLegacyId),tx=db.transaction('bookings','readonly'),idx=tx.objectStore('bookings').index('company_customer');
   return bounded(idx,IDBKeyRange.only([companyId,customerId]),clampLimit(limit,500,5000));
 }
 async function bookingDetails(bookingLegacyId){
   const {db}=await ctx(),bookingId=await local().uuidFor('bookings',bookingLegacyId),tx=db.transaction('booking_details','readonly'),idx=tx.objectStore('booking_details').index('booking_id');
   const row=await once(idx.get(bookingId));return row||null;
 }
 async function paymentsByBooking(bookingLegacyId,{limit=1000}={}){
   const {db,companyId}=await ctx(),bookingId=await local().uuidFor('bookings',bookingLegacyId),tx=db.transaction('payments','readonly'),idx=tx.objectStore('payments').index('company_booking');
   return bounded(idx,IDBKeyRange.only([companyId,bookingId]),clampLimit(limit,1000,5000));
 }
 async function customerByPhone(phone){
   const {db,companyId}=await ctx(),key=window.MyfntCustomers?.phoneKey?.(phone)||String(phone||'').replace(/\D/g,''),tx=db.transaction('customers','readonly'),idx=tx.objectStore('customers').index('company_phone');
   const rows=await once(idx.getAll([companyId,key]));return rows||[];
 }
 async function customerByName(name){
   const {db,companyId}=await ctx(),key=window.MyfntCustomers?.nameKey?.(name)||String(name||'').trim().toLowerCase(),tx=db.transaction('customers','readonly'),idx=tx.objectStore('customers').index('company_name');
   const rows=await once(idx.getAll([companyId,key]));return rows||[];
 }

 const norm=v=>String(v||'').normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim();
 const legacyId=row=>String(row?.legacy_id||row?.id||'');
 const ms=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0;};
 const hhmm=v=>{if(!v)return '';const m=String(v).match(/(?:T|^)(\d{2}:\d{2})/);return m?m[1]:String(v).slice(0,5);};
 function customerLegacy(row){if(!row)return null;const mapped=window.MyfntMappers?.customer?.fromRow?.(row);if(mapped)return mapped;return {id:legacyId(row),customerNo:String(row.customer_no||''),name:String(row.name||''),phone:String(row.phone_e164||''),address:String(row.address||''),notes:String(row.notes||''),createdAt:ms(row.created_at||row.local_created_at),updatedAt:ms(row.updated_at||row.local_updated_at)};}
 function paymentLegacy(row,booking=null){if(!row)return null;const bmap=new Map();if(booking&&row.booking_id)bmap.set(String(row.booking_id),booking);const mapped=window.MyfntMappers?.payment?.fromRow?.(row,{bookingByUuid:bmap,customerByUuid:new Map()});if(mapped)return {...mapped,__queryRow:true};return {id:legacyId(row),receiptNo:String(row.receipt_no||legacyId(row)),movementNo:String(row.movement_no||''),bookingId:booking?.id||String(row.booking_legacy_id||''),customerId:booking?.customerId||String(row.customer_legacy_id||''),direction:row.direction==='out'?'out':'in',amount:Number(row.amount_minor||0)/100,currency:String(row.currency||booking?.currency||'YER'),method:row.payment_method||'cash',reference:row.external_reference||'',note:row.memo||'',tag:row.tag||'',date:String(row.posted_at||'').slice(0,10),status:['reversed','voided'].includes(row.status)?'voided':'active',voidReason:row.reversal_reason||'',createdById:row.created_by_id||'',createdBy:row.created_by_name||row.edited_by_name_snapshot||'مستخدم',editedById:row.edited_by_id||'',editedByName:row.edited_by_name_snapshot||'',createdAt:ms(row.posted_at),updatedAt:ms(row.updated_at||row.posted_at),__queryRow:true};}
 async function packageLegacyId(packageUuid){if(!packageUuid)return '';const {db}=await ctx();const row=await once(db.transaction('booking_packages','readonly').objectStore('booking_packages').get(packageUuid));return legacyId(row);}
 function bookingLegacy(row,detail=null,customer=null,payments=[]){if(!row)return null;let paidMinor=Number(row.paid_minor);if(!Number.isFinite(paidMinor)){paidMinor=0;for(const p of payments||[])if(!['reversed','voided'].includes(p.status))paidMinor+=(p.direction==='out'?-1:1)*Number(p.amount_minor||0);}
   const mappedRow={...row,paid_minor:paidMinor},customers=new Map(),packages=new Map();if(customer&&row.customer_id)customers.set(String(row.customer_id),customer);if(detail?.package_id)packages.set(String(detail.package_id),{id:String(detail.package_legacy_id||detail.package_id),name:String(detail.package_name_snapshot||'مناسبة')});
   const mapped=window.MyfntMappers?.booking?.fromRows?.(mappedRow,detail,{customersByUuid:customers,packagesByUuid:packages,syncStatus:'local'});if(mapped)return {...mapped,__queryRow:true};
   const status=row.status==='archived'?'archived':row.status==='cancelled'?'cancelled':row.status==='completed'?'completed':row.confirmation==='temporary'?'pending':'confirmed';
   return {id:legacyId(row),bookingNo:String(row.booking_no||''),customerId:customer?.id||String(row.customer_legacy_id||''),packageId:detail?.package_id?String(detail.package_legacy_id||detail.package_id):'',name:String(detail?.customer_name_snapshot||row.customer_name_snapshot||customer?.name||''),phone:String(detail?.customer_phone_snapshot||row.customer_phone_snapshot||customer?.phone||''),address:String(detail?.address_snapshot||customer?.address||''),date:String(row.event_date||''),hasTime:Boolean(row.starts_at||row.ends_at),timeFrom:hhmm(row.starts_at)||'09:00',timeTo:hhmm(row.ends_at)||'21:00',type:String(detail?.package_name_snapshot||row.package_name_snapshot||'مناسبة'),amount:Number(detail?.agreed_total_minor??row.amount_minor??0)/100,paid:Math.max(0,paidMinor/100),currency:String(detail?.currency||row.currency||'YER'),notes:String(detail?.description||''),status,temporaryExpiresAt:row.temporary_expires_at?ms(row.temporary_expires_at):0,depositPending:status==='pending'&&Number(detail?.deposit_minor_snapshot||0)>0,depositRequired:Number(detail?.deposit_minor_snapshot||0)/100,createdAt:ms(row.local_created_at||row.created_at),updatedAt:ms(row.local_updated_at||row.updated_at),createdById:row.created_by_id||'',createdBy:row.created_by_name||'مستخدم',updatedById:row.updated_by_id||'',updatedBy:row.updated_by_name||'',serverVersion:Number(row.server_version)||0,syncStatus:'local',__queryRow:true};}
 async function bookingContext(legacyBookingId){const {db,companyId}=await ctx(),bookingId=await local().uuidFor('bookings',legacyBookingId);const row=await once(db.transaction('bookings','readonly').objectStore('bookings').get(bookingId));if(!row)return null;const detailPromise=once(db.transaction('booking_details','readonly').objectStore('booking_details').index('booking_id').get(bookingId));const customerPromise=row.customer_id?once(db.transaction('customers','readonly').objectStore('customers').get(row.customer_id)):Promise.resolve(null);const paymentsPromise=once(db.transaction('payments','readonly').objectStore('payments').index('company_booking').getAll([companyId,bookingId]));const [detail,customerRow,paymentRows]=await Promise.all([detailPromise,customerPromise,paymentsPromise]);if(detail?.package_id)detail.package_legacy_id=await packageLegacyId(detail.package_id);const customer=customerLegacy(customerRow),booking=bookingLegacy(row,detail,customer,paymentRows);const payments=(paymentRows||[]).map(x=>paymentLegacy(x,booking));return {booking,customer,payments,row,detail};}
 function upsert(list,item){if(!item)return;const i=list.findIndex(x=>String(x?.id)===String(item.id));if(i<0)list.push(item);else Object.assign(list[i],item);}
 async function ensureBooking(legacyBookingId){const context=await bookingContext(legacyBookingId);if(!context)return null;upsert(state.bookings,context.booking);if(context.customer)upsert(state.customers,context.customer);for(const r of context.payments)upsert(state.receipts,r);window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;return context.booking;}
 async function searchBookingsIndexed(term,{limit=30}={}){const q=norm(term);if(!q)return [];const {db,companyId}=await ctx(),max=clampLimit(limit,30,100),matches=[];await new Promise((resolve,reject)=>{const tx=db.transaction(['bookings','booking_details'],'readonly'),store=tx.objectStore('bookings'),details=tx.objectStore('booking_details').index('booking_id'),req=store.index('company_id').openCursor(IDBKeyRange.only(companyId));req.onsuccess=()=>{const c=req.result;if(!c||matches.length>=max)return resolve();const row=c.value||{},base=norm(row.search_text||[row.booking_no,row.event_date,row.customer_name_snapshot,row.customer_phone_snapshot,row.package_name_snapshot].join(' '));if(base.includes(q)){matches.push({row,detail:null});c.continue();return;}if(row.search_text){c.continue();return;}const dr=details.get(row.id);dr.onsuccess=()=>{const d=dr.result||{},text=norm([row.booking_no,row.event_date,d.customer_name_snapshot,d.customer_phone_snapshot,d.package_name_snapshot,d.description].join(' '));if(text.includes(q))matches.push({row,detail:d});c.continue();};dr.onerror=()=>c.continue();};req.onerror=()=>reject(req.error);});
   const out=[];for(const hit of matches){let d=hit.detail;if(!d){const tx=db.transaction('booking_details','readonly');d=await once(tx.objectStore('booking_details').index('booking_id').get(hit.row.id));}out.push(bookingLegacy(hit.row,d,null,[]));}return out;}
 async function paymentPage({query='',status='active',sort='newest',page=0,pageSize=25}={}){const {db,companyId}=await ctx(),q=norm(query),size=Math.max(1,Math.min(100,Number(pageSize)||25)),skip=Math.max(0,Number(page)||0)*size,rows=[],direction=sort==='oldest'?'next':sort==='amount-low'?'next':sort==='amount-high'?'prev':'prev';let matched=0;await new Promise((resolve,reject)=>{const tx=db.transaction(['payments','bookings','booking_details'],'readonly'),store=tx.objectStore('payments'),bookings=tx.objectStore('bookings'),details=tx.objectStore('booking_details').index('booking_id'),idx=(sort==='amount-high'||sort==='amount-low')&&store.indexNames.contains('company_amount')?store.index('company_amount'):store.index('company_posted'),range=sort.startsWith('amount')?IDBKeyRange.bound([companyId,0],[companyId,Number.MAX_SAFE_INTEGER]):IDBKeyRange.bound([companyId,''],[companyId,'\uffff']),req=idx.openCursor(range,direction);
     const accept=(row,text,c)=>{const isVoid=['reversed','voided'].includes(row.status),statusOk=status==='all'||(status==='voided'?isVoid:!isVoid);if(statusOk&&(!q||norm(text).includes(q))){if(matched>=skip&&rows.length<size)rows.push(row);matched++;}c.continue();};
     req.onsuccess=()=>{const c=req.result;if(!c)return resolve();const row=c.value||{},base=row.search_text||[row.receipt_no,row.movement_no,row.external_reference,row.tag,row.memo,row.booking_no_snapshot,row.customer_name_snapshot,row.customer_phone_snapshot].join(' ');if(!q||row.search_text||norm(base).includes(q)){accept(row,base,c);return;}const br=bookings.get(row.booking_id);br.onsuccess=()=>{const b=br.result||{},dr=details.get(row.booking_id);dr.onsuccess=()=>{const d=dr.result||{},text=[base,b.booking_no,b.event_date,b.customer_name_snapshot,b.customer_phone_snapshot,d.customer_name_snapshot,d.customer_phone_snapshot,d.package_name_snapshot,d.description].join(' ');accept(row,text,c);};dr.onerror=()=>accept(row,base,c);};br.onerror=()=>accept(row,base,c);};req.onerror=()=>reject(req.error);});
   const items=[];for(const row of rows){const br=await once(db.transaction('bookings','readonly').objectStore('bookings').get(row.booking_id)),dr=br?await once(db.transaction('booking_details','readonly').objectStore('booking_details').index('booking_id').get(row.booking_id)):null;if(dr?.package_id)dr.package_legacy_id=await packageLegacyId(dr.package_id);const b=bookingLegacy(br,dr,null,[row]),r=paymentLegacy(row,b);items.push({payment:r,booking:b});}return {items,total:matched,page:Number(page)||0,pageSize:size};}
 async function customerContext(legacyCustomerId){const {db,companyId}=await ctx(),customerId=await local().uuidFor('customers',legacyCustomerId),customerRow=await once(db.transaction('customers','readonly').objectStore('customers').get(customerId));if(!customerRow)return null;const bookingRows=await once(db.transaction('bookings','readonly').objectStore('bookings').index('company_customer').getAll([companyId,customerId]));const bookings=[];const payments=[],customer=customerLegacy(customerRow);for(const row of bookingRows||[]){const [detail,prs]=await Promise.all([once(db.transaction('booking_details','readonly').objectStore('booking_details').index('booking_id').get(row.id)),once(db.transaction('payments','readonly').objectStore('payments').index('company_booking').getAll([companyId,row.id]))]);if(detail?.package_id)detail.package_legacy_id=await packageLegacyId(detail.package_id);const b=bookingLegacy(row,detail,customer,prs);bookings.push(b);payments.push(...prs.map(x=>paymentLegacy(x,b)));}return {customer,bookings,payments};}
 async function ensurePayment(legacyPaymentId){const {db}=await ctx(),paymentId=await local().uuidFor('payments',legacyPaymentId),row=await once(db.transaction('payments','readonly').objectStore('payments').get(paymentId));if(!row)return null;if(row.booking_id){const bookingRow=await once(db.transaction('bookings','readonly').objectStore('bookings').get(row.booking_id));if(bookingRow){await ensureBooking(legacyId(bookingRow));return state.receipts.find(x=>String(x?.id)===String(legacyPaymentId))||null;}}const payment=paymentLegacy(row,null);upsert(state.receipts,payment);return payment;}
 async function ensureCustomer(legacyCustomerId){const c=await customerContext(legacyCustomerId);if(!c)return null;upsert(state.customers,c.customer);for(const b of c.bookings)upsert(state.bookings,b);for(const r of c.payments)upsert(state.receipts,r);window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;return c;}
 async function customerMatches(name,phone){const rows=await customerByName(name),phoneKey=window.MyfntCustomers?.phoneKey?.(phone)||String(phone||'').replace(/\D/g,'');return (rows||[]).filter(r=>String(r.phone_key||'')===String(phoneKey||'')).map(customerLegacy);}
 async function customerPage({query='',page=0,pageSize=25}={}){const {db,companyId}=await ctx(),q=norm(query),size=Math.max(1,Math.min(100,Number(pageSize)||25)),skip=Math.max(0,Number(page)||0)*size,rows=[];let matched=0;await new Promise((resolve,reject)=>{const tx=db.transaction('customers','readonly'),idx=tx.objectStore('customers').index('company_id'),req=idx.openCursor(IDBKeyRange.only(companyId));req.onsuccess=()=>{const c=req.result;if(!c)return resolve();const row=c.value||{},text=norm(row.search_text||[row.customer_no,row.name,row.phone_e164,row.address].join(' '));if(!q||text.includes(q)){if(matched>=skip&&rows.length<size)rows.push(row);matched++;}c.continue();};req.onerror=()=>reject(req.error);});
   const items=[];for(const row of rows){const bookingRows=await once(db.transaction('bookings','readonly').objectStore('bookings').index('company_customer').getAll([companyId,row.id])),totals=new Map();let lastDate='',activeCount=0;for(const b of bookingRows||[]){if(String(b.event_date||'')>lastDate)lastDate=String(b.event_date||'');if(['cancelled','archived'].includes(b.status))continue;activeCount++;let amountMinor=Number(b.amount_minor),paidMinor=Number(b.paid_minor),currency=String(b.currency||'');if(!Number.isFinite(amountMinor)||!currency){const d=await once(db.transaction('booking_details','readonly').objectStore('booking_details').index('booking_id').get(b.id));amountMinor=Number(d?.agreed_total_minor||0);currency=String(d?.currency||'YER');}if(!Number.isFinite(paidMinor)){const prs=await once(db.transaction('payments','readonly').objectStore('payments').index('company_booking').getAll([companyId,b.id]));paidMinor=0;for(const pr of prs||[])if(!['reversed','voided'].includes(pr.status))paidMinor+=(pr.direction==='out'?-1:1)*Number(pr.amount_minor||0);}const cur=currency||'YER',v=totals.get(cur)||{total:0,paid:0};v.total+=Math.max(0,amountMinor||0)/100;v.paid+=Math.max(0,paidMinor||0)/100;totals.set(cur,v);}items.push({customer:customerLegacy(row),summary:{bookingCount:(bookingRows||[]).length,activeCount,lastDate,totals:[...totals]}});}return {items,total:matched,page:Number(page)||0,pageSize:size};}
 async function paymentStats(){const {db,companyId}=await ctx(),received=new Map(),spent=new Map(),net=new Map(),paidByBooking=new Map(),bookingInfo=new Map();let incoming=0,outgoing=0;
   await new Promise((resolve,reject)=>{const tx=db.transaction('payments','readonly'),req=tx.objectStore('payments').index('company_id').openCursor(IDBKeyRange.only(companyId));req.onsuccess=()=>{const c=req.result;if(!c)return resolve();const r=c.value||{};if(!['reversed','voided'].includes(r.status)){const currency=String(r.currency||'YER'),amount=Number(r.amount_minor||0)/100,target=r.direction==='out'?spent:received;target.set(currency,(target.get(currency)||0)+amount);net.set(currency,(net.get(currency)||0)+(r.direction==='out'?-amount:amount));paidByBooking.set(String(r.booking_id||''),(paidByBooking.get(String(r.booking_id||''))||0)+(r.direction==='out'?-Number(r.amount_minor||0):Number(r.amount_minor||0)));r.direction==='out'?outgoing++:incoming++;}c.continue();};req.onerror=()=>reject(req.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('bookings','readonly'),req=tx.objectStore('bookings').index('company_id').openCursor(IDBKeyRange.only(companyId));req.onsuccess=()=>{const c=req.result;if(!c)return resolve();const r=c.value||{};bookingInfo.set(String(r.id),{status:r.status,amountMinor:Number.isFinite(Number(r.amount_minor))?Number(r.amount_minor):null,currency:r.currency||null});c.continue();};req.onerror=()=>reject(req.error);});
   const missing=new Set([...bookingInfo].filter(([,v])=>v.amountMinor==null||!v.currency).map(([id])=>id));if(missing.size){await new Promise((resolve,reject)=>{const tx=db.transaction('booking_details','readonly'),req=tx.objectStore('booking_details').index('company_id').openCursor(IDBKeyRange.only(companyId));req.onsuccess=()=>{const c=req.result;if(!c)return resolve();const d=c.value||{},id=String(d.booking_id||'');if(missing.has(id)){const info=bookingInfo.get(id);if(info){info.amountMinor=Number(d.agreed_total_minor||0);info.currency=d.currency||'YER';missing.delete(id);}}c.continue();};req.onerror=()=>reject(req.error);});}
   const owed=new Map();for(const [id,b] of bookingInfo){if(['cancelled','archived'].includes(b.status))continue;const cur=String(b.currency||'YER'),remaining=Math.max(0,Number(b.amountMinor||0)-Number(paidByBooking.get(id)||0))/100;owed.set(cur,(owed.get(cur)||0)+remaining);}return {received,spent,net,owed,incoming,outgoing};}


 async function notificationBookingCandidates({from='',to='',pastLimit=120,limit=12000}={}){
   const today=new Date().toISOString().slice(0,10),safeFrom=assertDate(from||today),safeTo=assertDate(to||today),safeLimit=clampLimit(limit,12000,50000),keepPast=Math.max(0,Math.min(Number(pastLimit)||120,1000));
   const {db,companyId}=await ctx(),rows=[],seen=new Set();
   const add=row=>{if(!row||seen.has(String(row.id))||['cancelled','archived'].includes(String(row.status||'')))return;seen.add(String(row.id));rows.push(row);};
   {
     const tx=db.transaction('bookings','readonly'),idx=tx.objectStore('bookings').index('company_date'),range=IDBKeyRange.bound([companyId,safeFrom],[companyId,safeTo]);
     const current=await bounded(idx,range,safeLimit);for(const row of current)add(row);
   }
   if(keepPast>0){
     await new Promise((resolve,reject)=>{let count=0;const tx=db.transaction('bookings','readonly'),idx=tx.objectStore('bookings').index('company_date'),range=IDBKeyRange.bound([companyId,'0000-01-01'],[companyId,safeFrom],false,true),req=idx.openCursor(range,'prev');req.onsuccess=()=>{const c=req.result;if(!c||count>=keepPast||rows.length>=safeLimit)return resolve();const row=c.value||{};if(!['cancelled','archived'].includes(String(row.status||''))){add(row);count++;}c.continue();};req.onerror=()=>reject(req.error);});
   }
   return rows.map(row=>({
     id:legacyId(row),bookingNo:String(row.booking_no||''),customerId:String(row.customer_legacy_id||''),packageId:String(row.package_legacy_id||''),
     name:String(row.customer_name_snapshot||''),phone:String(row.customer_phone_snapshot||''),address:'',date:String(row.event_date||''),
     hasTime:Boolean(row.starts_at&&row.ends_at),timeFrom:hhmm(row.starts_at),timeTo:hhmm(row.ends_at),type:String(row.package_name_snapshot||'مناسبة'),
     amount:Number(row.amount_minor||0)/100,paid:Number(row.paid_minor||0)/100,currency:String(row.currency||'YER'),notes:'',
     status:row.status==='archived'?'archived':row.status==='cancelled'?'cancelled':row.status==='completed'?'completed':row.confirmation==='temporary'?'pending':'confirmed',
     temporaryExpiresAt:ms(row.temporary_expires_at),createdAt:ms(row.local_created_at),updatedAt:ms(row.local_updated_at||row.local_created_at),
     createdById:row.created_by_id||'',createdBy:row.created_by_name||'',updatedById:row.updated_by_id||'',updatedBy:row.updated_by_name||'',__notificationQuery:true
   })).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
 }

 async function paymentAudit(legacyPaymentId,{limit=500}={}){
   const {db,companyId}=await ctx(),paymentId=await local().uuidFor('payments',legacyPaymentId),safeLimit=clampLimit(limit,500,5000),rows=[];
   await new Promise((resolve,reject)=>{const tx=db.transaction('payment_audit','readonly'),idx=tx.objectStore('payment_audit').index('company_id'),req=idx.openCursor(IDBKeyRange.only(companyId),'prev');req.onsuccess=()=>{const c=req.result;if(!c||rows.length>=safeLimit)return resolve();const r=c.value||{};if(String(r.payment_id||'')===String(paymentId))rows.push(r);c.continue();};req.onerror=()=>reject(req.error);});
   return rows.map(r=>({id:legacyId(r),entityId:String(legacyPaymentId),bookingId:'',type:({correct:'edit',reverse:'void',legacy_import:'opening-migration',create:'create'})[r.action]||String(r.action||'historical'),actorName:String(r.actor_name_snapshot||'مستخدم'),actorId:String(r.actor_id||'local'),reason:String(r.reason||''),before:r.before_json??null,after:r.after_json??null,at:ms(r.happened_at)})).sort((a,b)=>b.at-a.at);
 }
 async function exportLegacyDataset(){const snap=await local().hydrationSnapshot({forceFull:true}),t=snap.tables||{},customerByUuid=new Map((t.customers||[]).map(r=>[String(r.id),customerLegacy(r)])),packageByUuid=new Map((t.booking_packages||[]).map(r=>[String(r.id),legacyId(r)])),detailByBooking=new Map((t.booking_details||[]).map(r=>{if(r.package_id)r.package_legacy_id=packageByUuid.get(String(r.package_id))||'';return [String(r.booking_id),r];})),paymentsByBooking=new Map();for(const p of t.payments||[]){const k=String(p.booking_id||'');if(!paymentsByBooking.has(k))paymentsByBooking.set(k,[]);paymentsByBooking.get(k).push(p);}const bookings=[];for(const row of t.bookings||[]){const c=customerByUuid.get(String(row.customer_id||'')),b=bookingLegacy(row,detailByBooking.get(String(row.id)),c,paymentsByBooking.get(String(row.id))||[]);if(b)bookings.push(b);}const legacyBookingMap=new Map(bookings.map(b=>[String(b.id),b])),bookingByUuid=new Map((t.bookings||[]).map(r=>[String(r.id),legacyBookingMap.get(legacyId(r))]));const receipts=(t.payments||[]).map(r=>paymentLegacy(r,bookingByUuid.get(String(r.booking_id)))).filter(Boolean);return {bookings,customers:[...customerByUuid.values()],receipts,counts:snap.lazy?.counts||{bookings:bookings.length,customers:customerByUuid.size,payments:receipts.length}};}
 window.MyfntQuery=Object.freeze({bookingsRange,bookingsMonth,bookingsMonthView,bookingByNumber,bookingsByCustomer,bookingDetails,paymentsByBooking,customerByPhone,customerByName,bookingContext,ensureBooking,searchBookings:searchBookingsIndexed,paymentPage,ensurePayment,customerContext,ensureCustomer,customerMatches,customerPage,paymentStats,paymentAudit,notificationBookingCandidates,exportLegacyDataset});
})();
