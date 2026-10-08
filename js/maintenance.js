"use strict";
/* صيانة ملفات التشغيل + Step21M Storage Profiler. لا نحذف بيانات Domain من هذه الشاشة. */
(()=>{
 let busy=false,profiling=false;
 const $=id=>document.getElementById(id);
 const status=s=>{const x=$('ozCacheStatus');if(x)x.textContent=s;};
 const fmt=b=>{b=Number(b||0);if(b<1024)return `${b.toFixed(0)} B`;if(b<1048576)return `${(b/1024).toFixed(1)} KB`;return `${(b/1048576).toFixed(2)} MB`;};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function cacheUsage(){if(!('caches' in window))return 0;const scope=new URL('./',location.href).pathname,prefix='ozan-bookings-'+encodeURIComponent(scope)+'-',keys=(await caches.keys()).filter(k=>k.startsWith(prefix));let bytes=0;for(const key of keys){const cache=await caches.open(key),reqs=await cache.keys();for(const req of reqs){try{const r=await cache.match(req);if(r)bytes+=(await r.clone().blob()).size;}catch{}}}return bytes;}
 function localStorageUsage(){let bytes=0,count=0;try{const enc=new TextEncoder();for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'',v=localStorage.getItem(k)||'';bytes+=enc.encode(k).byteLength+enc.encode(v).byteLength;count++;}}catch{}return {bytes,count};}
 async function showStorageUsage(){try{const [cacheBytes,est]=await Promise.all([cacheUsage(),navigator.storage?.estimate?.()||Promise.resolve(null)]),total=Number(est?.usage||0),sync=window.MyfntSync?.status?.()||{};status(`Cache Storage: ${fmt(cacheBytes)}\nإجمالي مساحة الموقع: ${fmt(total)}\nLaravel/API: ${sync.enabled?'مربوط':'غير مربوط'}${sync.mode?` (${sync.mode})`:''}\n${sync.enabled?'يتم إنشاء أوامر مزامنة للتغييرات الجديدة.':'لا يتم إنشاء Sync Queue جديدة حتى يتم ربط API حقيقي.'}`);}catch(e){status('تعذر قياس التخزين: '+(e?.message||String(e)));}}
 async function runStorageProfile(){if(profiling)return;profiling=true;const btn=$('ozStorageProfile'),host=$('ozStorageProfileResult');btn?.setAttribute('aria-busy','true');btn&&(btn.disabled=true);if(host)host.innerHTML='<p class="oz-storage-profiler__empty">جارٍ تحليل الجداول ومساحة الموقع…</p>';
  try{
   const [dbp,media,cacheBytes,estimate]=await Promise.all([
    window.MyfntLocal?.storageProfile?.()||Promise.resolve({stores:[],totalBytes:0,totalRecords:0,queueEnabled:false}),
    window.MyfntMedia?.profile?.().catch(()=>null)||Promise.resolve(null),
    cacheUsage(),navigator.storage?.estimate?.()||Promise.resolve(null)
   ]);
   const ls=localStorageUsage(),physical=Number(estimate?.usage||0),quota=Number(estimate?.quota||0),rows=[...(dbp.stores||[])];
   if(media&&media.count)rows.push({name:'media',count:media.count,bytes:media.bytes,external:true});
   rows.sort((a,b)=>Number(b.bytes||0)-Number(a.bytes||0));
   const logical=Number(dbp.totalBytes||0)+Number(media?.bytes||0)+ls.bytes;
   const max=Math.max(1,...rows.map(r=>Number(r.bytes||0)));
   const labels={bookings:'الحجوزات',booking_details:'تفاصيل الحجوزات',customers:'العملاء',payments:'السندات والحركات',booking_audit:'سجل الحجوزات',payment_audit:'سجل السندات',notifications:'الإشعارات',notification_jobs:'مهام الإشعارات',sms_messages:'رسائل SMS',sms_templates:'قوالب SMS',sync_queue:'طابور المزامنة',sync_conflicts:'تعارضات المزامنة',entity_tombstones:'علامات الحذف',archive_records:'الأرشيف',company_settings:'إعدادات الشركة',booking_packages:'الباقات',booking_package_versions:'إصدارات الباقات',local_meta:'بيانات محلية مساعدة',outbox:'Outbox قديم',snapshots:'Snapshots',alert_rules:'قواعد التنبيه',calendar_blocks:'أيام/حظر التقويم',media:'الصور والشعار'};
   const sync=window.MyfntSync?.status?.()||{};
   const q=rows.find(r=>r.name==='sync_queue');
   const table=rows.length?`<div class="oz-storage-table-wrap"><table class="oz-storage-table"><thead><tr><th>المخزن</th><th>السجلات</th><th>الحجم التقريبي</th><th>النسبة</th></tr></thead><tbody>${rows.map(r=>`<tr class="${r.name==='sync_queue'?'is-sync-queue':''}"><td>${esc(labels[r.name]||r.name)}</td><td>${Number(r.count||0).toLocaleString('en-US')}</td><td>${fmt(r.bytes)}</td><td><div class="oz-storage-bar"><i style="width:${Math.max(2,Math.min(100,Number(r.bytes||0)/max*100)).toFixed(1)}%"></i></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="oz-storage-profiler__empty">لا توجد بيانات محلية قابلة للقياس.</p>';
   const quotaPct=quota?Math.min(100,physical/quota*100):0;
   if(host)host.innerHTML=`<div class="oz-storage-sync-state ${sync.enabled?'':'is-off'}"><b>${sync.enabled?'Laravel/API مربوط':'Laravel/API غير مربوط'}</b><br>${sync.enabled?'التغييرات الجديدة تنشئ Sync Queue ثم تُحذف/تُضغط بعد نجاح المزامنة.':'تم إيقاف إنشاء Sync Queue جديدة. الصفوف القديمة إن وجدت محفوظة كما هي ولن تُحذف تلقائيًا.'}${q?.count?`<br>Sync Queue القديمة: <b>${q.count}</b> سجل · ${fmt(q.bytes)}`:''}</div><div class="oz-storage-summary"><div><b>${fmt(cacheBytes)}</b><span>Cache Storage</span></div><div><b>${fmt(physical)}</b><span>إجمالي الموقع الفيزيائي</span></div><div><b>${fmt(logical)}</b><span>البيانات المنطقية المقاسة</span></div><div><b>${Number(dbp.totalRecords||0).toLocaleString('en-US')}</b><span>سجلات IndexedDB</span></div><div><b>${fmt(ls.bytes)}</b><span>LocalStorage (${ls.count})</span></div><div><b>${quota?quotaPct.toFixed(1)+'%':'—'}</b><span>من حصة التخزين</span></div></div>${table}<p class="oz-storage-note">الحجم لكل Store هو حجم منطقي تقريبي لمحتوى السجلات، وليس الحجم الفيزيائي الداخلي لـIndexedDB. متصفح Chromium قد يحجز صفحات/WAL وفهارس أكبر من البيانات نفسها؛ لذلك المرجع الفيزيائي النهائي هو «إجمالي مساحة الموقع».</p>`;
  }catch(e){if(host)host.innerHTML=`<p class="oz-storage-profiler__empty">تعذر تحليل التخزين: ${esc(e?.message||String(e))}</p>`;console.error('[Storage profiler]',e);}finally{profiling=false;btn?.removeAttribute('aria-busy');btn&&(btn.disabled=false);}
 }
 async function cacheMaintenance(refresh){
  if(busy)return;
  if(!await ozConfirm(refresh?'تحديث الملفات وإعادة بناء كاش التطبيق مع الحفاظ على بياناتك؟':'حذف ملفات الكاش فقط مع الحفاظ على كل بيانات الحجوزات والدفعات؟',{title:'تأكيد صيانة الملفات'}))return;
  busy=true;
  const button=$(refresh?'ozCacheRefresh':'ozCacheDelete');button?.classList.add('oz-action-busy');button?.setAttribute('aria-busy','true');
  status('جارٍ فحص التخزين المؤقت…');
  try{
   if(!('caches' in window))throw Error('Cache Storage غير مدعوم في هذا المتصفح');
   const regs=await navigator.serviceWorker?.getRegistrations?.()||[];
   const scope=new URL('./',location.href).pathname;
   const keys=await caches.keys();
   const prefix='ozan-bookings-'+encodeURIComponent(scope)+'-';
   const matching=keys.filter(k=>k.startsWith(prefix));
   await Promise.all(matching.map(k=>caches.delete(k)));
   status(`تم تنظيف ${matching.length} نسخة كاش مايفنت.\nبيانات الحجوزات المحلية لم تُمس.`);
   if(refresh){
    const reg=regs.find(r=>new URL(r.scope).pathname===scope);
    if(reg)await reg.update();
    const res=await fetch('index.html?refresh='+Date.now(),{cache:'reload'});
    if(!res.ok)throw Error('فشل فحص ملفات التطبيق: HTTP '+res.status);
    status(`تمت التهيئة بنجاح.\nالكاش المحذوف: ${matching.length}\nيمكنك إعادة فتح التطبيق لتحميل النسخة الجديدة.`);
   }
  }catch(e){status('تعذرت الصيانة: '+(e?.message||String(e)));console.error('[OZAN maintenance]',e);}
  finally{busy=false;button?.classList.remove('oz-action-busy');button?.removeAttribute('aria-busy');}
 }
 $('ozCacheRefresh')?.addEventListener('click',()=>cacheMaintenance(true));
 $('ozCacheDelete')?.addEventListener('click',()=>cacheMaintenance(false));
 $('ozStorageProfile')?.addEventListener('click',runStorageProfile);
 document.querySelector('[data-open-admin="cacheWindow"]')?.addEventListener('click',()=>setTimeout(showStorageUsage,120));
 document.addEventListener('myfnt:storage-changed',()=>{if(document.getElementById('cacheWindow')?.getAttribute('aria-hidden')==='false')showStorageUsage();});
})();
