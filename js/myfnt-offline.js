/* MYFNT 2.10.1 Step 21B data coordinator.
 * Automatic full-dataset checkpoints are disabled to stop storage amplification.
 * Emergency snapshots are created only when explicitly requested by the user.
 * NO server is connected in this build.
 */
'use strict';
(()=>{
 const ws=()=>{const s=window.OzanScope?.read?.();return s?`${s.companyId}:${s.userId}`:null;};
 let snapshotTask=null,snapshotRevision=0,snapshotTimer=0,bound=false,maintenance=false,snapshotProtected=false,outboxPage=0;const OUTBOX_PAGE_SIZE=25;const clone=x=>JSON.parse(JSON.stringify(x));
 const RESTORE_POLICY=Object.freeze({reason:'restore',enqueue:false,createsQueue:false});
 // One quiet-time checkpoint replaces many redundant full-size JSON snapshots.
 function scheduleSnapshot(){
  // Step 21B: ordinary domain writes never create a full-dataset snapshot.
  // Explicit emergency export may still call snapshot() on demand.
  return false;
 }

 async function record(entity,id,kind,_payload){
  if(!ws())return null;
  // RAM is only the working UI view. Durable domain writes are committed directly to IndexedDB.
  // Changes are NOT acknowledged remotely and cannot be lost on a fake push.
  try{return await window.MyfntLocal.recordOne(entity,id,kind);}
  catch(e){console.error('[Myfnt offline] durable record failed',entity,id,e);
   window.showToast?.('تعذر تثبيت التغيير في قاعدة البيانات المحلية؛ لم يُعتمد الحفظ','warning');
   throw e;}
 }
 async function remove(entity,id,options={}){
  if(!ws())return null;
  try{
   // Materialize the current legacy record first. This makes deletion deterministic
   // even when an older install has not yet completed its normalized startup mirror.
   await window.MyfntLocal.recordOne(entity,id,'update');
   return await window.MyfntLocal.tombstone(entity,id,options);
  }catch(e){console.error('[Myfnt offline] tombstone failed',entity,id,e);
   window.showToast?.('تعذر تسجيل الحذف للمزامنة؛ لم يُعتمد الحذف المحلي','warning');throw e;}
 }
 async function reconcile(options={}){
  if(!ws())return null;
  const reason=String(options?.reason||'').trim();
  try{
   if(reason)return await window.MyfntLocal.mirrorAll({...options,reason});
   // Step 22A.5: reconciliation without an explicit migration reason is read-side hydration, not state -> DB.
   if(window.MyfntHydration?.hydrate)return await window.MyfntHydration.hydrate({reason:'authority-reconcile'});
   return {authority:'indexeddb',hydrated:false};
  }catch(e){console.error('[Myfnt offline] reconcile failed',e);
   window.showToast?.('تعذر مصالحة البيانات المحلية؛ لم تتم الكتابة فوق IndexedDB','warning');return null;}
 }
 async function snapshot({mirror=false}={}){
  // Coalesce all events arriving during an IDB write; latest revision wins.
  if(snapshotProtected||window.MyfntFinance?.isRecoveryBlocked?.()||
    window.MyfntCustomers?.ready?.()===false||window.MyfntTabGuard?.isStale?.()||!ws())return false;
  const target=ws();snapshotRevision++;
  if(snapshotTask)return snapshotTask;
  snapshotTask=(async()=>{
   let written=0;
   try{
    const db=await window.MyfntLocal.open();
    do{
     written=snapshotRevision;
     // Verify no incomplete finance journal slipped in during an async await.
     if(window.MyfntFinance?.isRecoveryBlocked?.()||window.MyfntTabGuard?.isStale?.()||
       window.MyfntCustomers?.ready?.()===false||ws()!==target)return false;
     const s=window.OzanScope.read(),data=clone({
      bookings:(window.MyfntRepositories?.bookings?.snapshot?.()||state.bookings),customers:(window.MyfntRepositories?.customers?.snapshot?.()||state.customers),receipts:(window.MyfntRepositories?.payments?.snapshot?.()||state.receipts),packages:(window.MyfntRepositories?.packages?.snapshot?.()||state.packages),
      specialDays:(window.MyfntRepositories?.specialDays?.snapshot?.()||state.specialDays),settings:(window.MyfntRepositories?.settings?.snapshot?.()||state.settings),financeAudit:window.MyfntFinance?.audit?.()||[],
      financeCustomerNotes:window.MyfntFinance?.notes?.()||{},
      bookingHistory:typeof ozHistory!=='undefined'?ozHistory:[]
     });
     await new Promise((resolve,reject)=>{
      const tx=db.transaction('snapshots','readwrite');
      tx.objectStore('snapshots').put({workspace:target,companyId:s.companyId,userId:s.userId,
       at:Date.now(),schema:'myfnt-emergency-v1',data});
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
     });
    }while(written!==snapshotRevision);
    // Emergency checkpoints are now independent from normalization.
    // Full normalization runs only when explicitly requested (startup, import, repair).
    if(mirror)await window.MyfntLocal.mirrorAll({enqueue:false,reason:'manual-repair'});
    return true;
   }catch(e){console.warn('[Myfnt snapshot]',e);
    window.showToast?.('فشل تحديث نسخة الطوارئ: '+e.message,'warning');return false;
   }finally{
    snapshotTask=null;
    // A write may arrive after the last loop check while the optional full
    // mirror is still in flight. Never lose that newer checkpoint request.
    if(written!==snapshotRevision&&!snapshotProtected)scheduleSnapshot();
   }
  })();
  return snapshotTask;
 }
 const blobDownload=(body,name)=>{
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type:'application/json;charset=utf-8'}));
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 };
 async function inspectSnapshot(){
   const db=await window.MyfntLocal.open();return new Promise((resolve,reject)=>{
     const req=db.transaction('snapshots','readonly').objectStore('snapshots').get(ws());
     req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
   });
 }
 async function downloadEmergency(){
  const s=window.OzanScope?.read();if(!s)throw Error('اختر مساحة شركة');
  // Export a *fresh* checkpoint, never silently download yesterday's emergency copy.
  // An older copy protected from an empty localStorage load remains read-only.
  if(!snapshotProtected){
   if(snapshotTimer){clearTimeout(snapshotTimer);snapshotTimer=0;}
   if(!await snapshot())throw Error('تعذر تحديث نسخة الطوارئ. تحقق من سلامة الدفعات والتخزين أولًا.');
  }
  const db=await window.MyfntLocal.open();
  const item=await new Promise((resolve,reject)=>{
    const r=db.transaction('snapshots','readonly').objectStore('snapshots').get(ws());
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  if(!item)throw Error('لا توجد صورة طوارئ؛ قم أولًا بحفظ بيانات تجربة');
  if(item.companyId!==s.companyId||item.userId!==s.userId)throw Error('مساحة الشركة أو المستخدم لا تطابق هذه النسخة');
  // Download a file accepted by the original JSON-import UI, not just a raw
  // IndexedDB internal record. No session tokens or passwords are included.
  const data=item.data||{};
  if(!Array.isArray(data.bookings)||!Array.isArray(data.receipts))throw Error('نسخة الطوارئ غير مكتملة');
  const backup={version:APP_VERSION,owner:{companyId:s.companyId,userId:s.userId},
    exportedAt:new Date().toISOString(),source:'IndexedDB emergency snapshot',bookings:data.bookings,
    packages:data.packages||[],receipts:data.receipts,specialDays:data.specialDays||[],settings:data.settings||{},
    financeAudit:Array.isArray(data.financeAudit)?data.financeAudit:[],financeCustomerNotes:data.financeCustomerNotes||{},
    bookingHistory:data.bookingHistory&&typeof data.bookingHistory==='object'&&!Array.isArray(data.bookingHistory)?data.bookingHistory:{}};
  // Older snapshots may predate the customer directory. Omit absent/empty
  // directory in a nonempty legacy archive so import can rebuild stable links.
  if(Array.isArray(data.customers)&&(data.customers.length>0||!data.bookings.length))backup.customers=data.customers;
  blobDownload(JSON.stringify(backup),'myfnt-recoverable-emergency-'+new Date().toISOString().slice(0,10)+'.json');
 }
 async function downloadNormalized(){
   // Export is deliberately one-way. Imported rows require server-proven owner and active subscription.
   const content=await window.MyfntLocal.exportRows();
   blobDownload(JSON.stringify(content,null,2),'myfnt-local-schema-2.6-'+new Date().toISOString().slice(0,10)+'.json');
 }
 async function legacyCount(){
  const db=await window.MyfntLocal.open();return new Promise((resolve,reject)=>{
   const r=db.transaction('outbox','readonly').objectStore('outbox').index('workspace').count(ws());
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
 }
 async function display(){if(!ws())return [];
  const [queue,counts,old,conflicts]=await Promise.all([window.MyfntLocal.queue(),window.MyfntLocal.stats(),legacyCount(),window.MyfntLocal.conflicts()]);
  const host=document.getElementById('myfntOutboxStatus');
  if(host){
   const summary=Object.entries(counts).filter(([key])=>key!=='sync_queue').map(([key,count])=>`<span class="myfnt-db-chip">${escapeHtml(key)} <b>${count}</b></span>`).join('');
   const states=queue.reduce((acc,row)=>(acc[row.status]=(acc[row.status]||0)+1,acc),{}),active=queue.filter(x=>!['synced','superseded'].includes(x.status)).length;
   const completed=(states.synced||0)+(states.superseded||0),progress=queue.length?Math.round(completed/queue.length*100):100;
   const transport=window.MyfntSync?.status?.()||{enabled:false,mode:'none'};
   const conflictText=conflicts.length?`يوجد ${conflicts.length} تعارض مفتوح؛ لن تُستبدل نسخته المحلية تلقائيًا.`:'لا توجد تعارضات مفتوحة.';
   const transportText=transport.enabled?`موصل المزامنة جاهز (${transport.mode})`:(transport.mode==='mock'?'النقل التجريبي Mock معطّل عمدًا؛ لن يُفرَّغ الطابور بنجاح وهمي.':'موصل الخادم غير متصل بعد.');
   const labels={bookings:'حجز',booking_details:'تفاصيل حجز',customers:'عميل',payments:'سند/حركة',booking_packages:'باقة',company_settings:'إعدادات',booking_audit:'سجل حجز',payment_audit:'سجل سند',calendar_blocks:'يوم مميز',alert_rules:'قاعدة تنبيه'};
   const statusAr={pending:'بانتظار الإرسال',sending:'جارٍ الإرسال',synced:'متزامن',failed:'فشل',conflict:'تعارض',superseded:'مستبدل'};
   const sorted=queue.slice().sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))),pages=Math.max(1,Math.ceil(sorted.length/OUTBOX_PAGE_SIZE));outboxPage=Math.min(outboxPage,pages-1);const offset=outboxPage*OUTBOX_PAGE_SIZE;
   const rows=sorted.slice(offset,offset+OUTBOX_PAGE_SIZE).map((row,i)=>`<article class="mf-sync-row mf-sync-row--compact mf-sync-row--${escapeHtml(row.status||'pending')}"><span class="mf-sync-rowno">${offset+i+1}</span><span class="mf-sync-icon"><i class="fa-solid ${row.status==='synced'?'fa-cloud-circle-check':row.status==='conflict'?'fa-triangle-exclamation':row.status==='failed'?'fa-circle-xmark':row.status==='sending'?'fa-arrows-rotate fa-spin':'fa-cloud-arrow-up'}"></i></span><div><strong>${escapeHtml(labels[row.entity_type]||row.entity_type||'سجل')}</strong><small>${escapeHtml(row.operation||'upsert')} · ${escapeHtml(String(row.legacy_id||row.entity_id||'').slice(0,16))}</small>${row.last_error?`<em>${escapeHtml(row.last_error)}</em>`:''}</div><b>${escapeHtml(statusAr[row.status]||row.status||'pending')}</b></article>`).join('');
   host.innerHTML=`<div class="mf-sync-head"><div><b>${queue.length}</b><span>إجمالي الطابور</span></div><div><b>${states.pending||0}</b><span>انتظار</span></div><div><b>${states.failed||0}</b><span>فشل</span></div><div><b>${states.conflict||0}</b><span>تعارض</span></div></div><div class="mf-sync-progress"><div><span>تقدم المزامنة</span><b>${progress}%</b></div><progress max="100" value="${progress}">${progress}%</progress><small>${completed} مكتمل · ${active} عملية نشطة</small></div><div class="mf-sync-toolbar"><button type="button" class="secondary-btn" id="myfntRetryFailed" ${states.failed?'':'disabled'}><i class="fa-solid fa-rotate-right"></i> إعادة محاولة الفاشلة (${states.failed||0})</button></div><p class="mf-sync-transport">${maintenance?'صيانة: الإرسال إلى الخادم متوقف.':escapeHtml(transportText)}</p><p class="mf-sync-conflict-note">${escapeHtml(conflictText)}</p><div class="mf-sync-list">${rows||'<p class="sync-empty">لا توجد عمليات مزامنة حالية.</p>'}</div><div class="mf-sync-pager"><button type="button" data-sync-page="prev" ${outboxPage<=0?'disabled':''}><i class="fa-solid fa-chevron-right"></i> السابق</button><span>صفحة ${outboxPage+1} من ${pages} · 25 سجل لكل صفحة</span><button type="button" data-sync-page="next" ${outboxPage>=pages-1?'disabled':''}>التالي <i class="fa-solid fa-chevron-left"></i></button></div><details class="mf-sync-db-details"><summary>تفاصيل الجداول المحلية</summary><div class="myfnt-db-chips">${summary}</div><p>${old?'الطابور السابق محفوظ أيضًا ('+old+' عملية) للمراجعة عند ترحيل الخادم.':'لا توجد عمليات سابقة غير مُرحَّلة.'}</p></details>`;
   host.querySelector('[data-sync-page="prev"]')?.addEventListener('click',()=>{outboxPage=Math.max(0,outboxPage-1);display();});
   host.querySelector('[data-sync-page="next"]')?.addEventListener('click',()=>{outboxPage=Math.min(pages-1,outboxPage+1);display();});
   host.querySelector('#myfntRetryFailed')?.addEventListener('click',async e=>{const btn=e.currentTarget;btn.disabled=true;try{const count=await window.MyfntLocal.retryFailedCommands();window.showToast?.(`تم تجهيز ${count} عملية لإعادة المحاولة`);if(window.MyfntSync?.enabled?.())await window.MyfntSync.flush({limit:100});await display();}catch(err){window.showToast?.(err.message,'warning');}finally{btn.disabled=false;}});
  }
  const coverage=document.getElementById('myfntSyncCoverage');if(coverage){const rows=[['الحجوزات','bookings',true],['تفاصيل الحجوزات','booking_details',true],['العملاء','customers',true],['السندات والحركات','payments',true],['سجل الحجوزات','booking_audit',true],['سجل السندات','payment_audit',true],['الباقات','booking_packages',true],['إعدادات الشركة','company_settings',true]];coverage.innerHTML='<h4><i class="fa-solid fa-list-check"></i> تغطية المزامنة المستقبلية</h4><div class="mf-sync-coverage-grid">'+rows.map(([label,type,ready])=>`<span class="${ready?'is-ready':'is-pending'}"><i class="fa-solid ${ready?'fa-circle-check':'fa-clock'}"></i>${escapeHtml(label)}<b>${ready?'مشمولة':'قيد التجهيز'}</b></span>`).join('')+'</div><p>السجلات الأساسية وسجلات التدقيق لها صفوف منظمة مستقلة في IndexedDB وطابور المزامنة.</p>';}
  return queue;
 }
 function healthCheck(){
  const bookings=state.bookings||[],customers=state.customers||[],receipts=state.receipts||[];
  const issues=[],unique=(rows,label)=>{const seen=new Set();for(const item of rows){
   if(!item.id||seen.has(item.id))issues.push(`${label}: معرّف مفقود أو مكرر`);seen.add(item.id);
  }};
  unique(bookings,'الحجوزات');unique(customers,'العملاء');unique(receipts,'السندات');
  const customerNos=new Set();
  for(const c of customers){
   const number=String(c.customerNo||'');
   if(!/^[1-9]\d*$/.test(number))issues.push(`العميل ${c.name||c.id}: رقم العرض مفقود أو غير صالح`);
   else if(customerNos.has(number))issues.push(`رقم العميل ${number}: مكرر بين أكثر من ملف`);
   customerNos.add(number);
  }
  const owners=new Set(customers.map(c=>c.id)),validBookings=new Map(bookings.map(b=>[b.id,b]));
  // One linear pass over receipts; never scan millions of payments for every booking.
  const paidByBooking=new Map();
  for(const r of receipts)if(r.status!=='voided')paidByBooking.set(r.bookingId,
   (paidByBooking.get(r.bookingId)||0)+(r.direction==='out'?-1:1)*Number(r.amount||0));
  for(const b of bookings){
   if(!owners.has(b.customerId))issues.push(`الحجز ${b.bookingNo||b.id}: ملف العميل غير مرتبط`);
   const paid=paidByBooking.get(b.id)||0;
   if(Math.abs(paid-Number(b.paid||0))>0.00001)issues.push(`الحجز ${b.bookingNo||b.id}: مجموع السندات يختلف عن المدفوع`);
  }
  for(const r of receipts){if(!r.bookingId)continue;const b=validBookings.get(r.bookingId);
   if(!b)issues.push(`السند ${r.receiptNo||r.id}: الحجز المشار إليه غير موجود`);
   else if(r.customerId&&r.customerId!==b.customerId)issues.push(`السند ${r.receiptNo||r.id}: مرتبط بعميل مختلف`);
  }
  const duplicates=window.MyfntCustomers?.duplicateReport?.()||[];
  if(duplicates.length)issues.push(`يوجد ${duplicates.length} تطابقات في سجلات العملاء القديمة تستلزم مراجعة يدوية`);
  const result={bookings:bookings.length,customers:customers.length,receipts:receipts.length,issues};
  const host=document.getElementById('myfntHealthReport');if(host){host.textContent=issues.length?
    `تم العثور على ${issues.length} ملاحظات: ${issues.slice(0,8).join(' | ')}`:
    `لا توجد اختلافات في الروابط والمبالغ المفحوصة. العملاء: ${customers.length}، الحجوزات: ${bookings.length}، السندات: ${receipts.length}.`;
   host.setAttribute('data-status',issues.length?'warning':'ok');}
  return result;
 }
 function init(){if(!ws())return;
  if(bound)return;bound=true;
  // Durable writers already request a checkpoint after their localStorage commit.
  // Do not subscribe here to booking/package/finance domain events as well: those
  // events are for dependent UI/services and used to request the same checkpoint
  // a second time. One persistence entry point avoids duplicate timers and mirrors.
  document.addEventListener('myfnt:maintenance-changed',e=>{maintenance=!!e.detail?.active;display().catch(console.warn);});
  document.getElementById('myfntHealthCheck')?.addEventListener('click',healthCheck);
  document.getElementById('myfntShowOutbox')?.addEventListener('click',()=>{
   display().catch(e=>window.showToast?.(e.message,'warning'));});
  document.getElementById('myfntEmergencyExport')?.addEventListener('click',()=>downloadEmergency().catch(e=>window.showToast?.(e.message,'warning')));
  document.getElementById('myfntNormalizedExport')?.addEventListener('click',()=>downloadNormalized().catch(e=>window.showToast?.(e.message,'warning')));
  document.getElementById('myfntSchemaStatus')?.addEventListener('click',()=>window.MyfntLocal.migrationReport().then(r=>{
    const host=document.getElementById('myfntSchemaStatusText');if(host)host.textContent=
    `فُحصت ${r.mirror.total} سجلات، تغيّر ${r.mirror.changed} سجل. عدد العمليات: ${r.tables.sync_queue}.`;return display();
   }).catch(e=>window.showToast?.(e.message,'warning')));
  // Step 21B: never create or mirror a full dataset during startup. IndexedDB
  // already owns domain durability; emergency snapshots are manual exports only.
  display().catch(e=>console.error('[Myfnt offline display]',e));
  // Step 21N: purge completed/superseded sync work and age out transient device-only records
  // during idle time. Accounting/domain rows are never touched by this maintenance pass.
  const compact=()=>window.MyfntLocal?.compactLocal?.({terminalKeep:0,notificationDays:30,jobDays:7,errorDays:14}).catch?.(e=>console.warn('[Myfnt local compact]',e));
  if(typeof requestIdleCallback==='function')requestIdleCallback(compact,{timeout:5000});else setTimeout(compact,2500);
 }
 window.MyfntOffline=Object.freeze({init,record,remove,reconcile,snapshot,scheduleSnapshot,requestCheckpoint:scheduleSnapshot,display,downloadEmergency,
  downloadNormalized,inspectSnapshot,healthCheck,acceptRestoredData:()=>{snapshotProtected=false;return window.MyfntLocal.mirrorAll({enqueue:RESTORE_POLICY.enqueue,reason:RESTORE_POLICY.reason}).then(()=>snapshot({mirror:false}));},restorePolicy:()=>({...RESTORE_POLICY}),queue:()=>window.MyfntLocal.queue(),
  conflicts:()=>window.MyfntLocal.conflicts(),resolveConflict:(id,strategy)=>window.MyfntLocal.resolveConflict(id,strategy).then(async result=>{if(result?.status==='resolved_remote')await window.MyfntHydration?.hydrate?.({reason:'conflict-accept-remote'});await display();return result;}),
  setMaintenance:value=>{maintenance=!!value;document.dispatchEvent(new CustomEvent('myfnt:maintenance-changed',{detail:{active:maintenance}}));}});
})();
