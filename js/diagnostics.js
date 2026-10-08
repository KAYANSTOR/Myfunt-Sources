/* OZAN 1.9.8 — تشخيص سريع: معاينة فورية ثم فحوص متوازية بمهلة لكل مورد. */
(function(){
'use strict';
const VERSION=String(document.querySelector('meta[name=\"ozan-app-version\"]')?.content||'unknown'),MAX_LOGS=300,logs=[],startedAt=Date.now(),seen=new Map();
const originalConsole={error:console.error.bind(console),warn:console.warn.bind(console),log:console.log.bind(console)};
const resourcesToCheck=['assets/js/auth.js','assets/js/auth-data.js','assets/js/scope.js','assets/js/auth-journey.js','assets/css/auth.css','assets/css/auth-journey.css','assets/js/calendar.js','assets/js/calendar-tools.js','assets/js/core.js','assets/js/bookings.js','assets/js/ui.js','assets/js/app.js','assets/js/enhancements.js','assets/js/info-pages.js','assets/js/mock-api.js','assets/js/system-dialogs.js','assets/js/deposit-dialog.js','assets/js/excel-export.js','assets/js/jszip.min.js','assets/js/advanced.js','assets/js/maintenance.js','assets/js/myfnt-regression-tests.js','assets/js/myfnt-backup.js','assets/js/myfnt-hydration.js','assets/js/myfnt-bootstrap.js','assets/js/myfnt-local-db.js','assets/js/myfnt-repositories.js','assets/css/advanced.css','assets/css/booking-refinement.css','assets/css/ozan-polish.css','assets/css/app.css','assets/js/ozan-icons.js','assets/js/profile-tab.js','assets/css/ozan-v223.css','service-worker.js','manifest.json','assets/images/icon-192.png','assets/images/icon-512.png','assets/images/screenshot-mobile.png'];
let latestReport=null,activeAudit=null,renderToken=0,updateScheduled=false;
function now(){return new Date().toISOString()}
function safeString(v){try{return v instanceof Error?`${v.name}: ${v.message}\n${v.stack||''}`:typeof v==='string'?v:JSON.stringify(v,null,2)}catch{return String(v)}}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateBadge(){const el=document.getElementById('diagnosticsBtn');if(!el)return;const count=logs.filter(x=>x.level==='error').length;el.dataset.errorCount=String(count);el.classList.toggle('has-errors',count>0)}
function push(entry){
 const item={time:now(),level:'error',type:'runtime',message:'',source:'',line:null,column:null,stack:'',...entry};
 const fp=[item.level,item.type,item.message,item.source,item.line,item.column].join('|'),t=Date.now();
 if(t-(seen.get(fp)||0)<5000)return;seen.set(fp,t);if(seen.size>500)for(const [key,time] of seen)if(t-time>5000)seen.delete(key);
 logs.push(item);if(logs.length>MAX_LOGS)logs.shift();updateBadge();
 if(!document.getElementById('diagnosticsPanel')?.hidden&&!updateScheduled){
  updateScheduled=true;requestAnimationFrame(()=>{updateScheduled=false;renderInstant()});
 }
}
console.error=function(...args){push({level:'error',type:'console.error',message:args.map(safeString).join(' ')});originalConsole.error(...args)};
console.warn=function(...args){push({level:'warn',type:'console.warn',message:args.map(safeString).join(' ')});originalConsole.warn(...args)};
window.addEventListener('error',e=>{
 if(e.target&&e.target!==window){push({type:'resource',message:`فشل تحميل ${e.target.tagName||'RESOURCE'}`,source:e.target.src||e.target.href||''});return}
 push({type:'window.error',message:e.message||'خطأ JavaScript',source:e.filename||'',line:e.lineno||null,column:e.colno||null,stack:e.error?.stack||''});
},true);
window.addEventListener('unhandledrejection',e=>push({type:'unhandledrejection',message:e.reason?.message||safeString(e.reason),stack:e.reason?.stack||''}));
function storageCheck(){try{const k='__ozan_diag__';localStorage.setItem(k,'1');localStorage.removeItem(k);return {ok:true}}catch(e){return {ok:false,error:e.message}}}
function runtimeCheck(){const grid=document.getElementById('calendarGrid');return {calendarGlobal:!!window.OzanCalendar,calendarCells:grid?.querySelectorAll('.calendar-day').length||0,calendarReady:grid?.dataset?.calendarReady||'',watchdog:document.documentElement.dataset.calendarWatchdog||'',online:navigator.onLine,visibility:document.visibilityState,serviceWorker:'serviceWorker' in navigator}}
function domCheck(){return ['calendarGrid','monthTitle','bookingList','bookingFilters','menuBtn','searchBtn','notificationBtn','availableDatesList','availableMonthLabel'].map(id=>({id,ok:!!document.getElementById(id)}))}
function availabilityCheck(){
 try{
  if(typeof getAvailableMonthData!=='function')return {ok:false,detail:'محرك الأيام المتاحة لم يُحمّل'};
  const d=new Date(),data=getAvailableMonthData(d,[],d),number=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),expected=number-d.getDate()+1;
  const ok=data.days.length===expected&&data.year===d.getFullYear()&&data.month===d.getMonth();
  return {ok,detail:`${data.days.length} / ${expected} يوم متوقع لهذا الشهر دون حجوزات`};
 }catch(e){return {ok:false,detail:String(e)}}
}
function snapshot(){
 const runtime=runtimeCheck(),dom=domCheck(),availability=availabilityCheck();
 return {generatedAt:now(),version:VERSION,url:location.href,userAgent:navigator.userAgent,uptimeMs:Date.now()-startedAt,runtime,storage:storageCheck(),dom,availability,
 checks:[{name:'تقويم من 42 خلية',ok:runtime.calendarCells===42},{name:'جسر التقويم',ok:runtime.calendarGlobal},{name:'محرك التواريخ المتاحة',ok:availability.ok,detail:availability.detail},{name:'HTTPS',ok:window.isSecureContext}],errors:logs.slice().reverse()};
}
async function resourceCheck(path){
 // AbortController يحمي المركز من موارد لا تنتهي استجابتها.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);
 try{const r=await fetch(path+(path.includes('?')?'&':'?')+'diag='+Date.now(),{cache:'no-store',signal:controller.signal});return {ok:r.ok,status:r.status}}
 catch(e){return {ok:false,error:e.name==='AbortError'?'انتهت مهلة الفحص (3.5 ثانية)':e.message}}
 finally{clearTimeout(timer)}
}
async function runAudit(progress){
 const report={...snapshot(),resources:{},pwa:{secureContext:window.isSecureContext,standalone:window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true,notificationSupported:'Notification' in window,notificationPermission:typeof Notification==='undefined'?'unsupported':Notification.permission}};
 progress?.(report,0,resourcesToCheck.length);
 // تشغيل الفحوص بالتوازي بدل 16 طلباً متتالياً.
 await Promise.all(resourcesToCheck.map(async path=>{
  report.resources[path]=await resourceCheck(path);
  progress?.(report,Object.keys(report.resources).length,resourcesToCheck.length);
 }));
 if('serviceWorker' in navigator){try{const reg=await navigator.serviceWorker.getRegistration();report.serviceWorker={supported:true,registered:!!reg,controller:!!navigator.serviceWorker.controller,scope:reg?.scope||''}}catch(e){report.serviceWorker={supported:true,error:e.message}}}
 else report.serviceWorker={supported:false};
 // تحقق فعلي من حالة HTTP ونوع المحتوى؛ لا تحاول تحليل صفحة الخطأ HTML كأنها Manifest.
 try{
  const response=await fetch(document.querySelector('link[rel=manifest]')?.href||'manifest.json',{cache:'no-store'});
  const raw=await response.text();
  if(!response.ok)throw Error('HTTP '+response.status+' — لم يتم العثور على manifest.json في مجلد التطبيق');
  let m;try{m=JSON.parse(raw)}catch{throw Error('الخادم أعاد محتوى غير صالح بصيغة JSON؛ تحقق من إعدادات الاستضافة وإعادة التوجيه')}
  const path=new URL(m.start_url||'./',location.href);
  const icons=Array.isArray(m.icons)?m.icons:[];
  const valid=Boolean(m.name&&(m.display==='standalone'||m.display==='minimal-ui')&&path.origin===location.origin&&icons.some(x=>x.sizes?.includes('192x192'))&&icons.some(x=>x.sizes?.includes('512x512')));
  report.pwa.manifest={ok:valid,status:response.status,name:m.name,display:m.display,startUrl:m.start_url,iconCount:icons.length,error:valid?'':'حقول ملف التثبيت أو الأيقونات المطلوبة غير مكتملة'};
 }catch(e){report.pwa.manifest={ok:false,error:e.message}}

 report.checks.push({name:'نظام الأيقونات المتجهية',ok:!!window.OzanIcons&&window.OzanIcons.iconCount()>0,detail:window.OzanIcons?'أيقونات SVG مستقلة عن الخطوط':'ملف assets/js/ozan-icons.js غير محمّل'});
 report.checks.push({name:'Manifest صالح',ok:!!report.pwa.manifest.ok,detail:report.pwa.manifest.error||'صالح'},{name:'Service Worker مسجل',ok:!!report.serviceWorker.registered});
 try{report.identityAudit=await window.MyfntLocal?.identityAudit?.();report.checks.push({name:'Identity Audit',ok:!!report.identityAudit?.healthy,detail:report.identityAudit?.healthy?'UUID والعلاقات سليمة':`${report.identityAudit?.issues?.length||0} مشكلة هوية/علاقة`});}catch(e){report.identityAudit={healthy:false,error:e.message};report.checks.push({name:'Identity Audit',ok:false,detail:e.message});}
 try{report.storageHealth=await window.MyfntLocal?.storageHealth?.();const mb=(Number(report.storageHealth?.profile?.totalBytes||0)/1048576).toFixed(2);report.checks.push({name:'Storage Health',ok:!!report.storageHealth?.healthy,detail:report.storageHealth?.healthy?`${mb} MB · ${report.storageHealth?.profile?.totalRecords||0} سجل`:`${(report.storageHealth?.warnings||[]).join(', ')||'يحتاج مراجعة'} · ${mb} MB`});}catch(e){report.storageHealth={healthy:false,error:e.message};report.checks.push({name:'Storage Health',ok:false,detail:e.message});}
 try{report.repositoryAuthority=window.MyfntRepositories?.audit?.()||null;report.checks.push({name:'Repository Authority',ok:!!report.repositoryAuthority?.healthy,detail:report.repositoryAuthority?.healthy?'IndexedDB/Query هو المصدر الرسمي':'Repository Authority غير جاهز'});}catch(e){report.repositoryAuthority={healthy:false,error:e.message};report.checks.push({name:'Repository Authority',ok:false,detail:e.message});}
 try{const b=window.MyfntBackup;report.backupEngine={loaded:!!b,filename:b?.filename?.('2026-10-03')||'',excluded:b?.excludedStores||[]};report.checks.push({name:'Backup .db Engine',ok:!!b&&String(report.backupEngine.filename).endsWith('.db')&&report.backupEngine.excluded.includes('sync_queue')&&report.backupEngine.excluded.includes('users'),detail:b?'MYFNTDB1 · GZIP/SHA-256 · يستبعد Queue والحسابات الحساسة':'محرك النسخ غير محمل'});}catch(e){report.backupEngine={loaded:false,error:e.message};report.checks.push({name:'Backup .db Engine',ok:false,detail:e.message});}
 try{const cfg=window.MyfntRepositories?.settings?.snapshot?.()||window.MyfntRepositories?.settings?.get?.()||{},c=cfg.company||{},rules=window.MyfntRepositories?.alerts?.snapshot?.()||window.MyfntRepositories?.alerts?.all?.()||[],staffSms=rules.filter(r=>Array.isArray(r?.channels)&&r.channels.includes('sms')&&['staff','both'].includes(String(r.recipient||'staff'))),phones=(window.MyfntRecipientResolver?.company?.('sms')||[]).map(x=>x.phone).filter(Boolean),bad=staffSms.filter(r=>!String(r.staffMessage||'').trim());report.alertTemplates={staffSmsRules:staffSms.length,staffPhones:[...new Set(phones)].length,missingStaffTemplates:bad.length};const ok=!staffSms.length||(phones.length>0&&bad.length===0);report.checks.push({name:'التنبيهات والقوالب',ok,detail:!staffSms.length?'لا توجد قاعدة SMS للموظفين':ok?`${staffSms.length} قاعدة · ${[...new Set(phones)].length} رقم شركة جاهز`:`تحقق من أرقام الرسائل التي قناتها SMS وقالب رسالة الشركة`});}catch(e){report.alertTemplates={error:e.message};report.checks.push({name:'التنبيهات والقوالب',ok:false,detail:e.message});}
 try{report.bootstrap=await window.MyfntBootstrap?.load?.();report.checks.push({name:'Bootstrap Progress Contract',ok:Boolean(report.bootstrap&&Number.isFinite(Number(report.bootstrap.processed))&&Number.isFinite(Number(report.bootstrap.total))),detail:report.bootstrap?`${report.bootstrap.processed}/${report.bootstrap.total} · ${report.bootstrap.phase}`:'غير جاهز'});}catch(e){report.bootstrap={error:e.message};report.checks.push({name:'Bootstrap Progress Contract',ok:false,detail:e.message});}
 try{report.regression=await window.MyfntRegressionTests?.run?.();report.checks.push({name:'Regression 2.14.5',ok:!!report.regression?.healthy,detail:report.regression?`${report.regression.passed}/${report.regression.total} اختبارات ناجحة`:'وحدة الاختبار غير محملة'});}catch(e){report.regression={healthy:false,error:e.message};report.checks.push({name:'Regression 2.14.5',ok:false,detail:e.message});}
 report.errors=logs.slice().reverse();latestReport=report;progress?.(report,resourcesToCheck.length,resourcesToCheck.length);return report;
}
function ensurePanel(){
 let el=document.getElementById('diagnosticsPanel');if(el)return el;
 el=document.createElement('section');el.id='diagnosticsPanel';el.className='diagnostics-panel';el.hidden=true;
 el.innerHTML='<header class="diagnostics-head"><button class="icon-btn" id="diagCloseBtn" aria-label="إغلاق التشخيص"><i class="fa-solid fa-xmark"></i></button><div><span>نظام التشخيص</span><h2>مركز الأخطاء والفحص</h2></div><button class="primary-btn" id="diagRefreshBtn"><i class="fa-solid fa-stethoscope"></i> فحص الآن</button></header><div class="diagnostics-body"><div id="diagSummary"></div><div class="diagnostics-actions"><button id="diagCopyBtn" class="secondary-btn">نسخ التقرير</button><button id="diagDownloadBtn" class="secondary-btn">تنزيل JSON</button><button id="diagPrintBtn" class="primary-btn">طباعة</button><button id="diagClearBtn" class="danger-btn">مسح السجل</button></div><div id="diagChecks"></div><div id="diagErrors"></div></div>';
 document.body.appendChild(el);
 el.querySelector('#diagCloseBtn').onclick=()=>el.hidden=true;
 el.querySelector('#diagRefreshBtn').onclick=renderPanel;
 el.querySelector('#diagClearBtn').onclick=()=>{logs.length=0;seen.clear();renderInstant();updateBadge()};
 el.querySelector('#diagCopyBtn').onclick=async()=>{const r=latestReport||snapshot();try{await navigator.clipboard.writeText(JSON.stringify(r,null,2))}catch(e){console.warn('تعذر النسخ',e)}};
 el.querySelector('#diagDownloadBtn').onclick=()=>{const r=latestReport||snapshot(),blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`ozan-diagnostics-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
 el.querySelector('#diagPrintBtn').onclick=()=>window.print();return el;
}
function renderInstant(){
 const panel=document.getElementById('diagnosticsPanel');if(!panel||panel.hidden)return;
 const r=snapshot(),fatal=r.errors.filter(x=>x.level==='error').length,warns=r.errors.filter(x=>x.level==='warn').length;
 panel.querySelector('#diagSummary').innerHTML=`<div class="diag-summary-grid"><div><b>${fatal}</b><span>أخطاء</span></div><div><b>${warns}</b><span>تحذيرات</span></div><div><b>${r.runtime.calendarCells}</b><span>خلايا التقويم</span></div><div><b>${r.runtime.online?'ONLINE':'OFFLINE'}</b><span>الشبكة</span></div></div>`;
 panel.querySelector('#diagErrors').innerHTML='<h3>سجل الأخطاء المباشر</h3>'+(r.errors.length?r.errors.map(x=>`<article class="diag-error diag-error--${x.level}"><header><b>${x.level==='warn'?'تحذير':'خطأ'} · ${esc(x.type)}</b><time>${esc(x.time)}</time></header><p>${esc(x.message)}</p>${x.source?`<small>${esc(x.source)}</small>`:''}${x.stack?`<pre>${esc(x.stack)}</pre>`:''}</article>`).join(''):'<div class="diag-empty">لا توجد أخطاء مسجلة حتى الآن.</div>');
}
function renderProgress(r,done,total){
 const panel=document.getElementById('diagnosticsPanel');if(!panel||panel.hidden)return;
 const checks=r.checks.map(c=>`<div class="diag-check ${c.ok?'is-ok':'is-bad'}"><span>${esc(c.name)}</span><b>${c.ok?'سليم':esc(c.detail||'يحتاج إصلاح')}</b></div>`).join('');
 const resources=Object.entries(r.resources||{}).map(([name,res])=>`<div class="diag-check ${res.ok?'is-ok':'is-bad'}"><span>${esc(name)}</span><b>${res.ok?'سليم':esc(res.error||'HTTP '+res.status)}</b></div>`).join('');
 panel.querySelector('#diagChecks').innerHTML=`<h3>فحص المكونات والموارد: ${done}/${total}</h3><div class="diag-checks">${checks}${resources}</div>`;
}
function renderPanel(){
 const token=++renderToken;ensurePanel();renderInstant();
 // النتيجة الأولية تعرض قبل أي fetch، ثم تُحدّث بشكل تدريجي.
 const r=snapshot();renderProgress(r,0,resourcesToCheck.length);
 activeAudit=runAudit((result,done,total)=>{if(token===renderToken)renderProgress(result,done,total)});
 return activeAudit;
}
function openPanel(){const el=ensurePanel();el.hidden=false;renderPanel()}
document.addEventListener('click',e=>{if(e.target.closest('#diagnosticsBtn')){e.preventDefault();openPanel()}},true);
window.addEventListener('load',()=>{
 const r=snapshot();if(r.runtime.calendarCells!==42)push({type:'health.calendar',message:`عدد خلايا التقويم: ${r.runtime.calendarCells}`});
 for(const d of r.dom)if(!d.ok)push({type:'health.dom',message:`عنصر مفقود: #${d.id}`});updateBadge();
});
window.OzanDiagnostics={push,runAudit,open:openPanel,version:VERSION,getLogs:()=>logs.slice(),snapshot};
})();
