/* OZAN V1.9.3 — الميزات المستقلة؛ كل دالة موثقة بالعربية.
   يُحمّل بعد core/bookings/ui وقبل app، ولا يغيّر مفاتيح بيانات الإصدارات السابقة. */
"use strict";
const OZ_HISTORY_KEY = "ozan.booking-history.v1";
const OZ_PREF_KEY = "ozan.experience.v1";
const OZ_REMINDER_SENT_KEY = "ozan.reminder-delivery.v1";
let ozHistory = {};
let ozPreferences = {sounds:true,vibration:false,motion:true,reminderDays:1};

// قراءة JSON مخزّن دون السماح لبيانات تالفة بتعطيل التطبيق.
function ozRead(key,fallback){try{const value=JSON.parse(safeStorage.get(key)||"null");return value===null?fallback:value;}catch{return fallback;}}

// تحميل السجل والإعدادات، واحترام إعداد النظام لتقليل الحركة ما لم يغيّره المستخدم.
function loadEnhancements(){
  const history=ozRead(OZ_HISTORY_KEY,{});ozHistory=history&&typeof history==="object"&&!Array.isArray(history)?history:{};
  const saved=ozRead(OZ_PREF_KEY,{});
  ozPreferences={...ozPreferences,...(saved&&typeof saved==="object"&&!Array.isArray(saved)?saved:{})};
  if(!Object.hasOwn(saved||{},"motion")&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)ozPreferences.motion=false;
  if(!Object.hasOwn(saved||{},"sounds"))ozPreferences.sounds=window.OzanSounds?.enabled()!==false;
  applyExperiencePreferences();
  // التذكيرات تظهر أثناء استخدام التطبيق، وعند العودة من تبويب آخر.
  checkUpcomingReminders();
  if(!window.__ozanRemindersInterval)window.__ozanRemindersInterval=window.setInterval(()=>{if(!document.hidden)checkUpcomingReminders();},60000);
  if(!window.__ozanReminderListener){window.__ozanReminderListener=true;document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkUpcomingReminders();});}
}

// حفظ حدث زمني مستقل عن الحجز، للرجوع إلى التعديلات والدفعات لاحقاً.
function recordBookingHistory(bookingId,kind,label,details={}){
  if(!bookingId)return;
  const list=Array.isArray(ozHistory[bookingId])?ozHistory[bookingId]:[];
  // سجل موجز؛ لا يكرر جميع البيانات المحاسبية في التخزين كل مرة.
  const {before,after,...rest}=details;
  const changedFields=before&&after?Object.keys(after).filter(k=>!['updatedAt','createdAt'].includes(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k])):[];
  list.push({id:uid('h'),at:Date.now(),kind,label,changedFields,...rest});
  ozHistory[bookingId]=list.slice(-150);
  safeStorage.set(OZ_HISTORY_KEY,JSON.stringify(ozHistory));
}

// رسم سجل الحجز داخل نافذة المعاينة بترتيب الأحدث فالأقدم.
function renderBookingHistory(bookingId){
  const host=$("#bookingHistory");if(!host)return;
  const list=Array.isArray(ozHistory[bookingId])?ozHistory[bookingId]:[];
  host.innerHTML=list.length?list.slice().reverse().map(item=>`<div class="oz-history-row"><strong>${escapeHtml(item.label||"تغيير")}</strong><time>${escapeHtml(formatAuditTimestamp(item.at))}</time>${item.changedFields?.length?`<small>الحقول المعدلة: ${escapeHtml(item.changedFields.map(ozFieldLabel).join('، '))}</small>`:''}</div>`).join(''):'<p class="oz-hint">لا توجد تغييرات مسجلة بعد. يبدأ السجل عند أول عملية بعد التحديث.</p>';
}
function ozFieldLabel(key){return ({name:'اسم العميل',phone:'الهاتف',date:'التاريخ',type:'الباقة',status:'الحالة',amount:'الإجمالي',paid:'المدفوع',notes:'الملاحظات',address:'عنوان المناسبة',adjustments:'الخصم والإضافة',hasTime:'تحديد الوقت',timeFrom:'من الساعة',timeTo:'إلى الساعة'})[key]||key;}

// إظهار التفضيلات المحفوظة في صفحة الإعدادات.
function fillExperienceSettings(){
  $("#prefSounds").checked=!!ozPreferences.sounds;$("#prefVibration").checked=!!ozPreferences.vibration;
  $("#prefMotion").checked=!!ozPreferences.motion;$("#prefReminderDays").value=String(ozPreferences.reminderDays);
}

// تطبيق تفضيلات الحركة والصوت والاهتزاز فوراً.
function applyExperiencePreferences(){
  document.body.classList.toggle('oz-reduce-motion',!ozPreferences.motion);
  const soundEnabled=window.OzanSounds?.enabled();
  if(typeof soundEnabled==='boolean'&&soundEnabled!==!!ozPreferences.sounds)window.OzanSounds.toggle();
  if(typeof updateSoundButton==='function')updateSoundButton();
}
function saveExperiencePreferences(){
  const days=Number($("#prefReminderDays").value);
  if(!Number.isInteger(days)||days<0||days>365){$("#experienceResult").textContent='اختر عدداً صحيحاً من 0 إلى 365 يوماً';return;}
  ozPreferences={sounds:$("#prefSounds").checked,vibration:$("#prefVibration").checked,motion:$("#prefMotion").checked,reminderDays:days};
  safeStorage.set(OZ_PREF_KEY,JSON.stringify(ozPreferences));applyExperiencePreferences();
  $("#experienceResult").textContent='تم حفظ الإعدادات';showToast('تم حفظ إعدادات التفاعل');renderNotificationBadge();checkUpcomingReminders();
}
// اهتزاز لطيف وغير معيق، عند دعم المتصفح وتفعيل الخيار.
function ozVibrate(){if(ozPreferences.vibration&&!document.hidden)try{navigator.vibrate?.(20);}catch{}}

// إشعارات محلية: لا تدّعي العمل بعد إغلاق التطبيق، ولا تطلب الإذن تلقائياً.
function checkUpcomingReminders(){
 if(document.hidden)return;
 const sent=ozRead(OZ_REMINDER_SENT_KEY,{}),today=isoDate(new Date());
 // نعتمد نفس محرك الإشعارات الداخلية حتى لا يختلف موعد إشعار Chrome عنها.
 const upcoming=typeof notificationItems==="function"?notificationItems().filter(n=>
  n.type==="reminder"&&!state.notificationRead.has(n.id)&&(window.MyfntRepositories?.bookings?.all?.()||[]).some(b=>b.id===n.bookingId&&!["cancelled","archived"].includes(b.status))
 ):[];
 let newCount=0;
 for(const n of upcoming){
  const key=n.id;if(sent[key])continue;
  sent[key]=Date.now();newCount++;
  if("Notification"in window&&Notification.permission==="granted")try{
   const browserNotification=new Notification(n.title,{body:n.text,icon:"assets/images/icon-192.png",tag:`ozan-${n.id}`});
   browserNotification.onclick=()=>{window.focus();const booking=window.MyfntRepositories?.bookings?.get?.(n.bookingId);if(booking)openPreview(booking);browserNotification.close();};
  }catch(error){console.debug("[التذكيرات] إشعار النظام غير متاح",error);}
 }
 if(newCount){
  safeStorage.set(OZ_REMINDER_SENT_KEY,JSON.stringify(Object.fromEntries(Object.entries(sent).filter(([,v])=>Date.now()-Number(v)<400*86400000))));
  renderNotificationBadge();showToast(`لديك ${newCount} تذكير جديد بالمناسبات`);ozVibrate();
 }
}

// طلب إذن المتصفح بالنقر المباشر فقط، ولا يتطلب الإذن لاستخدام التنبيهات الداخلية.
async function requestOzanNotifications(){
  const result=$("#experienceResult");
  if(!('Notification'in window)||!window.isSecureContext){result.textContent='إشعارات النظام غير مدعومة هنا أو تتطلب HTTPS';return;}
  try{const permission=await Notification.requestPermission();result.textContent=permission==='granted'?'تم تفعيل الإشعارات أثناء فتح التطبيق':permission==='denied'?'تم حظر الإذن؛ افتح إعدادات الموقع في المتصفح للسماح':'لم يتم منح الإذن، يمكنك إعادة المحاولة';if(permission==='granted'){checkUpcomingReminders();window.OzanSounds?.play('notification');}}
  catch{result.textContent='تعذر طلب الإذن في هذا المتصفح';}
}

// إنشاء بصمة SHA-256 محلية لمحتوى النسخة؛ لا تُرسل أي بيانات إلى خادم.
async function ozSha256(value){
  if(!crypto?.subtle)throw Error('التحقق المشفر يتطلب HTTPS ومتصفحاً حديثاً');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
// تصدير جميع المجموعات المستخدمة وبيانات السجل مع إصدار المخطط والتحقق من السلامة.
async function downloadFullBackup(){
  if(!enhancementPlanAllows('manual_backup_enabled'))return showToast('تنزيل نسخة يدوية غير متاح في خطتك الحالية','warning');
  const out=$("#backupResult");out.textContent='جاري تجهيز قاعدة البيانات المضغوطة…';
  try{
    if(!window.MyfntBackup)throw Error('محرك النسخ الاحتياطية غير جاهز');
    const wrapper=await window.MyfntBackup.makeWrapper(),summary=window.MyfntBackup.summary(wrapper.payload),saved=await window.MyfntBackup.downloadWrapper(wrapper);
    out.textContent=`تم تنزيل ${saved.name} · ${summary.bookings} حجز · ${summary.payments} سند · ${summary.customers} عميل · ${summary.tables} جدول.`;
  }catch(error){out.textContent=error.message||'تعذر تجهيز النسخة';}
}

// تحقق صارم من بنية النسخة والعلاقات والأرقام قبل السماح باستبدال الحالة الحالية.
function validateOzanPayload(p){
  if(!p||p.schema!=='ozan-backup-v1')throw Error('صيغة النسخة غير مدعومة');
  for(const key of ['bookings','packages','receipts','specialDays'])if(!Array.isArray(p[key]))throw Error(`بيانات ${key} غير صالحة`);
  if(!p.settings||typeof p.settings!=='object'||Array.isArray(p.settings))throw Error('الإعدادات غير صالحة');
  if(!p.bookingHistory||typeof p.bookingHistory!=='object'||Array.isArray(p.bookingHistory))throw Error('سجل الحجوزات غير صالح');
  if(p.customers!==undefined){
    if(!Array.isArray(p.customers))throw Error('جدول العملاء غير صالح');
    const canonical=p.customers.every(c=>c&&typeof c.id==='string'&&c.id&&/^[1-9]\d*$/.test(String(c.customerNo||''))&&c.name);
    const legacyContacts=p.customers.every(c=>c&&typeof c.name==='string'&&!c.id);
    if(!canonical&&!legacyContacts)throw Error('نسخة العملاء غير مكتملة؛ لا يمكن الترحيل تلقائيًا');
    if(canonical){const ids=new Set(p.customers.map(c=>c.id)),numbers=new Set(p.customers.map(c=>String(c.customerNo)));
      if(ids.size!==p.customers.length||numbers.size!==p.customers.length)throw Error('معرّفات أو أرقام عملاء مكررة في النسخة');
      if(p.bookings.some(b=>!ids.has(b.customerId)))throw Error('حجز بلا ملف عميل في النسخة');
      const linked=new Map(p.bookings.map(b=>[b.id,b.customerId]));
      if(p.receipts.some(r=>r.bookingId&&r.customerId&&r.customerId!==linked.get(r.bookingId)))throw Error('سند يخص عميلًا مختلفًا عن حجزه');
    }
  }
  if(p.alertTemplates!==undefined&&!Array.isArray(p.alertTemplates))throw Error('جدول التنبيهات غير صالح');
  const ids=new Set();for(const b of p.bookings){
    if(!b||typeof b.id!=='string'||!b.id||ids.has(b.id)||typeof b.name!=='string'||!/^\d{4}-\d\d-\d\d$/.test(b.date)||!Number.isFinite(Number(b.amount))||!Number.isFinite(Number(b.paid))||Number(b.amount)<0||Number(b.paid)<0)throw Error('تكرار أو بيانات غير صالحة في الحجوزات');ids.add(b.id);
  }
  for(const r of p.receipts){const linked=typeof r?.bookingId==='string'&&r.bookingId!=='';if(!r||typeof r.bookingId!=='string'||(linked&&!ids.has(r.bookingId))||!Number.isFinite(Number(r.amount))||Number(r.amount)<0)throw Error('سند غير صالح أو يشير إلى حجز غير موجود');}
  return true;
}
// استعادة آمنة قدر الإمكان: التحقق الكامل أولاً، ثم الاحتفاظ بنسخة الذاكرة واسترجاعها عند الفشل.
async function restoreFullBackup(file){
  if(!enhancementPlanAllows('manual_backup_enabled'))return showToast('استعادة النسخ اليدوية غير متاحة في خطتك الحالية','warning');
  const result=$("#backupResult");
  if(!file)return;
  if(file.size>30*1024*1024){result.textContent='الملف أكبر من 30 ميجابايت؛ لم تتم الاستعادة';return;}
  try{
    const wrapper=window.MyfntBackup?await window.MyfntBackup.decodeFile(file):JSON.parse(await file.text());
    if(!wrapper?.payload||typeof wrapper.sha256!=='string')throw Error('ملف غير مطابق لصيغة النسخ الاحتياطي');
    if(!window.MyfntBackup&&(await ozSha256(JSON.stringify(wrapper.payload)))!==wrapper.sha256)throw Error('فشل فحص السلامة: ربما تم تعديل الملف أو تلفه');
    const p=wrapper.payload;validateOzanPayload(p);const currentOwner=window.OzanScope?.owner();
    if(!window.MyfntAccess?.isActive?.())throw Error('لا يمكن استيراد النسخة إلا باشتراك نشط. يمكن تصدير البيانات للاحتفاظ بها.');
    if(!currentOwner||!p.owner||p.owner.userId!==currentOwner.userId||p.owner.companyId!==currentOwner.companyId)throw Error('النسخة يجب أن تخص الحساب والشركة المسجلين حاليًا. النسخ القديمة دون مالك تحتاج ترحيلًا منفصلًا.');
    const message=`تم التحقق من سلامة الملف. ستُستبدل البيانات المحلية بـ ${p.bookings.length} حجز و${p.receipts.length} سند. احفظ نسخة من البيانات الحالية أولاً. هل تريد المتابعة؟`;
    if(!await ozConfirm(message,{title:'استعادة النسخة الاحتياطية',confirmLabel:'استعادة البيانات',danger:true})){result.textContent='تم إلغاء الاستعادة؛ لم تتغير البيانات';return;}
    if(window.MyfntTabGuard?.isStale?.()||window.MyfntFinance?.isRecoveryBlocked?.()||safeStorage.get('ozan.finance.journal.v1'))throw Error('يوجد تحديث من تبويب آخر أو معاملة لم تكتمل؛ أعد فتح التطبيق قبل الاستعادة');
    const canonicalCustomers=Array.isArray(p.customers)&&p.customers.every(c=>c&&c.id&&/^[1-9]\d*$/.test(String(c.customerNo||'')));
    const keys=[STORAGE_KEY,PACKAGES_KEY,RECEIPTS_KEY,SPECIAL_DAYS_KEY,SETTINGS_KEY,NOTIFICATION_READ_KEY,SYNC_AUDIT_KEY,OZ_HISTORY_KEY,OZ_PREF_KEY,NOTIFICATION_READ_AT_KEY,'ozan.finance.audit.v1','ozan.finance.customers.v1','ozan.customers.directory.v1'];
    const before=keys.map(k=>[k,safeStorage.get(k)]);
    const payloads=[p.bookings,p.packages,p.receipts,p.specialDays,p.settings,Array.isArray(p.notificationRead)?p.notificationRead:[],p.syncAudit||{lastAt:0,simulated:[],pending:[]},p.bookingHistory,p.experience||ozPreferences,p.notificationReadAt&&typeof p.notificationReadAt==='object'&&!Array.isArray(p.notificationReadAt)?p.notificationReadAt:{},Array.isArray(p.financeAudit)?p.financeAudit:[],p.financeCustomerNotes&&typeof p.financeCustomerNotes==='object'?p.financeCustomerNotes:{},canonicalCustomers?p.customers:[]];
    try{
      // كتابة جميع المفاتيح أولاً؛ أي خطأ في مساحة التخزين يعيد القيم القديمة.
      keys.forEach((k,i)=>{if(safeStorage.set(k,JSON.stringify(payloads[i]))===false)throw Error('فشل كتابة '+k);});
    }catch(writeError){
      for(const [k,v]of before){try{if(v===null)safeStorage.remove(k);else safeStorage.set(k,v);}catch(e){console.error('[استعادة] فشل الرجوع',k,e);}}
      throw Error('فشل التخزين؛ حاول تحرير مساحة الجهاز. لم تُعتمد الاستعادة.');
    }
    loadState();
    // Rehydrate the in-memory directory from the restored data, never the previous workspace.
    // V2.9.2 archives sometimes carried contact-only rows with no IDs; recover IDs
    // from each booking without merging two legacy customer IDs by name/phone.
    const migration=window.MyfntCustomers.migrate((window.MyfntRepositories?.bookings?.all?.()||[]),(window.MyfntRepositories?.payments?.all?.()||[]),{ignoreSaved:!canonicalCustomers});
    if(migration.changed)window.MyfntFinance?.commitCustomerMigration?.();
    const seqMigration=window.MyfntSequences?.migrate?.({force:true});
    if(seqMigration?.changed){saveBookings();window.MyfntCustomers?.save?.();saveReceipts();}
    loadEnhancementStateOnly();window.MyfntFinance?.reload?.();await window.MyfntOffline?.acceptRestoredData?.();
    if(p.database?.tables&&window.MyfntLocal?.restoreBackupTables){await window.MyfntLocal.restoreBackupTables(p.database.tables);await window.MyfntHydration?.hydrate?.({reason:'backup-restore'});}
    // بيانات محسوبة من حجوزات النسخة، مع سجلات التخصيص المستقلة.
    if(Array.isArray(p.alertTemplates)){window.MyfntRepositories?.alerts?.replaceLocal?.(p.alertTemplates,{persist:true,reconcile:false});}
    if(p.usage&&typeof p.usage==='object'&&!Array.isArray(p.usage))safeStorage.set('ozan.advanced.usage.v1',JSON.stringify(p.usage));
    renderAll();result.textContent='تمت الاستعادة والتحقق من سلامة البيانات';showToast('تمت استعادة النسخة بنجاح');
  }catch(error){result.textContent=error.message||'تعذر قراءة الملف';console.error('[النسخ الاحتياطي]',error);}
}
// إعادة تحميل السجل والتفضيلات بعد الاستعادة دون إنشاء مؤقت تذكيرات جديد.
function loadEnhancementStateOnly(){ozHistory=ozRead(OZ_HISTORY_KEY,{});ozPreferences={...ozPreferences,...ozRead(OZ_PREF_KEY,{})};applyExperiencePreferences();}
window.MyfntBackupRestore=Object.freeze({fromWrapper:wrapper=>restoreFullBackup(new Blob([JSON.stringify(wrapper)],{type:'application/json'})),fromFile:file=>restoreFullBackup(file)});

// ربط أحداث الواجهة مرة واحدة؛ واجهات فتح النوافذ تستعمل المدير الموجود أصلاً.
function bindEnhancementEvents(){
  $("#quickAddBooking")?.addEventListener('click',()=>{ozVibrate();openBookingForm();});
  $("#quickTodayBookings")?.addEventListener('click',()=>{goToday();setViewFilter('today');closeAllWindows();window.scrollTo({top:0,behavior:ozPreferences.motion?'smooth':'instant'});});
  $("#openBackupCenter")?.addEventListener('click',()=>switchWindow('backupCenterWindow'));
  $("#openExperienceSettings")?.addEventListener('click',()=>{fillExperienceSettings();switchWindow('experienceWindow');});
  $("#saveExperienceBtn")?.addEventListener('click',saveExperiencePreferences);
  $("#requestNotificationPermission")?.addEventListener('click',requestOzanNotifications);
  $("#backupDownloadBtn")?.addEventListener('click',downloadFullBackup);
  $("#backupRestoreFile")?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)restoreFullBackup(file);e.target.value='';});
  $("#bookingForm")?.addEventListener('submit',()=>ozVibrate());
  $("#receiptForm")?.addEventListener('submit',()=>ozVibrate());
}
