/* Myfnt 2.14.21 — Laravel-ready Initial Device Bootstrap.
 * Bootstrap is a server -> local seed and NEVER creates sync_queue commands.
 * Critical path loads configuration + current-year working set + a small future window.
 * Historical rows and audit logs are lazy/on-demand and are never required to open the app.
 */
'use strict';
(()=>{
 const STATE_KEY='initial-company-bootstrap-v3';
 const CONTRACT_VERSION=3;
 const DEFAULT_LIMIT=()=>{if(navigator.connection?.saveData)return 100;const dm=Number(navigator.deviceMemory||0);return dm&&dm<=2?120:dm&&dm<=4?200:300;};
 const CONFIG_TABLES=['companies','company_settings','booking_packages','booking_types','alert_rules','calendar_blocks'];
 const WORKING_TABLES=['customers','bookings','booking_details','payments'];
 const ARCHIVE_TABLES=['customers','bookings','booking_details','payments'];
 const REPLACE_MANAGED_TABLES=[...new Set([...CONFIG_TABLES,...WORKING_TABLES,...ARCHIVE_TABLES])];
 const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const online=()=>navigator.onLine!==false;
 const api=()=>window.OzanApi;
 const local=()=>window.MyfntLocal;
 const syncEnabled=()=>Boolean(window.MyfntSync?.enabled?.());
 const workspace=()=>{const s=window.OzanScope?.read?.();return s?.companyId&&s?.userId?`${s.companyId}:${s.userId}`:'';};
 const yearRange=()=>{const d=new Date(),y=d.getFullYear(),future=new Date(d);future.setDate(future.getDate()+180);const endYear=Math.max(y,future.getFullYear()),end=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`;return {from:`${y}-01-01`,to:end,years:[...new Set([y,endYear])]};};
 let current=null,running=null,controller=null,uiBound=false;
 const fresh=()=>({version:CONTRACT_VERSION,workspace:workspace(),status:'idle',phase:'idle',manifestRevision:null,bootstrapId:null,companyName:'',workingRange:yearRange(),processed:0,total:0,configProcessed:0,configTotal:0,workingProcessed:0,workingTotal:0,archiveProcessed:0,archiveTotal:0,tables:{},configReady:false,workingReady:false,complete:false,replacePending:false,reconciliation:{same:0,'server-newer':0,'local-newer':0,conflict:0,'identity-conflict':0,deleted:0,finalPruned:0},pausedReason:null,lastError:null,startedAt:null,updatedAt:new Date().toISOString(),completedAt:null});
 async function load(){if(current&&current.workspace===workspace())return current;const saved=await local()?.getUiMeta?.(STATE_KEY);current=saved&&saved.workspace===workspace()?{...fresh(),...saved,tables:saved.tables||{}}:fresh();return current;}
 async function save(patch={}){const st=await load();Object.assign(st,patch,{workspace:workspace(),updatedAt:new Date().toISOString()});await local()?.setUiMeta?.(STATE_KEY,st);paint();document.dispatchEvent(new CustomEvent('myfnt:bootstrap-progress',{detail:{...st}}));return st;}
 function tableState(st,key,total=0){if(!st.tables[key])st.tables[key]={cursor:null,processed:0,total:Number(total||0),done:false};else if(total!=null)st.tables[key].total=Number(total||st.tables[key].total||0);return st.tables[key];}
 function normalizeManifest(r){
  const range=r?.working_range||r?.workingRange||yearRange(),tables=r?.tables||{},counts=r?.counts||{};
  const count=(table,scope)=>Number(tables?.[table]?.[scope]??tables?.[table]?.[scope+'_count']??counts?.[scope]?.[table]??0)||0;
  const plans=[];
  for(const table of CONFIG_TABLES)plans.push({table,scope:'config',total:count(table,'config')||count(table,'total')});
  for(const table of WORKING_TABLES)plans.push({table,scope:'working',total:count(table,'working')});
  for(const table of ARCHIVE_TABLES)plans.push({table,scope:'archive',total:count(table,'archive')});
  return {bootstrapId:String(r?.bootstrap_id||r?.bootstrapId||r?.revision||'bootstrap'),revision:String(r?.company_revision??r?.revision??''),companyName:String(r?.company?.name||r?.company_name||''),serverCompanyId:String(r?.company?.id||r?.company_id||''),workingRange:{from:String(range.from||yearRange().from),to:String(range.to||yearRange().to),years:Array.isArray(range.years)?range.years:yearRange().years},plans,replaceLocal:Boolean(r?.replace_local),raw:r};
 }
 async function manifest(){
  if(!syncEnabled())throw Object.assign(Error('Initial Company Bootstrap يحتاج Laravel/API حقيقي. وضع Mock لا يكتب بيانات خادم وهمية.'),{code:'BOOTSTRAP_TRANSPORT_DISABLED'});
  const r=await api().request('/bootstrap/manifest',{method:'GET'});if(!r?.ok)throw Object.assign(Error(r?.message||'تعذر قراءة Manifest الشركة'),{status:Number(r?.status||0)});return normalizeManifest(r);
 }
 function keyOf(plan){return `${plan.scope}:${plan.table}`;}
 function totalsFromPlans(plans){let total=0,config=0,working=0,archive=0;for(const p of plans){const n=Number(p.total||0);total+=n;if(p.scope==='config')config+=n;else if(p.scope==='working')working+=n;else if(p.scope==='archive')archive+=n;}return {total,config,working,archive};}
 function recomputeProgress(st){let total=0,processed=0,configTotal=0,configProcessed=0,workingTotal=0,workingProcessed=0,archiveTotal=0,archiveProcessed=0;for(const [key,x] of Object.entries(st.tables||{})){const t=Number(x.total||0),p=Math.min(Number(x.processed||0),t||Number(x.processed||0));total+=t;processed+=p;if(key.startsWith('config:')){configTotal+=t;configProcessed+=p;}else if(key.startsWith('working:')){workingTotal+=t;workingProcessed+=p;}else if(key.startsWith('archive:')){archiveTotal+=t;archiveProcessed+=p;}}Object.assign(st,{total,processed,configTotal,configProcessed,workingTotal,workingProcessed,archiveTotal,archiveProcessed});return st;}
 function hasBlockingReconciliation(st){const r=st?.reconciliation||{};return Number(r['local-newer']||0)>0||Number(r.conflict||0)>0||Number(r['identity-conflict']||0)>0;}
 function canFinalizeReplacement(st){if(!st?.replacePending||hasBlockingReconciliation(st))return false;return Object.entries(st.tables||{}).every(([,x])=>x?.done===true);}
 async function requestBatch(meta,plan,ts){
  const q=new URLSearchParams({bootstrap_id:meta.bootstrapId,table:plan.table,scope:plan.scope,limit:String(DEFAULT_LIMIT()),from:meta.workingRange.from,to:meta.workingRange.to});if(ts.cursor)q.set('cursor',String(ts.cursor));
  let last=null;for(let attempt=0;attempt<5;attempt++){
   if(!online())throw Object.assign(Error('انقطع الإنترنت'),{code:'OFFLINE_PAUSE'});
   try{const r=await api().request('/bootstrap/batch?'+q.toString(),{method:'GET'});if(r?.ok)return {items:Array.isArray(r.items)?r.items:Array.isArray(r.rows)?r.rows:[],next:r.next_cursor??r.cursor??null,done:Boolean(r.done)||(r.next_cursor==null&&r.cursor==null),total:Number(r.total??plan.total??0)||0};
    const status=Number(r?.status||0),retry=status===0||status===408||status===429||status>=500;last=Object.assign(Error(r?.message||`تعذر تنزيل ${plan.table}`),{status,retryable:retry,retryAfterMs:Number(r?.retryAfterMs)||0});if(!retry)throw last;
   }catch(e){last=e;const status=Number(e?.status||0),retry=e?.retryable!==false&&(status===0||status===408||status===429||status>=500);if(!retry)throw e;}
   const wait=Math.min(8000,Math.max(Number(last?.retryAfterMs||0),800*Math.pow(2,attempt)));await save({status:'retrying',lastError:`تعذر الاتصال مؤقتًا · إعادة المحاولة ${attempt+1}/5`});await sleep(wait);
  }throw last||Error(`تعذر تنزيل ${plan.table}`);
 }
 async function ingestPlan(meta,plan){
  const st=await load(),key=keyOf(plan),ts=tableState(st,key,plan.total);if(ts.done)return;
  while(!ts.done){
   if(controller?.signal.aborted)throw Object.assign(Error('تم إيقاف التهيئة'),{name:'AbortError'});
   if(!online()){await save({status:'paused',pausedReason:'offline'});throw Object.assign(Error('انقطع الإنترنت؛ حُفظ موضع التنزيل وسيُستأنف تلقائيًا.'),{code:'OFFLINE_PAUSE'});}
   await save({status:'running',phase:plan.scope,currentTable:plan.table,pausedReason:null,lastError:null});
   const b=await requestBatch(meta,plan,ts);if(b.total>0)ts.total=Number(b.total);
   if(b.items.length){
    const report=await local().ingestReconciledBootstrapBatch(plan.table,b.items,{serverCompanyId:meta.serverCompanyId,source:`bootstrap:${plan.scope}`,bootstrapId:meta.bootstrapId,revision:meta.revision});
    const rec={...(st.reconciliation||{})};for(const k of ['same','server-newer','local-newer','conflict','identity-conflict','deleted'])rec[k]=Number(rec[k]||0)+Number(report?.counts?.[k]||0);
    st.reconciliation=rec;
    if(report?.blocked)throw Object.assign(Error(`أوقفت بوابة المطابقة دمج ${plan.table}: توجد ${report.issues.length} حالة تحتاج مراجعة قبل الكتابة.`),{code:'BOOTSTRAP_RECONCILIATION_REQUIRED',table:plan.table,reconciliation:report});
   }
   ts.processed+=b.items.length;ts.cursor=b.next;ts.done=b.done||(!b.items.length&&b.next==null);
   recomputeProgress(st);
   await save({tables:st.tables,processed:st.processed,total:st.total,configProcessed:st.configProcessed,configTotal:st.configTotal,workingProcessed:st.workingProcessed,workingTotal:st.workingTotal,archiveProcessed:st.archiveProcessed,archiveTotal:st.archiveTotal,reconciliation:st.reconciliation});
   await new Promise(r=>(window.requestIdleCallback?requestIdleCallback(()=>r(),{timeout:60}):setTimeout(r,0)));
  }
 }
 async function prepareManifest({restart=false}={}){
  const st=await load(),m=await manifest(),tot=totalsFromPlans(m.plans);
  if(restart||st.bootstrapId!==m.bootstrapId||st.manifestRevision!==m.revision){
   current={...fresh(),status:'running',phase:'manifest',bootstrapId:m.bootstrapId,manifestRevision:m.revision,companyName:m.companyName,workingRange:m.workingRange,total:tot.total,configTotal:tot.config,workingTotal:tot.working,archiveTotal:tot.archive,startedAt:new Date().toISOString(),tables:{}};
   for(const p of m.plans)tableState(current,keyOf(p),p.total);
   if(m.replaceLocal){
    // Step 22A.1: an empty queue is NOT evidence that local data is disposable.
    // Pre-Laravel rows were intentionally saved without queue commands, so replacement is blocked
    // unless every protected row has positive server-adoption evidence.
    let adoption=await local().localAdoptionGuard?.();
    // Step 22A.2: finalizing an adoption session is a separate safety requirement.
    // Even when every row has a batch ACK, bootstrap cannot clear local data until
    // /bootstrap/adoption/complete has also been acknowledged.
    if(!window.MyfntAdoption?.ensureReady)throw Object.assign(Error('قناة اعتماد البيانات المحلية غير محمّلة؛ تم منع الاستبدال.'),{code:'LOCAL_ADOPTION_REQUIRED',adoption});
    if(!adoption?.safeToReplace)await save({status:'adopting',phase:'adoption',pausedReason:'local-adoption',lastError:null});
    await window.MyfntAdoption.ensureReady();
    adoption=await local().localAdoptionGuard?.();
    if(!adoption?.safeToReplace){const tables=(adoption?.localTables||[]).join(', ');throw Object.assign(Error('لم يكتمل اعتماد البيانات المحلية؛ تم منع الاستبدال'+(tables?` (${tables})`:'.')),{code:'LOCAL_ADOPTION_REQUIRED',adoption});}
    // Step 22A.3: do not clear first. Keep the adopted local snapshot until every server batch
    // has passed reconciliation. Stale rows are pruned only after the full bootstrap completes.
    current.replacePending=true;
   }
   await local().setUiMeta(STATE_KEY,current);
  }else{
   current.total=tot.total;current.configTotal=tot.config;current.workingTotal=tot.working;current.archiveTotal=tot.archive;current.workingRange=m.workingRange;current.replacePending=Boolean(current.replacePending||m.replaceLocal);for(const p of m.plans)tableState(current,keyOf(p),p.total);recomputeProgress(current);await save();
  }
  return {meta:m,state:current};
 }
 async function run({restart=false,archive=false,showOverlay=true}={}){
  if(running)return running;controller=new AbortController();
  running=(async()=>{try{
   if(showOverlay)show(true);const {meta}=await prepareManifest({restart});
   const configPlans=meta.plans.filter(p=>p.scope==='config');for(const plan of configPlans)await ingestPlan(meta,plan);
   await save({configReady:true,phase:'working',status:'running'});
   const workingPlans=meta.plans.filter(p=>p.scope==='working');for(const plan of workingPlans)await ingestPlan(meta,plan);
   await save({workingReady:true,phase:'working-ready',status:archive?'running':'ready'});
   await window.MyfntHydration?.hydrate?.({reason:'initial-company-bootstrap'});
   document.dispatchEvent(new CustomEvent('myfnt:bootstrap-working-ready',{detail:{...(await load())}}));show(false);window.showToast?.('تم تجهيز البيانات الأساسية على هذا الجهاز. السجل التاريخي يُحمّل عند الحاجة فقط.');
   if(archive){for(const plan of meta.plans.filter(p=>p.scope==='archive')){await ingestPlan(meta,plan);await sleep(25);}}
   if(archive&&canFinalizeReplacement(await load())){
    const prune=await local().finalizeBootstrapReplacement({tables:REPLACE_MANAGED_TABLES,bootstrapId:meta.bootstrapId});
    const st=await load(),rec={...(st.reconciliation||{}),finalPruned:Number(prune?.deleted||0)};await save({replacePending:false,reconciliation:rec});
   }
   const done=await save({complete:archive,status:archive?'complete':'ready',phase:archive?'complete':'working-ready',completedAt:archive?new Date().toISOString():null,lastError:null});
   if(archive)document.dispatchEvent(new CustomEvent('myfnt:bootstrap-complete',{detail:{...done}}));return done;
  }catch(e){if(e?.name==='AbortError')return save({status:'paused',pausedReason:'user'});if(e?.code==='OFFLINE_PAUSE')return load();if(e?.code==='LOCAL_ADOPTION_REQUIRED'||String(e?.code||'').startsWith('ADOPTION_')){show(false);await save({status:'paused',phase:'adoption-required',pausedReason:'local-adoption',lastError:String(e?.message||e),adoptionGuard:e.adoption||null});document.dispatchEvent(new CustomEvent('myfnt:bootstrap-adoption-required',{detail:e.adoption||{}}));throw e;}if(e?.code==='BOOTSTRAP_RECONCILIATION_REQUIRED'){show(false);await save({status:'paused',phase:'reconciliation-required',pausedReason:'reconciliation',lastError:String(e?.message||e),reconciliationIssue:e.reconciliation||null});document.dispatchEvent(new CustomEvent('myfnt:bootstrap-reconciliation-required',{detail:e.reconciliation||{}}));throw e;}await save({status:'error',lastError:String(e?.message||e),pausedReason:null});throw e;}finally{running=null;controller=null;paint();}})();return running;
 }
 async function resume(){const st=await load();if(st.workingReady)return st;if(!syncEnabled())throw Error('لا يمكن الاستئناف قبل ربط Laravel/API حقيقي.');return run({restart:false,archive:false,showOverlay:true});}
 async function loadArchive(){if(!syncEnabled())throw Error('لا يمكن تحميل الأرشيف قبل ربط Laravel/API حقيقي.');return run({restart:false,archive:true,showOverlay:false});}
 async function pause(){controller?.abort();return save({status:'paused',pausedReason:'user'});}
 async function reset(){controller?.abort();current=fresh();await local()?.setUiMeta?.(STATE_KEY,current);paint();return current;}
 function pct(n,d,done=false){if(!d)return done?100:0;return Math.max(0,Math.min(100,Math.round(n/d*100)));}
 function fmt(n){return Number(n||0).toLocaleString('en-US');}
 function labelTable(t){return ({companies:'بيانات الشركة',company_settings:'الإعدادات',booking_packages:'الباقات',booking_types:'أنواع الحجوزات',alert_rules:'قواعد التنبيه',calendar_blocks:'أيام التقويم',customers:'العملاء',bookings:'الحجوزات',booking_details:'تفاصيل الحجوزات',payments:'السندات والدفعات',booking_audit:'سجل الحجوزات',payment_audit:'سجل السندات'})[t]||t;}
 function statusText(st){if(st.complete)return 'تم تجهيز بيانات الشركة مع الأرشيف المطلوب';if(st.workingReady)return 'الجهاز جاهز · التاريخ القديم يُحمّل عند الحاجة فقط';if(st.status==='paused'&&st.pausedReason==='offline')return 'متوقف مؤقتًا بسبب انقطاع الإنترنت · سيكمل من نفس الموضع';if(st.status==='paused'&&st.pausedReason==='local-adoption')return 'محمي: توجد بيانات محلية يجب اعتمادها على الخادم قبل الاستبدال';if(st.status==='paused'&&st.pausedReason==='reconciliation')return 'متوقف للحماية: توجد فروقات محلية/خادمية تحتاج مطابقة قبل الدمج';if(st.status==='paused')return 'تم إيقاف التنزيل مؤقتًا';if(st.status==='error')return st.lastError||'حدث خطأ في التهيئة';if(st.status==='retrying')return st.lastError||'إعادة محاولة الاتصال…';if(st.status==='running')return 'جارٍ تجهيز بيانات الشركة…';return syncEnabled()?'جاهز لتهيئة بيانات الشركة':'بانتظار ربط Laravel/API';}
 function ensureUI(){if(uiBound)return;uiBound=true;
  const body=document.querySelector('#syncWindow .window__body');if(body&&!document.getElementById('myfntBootstrapPanel')){const sec=document.createElement('section');sec.id='myfntBootstrapPanel';sec.className='myfnt-bootstrap-panel';sec.innerHTML='<div class="myfnt-bootstrap-head"><div><small>INITIAL COMPANY BOOTSTRAP</small><h3>تهيئة بيانات الشركة على هذا الجهاز</h3></div><i class="fa-solid fa-cloud-arrow-down"></i></div><div id="myfntBootstrapSummary"></div><div class="myfnt-bootstrap-actions"><button type="button" id="myfntBootstrapStart" class="primary-btn"><i class="fa-solid fa-cloud-arrow-down"></i> بدء / استئناف</button><button type="button" id="myfntBootstrapPause" class="secondary-btn"><i class="fa-solid fa-pause"></i> إيقاف مؤقت</button></div>';body.appendChild(sec);sec.querySelector('#myfntBootstrapStart').onclick=()=>resume().catch(e=>window.showToast?.(e.message,'warning'));sec.querySelector('#myfntBootstrapPause').onclick=()=>pause();}
  if(!document.getElementById('myfntBootstrapOverlay')){const d=document.createElement('div');d.id='myfntBootstrapOverlay';d.className='myfnt-bootstrap-overlay';d.hidden=true;d.innerHTML='<div class="myfnt-bootstrap-card" role="dialog" aria-modal="true" aria-labelledby="myfntBootstrapTitle"><div class="myfnt-bootstrap-icon"><i class="fa-solid fa-cloud-arrow-down"></i></div><h2 id="myfntBootstrapTitle">تجهيز بيانات الشركة</h2><p id="myfntBootstrapOverlayStatus">جارٍ التحضير…</p><div class="myfnt-bootstrap-big-progress"><i id="myfntBootstrapBar"></i></div><strong id="myfntBootstrapNumbers">0 / 0</strong><div id="myfntBootstrapStages" class="myfnt-bootstrap-stages"></div><p class="myfnt-bootstrap-note">يمكن إغلاق التطبيق أو فقد الاتصال بأمان؛ يتم حفظ Cursor بعد كل دفعة ويُستأنف من آخر موضع.</p><div class="myfnt-bootstrap-overlay-actions"><button type="button" id="myfntBootstrapHide" class="secondary-btn">متابعة في الخلفية</button><button type="button" id="myfntBootstrapOverlayPause" class="secondary-btn">إيقاف مؤقت</button></div></div>';document.body.appendChild(d);d.querySelector('#myfntBootstrapHide').onclick=()=>show(false);d.querySelector('#myfntBootstrapOverlayPause').onclick=()=>pause();}
  addEventListener('online',()=>{load().then(st=>{if(st.status==='paused'&&st.pausedReason==='offline'&&syncEnabled())resume().catch(()=>{});});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')paint();});
 }
 function show(on=true){ensureUI();const d=document.getElementById('myfntBootstrapOverlay');if(d)d.hidden=!on;paint();}
 async function paint(){ensureUI();const st=await load().catch(()=>fresh()),sum=document.getElementById('myfntBootstrapSummary');const cp=pct(st.configProcessed,st.configTotal,st.configReady),wp=pct(st.workingProcessed,st.workingTotal,st.workingReady),ap=pct(st.archiveProcessed,st.archiveTotal,st.complete),all=pct(st.processed,st.total,st.complete);
  if(sum)sum.innerHTML=`<div class="myfnt-bootstrap-state ${st.status}"><b>${esc(statusText(st))}</b><span>${esc(st.companyName||'مساحة الشركة')} · ${esc(st.workingRange?.from||'')} → ${esc(st.workingRange?.to||'')}</span></div><div class="myfnt-bootstrap-mini"><div><span>تهيئة الشركة والإعدادات</span><b>${fmt(st.configProcessed)} / ${fmt(st.configTotal)}</b><i><em style="width:${cp}%"></em></i></div><div><span>السنة الحالية + نافذة مستقبلية</span><b>${fmt(st.workingProcessed)} / ${fmt(st.workingTotal)}</b><i><em style="width:${wp}%"></em></i></div><div><span>الأرشيف عند الطلب</span><b>${fmt(st.archiveProcessed)} / ${fmt(st.archiveTotal)}</b><i><em style="width:${ap}%"></em></i></div></div>${st.lastError?`<p class="myfnt-bootstrap-error">${esc(st.lastError)}</p>`:''}`;
  const start=document.getElementById('myfntBootstrapStart'),pauseBtn=document.getElementById('myfntBootstrapPause');if(start){start.disabled=!syncEnabled()||st.workingReady||st.status==='running';start.innerHTML=syncEnabled()?(st.workingReady?'<i class="fa-solid fa-circle-check"></i> الجهاز جاهز':'<i class="fa-solid fa-cloud-arrow-down"></i> '+(st.processed?'استئناف':'بدء التهيئة')):'<i class="fa-solid fa-link-slash"></i> API غير مربوط';}if(pauseBtn)pauseBtn.disabled=st.status!=='running';
  const bar=document.getElementById('myfntBootstrapBar'),nums=document.getElementById('myfntBootstrapNumbers'),os=document.getElementById('myfntBootstrapOverlayStatus'),stages=document.getElementById('myfntBootstrapStages');if(bar)bar.style.width=all+'%';if(nums)nums.textContent=`${fmt(st.processed)} / ${fmt(st.total)} · ${all}%`;if(os)os.textContent=statusText(st);if(stages){const cur=st.currentTable?labelTable(st.currentTable):'التحضير';stages.innerHTML=`<div class="${st.configReady?'done':'active'}"><i class="fa-solid ${st.configReady?'fa-circle-check':'fa-spinner fa-spin'}"></i><span>الإعدادات والتهيئة</span><b>${cp}%</b></div><div class="${st.workingReady?'done':st.configReady?'active':''}"><i class="fa-solid ${st.workingReady?'fa-circle-check':st.configReady?'fa-spinner fa-spin':'fa-circle'}"></i><span>السنة الحالية + نافذة مستقبلية</span><b>${wp}%</b></div><div class="${st.complete?'done':st.workingReady?'active':''}"><i class="fa-solid ${st.complete?'fa-circle-check':st.workingReady?'fa-spinner fa-spin':'fa-circle'}"></i><span>الأرشيف عند الطلب${st.currentTable?' · '+esc(cur):''}</span><b>${ap}%</b></div>`;}
 }
 async function startAfterLogin(){const st=await load();if(!syncEnabled()||st.workingReady)return false;show(true);run({restart:false,archive:false,showOverlay:true}).catch(e=>window.showToast?.(e.message,'warning'));return true;}
 function contract(){return {manifest:'GET /api/v1/bootstrap/manifest',batch:'GET /api/v1/bootstrap/batch?bootstrap_id=&table=&scope=&cursor=&limit=&from=&to=',batchLimit:DEFAULT_LIMIT(),criticalScopes:['config','working'],archiveScope:'lazy/manual only',resumeStorage:'IndexedDB/local_meta via setUiMeta',workingRange:yearRange(),queuePolicy:'server bootstrap and pull NEVER create sync_queue',reconciliation:['same','server-newer','local-newer','conflict','identity-conflict','deleted'],replacePolicy:'reconcile-first; historical archive is not auto-downloaded'};}
 window.MyfntBootstrap=Object.freeze({load,status:load,start:run,resume,loadArchive,pause,reset,show,startAfterLogin,contract,enabled:syncEnabled,testHooks:Object.freeze({recomputeProgress,hasBlockingReconciliation,canFinalizeReplacement})});
 document.addEventListener('DOMContentLoaded',()=>{ensureUI();paint();load().then(st=>{if(syncEnabled()&&!st.workingReady&&st.startedAt&&st.status!=='running')resume().catch(()=>{});});},{once:true});
})();
