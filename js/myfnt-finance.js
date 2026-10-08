/* Myfnt 2.10.1 Step 21B: IndexedDB-authoritative local finance and customer directory.
   NOT a server trust boundary; server must validate auth, company, ledger and roles. */
'use strict';
(()=>{
 const AUDIT_KEY='ozan.finance.audit.v1', JOURNAL_KEY='ozan.finance.journal.v1', CUSTOMERS_KEY='ozan.finance.customers.v1', DIRECTORY_KEY='ozan.customers.directory.v1';
 const q=id=>document.getElementById(id), esc=v=>escapeHtml(String(v??''));
 const customerRepository=()=>window.MyfntRepositories?.customers||null;
 const paymentRepository=()=>window.MyfntRepositories?.payments||null;
 const allPayments=()=>paymentRepository()?.all?.()||(Array.isArray(state.receipts)?state.receipts:[]);
 const paymentById=id=>paymentRepository()?.get?.(id)||allPayments().find(x=>String(x?.id)===String(id))||null;
 const allCustomers=()=>customerRepository()?.all?.()||(Array.isArray(state.customers)?state.customers:[]);
 const customerById=id=>customerRepository()?.get?.(id)||window.MyfntCustomers?.byId?.(id)||null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const textMoney=(v,c)=>`${numberText(Number(v||0))} ${CURRENCIES[c]||CURRENCIES.YER}`;
 let audit=[],notes={},selectedCustomer='',selectedAuditReceipt='',auditPage=0,page=0,search='',status='active',correctionPending=false;
 // If durable recovery fails, never auto-migrate or accept another financial write.
 let recoveryBlocked=false,startupRecoveryChecked=false;
 const voidPending=new Set();
 const PAGE_SIZE=25,view={customerPage:0,customerQuery:'',customerSort:'latest',customerBalanceCurrency:(state.settings?.preferences?.currency||'YER'),paymentSort:'newest',detailBookings:0,detailPayments:0,loading:false};
 const direction=r=>r.direction==='out'?'out':'in';
 const signed=r=>(direction(r)==='out'?-1:1)*Number(r.amount||0);
 const allowInitialOverpay=()=>Boolean(state.settings.bookingUi?.allowBookingOverpayment);
 const allowReceiptOverRemaining=()=>Boolean(state.settings.bookingUi?.allowReceiptOverRemaining);
 const icon=(name)=>`<i class="fa-solid fa-${name}" aria-hidden="true"></i>`;
 const fmtDate=v=>v?esc(String(v).slice(0,10)):'—';
 const safeContact=c=>{const digits=normalizePhone(c.phone||'');return /^\d{7,15}$/.test(digits)?digits:'';};
 const displayContact=v=>window.MyfntPhone?.display?.(v)||String(v||'');
 const validIsoDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
   const [y,m,d]=value.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
   return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
 };
 const restoreList=(originals,snapshots)=>{
   for(let i=0;i<originals.length;i++){
     const item=originals[i];for(const key of Object.keys(item))if(!Object.hasOwn(snapshots[i],key))delete item[key];
     Object.assign(item,snapshots[i]);
   }
   return originals;
 };
 const navigateList=(windowId,selector)=>{
   const win=q(windowId),body=win?.querySelector('.window__body'),target=body?.querySelector(selector);
   if(!body||!target||!win.classList.contains('is-open'))return;
   // Only the window body scrolls. Preserve the list header, not the page hero.
   const position=target.getBoundingClientRect().top-body.getBoundingClientRect().top+body.scrollTop-9;
   body.scrollTo({top:Math.max(0,position),behavior:'auto'});
 };
 const afterPaint=fn=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(fn);else fn();};
 let refreshPending=false;
 const refreshMainWhenIdle=()=>{
   if(refreshPending)return;
   refreshPending=true;
   const run=()=>{refreshPending=false;try{renderAll();}catch(e){console.error('[finance refresh]',e);}};
   if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(run,{timeout:700});
   else setTimeout(run,180);
 };
 const allowed=cap=>(window.MyfntAccess?.isActive?.()!==false)&&(window.OzanPermissions?.can?.(cap)!==false);
 const user=()=>{const s=window.OzanScope?.read(),u=window.OzanAuth?.data?.users?.find(x=>x.id===s?.userId);return {id:s?.userId||'local',name:u?.name||'مستخدم محلي',companyId:s?.companyId||'local'};};
 const canWrite=cap=>{if(window.MyfntAccess?.requireWrite?.())return false;if(window.OzanPermissions?.denied?.(cap))return false;return true;};
 const readJson=(key,fallback)=>{try{return JSON.parse(safeStorage.get(key)||'null')??fallback}catch{return fallback}};
 const recordAudit=(type,entityId,bookingId,before,after,reason)=>{
   const actor=user();return {id:uid('audit'),type,entityId,bookingId,at:Date.now(),actorId:actor.id,actorName:actor.name,companyId:actor.companyId,before:before?clone(before):null,after:after?clone(after):null,reason:String(reason||'').slice(0,350)};
 };
 // Step 21B: financial atomicity is provided by one IndexedDB transaction.
 // The old full localStorage pre-image journal is obsolete and is removed on startup.
 function recover(){try{safeStorage.remove(JOURNAL_KEY);}catch{} recoveryBlocked=false;return false;}
 function recoverBeforeLoad(){startupRecoveryChecked=true;recover();return {recovered:false,blocked:false};}
 const requireCleanJournal=()=>{
   if(window.MyfntTabGuard?.isStale?.())throw Error('تغيّرت البيانات في تبويب آخر؛ أعد فتح التطبيق قبل أي تعديل مالي.');
   if(!window.MyfntLocal?.recordOne)throw Error('قاعدة IndexedDB المحلية غير جاهزة للحفظ المالي.');
 };
 async function commitPayment(booking,doChange,action,reason){
   requireCleanJournal();
   if(window.MyfntCustomers && (!window.MyfntCustomers.ready()||!window.MyfntCustomers.byId(booking?.customerId)))
     throw Error('ملف العميل غير جاهز أو ارتباطه بالحجز غير سليم؛ أعد فتح التطبيق قبل إضافة دفعة.');
   if(!state.bookings.includes(booking))throw Error('الحجز تغيّر منذ فتح النموذج. أعد اختيار الحجز قبل إضافة حركة مالية.');
   const reconciled=allPayments().filter(r=>r.bookingId===booking.id&&r.status!=='voided').reduce((n,r)=>n+signed(r),0);
   if(reconciled!==Number(booking.paid))throw Error('يوجد اختلاف بين السندات والمدفوع في هذا الحجز. يرجى فحص البيانات وعدم إضافة حركة قبل المصالحة.');
   const receiptRefs=state.receipts.slice(),bookingRefs=state.bookings.slice();
   const before=clone(receiptRefs),beforeBookings=clone(bookingRefs),prevAudit=clone(audit);
   let change;
   try{
     const {oldRecord,newRecord}=doChange();change={oldRecord,newRecord};
     booking.updatedAt=Date.now();
     audit.push(recordAudit(action,newRecord?.id||oldRecord?.id,booking.id,oldRecord,newRecord,reason));
     const paymentId=newRecord?.id||oldRecord?.id;
     await window.MyfntLocal.recordOne('payments',paymentId,action);
   }catch(err){
     state.receipts=restoreList(receiptRefs,before);state.bookings=restoreList(bookingRefs,beforeBookings);audit=prevAudit;
     throw err;
   }
   try{markBookingPending(booking);}catch(e){console.warn('[finance pending marker]',e);}
   try{document.dispatchEvent(new CustomEvent('myfnt:finance-changed',{detail:{bookingId:booking.id,paymentId,action,userId:user().id,userName:user().name}}));}catch(e){console.warn('[finance event]',e);}
   try{
     if(q('myfntPaymentsWindow')?.classList.contains('is-open'))renderPayments();
     if(q('myfntCustomersWindow')?.classList.contains('is-open'))renderCustomers();
     if(q('myfntCustomerDetailWindow')?.classList.contains('is-open'))customerDetails(selectedCustomer,{keepScroll:true});
   }catch(e){console.error('[finance repaint]',e);}
   refreshMainWhenIdle();
   return true;
 }
 // Initial payment uses the SAME durable pre-operation journal as later receipts.
 // Write only after journal is durable, and never mirror a partly written booking.
 async function commitInitialBooking(booking,receipt){
   requireCleanJournal();
   if(!booking||!receipt||booking.id!==receipt.bookingId||state.bookings.some(b=>b.id===booking.id)
       ||allPayments().some(r=>r.id===receipt.id))throw Error('الحجز أو سند العربون مكرر أو غير متطابق.');
   if(!Number.isSafeInteger(Number(booking.amount))||!Number.isSafeInteger(Number(booking.paid))
       ||Number(booking.paid)<=0||(!allowInitialOverpay()&&Number(booking.paid)>Number(booking.amount))
       ||Number(receipt.amount)!==Number(booking.paid)||receipt.status!=='active'
       ||(receipt.direction||'in')!=='in'||!validIsoDate(receipt.date))throw Error('معلومات العربون الأولي غير متطابقة مع الحجز.');
   const owner=window.OzanScope?.owner?.();if(owner){Object.assign(booking,owner);Object.assign(receipt,owner);}
   const entry=recordAudit('create',receipt.id,booking.id,null,receipt,'عربون أولي أثناء إنشاء الحجز');
   state.bookings.push(booking);state.receipts.push(receipt);audit.push(entry);
   try{
     await window.MyfntLocal.commitBookingAggregate(booking.id,{paymentLegacyId:receipt.id,paymentOperation:'create',paymentReason:entry.reason});
   }catch(error){
     const bi=state.bookings.indexOf(booking),ri=state.receipts.indexOf(receipt);if(bi>=0)state.bookings.splice(bi,1);if(ri>=0)state.receipts.splice(ri,1);audit=audit.filter(x=>x!==entry);throw error;
   }
   window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;
   return {receipt,entry};
 }
 // One-time migration upgrades previous booking and receipt links with a
 // directory. A power loss replays all three prior data sets on next launch.
 async function commitCustomerMigration(){
   requireCleanJournal();
   if(!window.MyfntCustomers?.ready?.())throw Error('دليل العملاء لم يكتمل تحميله');
   // Fresh-start Step 21B does not import historical localStorage. This path only
   // normalizes current RAM once if an older caller invokes it.
   await window.MyfntLocal.mirrorAll({enqueue:false,reason:'finance-recovery'});
   window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;
   return true;
 }
 // Save a new/edited booking and its canonical customer in one recoverable
 // operation. An initial receipt and its audit record join the SAME journal.
 async function commitBookingCustomer(booking,customer,receipt=null,options={}){
   requireCleanJournal();
   if(!window.MyfntCustomers?.ready?.())throw Error('دليل العملاء غير جاهز؛ أعد فتح التطبيق.');
   if(!customer?.id||!/^[1-9]\d*$/.test(String(customer.customerNo||''))||!booking?.id||booking.customerId!==customer.id)
     throw Error('معرّف العميل أو ارتباط الحجز غير صحيح');
   const old=state.bookings.find(b=>b.id===booking.id);
   if(receipt && (old||receipt.bookingId!==booking.id||allPayments().some(r=>r.id===receipt.id)
       ||Number(receipt.amount)!==Number(booking.paid)||Number(booking.paid)<=0))throw Error('عربون الحجز أو رقم السند غير متطابق');
   if(old&&old.customerId!==booking.customerId&&allPayments().some(r=>r.bookingId===booking.id))
     throw Error('لا يمكن تغيير ملف عميل حجز لديه سندات مالية؛ يلزم إبقاء ارتباط السندات سليمًا.');
   const knownCustomer=window.MyfntCustomers.byId(customer.id);
   const unchangedContact=Boolean(knownCustomer&&window.MyfntCustomers.nameKey(knownCustomer.name)===window.MyfntCustomers.nameKey(customer.name)
     &&window.MyfntCustomers.phoneKey(knownCustomer.phone)===window.MyfntCustomers.phoneKey(customer.phone));
   if(!unchangedContact&&window.MyfntCustomers?.conflicts(customer.name,customer.phone,customer.id)?.length&&!options.allowCustomerDuplicate)
     throw Error('يوجد عميل آخر بنفس الاسم والهاتف؛ أكّد إنشاء ملف مستقل من نافذة الحجز');
   const bookingRefs=state.bookings.slice(),bookingCopies=clone(bookingRefs),customerRefs=state.customers.slice(),customerCopies=clone(customerRefs);
   const receiptRefs=state.receipts.slice(),receiptCopies=clone(receiptRefs),priorAudit=clone(audit);
   const entry=receipt?recordAudit('create',receipt.id,booking.id,null,receipt,'عربون أولي أثناء إنشاء الحجز'):null;
   try{
     const owner=window.OzanScope?.owner?.();if(owner){Object.assign(booking,owner);if(receipt)Object.assign(receipt,owner);}
     const ci=state.customers.findIndex(c=>c.id===customer.id);if(ci<0)state.customers.push(customer);else state.customers[ci]=customer;
     for(const b of state.bookings)if(b.customerId===customer.id && b.id!==booking.id){b.name=customer.name;b.phone=customer.phone;}
     const bi=state.bookings.findIndex(b=>b.id===booking.id);if(bi<0)state.bookings.push(booking);else Object.assign(state.bookings[bi],booking);
     if(receipt){state.receipts.push(receipt);audit.push(entry);}
     await window.MyfntLocal.commitBookingAggregate(booking.id,{paymentLegacyId:receipt?.id||null,paymentOperation:'create',paymentReason:entry?.reason||''});
   }catch(err){
     state.bookings=restoreList(bookingRefs,bookingCopies);state.customers=restoreList(customerRefs,customerCopies);state.receipts=restoreList(receiptRefs,receiptCopies);audit=priorAudit;throw err;
   }
   window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;
   return {customer,receipt,entry};
 }
 function nextReceiptNumber(){return window.MyfntSequences?.nextReceipt?.()||String(Math.max(0,...allPayments().map(r=>Number(r.receiptNo)||0))+1);}
 function nextMovementNumber(){return window.MyfntSequences?.nextMovement?.()||String(Math.max(0,...allPayments().map(r=>Number(r.movementNo)||0))+1);}

 async function postPayment(b,amount,date,note,meta={}){
   const kind=meta.direction??'in',method=meta.method||'cash';
   if(!allowed('payments.write'))throw Error('ليس لديك صلاحية لإنشاء حركة مالية');
   if(!Number.isSafeInteger(amount)||amount<=0||!['in','out'].includes(kind)||!['cash','voucher'].includes(method))throw Error('قيمة أو نوع الحركة أو طريقة الدفع غير صحيحة');
   if(!validIsoDate(date))throw Error('تاريخ الدفعة غير صحيح');
   if(kind==='in'&&(b.status==='cancelled'||(!allowReceiptOverRemaining()&&amount>remainingFor(b))))throw Error('قيمة الدفعة خارج الحدود أو الحجز ملغى');
   if(kind==='out'&&amount>Number(b.paid||0))throw Error('الصرف يتجاوز الرصيد المقبوض المرتبط بهذا الحجز');
   const receiptId=uid('r');
   const receiptNo=window.MyfntDomainRuntime?.lazy&&window.MyfntLocal?.nextDisplaySequence?await window.MyfntLocal.nextDisplaySequence('receipt'):nextReceiptNumber(),movementNo=window.MyfntDomainRuntime?.lazy&&window.MyfntLocal?.nextDisplaySequence?await window.MyfntLocal.nextDisplaySequence('movement'):nextMovementNumber();
   const r={id:receiptId,receiptNo,movementNo,bookingId:b.id,customerId:b.customerId,direction:kind,amount,date,note:String(note||'').slice(0,160),
    method,reference:String(meta.reference||'').trim().slice(0,190),tag:String(meta.tag||'').trim().slice(0,90),
    createdAt:Date.now(),createdBy:user().name,createdById:user().id,status:'active',source:'receipt'};
   const delta=signed(r),completedDeposit=Boolean(kind==='in'&&b.depositPending&&b.paid+amount>=Number(b.depositRequired||0));
   await commitPayment(b,()=>{state.receipts.push(r);b.paid=Number(b.paid)+delta;
    if(completedDeposit){b.status='confirmed';b.depositPending=false;b.temporaryExpiresAt=0;}
    return {oldRecord:null,newRecord:clone(r)};},'create',`${kind==='out'?'سند صرف':'سند قبض'} للحجز #${b.bookingNo}`);
   try{
     recordBookingHistory(b.id,'payment',(kind==='out'?'صرف':'قبض')+' بقيمة '+numberText(amount)+' '+currencyLabel(b),{amount,date,receiptId:r.id,direction:kind});
     if(completedDeposit)recordBookingHistory(b.id,'confirm','تأكيد بعد استكمال العربون المسجّل بتاريخ الحجز',{depositRequired:b.depositRequired});
   }catch(e){console.warn('[finance booking history]',e);}
   return {receipt:r,completedDeposit};
 }
 function activeReceipts(bookingId){return paymentRepository()?.activeByBooking?.(bookingId)||allPayments().filter(r=>r.bookingId===bookingId&&r.status!=='voided');}
 function repairAudit(){return 0;} // Step 21B fresh-start: no historical localStorage audit repair
 function registerOpeningPayments(){return 0;} // Step 21B fresh-start: no legacy opening-balance migration
 function paymentTotals(){const by=new Map(),bi=bookingIndex();for(const r of allPayments()){if(r.status==='voided')continue;const b=bi.get(r.bookingId);if(!b)continue;const c=b.currency||'YER';by.set(c,(by.get(c)||0)+signed(r));}return by;}
 function moneyLines(map){return [...map].map(([c,v])=>`<div><strong>${textMoney(v,c)}</strong><small>${esc(c)}</small></div>`).join('')||'<p>لا توجد مبالغ</p>';}
 function bookingIndex(){return new Map(state.bookings.map(b=>[b.id,b]));}
 function statMoney(map){return [...map].map(([currency,amount])=>`<div class="myfnt-money-row"><strong>${textMoney(amount,currency)}</strong><small>${esc(currency)}</small></div>`).join('')||'<small>لا توجد حركات بعد</small>';}
 function metric(title,iconName,value,desc='',tone='primary'){
   return `<section class="mf-metric mf-metric--${tone}"><div class="mf-metric-top"><span class="mf-metric-icon">${icon(iconName)}</span><span>${esc(title)}</span></div><div class="mf-metric-value">${value}</div>${desc?`<small>${esc(desc)}</small>`:''}</section>`;
 }
 function pager(prefix,current,total){const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE)),p=Math.min(current,totalPages-1);
   const indices=new Set([0,totalPages-1,p-1,p,p+1].filter(x=>x>=0&&x<totalPages));
   return `<nav class="mf-pages" aria-label="ترقيم صفحات ${prefix}"><button data-mf-pager="${prefix}" data-mf-page="${p-1}" ${p===0?'disabled':''} aria-label="السابق">${icon('chevron-right')}</button>${[...indices].sort((a,b)=>a-b).map((x,i,arr)=>`${i&&x>arr[i-1]+1?'<span>…</span>':''}<button data-mf-pager="${prefix}" data-mf-page="${x}" aria-current="${x===p?'page':'false'}">${x+1}</button>`).join('')}<button data-mf-pager="${prefix}" data-mf-page="${p+1}" ${p===totalPages-1?'disabled':''} aria-label="التالي">${icon('chevron-left')}</button><small>${total?`${p*PAGE_SIZE+1}–${Math.min((p+1)*PAGE_SIZE,total)} من ${total}`:'0 سجل'}</small></nav>`;
 }
 function renderPaymentsLegacy({keepFocus=false,jumpToList=false}={}){
   const host=q('myfntPaymentsContent');if(!host)return;const bi=bookingIndex(),totals=new Map(),received=new Map(),spent=new Map(),owed=new Map(),netByBooking=new Map();
   let incoming=0,outgoing=0;for(const r of allPayments()){if(r.status==='voided')continue;const b=bi.get(r.bookingId);if(!b)continue;const c=b.currency||'YER';const map=direction(r)==='out'?spent:received;map.set(c,(map.get(c)||0)+Number(r.amount||0));totals.set(c,(totals.get(c)||0)+signed(r));netByBooking.set(b.id,(netByBooking.get(b.id)||0)+signed(r));direction(r)==='out'?outgoing++:incoming++;}
   for(const b of state.bookings.filter(x=>x.status!=='cancelled'))owed.set(b.currency||'YER',(owed.get(b.currency||'YER')||0)+Math.max(0,remainingFor(b)));
   const qnorm=normalizeSearch(search.trim());const receipts=allPayments().filter(r=>{
     const b=bi.get(r.bookingId);return (!qnorm||normalizeSearch([r.id,r.receiptNo,r.movementNo,r.reference,r.tag,r.note,b?.name,b?.phone,b?.bookingNo].join(' ')).includes(qnorm))&&
       (status==='all'||(status==='voided'?r.status==='voided':r.status!=='voided'));
   }).sort((a,b)=>view.paymentSort==='oldest'?Number(a.createdAt||0)-Number(b.createdAt||0):view.paymentSort==='amount-high'?Number(b.amount||0)-Number(a.amount||0):view.paymentSort==='amount-low'?Number(a.amount||0)-Number(b.amount||0):Number(b.createdAt||0)-Number(a.createdAt||0));
   page=Math.min(page,Math.max(0,Math.ceil(receipts.length/PAGE_SIZE)-1));
   const inconsistent=state.bookings.filter(b=>Number(b.paid||0)!==(netByBooking.get(b.id)||0));
   const focused=keepFocus&&document.activeElement?.id==='myfntPaymentSearch';const selection=focused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
   host.innerHTML=`<div class="mf-page-head"><div class="mf-kicker">${icon('vault')} إدارة المالية</div><h3>الدفعات والصندوق</h3><p>سجل مترابط بالحجوزات · أرقام مرجعية · تاريخ كامل للتصحيحات</p></div>
    ${inconsistent.length?`<div class="myfnt-warning" role="alert">${icon('triangle-exclamation')} توجد ${inconsistent.length} حجوزات تحتاج مراجعة تطابق المدفوع والسندات. لا تُجرِ تعديلات عليها قبل المصالحة.</div>`:''}
    <div class="mf-metrics">${metric('المقبوض', 'arrow-down-to-bracket',statMoney(received),'كل سندات القبض الفعّالة','success')}${metric('المنصرف','arrow-up-from-bracket',statMoney(spent),'سندات الصرف الفعّالة','danger')}${metric('صافي الصندوق','wallet',statMoney(totals),'دون دمج العملات')}${metric('المتبقي المستحق','hourglass-half',statMoney(owed),'للحجوزات غير الملغاة','warning')}${metric('عدد حركات القبض','receipt',`<strong>${incoming}</strong>`)}${metric('عدد حركات الصرف','money-bill-transfer',`<strong>${outgoing}</strong>`)} </div>
    <div class="mf-panel mf-panel--filters"><div class="mf-panel-title"><h4>سجل الحركات</h4><button type="button" class="primary-btn" data-myfnt-new-payment>${icon('plus')} حركة جديدة</button></div>
     <div class="mf-controls"><label class="mf-search">${icon('magnifying-glass')}<input type="search" id="myfntPaymentSearch" placeholder="اسم، هاتف، رقم حجز، مرجع أو وسم" value="${esc(search)}" autocomplete="off" aria-label="بحث الدفعات"></label>
      <label class="mf-field"><span>الحالة</span><select id="myfntPaymentStatus">${[['active','الفعّالة'],['voided','الملغاة'],['all','الكل']].map(([v,l])=>`<option value="${v}" ${status===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="mf-field"><span>الترتيب</span><select id="myfntPaymentSort">${[['newest','الأحدث'],['oldest','الأقدم'],['amount-high','الأعلى مبلغًا'],['amount-low','الأقل مبلغًا']].map(([v,l])=>`<option value="${v}" ${view.paymentSort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
      <div class="mf-results-count" role="status" aria-live="polite">${icon('list-check')} ${receipts.length} حركة · ${PAGE_SIZE} سجل لكل صفحة</div>
      <div class="myfnt-records mf-records">${receipts.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(r=>{
       const b=bi.get(r.bookingId),out=direction(r)==='out';return `<article class="myfnt-record mf-record ${r.status==='voided'?'is-void':''}">
       <div class="mf-record-top"><span class="mf-avatar mf-avatar--${out?'out':'in'}">${icon(out?'arrow-up':'arrow-down')}</span><div class="mf-record-heading"><b>${esc(b?.name||'حجز غير متاح')}</b><small>حجز #${esc(b?.bookingNo||'—')} · ${fmtDate(r.date)}</small></div><span class="mf-pill mf-pill--${r.status==='voided'?'void':out?'out':'in'}">${r.status==='voided'?'ملغاة':out?'عليه · صرف':'له · قبض'}</span></div>
       <div class="mf-record-amount"><strong class="mf-money-${out?'out':'in'}">${out?'−':'+'}${textMoney(r.amount,b?.currency)}</strong><small>سند #${esc(r.receiptNo||'—')} · حركة #${esc(r.movementNo||'—')}</small></div>
       <div class="mf-record-meta"><span>${icon('credit-card')} ${r.method==='voucher'?'سند':'كاش'}</span>${r.reference?`<span>${icon('hashtag')} ${esc(r.reference)}</span>`:''}${r.tag?`<span class="mf-tag">${icon('tag')} ${esc(r.tag)}</span>`:''}${r.note?`<span>${icon('note-sticky')} ${esc(r.note)}</span>`:''}<span>${icon('user-pen')} ${esc(r.editedByName||r.createdBy||'غير مسجل')}</span></div>
       <div class="myfnt-actions">${r.status!=='voided'&&allowed('payments.write')?`<button data-myfnt-edit="${esc(r.id)}">${icon('pen')} تعديل</button><button data-myfnt-void="${esc(r.id)}" class="is-danger">${icon('ban')} إلغاء محاسبي</button>`:''}<button data-myfnt-image="${esc(r.id)}">${icon('image')} صورة</button><button data-myfnt-print="${esc(r.id)}">${icon('print')} طباعة</button><button data-myfnt-audit="${esc(r.id)}">${icon('clock-rotate-left')} السجل</button></div></article>`;}).join('')||`<div class="mf-empty">${icon('inbox')}<strong>لا توجد حركات مطابقة</strong><span>عدّل معايير البحث أو أضف حركة جديدة.</span></div>`}</div>${pager('payments',page,receipts.length)}</div><p class="mf-footnote">الإلغاء يحفظ السند الأصلي وسجل التدقيق. هذه الإحصائيات محلية وليست كشفًا بنكيًا معتمدًا.</p>`;
   if(focused){const el=q('myfntPaymentSearch');el?.focus({preventScroll:true});if(selection&&selection[0]!=null)el.setSelectionRange(...selection);}
   if(jumpToList)afterPaint(()=>navigateList('myfntPaymentsWindow','.mf-panel--filters'));
 }
 function customerKey(b){return b.customerId||('legacy-booking:'+b.id);}
 function groups(){const m=new Map();for(const b of state.bookings){const key=customerKey(b);if(!m.has(key))m.set(key,{key,name:b.name,phone:b.phone,bookings:[],last:0});const c=m.get(key);const master=customerById(key);if(master){c.name=master.name;c.phone=master.phone;c.customerNo=master.customerNo;}c.bookings.push(b);c.last=Math.max(c.last,Number(b.createdAt)||Date.parse(b.date)||0);if(!c.name&&b.name)c.name=b.name;if(!c.phone&&b.phone)c.phone=b.phone;}return [...m.values()];}
 function clientTotals(c){const amounts=new Map();for(const b of c.bookings.filter(x=>x.status!=='cancelled')){const k=b.currency||'YER',v=amounts.get(k)||{total:0,paid:0};v.total+=Number(b.amount||0);v.paid+=Number(b.paid||0);amounts.set(k,v);}return amounts;}
 function customerLedger(c){return [...clientTotals(c)].map(([currency,v])=>`<div class="mf-client-ledger"><strong>${esc(currency)}</strong><span>الإجمالي: ${numberText(v.total)}</span><span>المدفوع: ${numberText(v.paid)}</span><span class="mf-owed">عليه: ${numberText(Math.max(0,v.total-v.paid))}</span><span>له: ${numberText(Math.max(0,v.paid-v.total))}</span></div>`).join('')||'<small>لا توجد حجوزات نشطة</small>';}
 function renderCustomersLegacy(query=view.customerQuery,{keepFocus=false,jumpToList=false}={}){
   const host=q('myfntCustomersContent');if(!host)return;view.customerQuery=query;
   const all=groups(),totalsByCustomer=new Map(all.map(c=>[c.key,clientTotals(c)]));
   const currencies=[...new Set([...totalsByCustomer.values()].flatMap(t=>[...t.keys()]))].sort();
   if(currencies.length&&!currencies.includes(view.customerBalanceCurrency))view.customerBalanceCurrency=currencies[0];
   // Compare balances ONLY within a single currency; adding YER+USD+SAR is misleading.
   const dueByCustomer=new Map([...totalsByCustomer].map(([key,totals])=>[key,Math.max(0,(totals.get(view.customerBalanceCurrency)?.total||0)-(totals.get(view.customerBalanceCurrency)?.paid||0))]));
   const qnorm=normalizeSearch(query.trim());const matching=all.filter(c=>!qnorm||normalizeSearch([c.name,c.phone,c.customerNo,...c.bookings.map(b=>b.bookingNo)].join(' ')).includes(qnorm)).sort((a,b)=>{
     if(view.customerSort==='name')return String(a.name).localeCompare(String(b.name),'ar');
     if(view.customerSort==='bookings')return b.bookings.length-a.bookings.length;
     if(view.customerSort==='balance')return (dueByCustomer.get(b.key)||0)-(dueByCustomer.get(a.key)||0);
     return b.last-a.last;
   });
   const tally=new Map();let bookingsCount=0;for(const c of all){bookingsCount+=c.bookings.length;for(const [currency,v] of totalsByCustomer.get(c.key)){const entry=tally.get(currency)||{total:0,paid:0};entry.total+=v.total;entry.paid+=v.paid;tally.set(currency,entry);}}
   view.customerPage=Math.min(view.customerPage,Math.max(0,Math.ceil(matching.length/PAGE_SIZE)-1));
   const focused=keepFocus&&document.activeElement?.id==='myfntCustomerSearch',selection=focused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
   host.innerHTML=`<div class="mf-page-head"><div class="mf-kicker">${icon('address-book')} دليل العملاء</div><h3>العملاء</h3><p>ملف مستقل لكل عميل، مرتبط بجميع حجوزاته ودفعاته وسنداته.</p></div>
   <div class="mf-metrics">${metric('إجمالي العملاء','users',`<strong>${all.length}</strong>`,'عميل مسجل')}${metric('عدد الحجوزات','calendar-check',`<strong>${bookingsCount}</strong>`,'جميع الحجوزات')}${metric('المبالغ المستحقة','hand-holding-dollar',statMoney(new Map([...tally].map(([k,v])=>[k,Math.max(0,v.total-v.paid)]))),'دون تجميع العملات','warning')}${metric('المبالغ المقبوضة','sack-dollar',statMoney(new Map([...tally].map(([k,v])=>[k,v.paid]))),'للعملاء النشطين','success')}</div>
   <div class="mf-panel mf-panel--filters"><div class="mf-panel-title"><h4>دليل العملاء</h4><span class="mf-count">${matching.length} نتيجة</span></div>
    <div class="mf-controls"><label class="mf-search">${icon('magnifying-glass')}<input id="myfntCustomerSearch" type="search" placeholder="بحث بالاسم أو الهاتف أو رقم العميل أو الحجز" value="${esc(query)}" autocomplete="off" aria-label="بحث العملاء"></label>
    <label class="mf-field"><span>ترتيب حسب</span><select id="myfntCustomerSort">${[['latest','أحدث حجز'],['name','الاسم أبجديًا'],['bookings','الأكثر حجوزات'],['balance','الأعلى مستحقات بالعملة المختارة']].map(([v,l])=>`<option value="${v}" ${view.customerSort===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="mf-field"><span>عملة الفرز المالي</span><select id="myfntCustomerBalanceCurrency" aria-label="عملة الفرز المالي">${(currencies.length?currencies:[view.customerBalanceCurrency]).map(c=>`<option value="${esc(c)}" ${view.customerBalanceCurrency===c?'selected':''}>${esc(CURRENCIES[c]||c)}</option>`).join('')}</select></label></div>
    <div class="mf-results-count" role="status" aria-live="polite">${icon('list')} ${PAGE_SIZE} عميلًا في الصفحة · السجلات القديمة المتشابهة لا تُدمَج تلقائيًا</div>
    <div class="myfnt-records mf-records">${matching.slice(view.customerPage*PAGE_SIZE,(view.customerPage+1)*PAGE_SIZE).map(c=>`<article class="myfnt-record mf-record mf-customer-card"><div class="mf-record-top"><span class="mf-avatar">${icon('user')}</span><div class="mf-record-heading"><b>${esc(c.name||'عميل دون اسم')}</b><small dir="auto">${esc(displayContact(c.phone)||'لم يُسجَّل هاتف')} · عميل #${esc(c.customerNo||'—')}</small></div><span class="mf-pill">${c.bookings.length} حجز</span></div><div class="mf-customer-money">${customerLedger(c)}</div><div class="mf-record-meta"><span>${icon('calendar-days')} آخر حجز: ${fmtDate([...c.bookings].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0))[0]?.date)}</span></div><div class="myfnt-actions"><button data-myfnt-customer="${esc(c.key)}" class="mf-open-client">${icon('arrow-up-right-from-square')} ملف العميل وسنداته</button></div></article>`).join('')||`<div class="mf-empty">${icon('users-slash')}<strong>لم يُعثر على عملاء</strong><span>حاول اسمًا أو رقمًا آخر.</span></div>`}</div>${pager('customers',view.customerPage,matching.length)}</div>`;
   if(focused){const el=q('myfntCustomerSearch');el?.focus({preventScroll:true});if(selection&&selection[0]!=null)el.setSelectionRange(...selection);}
   if(jumpToList)afterPaint(()=>navigateList('myfntCustomersWindow','.mf-panel--filters'));
 }
 function customerDetailsLegacy(key,{keepScroll=false,jumpTo=null}={}){const c=groups().find(x=>x.key===key);if(!c)return;
   const unsavedDraft=keepScroll&&selectedCustomer===key?q('myfntCustomerNote')?.value:null;
   selectedCustomer=key;
   const detailBody=q('myfntCustomerDetailWindow')?.querySelector('.window__body'),prevScroll=detailBody?.scrollTop||0;
   const customerBookingIds=new Set(c.bookings.map(b=>b.id)),receipts=allPayments().filter(r=>customerBookingIds.has(r.bookingId)).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
   const bookings=[...c.bookings].sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
   view.detailPayments=Math.min(view.detailPayments,Math.max(0,Math.ceil(receipts.length/PAGE_SIZE)-1));
   view.detailBookings=Math.min(view.detailBookings,Math.max(0,Math.ceil(bookings.length/PAGE_SIZE)-1));
   const bi=bookingIndex(),p=view.detailPayments*PAGE_SIZE,bp=view.detailBookings*PAGE_SIZE;
   const host=q('myfntCustomerDetail');if(!host)return;
   const phone=safeContact(c),contactText=encodeURIComponent(`مرحبًا ${c.name||''}، نتواصل معك من ${state.settings.company?.name||'مايفنت'} بخصوص حجزك.`);
   host.innerHTML=`<div class="mf-client-hero"><div class="mf-avatar mf-avatar--large">${icon('user-tie')}</div><div><div class="mf-kicker">ملف العميل</div><h3>${esc(c.name||'عميل')}</h3><span dir="auto">${esc(displayContact(c.phone)||'دون هاتف')} · رقم العميل #${esc(c.customerNo||'—')}</span><p>${bookings.length} حجز · ${receipts.length} حركة مالية</p></div></div>
    <div class="mf-contact-bar" role="group" aria-label="طرق التواصل مع العميل">
      <a href="${phone?'tel:+'+phone:'#'}" ${phone?'':'aria-disabled="true" tabindex="-1"'} class="mf-contact-link mf-contact-call" data-mf-contact="call">${icon('phone')} اتصال</a>
      <a href="${phone?'https://wa.me/'+phone+'?text='+contactText:'#'}" target="_blank" rel="noopener noreferrer" ${phone?'':'aria-disabled="true" tabindex="-1"'} class="mf-contact-link mf-contact-wa" data-mf-contact="whatsapp">${icon('comment-dots')} واتساب</a>
      <a href="${phone?'sms:+'+phone+'?body='+contactText:'#'}" ${phone?'':'aria-disabled="true" tabindex="-1"'} class="mf-contact-link mf-contact-sms" data-mf-contact="sms">${icon('envelope')} رسالة</a>
    </div>
    <section class="mf-panel"><div class="mf-panel-title"><h4>${icon('chart-pie')} كشف الحساب حسب العملة</h4></div><div class="mf-client-balances">${customerLedger(c)}</div></section>
    <section class="mf-panel"><label for="myfntCustomerNote" class="mf-note-label">${icon('note-sticky')} ملاحظات العميل</label><textarea id="myfntCustomerNote" rows="3" maxlength="2000" placeholder="ملاحظات محفوظة محليًا...">${esc(unsavedDraft??notes[key]??'')}</textarea><button type="button" id="myfntCustomerSaveNote" class="primary-btn">${icon('floppy-disk')} حفظ الملاحظات</button></section>
    <section class="mf-panel mf-client-section--bookings"><div class="mf-panel-title"><h4>${icon('calendar-check')} حجوزات العميل</h4><span class="mf-count">${bookings.length}</span></div><div class="mf-client-list">${bookings.slice(bp,bp+PAGE_SIZE).map(b=>`<article class="mf-client-item"><div><b>#${esc(b.bookingNo)} · ${fmtDate(b.date)}</b><small>${esc(b.type||'مناسبة')} · ${b.status==='cancelled'?'ملغى':'نشط'}</small><span>${textMoney(b.amount,b.currency)} · المدفوع ${numberText(b.paid)} · المتبقي ${numberText(remainingFor(b))}</span></div><button data-myfnt-view-booking="${esc(b.id)}">${icon('eye')} عرض</button></article>`).join('')||'<p>لا توجد حجوزات.</p>'}</div>${pager('detailBookings',view.detailBookings,bookings.length)}</section>
    <section class="mf-panel mf-client-section--payments"><div class="mf-panel-title"><h4>${icon('receipt')} سندات ودفعات العميل</h4><span class="mf-count">${receipts.length}</span></div><div class="mf-client-list">${receipts.slice(p,p+PAGE_SIZE).map(r=>{const b=bi.get(r.bookingId);return `<article class="mf-client-item"><div><b class="mf-money-${direction(r)==='out'?'out':'in'}">${direction(r)==='out'?'صرف':'قبض'} · ${textMoney(r.amount,b?.currency)}</b><small>#${esc(b?.bookingNo||'—')} · ${fmtDate(r.date)} · ${r.status==='voided'?'ملغى':'فعّال'}</small><span>سند #${esc(r.receiptNo||'—')} · حركة #${esc(r.movementNo||'—')} ${r.reference?'· '+esc(r.reference):''}</span></div><div class="mf-client-buttons"><button data-myfnt-image="${esc(r.id)}">${icon('image')} صورة</button><button data-myfnt-print="${esc(r.id)}">${icon('print')} سند</button><button data-myfnt-audit="${esc(r.id)}">${icon('clock-rotate-left')} السجل</button>${r.status!=='voided'&&allowed('payments.write')?`<button data-myfnt-edit="${esc(r.id)}">${icon('pen')} تعديل</button>`:''}</div></article>`;}).join('')||'<p>لا توجد سندات.</p>'}</div>${pager('detailPayments',view.detailPayments,receipts.length)}</section>`;
   openWindow('myfntCustomerDetailWindow');
   if(jumpTo)afterPaint(()=>navigateList('myfntCustomerDetailWindow',jumpTo==='detailBookings'?'.mf-client-section--bookings':'.mf-client-section--payments'));
   else if(keepScroll&&detailBody)afterPaint(()=>{detailBody.scrollTop=prevScroll;});
 }

 async function renderPayments(options={}){
   if(!window.MyfntDomainRuntime?.lazy||!window.MyfntQuery?.paymentPage)return renderPaymentsLegacy(options);
   const host=q('myfntPaymentsContent');if(!host)return;const keepFocus=Boolean(options.keepFocus),jumpToList=Boolean(options.jumpToList),focused=keepFocus&&document.activeElement?.id==='myfntPaymentSearch',selection=focused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
   const token=(view.paymentRenderToken||0)+1;view.paymentRenderToken=token;view.loading=true;host.setAttribute('aria-busy','true');
   try{const [result,stats]=await Promise.all([window.MyfntQuery.paymentPage({query:search,status,sort:view.paymentSort,page,pageSize:PAGE_SIZE}),window.MyfntQuery.paymentStats()]);if(token!==view.paymentRenderToken)return;
    for(const item of result.items||[]){if(item.booking){const bi=state.bookings.findIndex(x=>String(x.id)===String(item.booking.id));if(bi<0)state.bookings.push(item.booking);else Object.assign(state.bookings[bi],item.booking);}if(item.payment){const ri=state.receipts.findIndex(x=>String(x.id)===String(item.payment.id));if(ri<0)state.receipts.push(item.payment);else Object.assign(state.receipts[ri],item.payment);}}
    const receipts=(result.items||[]).map(x=>x.payment),bookingMap=new Map((result.items||[]).map(x=>[x.payment?.bookingId,x.booking]));page=Math.min(Number(page)||0,Math.max(0,Math.ceil(result.total/PAGE_SIZE)-1));
    host.innerHTML=`<div class="mf-page-head"><div class="mf-kicker">${icon('vault')} إدارة المالية</div><h3>الدفعات والصندوق</h3><p>قراءة مباشرة من IndexedDB · تحميل صفحات فقط عند الحاجة</p></div>
    <div class="mf-metrics">${metric('المقبوض','arrow-down-to-bracket',statMoney(stats.received),'جميع السندات الفعّالة','success')}${metric('المنصرف','arrow-up-from-bracket',statMoney(stats.spent),'جميع سندات الصرف','danger')}${metric('صافي الصندوق','wallet',statMoney(stats.net),'من قاعدة البيانات المحلية')}${metric('المتبقي المستحق','hourglass-half',statMoney(stats.owed),'للحجوزات غير الملغاة','warning')}${metric('عدد حركات القبض','receipt',`<strong>${stats.incoming}</strong>`)}${metric('عدد حركات الصرف','money-bill-transfer',`<strong>${stats.outgoing}</strong>`)}</div>
    <div class="mf-panel mf-panel--filters"><div class="mf-panel-title"><h4>سجل الحركات</h4><button type="button" class="primary-btn" data-myfnt-new-payment>${icon('plus')} حركة جديدة</button></div>
    <div class="mf-controls"><label class="mf-search">${icon('magnifying-glass')}<input type="search" id="myfntPaymentSearch" placeholder="اسم، هاتف، رقم حجز، مرجع أو وسم" value="${esc(search)}" autocomplete="off"></label><label class="mf-field"><span>الحالة</span><select id="myfntPaymentStatus">${[['active','الفعّالة'],['voided','الملغاة'],['all','الكل']].map(([v,l])=>`<option value="${v}" ${status===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="mf-field"><span>الترتيب</span><select id="myfntPaymentSort">${[['newest','الأحدث'],['oldest','الأقدم'],['amount-high','الأعلى مبلغًا'],['amount-low','الأقل مبلغًا']].map(([v,l])=>`<option value="${v}" ${view.paymentSort===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="mf-results-count">${icon('database')} ${result.total} حركة · الصفحة محمّلة مباشرة من IndexedDB</div><div class="myfnt-records mf-records">${receipts.map(r=>{const b=bookingMap.get(r.bookingId),out=direction(r)==='out';return `<article class="myfnt-record mf-record ${r.status==='voided'?'is-void':''}"><div class="mf-record-top"><span class="mf-avatar mf-avatar--${out?'out':'in'}">${icon(out?'arrow-up':'arrow-down')}</span><div class="mf-record-heading"><b>${esc(b?.name||'حجز')}</b><small>حجز #${esc(b?.bookingNo||'—')} · ${fmtDate(r.date)}</small></div><span class="mf-pill mf-pill--${r.status==='voided'?'void':out?'out':'in'}">${r.status==='voided'?'ملغاة':out?'عليه · صرف':'له · قبض'}</span></div><div class="mf-record-amount"><strong class="mf-money-${out?'out':'in'}">${out?'−':'+'}${textMoney(r.amount,b?.currency||r.currency)}</strong><small>سند #${esc(r.receiptNo||'—')} · حركة #${esc(r.movementNo||'—')}</small></div><div class="mf-record-meta"><span>${icon('credit-card')} ${r.method==='voucher'?'سند':'كاش'}</span>${r.reference?`<span>${icon('hashtag')} ${esc(r.reference)}</span>`:''}${r.tag?`<span class="mf-tag">${icon('tag')} ${esc(r.tag)}</span>`:''}${r.note?`<span>${icon('note-sticky')} ${esc(r.note)}</span>`:''}</div><div class="myfnt-actions">${r.status!=='voided'&&allowed('payments.write')?`<button data-myfnt-edit="${esc(r.id)}">${icon('pen')} تعديل</button><button data-myfnt-void="${esc(r.id)}" class="is-danger">${icon('ban')} إلغاء محاسبي</button>`:''}<button data-myfnt-image="${esc(r.id)}">${icon('image')} صورة</button><button data-myfnt-print="${esc(r.id)}">${icon('print')} طباعة</button><button data-myfnt-audit="${esc(r.id)}">${icon('clock-rotate-left')} السجل</button></div></article>`;}).join('')||`<div class="mf-empty">${icon('inbox')}<strong>لا توجد حركات مطابقة</strong></div>`}</div>${pager('payments',page,result.total)}</div><p class="mf-footnote">وضع البيانات الكبيرة نشط: لا يتم تحميل السجل المالي كاملًا إلى الذاكرة.</p>`;
    if(focused){const el=q('myfntPaymentSearch');el?.focus({preventScroll:true});if(selection&&selection[0]!=null)el.setSelectionRange(...selection);}if(jumpToList)afterPaint(()=>navigateList('myfntPaymentsWindow','.mf-panel--filters'));
   }catch(error){console.error('[lazy finance]',error);host.innerHTML=`<div class="mf-empty">${icon('triangle-exclamation')}<strong>تعذر قراءة السجل المالي</strong><span>${esc(error.message||'خطأ IndexedDB')}</span></div>`;}finally{view.loading=false;host.removeAttribute('aria-busy');}
 }
 async function renderCustomers(query=view.customerQuery,options={}){
   if(!window.MyfntDomainRuntime?.lazy||!window.MyfntQuery?.customerPage)return renderCustomersLegacy(query,options);
   const host=q('myfntCustomersContent');if(!host)return;view.customerQuery=query;const keepFocus=Boolean(options.keepFocus),jumpToList=Boolean(options.jumpToList),focused=keepFocus&&document.activeElement?.id==='myfntCustomerSearch',selection=focused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null,token=(view.customerRenderToken||0)+1;view.customerRenderToken=token;host.setAttribute('aria-busy','true');
   try{const result=await window.MyfntQuery.customerPage({query,page:view.customerPage,pageSize:PAGE_SIZE});if(token!==view.customerRenderToken)return;for(const cx of result.items||[]){if(cx.customer){const i=state.customers.findIndex(x=>String(x.id)===String(cx.customer.id));if(i<0)state.customers.push(cx.customer);else Object.assign(state.customers[i],cx.customer);}}
    const summaryLedger=summary=>(summary?.totals||[]).map(([currency,v])=>`<div class="mf-client-ledger"><strong>${esc(currency)}</strong><span>الإجمالي: ${numberText(v.total)}</span><span>المدفوع: ${numberText(v.paid)}</span><span class="mf-owed">عليه: ${numberText(Math.max(0,v.total-v.paid))}</span><span>له: ${numberText(Math.max(0,v.paid-v.total))}</span></div>`).join('')||'<small>لا توجد حجوزات نشطة</small>';
    const cards=(result.items||[]).map(cx=>{const c={key:cx.customer?.id,name:cx.customer?.name,phone:cx.customer?.phone,customerNo:cx.customer?.customerNo},summary=cx.summary||{};return `<article class="myfnt-record mf-record mf-customer-card"><div class="mf-record-top"><span class="mf-avatar">${icon('user')}</span><div class="mf-record-heading"><b>${esc(c.name||'عميل دون اسم')}</b><small dir="auto">${esc(displayContact(c.phone)||'لم يُسجَّل هاتف')} · عميل #${esc(c.customerNo||'—')}</small></div><span class="mf-pill">${summary.bookingCount||0} حجز</span></div><div class="mf-customer-money">${summaryLedger(summary)}</div><div class="mf-record-meta"><span>${icon('calendar-days')} آخر حجز: ${fmtDate(summary.lastDate)}</span></div><div class="myfnt-actions"><button data-myfnt-customer="${esc(c.key)}" class="mf-open-client">${icon('arrow-up-right-from-square')} ملف العميل وسنداته</button></div></article>`;}).join('');
    host.innerHTML=`<div class="mf-page-head"><div class="mf-kicker">${icon('address-book')} دليل العملاء</div><h3>العملاء</h3><p>دليل كسول التحميل: الصفحة الحالية فقط في الذاكرة</p></div><div class="mf-metrics">${metric('إجمالي العملاء','users',`<strong>${result.total}</strong>`,'حسب قاعدة البيانات المحلية')}</div><div class="mf-panel mf-panel--filters"><div class="mf-panel-title"><h4>دليل العملاء</h4><span class="mf-count">${result.total} نتيجة</span></div><div class="mf-controls"><label class="mf-search">${icon('magnifying-glass')}<input id="myfntCustomerSearch" type="search" placeholder="بحث بالاسم أو الهاتف أو رقم العميل" value="${esc(query)}" autocomplete="off"></label></div><div class="myfnt-records mf-records">${cards||`<div class="mf-empty">${icon('users-slash')}<strong>لم يُعثر على عملاء</strong></div>`}</div>${pager('customers',view.customerPage,result.total)}</div>`;
    if(focused){const el=q('myfntCustomerSearch');el?.focus({preventScroll:true});if(selection&&selection[0]!=null)el.setSelectionRange(...selection);}if(jumpToList)afterPaint(()=>navigateList('myfntCustomersWindow','.mf-panel--filters'));
   }catch(error){console.error('[lazy customers]',error);host.innerHTML=`<div class="mf-empty">${icon('triangle-exclamation')}<strong>تعذر قراءة دليل العملاء</strong><span>${esc(error.message||'خطأ IndexedDB')}</span></div>`;}finally{host.removeAttribute('aria-busy');}
 }
 async function customerDetails(key,options={}){if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.ensureCustomer){try{const cx=await window.MyfntQuery.ensureCustomer(key);if(cx?.customer?.notes)notes={...notes,[String(key)]:cx.customer.notes};}catch(error){showToast(error.message||'تعذر تحميل ملف العميل','warning');return;}}return customerDetailsLegacy(key,options);}
 function renderPaymentAuditLegacy(id=selectedAuditReceipt,{jumpToList=false}={}){
   const host=q('myfntPaymentAuditBody');if(!host)return;
   if(id!==selectedAuditReceipt){auditPage=0;selectedAuditReceipt=id;}
   const items=audit.filter(x=>x.entityId===id).sort((a,b)=>b.at-a.at);
   auditPage=Math.min(auditPage,Math.max(0,Math.ceil(items.length/PAGE_SIZE)-1));
   host.innerHTML=`<div class="mf-audit-heading"><strong>${icon('shield-halved')} سجل التغييرات (${items.length})</strong><small>25 عملية بكل صفحة · التعديلات السابقة محفوظة</small></div><div class="mf-audit-records">${items.slice(auditPage*PAGE_SIZE,(auditPage+1)*PAGE_SIZE).map(a=>`<article class="myfnt-record mf-audit-record"><b>${esc(({create:'إنشاء',edit:'تعديل',void:'إلغاء محاسبي','opening-migration':'ترحيل افتتاحي'})[a.type]||a.type)}</b><small>${new Date(a.at).toLocaleString('ar-YE')} · ${esc(a.actorName)} · ${esc(a.actorId)}</small><small>${esc(a.reason||'')}</small><details><summary>عرض تفاصيل القيم القديمة والجديدة</summary><pre>قبل: ${esc(JSON.stringify(a.before))}\nبعد: ${esc(JSON.stringify(a.after))}</pre></details></article>`).join('')||'<p>لا يوجد سجل بعد.</p>'}</div>${pager('audit',auditPage,items.length)}`;
   openWindow('myfntPaymentAuditWindow');if(jumpToList)afterPaint(()=>navigateList('myfntPaymentAuditWindow','.mf-audit-records'));
 }

 async function renderPaymentAudit(id=selectedAuditReceipt,{jumpToList=false}={}){
   if(!window.MyfntDomainRuntime?.lazy||!window.MyfntQuery?.paymentAudit)return renderPaymentAuditLegacy(id,{jumpToList});
   try{
     const remote=await window.MyfntQuery.paymentAudit(id,{limit:1000});
     const other=audit.filter(x=>String(x.entityId)!==String(id)),merged=new Map();
     for(const a of [...remote,...audit.filter(x=>String(x.entityId)===String(id))])merged.set(String(a.id||`${a.type}:${a.at}`),a);
     audit=[...other,...merged.values()];
   }catch(error){console.warn('[lazy payment audit]',error);}
   return renderPaymentAuditLegacy(id,{jumpToList});
 }
 function openPaymentEditor(id){const r=paymentById(id);if(r?.status==='voided')return;if(!r||!canWrite('payments.write'))return;const b=state.bookings.find(x=>x.id===r.bookingId);if(!b)return;
   const form=q('myfntPaymentEditForm');form.elements.paymentId.value=r.id;form.elements.amount.value=r.amount;if(form.elements.date)form.elements.date.value=isoDate(new Date());form.elements.note.value=r.note||'';form.elements.direction.value=direction(r);form.elements.method.value=r.method||'cash';form.elements.reference.value=r.reference||'';form.elements.tag.value=r.tag||'';form.elements.reason.value='';const meta=q('myfntPaymentEditDateMeta');if(meta)meta.textContent='سيُسجل التصحيح بتاريخ اليوم تلقائيًا: '+fmtDate(isoDate(new Date()));q('myfntPaymentEditContext').textContent=`${b.name} · حجز #${b.bookingNo} · ${CURRENCIES[b.currency]}`;openWindow('myfntPaymentEditWindow');}
 async function editPayment(e){e.preventDefault();if(correctionPending||!canWrite('payments.write'))return;const form=e.currentTarget,r=paymentById(form.elements.paymentId.value),b=state.bookings.find(x=>x.id===r?.bookingId);if(!r||!b||r.status==='voided')return;
   const amount=Number(form.elements.amount.value),date=isoDate(new Date()),note=form.elements.note.value.trim(),reason=form.elements.reason.value.trim(),
    nextDirection=form.elements.direction.value,method=form.elements.method.value,reference=form.elements.reference.value.trim(),tag=form.elements.tag.value.trim();
   if(!Number.isSafeInteger(amount)||amount<=0||!validIsoDate(date)||reason.length<6)return showToast('راجع المبلغ وأدخل سبب التعديل (6 أحرف على الأقل)','warning');
   if(!['in','out'].includes(nextDirection)||!['cash','voucher'].includes(method))return showToast('نوع الحركة أو طريقة الدفع غير صالحة','warning');
   const newPaid=Number(b.paid)-signed(r)+(nextDirection==='out'?-amount:amount);if(newPaid<0||(!allowReceiptOverRemaining()&&newPaid>b.amount))return showToast('سيصبح المدفوع خارج حدود إجمالي الحجز؛ راجع القيمة أو فعّل السماح بسند قبض زائد','warning');
   correctionPending=true;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
   try{await commitPayment(b,()=>{const oldRecord=clone(r);Object.assign(r,{amount,date,note,direction:nextDirection,method,reference,tag,editedById:user().id,editedByName:user().name,editedAt:Date.now()});b.paid=newPaid;return {oldRecord,newRecord:clone(r)};},'edit',reason);closeWindow('myfntPaymentEditWindow');showToast('تم حفظ التعديل مع هوية المحرر في سجل مستقل');}catch(err){ozWarn(err.message);}
   finally{correctionPending=false;if(submit)submit.disabled=false;}
 }
 async function voidPayment(id){if(voidPending.has(id)||!canWrite('payments.write'))return;const r=paymentById(id),b=state.bookings.find(x=>x.id===r?.bookingId);if(!r||!b||r.status==='voided')return;const reason=promptReason();if(!reason)return;
   voidPending.add(id);
   try{
   if(Number(b.paid)-signed(r)<0||(!allowReceiptOverRemaining()&&Number(b.paid)-signed(r)>Number(b.amount)))return showToast('لا يمكن إلغاء السند مع وجود حركات لاحقة تعتمد على رصيده؛ راجع السندات أولًا','warning');
   if(!await ozConfirm(`سيتم إلغاء أثر السند وتحديث الرصيد بمقدار ${textMoney(r.amount,b.currency)}. سيظل السند وتاريخ تعديله محفوظين.`,{title:'إلغاء محاسبي غير قابل للتراجع دون سجل جديد',danger:true,confirmLabel:'تأكيد الإلغاء'}))return;
   try{await commitPayment(b,()=>{const oldRecord=clone(r);r.status='voided';r.voidReason=reason;r.voidedAt=Date.now();r.editedById=user().id;r.editedByName=user().name;b.paid-=signed(r);return {oldRecord,newRecord:clone(r)};},'void',reason);const input=q('myfntVoidReason');if(input)input.value='';showToast('تم إلغاء أثر الدفعة وحفظ سجل التدقيق');}catch(err){ozWarn(err.message);}
   }finally{voidPending.delete(id);}
 }
 function promptReason(){const reason=q('myfntVoidReason');if(!reason){showToast('حقل سبب الإلغاء غير متاح','warning');return null;}const value=reason.value.trim();if(value.length<6){const panel=reason.closest('details');if(panel)panel.open=true;reason.focus();showToast('اكتب سبب الإلغاء (6 أحرف على الأقل) في لوحة الإلغاء المحاسبي','warning');return null;}return value;}
 function printPayment(id){const r=paymentById(id),b=state.bookings.find(x=>x.id===r?.bookingId);if(!b||!r)return;const popup=window.open('','_blank');if(popup)popup.opener=null;if(!popup){showToast('اسمح بنوافذ الطباعة المنبثقة','warning');return;}
   const lines=[['الشركة',state.settings.company?.name||'مايفنت'],['العميل',b.name],['رقم الحجز',b.bookingNo],['رقم السند',r.receiptNo||'—'],['رقم الحركة',r.movementNo||'—'],['نوع الحركة',direction(r)==='out'?'صرف / عليه':'قبض / له'],['طريقة الدفع',r.method==='voucher'?'سند':'كاش'],['المرجع',r.reference||'—'],['الوسم',r.tag||'—'],['تاريخ الحركة',r.date],['مبلغ الحركة',textMoney(r.amount,b.currency)],['البيان',r.note||'—'],['الحالة',r.status==='voided'?'ملغى محاسبيًا':'فعّال'],['المحرر',r.editedByName||r.createdBy||'غير مسجل']];
   popup.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>سند مالي</title><style>body{font:18px Arial;margin:42px;line-height:1.7}h1{color:#C4014D}div{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:8px}</style><h1>سند مالي — مايفنت</h1>'+lines.map(([a,v])=>`<div><b>${esc(a)}</b><span>${esc(v)}</span></div>`).join('')+'<p>نسخة صادرة من سجل محلي تجريبي</p></html>');popup.document.close();popup.focus();popup.print();}
 async function openPaymentRecord(id){let r=paymentById(id);if(!r&&window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.ensurePayment){try{r=await window.MyfntQuery.ensurePayment(id);}catch(error){console.warn('[lazy payment open]',error);}}if(!r)return false;search=String(r.receiptNo||r.movementNo||r.id||'');page=0;openWindow('myfntPaymentsWindow');requestAnimationFrame(()=>requestAnimationFrame(()=>{renderPayments();const el=q('myfntPaymentSearch');if(el){el.value=search;el.focus({preventScroll:true});}q('myfntPaymentsWindow')?.querySelector('.window__body')?.scrollTo?.({top:0,behavior:'smooth'});}));return true;}
 async function openCustomerRecord(id){let c=customerById(id);if(!c&&window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.ensureCustomer){try{await window.MyfntQuery.ensureCustomer(id);c=customerById(id);}catch(error){console.warn('[lazy customer open]',error);}}if(!c)return false;view.detailBookings=0;view.detailPayments=0;customerDetails(c.id);return true;}
 function init(){if(!startupRecoveryChecked)recover();audit=[];notes={};
   if(!recoveryBlocked){registerOpeningPayments();repairAudit();}
   else console.error('Finance recovery pending: automatic migrations and financial writes disabled');
   const skeleton=()=>`<div class="mf-skeleton-grid" aria-busy="true" aria-live="polite">${Array.from({length:4},()=>'<div class="mf-skeleton"><span></span><span></span><span></span></div>').join('')}</div>`;
   const deferred=(host,fn)=>{if(!host)return;host.innerHTML=skeleton();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(host.closest('.window')?.classList.contains('is-open'))fn();}));};
   document.querySelectorAll('[data-myfnt-open]').forEach(btn=>btn.addEventListener('click',()=>{const w=btn.dataset.myfntOpen;
     const host=q(w==='myfntPaymentsWindow'?'myfntPaymentsContent':'myfntCustomersContent');
     openWindow(w);deferred(host,()=>w==='myfntPaymentsWindow'?renderPayments():renderCustomers());}));
   const handlePaymentButton=btn=>{if(btn.hasAttribute('data-myfnt-new-payment'))openReceipt({useActive:false});else if(btn.dataset.myfntEdit)openPaymentEditor(btn.dataset.myfntEdit);
     else if(btn.dataset.myfntVoid)voidPayment(btn.dataset.myfntVoid);else if(btn.dataset.myfntPrint)printPayment(btn.dataset.myfntPrint);else if(btn.dataset.myfntImage)window.MyfntReceiptImage?.open(btn.dataset.myfntImage);
     else if(btn.dataset.myfntAudit)renderPaymentAudit(btn.dataset.myfntAudit);
     else if(btn.dataset.mfPager==='payments'){page=Number(btn.dataset.mfPage)||0;renderPayments({jumpToList:true});}
   };
   q('myfntPaymentsContent')?.addEventListener('click',e=>{const btn=e.target.closest('button');if(btn)handlePaymentButton(btn);});
   let pTimer,cTimer;
   q('myfntPaymentsContent')?.addEventListener('input',e=>{if(e.target.id==='myfntPaymentSearch'){search=e.target.value;page=0;clearTimeout(pTimer);pTimer=setTimeout(()=>{if(q('myfntPaymentsWindow')?.classList.contains('is-open'))renderPayments({keepFocus:true});},230);}});
   q('myfntPaymentsContent')?.addEventListener('change',e=>{if(e.target.id==='myfntPaymentStatus'){status=e.target.value;page=0;renderPayments();}if(e.target.id==='myfntPaymentSort'){view.paymentSort=e.target.value;page=0;renderPayments();}});
   q('myfntCustomersContent')?.addEventListener('input',e=>{if(e.target.id==='myfntCustomerSearch'){view.customerQuery=e.target.value;view.customerPage=0;clearTimeout(cTimer);cTimer=setTimeout(()=>{if(q('myfntCustomersWindow')?.classList.contains('is-open'))renderCustomers(view.customerQuery,{keepFocus:true});},230);}});
   q('myfntCustomersContent')?.addEventListener('change',e=>{
     if(e.target.id==='myfntCustomerSort'){view.customerSort=e.target.value;view.customerPage=0;renderCustomers();}
     if(e.target.id==='myfntCustomerBalanceCurrency'){view.customerBalanceCurrency=e.target.value;view.customerPage=0;renderCustomers();}
   });
   q('myfntCustomersContent')?.addEventListener('click',e=>{const btn=e.target.closest('button');if(!btn)return;if(btn.dataset.myfntCustomer){view.detailBookings=0;view.detailPayments=0;customerDetails(btn.dataset.myfntCustomer);}if(btn.dataset.mfPager==='customers'){view.customerPage=Number(btn.dataset.mfPage)||0;renderCustomers(view.customerQuery,{jumpToList:true});}});
   q('myfntCustomerDetail')?.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
     if(t.id==='myfntCustomerSaveNote'){const next={...notes,[selectedCustomer]:q('myfntCustomerNote').value};notes=next;const c=customerById(selectedCustomer);if(c){c.notes=notes[selectedCustomer];Promise.resolve(window.MyfntLocal?.recordOne?.('customers',selectedCustomer,'update')).then(()=>showToast('تم حفظ ملاحظات العميل')).catch(e=>showToast(e.message||'تعذر حفظ الملاحظات','warning'));}}
     if(t.dataset.myfntViewBooking){const b=state.bookings.find(x=>x.id===t.dataset.myfntViewBooking);if(b)openPreview(b);}
     if(t.dataset.myfntPrint)printPayment(t.dataset.myfntPrint);if(t.dataset.myfntImage)window.MyfntReceiptImage?.open(t.dataset.myfntImage);if(t.dataset.myfntAudit)renderPaymentAudit(t.dataset.myfntAudit);if(t.dataset.myfntEdit)openPaymentEditor(t.dataset.myfntEdit);
     if(['detailPayments','detailBookings'].includes(t.dataset.mfPager)){view[t.dataset.mfPager]=Number(t.dataset.mfPage)||0;customerDetails(selectedCustomer,{jumpTo:t.dataset.mfPager});}
   });
   q('myfntPaymentEditForm')?.addEventListener('submit',editPayment);
   q('myfntPaymentAuditBody')?.addEventListener('click',e=>{
     const btn=e.target.closest('[data-mf-pager="audit"]');if(!btn||btn.disabled)return;
     auditPage=Number(btn.dataset.mfPage)||0;renderPaymentAudit(selectedAuditReceipt,{jumpToList:true});
   });
   // Finance transactions checkpoint explicitly after a successful durable commit.
   // The finance-changed event remains a domain/UI event, not a second persistence trigger.
 }
 window.MyfntFinance={init,recoverBeforeLoad,isRecoveryBlocked:()=>recoveryBlocked,nextReceiptNumber,nextMovementNumber,
   reload:()=>{},reloadFromHydration:(nextNotes={})=>{notes={...nextNotes};audit=[];},
   postPayment,commitInitialBooking,commitBookingCustomer,commitCustomerMigration,renderPayments,renderCustomers,activeReceipts,recordAudit,
   registerOpeningPayments,paymentTotals,printPayment,audit:()=>clone(audit),notes:()=>clone(notes),
   transaction:commitPayment,signedAmount:signed,pageSize:PAGE_SIZE,groups,openPaymentRecord,openCustomerRecord};
})();
