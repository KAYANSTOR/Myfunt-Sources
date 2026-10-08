// OZAN V1.9.3 — assets/js/bookings.js
// عمليات الحجز ومشاركة معلوماته
// تنسيق الساعات مع التمييز بين الصباح والمساء، وتوحيد البيانات بين الحجز والفاتورة والمشاركة.
// BookingRepository is the access boundary. Legacy state remains a compatibility cache during R15.
function bookingRepository(){return window.MyfntRepositories?.bookings||null;}
function allBookings(){return bookingRepository()?.all?.()||[];}
function bookingById(id){return bookingRepository()?.get?.(id)||allBookings().find(b=>String(b?.id)===String(id))||null;}
function filterBookings(predicate){return bookingRepository()?.filter?.(predicate)||allBookings().filter(predicate);}
function paymentRepository(){return window.MyfntRepositories?.payments||null;}
function packageRepository(){return window.MyfntRepositories?.packages||null;}
function allPackages(){return packageRepository()?.all?.()||[];}
function packageById(id){return packageRepository()?.get?.(id)||allPackages().find(p=>String(p?.id)===String(id))||null;}
function settingsRepository(){return window.MyfntRepositories?.settings||null;}
function specialRepository(){return window.MyfntRepositories?.specialDays||null;}
function allSpecialDays(){return specialRepository()?.all?.()||[];}
function appSettings(){return settingsRepository()?.all?.()||{};}
function allPayments(){return paymentRepository()?.all?.()||[];}
function bookingPlanAllows(name){const p=window.MyfntPlans;if(!p?.current?.())return true;return p.allowed(name);}
function paymentsForBooking(id,{activeOnly=false}={}){const repo=paymentRepository();if(activeOnly&&repo?.activeByBooking)return repo.activeByBooking(id);if(repo?.byBooking)return repo.byBooking(id);return allPayments().filter(r=>String(r?.bookingId)===String(id)&&(activeOnly?r?.status!=='voided':true));}

function formatBookingClock(value){if(!/^\d{2}:\d{2}$/.test(value||''))return '—';const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'صباحًا':'مساءً'}`;}
function bookingTimeLabel(b){return b?.hasTime?`من ${formatBookingClock(b.timeFrom)} إلى ${formatBookingClock(b.timeTo)}`:'غير محدد';}
function setBookingTimeVisible(visible){const panel=$("#bookingTimePanel"),btn=$("#dateTimeToggle");if(!panel)return;panel.hidden=!visible;btn?.setAttribute('aria-expanded',String(visible));updateBookingTimeSummary();}
function updateBookingTimeSummary(){const from=$("#bookingTimeFrom")?.value||'09:00',to=$("#bookingTimeTo")?.value||'21:00';const label=$("#bookingTimeSummary");if(label)label.textContent=`الوقت المحدد: من ${formatBookingClock(from)} إلى ${formatBookingClock(to)}`;}
function bookingShareText(b){ const company=appSettings().company.name||"مايفنت"; const remain=remainingFor(b); return en(`${company}\n${b.status==="pending"?(b.depositPending?"تم تسجيل حجزك المؤقت بانتظار استكمال العربون":"تم تسجيل حجزك المؤقت"):"تم تسجيل حجزك بنجاح"}\nالعميل: ${b.name}\nالمناسبة: ${b.type||"—"}\nالتاريخ: ${formatDateLabel(b.date)}\n${b.hasTime?`الوقت: ${bookingTimeLabel(b)}\n`:''}${Number(b.amount)>0?`المتبقي: ${numberText(remain)} ${currencyLabel(b)}\n`:""}معرف الحجز: #${bookingNumberFor(b)}`); }
function markBookingMessageOpened(b,channel){
 if(!b)return;
 const at=Date.now();
 bookingRepository()?.mutate?.(b.id,item=>{item.manualMessageAttempts=Array.isArray(item.manualMessageAttempts)?item.manualMessageAttempts:[];item.manualMessageAttempts.push({channel,at,state:"opened"});item.updatedAt=at;},{persist:false,sync:false});
 const current=bookingById(b.id)||b,attempts=Array.isArray(current.manualMessageAttempts)?current.manualMessageAttempts:[];
 window.MyfntLocal?.setUiMeta?.(`booking-message:${b.id}`,{attempts:structuredClone(attempts),lastChannel:channel,lastOpenedAt:at}).catch?.(e=>console.warn('[message ui meta]',e));
 recordBookingHistory(b.id,"message-opened",`تم فتح تطبيق ${channel==="sms"?"الرسائل النصية":"واتساب"} للتأكيد اليدوي`);
 if(state.activeBookingId===b.id&&state.windowStack.includes("previewWindow"))openPreview(current);
}
function openSmsForBooking(b){ if(!b?.phone)return; const phone=normalizePhone(b.phone);markBookingMessageOpened(b,"sms");location.href=`sms:${phone}?body=${encodeURIComponent(bookingShareText(b))}`; }
function openWhatsappForBooking(b){ if(!b?.phone)return; const phone=normalizePhone(b.phone);markBookingMessageOpened(b,"whatsapp");window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(bookingShareText(b))}`,"_blank","noopener"); }
function downloadSuccessNotice(b){
  if(!bookingPlanAllows('booking_receipt_download'))return showToast('تنزيل سند الحجز غير متاح في خطتك الحالية','warning');
  const c=document.createElement("canvas"); c.width=1080;c.height=1080;const x=c.getContext("2d");const g=x.createLinearGradient(0,0,1080,1080);g.addColorStop(0,"#fff7fa");g.addColorStop(1,"#ffffff");x.fillStyle=g;x.fillRect(0,0,1080,1080);x.fillStyle="#C4014D";x.fillRect(0,0,1080,20);x.textAlign="right";x.direction="rtl";x.fillStyle="#32091f";x.font="700 58px Arial";x.fillText(b.status==="pending"?"تم تسجيل حجز مؤقت":"تم تأكيد الحجز",970,145);x.font="700 68px Arial";x.fillText(b.name,970,260);x.font="42px Arial";x.fillStyle="#85536c";x.fillText(b.type||"مناسبة",970,345);x.fillText(formatDateLabel(b.date),970,430);x.fillText(formatHijriDate(b.date),970,505);if(Number(b.amount)>0)x.fillText(`${numberText(remainingFor(b))} ${currencyLabel(b)} متبقي`,970,590);x.fillStyle="#1f9d54";x.font="700 46px Arial";x.fillText("تم الحفظ بنجاح",970,735);x.fillStyle="#C4014D";x.font="700 31px Arial";x.fillText(en(`معرف الحجز: #${bookingNumberFor(b)}`),970,920);c.toBlob(blob=>downloadBlob(blob,`booking-notice-${en(b.id.slice(-8))}.jpg`),"image/jpeg",.94);
}
function openSuccessWindow(b){
  if(!b)return; state.lastCreatedBookingId=b.id; $("#successTitle").textContent=`${b.status==="pending"?"تم اعتماد حجز مؤقت":"تم حفظ الحجز بنجاح"} — ${b.name}`; $("#successWindowHeading").textContent=b.status==="pending"?"تم إنشاء حجز مؤقت":"تمت إضافة الحجز"; $("#successText").textContent=`${formatDateLabel(b.date)} · ${b.type||"مناسبة"}${b.depositPending?` · متبقي لاستكمال العربون: ${numberText(Math.max(0,Number(b.depositRequired||0)-Number(b.paid||0)))} ${currencyLabel(b)}`:""}`; const note=$("#successOfflineNote");if(note)note.hidden=!b.offlineQueued; const has=Boolean(normalizePhone(b.phone)); $("#successSmsBtn").disabled=!has; $("#successWhatsappBtn").disabled=!has; $("#successSmsBtn").title=$("#successWhatsappBtn").title=has?"":"أضف رقم هاتف العميل لتفعيل الإرسال"; openWindow("successWindow");
}
function validateBookingDraft(booking, previous=null){
  if(booking.name.length<2) return "اسم العميل قصير جدًا";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || Number.isNaN(parseIso(booking.date).getTime())) return "اختر تاريخًا صحيحًا";
  if(!validPhone(booking.phone)) return "رقم الهاتف غير صحيح";
  if(!Number.isSafeInteger(booking.amount)||!Number.isSafeInteger(booking.paid)||booking.amount<0||booking.paid<0) return "أدخل مبلغًا صحيحًا غير سالب";
  if(booking.paid>booking.amount && !Boolean(appSettings().bookingUi?.allowBookingOverpayment)) return "المدفوع أكبر من إجمالي قيمة الحجز؛ فعّل السماح بالدفع الزائد من إعدادات الحجز أو عدّل الإجمالي";
  const pkg=packageById(booking.packageId);
  if(pkg && !pkg.allowDoubleBooking){
    const duplicate=filterBookings(b=>b.id!==booking.id&&b.date===booking.date&&b.packageId===booking.packageId&&!["cancelled","archived"].includes(b.status));
    if(duplicate.length)return `الباقة «${pkg.name}» لا تسمح بالحجز مرتين في نفس التاريخ`;
  }
  if(booking.hasTime && booking.timeTo<=booking.timeFrom)return "يجب أن يكون وقت النهاية بعد وقت البداية";
  return "";
}
function fillCompanyForm(){ const c=appSettings().company; const session=window.OzanScope?.read?.(); const company=window.OzanAuth?.data?.companies?.find?.(x=>x.id===session?.companyId); const type=window.OzanAuthData?.businessTypes?.find?.(x=>x.id===company?.type); $("#companyName").value=c.name||"";$("#companyPhone1").value=window.MyfntPhone?.display?.(c.phone)||c.phone||"";$("#companyPhone2").value=window.MyfntPhone?.display?.(c.phone2)||c.phone2||"";$("#companyDescription").value=c.description||type?.description||"";$("#companyAddresses").value=c.addresses||"الجمهورية اليمنية صنعاء";$("#companyTerms").value=c.terms||"";$("#companyReceiptNotes").value=c.receiptNotes||""; const p=$("#companyLogoPreview");p.innerHTML=c.logo?`<img src="${c.logo}" alt="شعار الشركة">`:'<i class="fa-solid fa-building"></i>';
 const season=appSettings().season||{};
 const enabled=$('#companySeasonEnabled'),name=$('#companySeasonName'),start=$('#companySeasonStart'),end=$('#companySeasonEnd');
 if(enabled)enabled.checked=season.enabled!==false;
 if(name)name.value=season.name||'موسم';
 const year=new Date().getFullYear();
 if(start)start.value=season.start||`${year}-03-10`;
 if(end)end.value=season.end||`${year}-09-30`;
}
function renderSyncWindow(){
  const l=$("#lastSyncLabel"),t=Number(state.syncAudit.lastAt||0);if(l)l.textContent=t?new Date(t).toLocaleString("ar-YE"):"لم تتم مزامنة خادم بعد";
  const transport=window.MyfntSync?.status?.()||{enabled:false,mode:'none'},a=$("#mockApiStatus");
  if(a)a.textContent=transport.enabled?`متصل — ${transport.mode}`:transport.mode==='mock'?"Mock تجريبي — الإرسال معطّل للحماية":"غير مربوط بالخادم";
  const panel=$("#syncAuditPanel");if(panel)panel.innerHTML=`<div class="sync-summary sync-summary--modern"><div><i class="fa-solid fa-database"></i><b>IndexedDB</b><span>المصدر المحلي المنظم</span></div><div><i class="fa-solid fa-shuffle"></i><b>State Machine</b><span>pending → sending → synced</span></div><div><i class="fa-solid fa-shield-halved"></i><b>Conflict Safe</b><span>لا يتم سحق تعديل Offline</span></div></div><p class="sync-warning">حالة الطابور أدناه هي الحالة الحقيقية المحلية. النقل Mock لا يستطيع تحويل العمليات إلى «متزامن» بنجاح وهمي.</p>`;
  window.MyfntOffline?.display?.().catch?.(e=>console.warn('[sync window]',e));
}



// عرض الحجوزات والبحث والتصفية
function sortBookings(list, direction="asc") {
  return [...list].sort((a,b)=>{
    const dateCompare=String(a.date||"").localeCompare(String(b.date||""));
    if(direction==="desc") return -dateCompare || (b.createdAt||0)-(a.createdAt||0);
    return dateCompare || (a.createdAt||0)-(b.createdAt||0);
  });
}
function monthKeyFromDate(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function monthKeyFromIso(value){ return String(value||"").slice(0,7); }
let bookingMonthCache={key:'',revision:-1,rows:[],byDate:new Map(),byId:new Map(),loadingKey:'',token:0};
function buildMonthIndexes(rows){const byDate=new Map(),byId=new Map();for(const b of rows||[]){byId.set(String(b.id),b);const key=String(b.date||'');if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(b);}return {byDate,byId};}
function fallbackBookingsForMonth(key){
  return allBookings().filter(b=>b&&!["cancelled","archived"].includes(b.status)&&monthKeyFromIso(b.date)===key)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.createdAt||0)-Number(b.createdAt||0));
}
function refreshViewMonthFromIndexedDB({force=false}={}){
  const key=monthKeyFromDate(state.viewDate),revision=Number(window.__myfntBookingsRevision||0),query=window.MyfntQuery;
  if(!query?.bookingsMonthView)return Promise.resolve(fallbackBookingsForMonth(key));
  if(!force&&bookingMonthCache.key===key&&bookingMonthCache.revision===revision)return Promise.resolve(bookingMonthCache.rows);
  if(bookingMonthCache.loadingKey===`${key}:${revision}`)return Promise.resolve(bookingMonthCache.rows);
  const [year,month]=key.split('-').map(Number),token=++bookingMonthCache.token;
  bookingMonthCache.loadingKey=`${key}:${revision}`;
  return query.bookingsMonthView(year,month,{limit:5000}).then(rows=>{
    if(token!==bookingMonthCache.token)return rows;
    rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.createdAt||0)-Number(b.createdAt||0));
    const indexes=buildMonthIndexes(rows);bookingMonthCache={key,revision,rows,byDate:indexes.byDate,byId:indexes.byId,loadingKey:'',token};
    window.__myfntMonthBookings=rows;
    try{renderCalendar();}catch{}
    try{renderBookings();}catch{}
    try{syncAvailableDatesMonth?.(state.viewDate,{force:document.querySelector('#availableDatesWindow')?.classList.contains('is-open')});}catch{}
    return rows;
  }).catch(error=>{console.warn('[month query]',error);bookingMonthCache.loadingKey='';return fallbackBookingsForMonth(key);});
}
function bookingsForViewMonth(){
  const key=monthKeyFromDate(state.viewDate),revision=Number(window.__myfntBookingsRevision||0);
  if(bookingMonthCache.key===key&&bookingMonthCache.revision===revision)return bookingMonthCache.rows;
  const fallback=fallbackBookingsForMonth(key);
  if(bookingMonthCache.loadingKey!==`${key}:${revision}`)queueMicrotask(()=>refreshViewMonthFromIndexedDB());
  return fallback;
}
window.MyfntMonthData=Object.freeze({
  current:()=>bookingsForViewMonth(),
  refresh:opts=>refreshViewMonthFromIndexedDB(opts),
  forDate:value=>{const key=monthKeyFromDate(state.viewDate),revision=Number(window.__myfntBookingsRevision||0);if(bookingMonthCache.key===key&&bookingMonthCache.revision===revision)return bookingMonthCache.byDate.get(String(value||''))||[];return bookingsForViewMonth().filter(b=>b.date===value&&!["cancelled","archived"].includes(b.status));},
  byId:id=>{const key=monthKeyFromDate(state.viewDate),revision=Number(window.__myfntBookingsRevision||0);if(bookingMonthCache.key===key&&bookingMonthCache.revision===revision)return bookingMonthCache.byId.get(String(id))||null;return null;}
});
function bookingsForCurrentFilter() {
  const today = isoDate(new Date());
  const monthly = bookingsForViewMonth();
  switch(state.viewFilter){
    case "today": return sortBookings(monthly.filter(b=>b.date===today));
    case "upcoming": return sortBookings(monthly.filter(b=>b.date>=today&&!["cancelled","archived"].includes(b.status)),"asc");
    case "confirmed": return sortBookings(monthly.filter(b=>b.status==="confirmed"));
    case "pending": return sortBookings(monthly.filter(b=>b.status==="pending"));
    case "date": return sortBookings(monthly.filter(b=>b.date===state.selectedDate));
    default: return sortBookings(monthly);
  }
}
function renderFilterState(){ $$("#bookingFilters .filter-chip").forEach(b=>b.classList.toggle("is-active",state.viewFilter===b.dataset.view)); }
function markTimelineCards(list){
  const today=isoDate(new Date());
  list?.querySelectorAll?.(".booking-card").forEach(card=>{
    const booking=window.MyfntMonthData?.byId?.(card.dataset.id)||bookingById(card.dataset.id);
    if(!booking) return;
    card.classList.toggle("is-past",booking.date<today);
    card.classList.toggle("is-today",booking.date===today);
    card.classList.toggle("is-future",booking.date>today);
  });
}
function focusTimelineAroundToday({smooth=false}={}){
  if(state.viewFilter!=="all" || monthKeyFromDate(state.viewDate)!==monthKeyFromIso(isoDate(new Date()))) return;
  const list=$("#bookingList"); if(!list) return;
  const cards=[...list.querySelectorAll(".booking-card")]; if(!cards.length) return;
  const today=isoDate(new Date());
  const lookup=new Map(allBookings().map(b=>[b.id,b]));
  const getBooking=card=>lookup.get(card.dataset.id);
  let target=cards.find(c=>getBooking(c)?.date===today);
  if(!target) target=cards.find(c=>getBooking(c)?.date>today);
  if(!target) target=[...cards].reverse().find(c=>getBooking(c)?.date<today);
  if(!target) return;
  requestAnimationFrame(()=>{
    const container=document.body.classList.contains("calendar-pinned")?list:null;
    if(container && container.scrollHeight>container.clientHeight){
      const top=Math.max(0,target.offsetTop-container.offsetTop-4);
      container.scrollTo({top,behavior:smooth?"smooth":"auto"});
    }else{
      target.scrollIntoView({block:"nearest",behavior:smooth?"smooth":"auto"});
    }
  });
}
function scheduleTimelineCenter({smooth=false}={}){
  const list=$("#bookingList");
  if(!list) return;
  markTimelineCards(list);
  if(state.timelinePositioned) return;
  if(state.viewFilter!=="all") return;
  const today=isoDate(new Date());
  if(monthKeyFromDate(state.viewDate)!==monthKeyFromIso(today)) return;
  state.timelinePositioned=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>focusTimelineAroundToday({smooth})));
}

function renderBookings() {
  const list = $("#bookingList");
  const bookings = bookingsForCurrentFilter();
  list.textContent = "";

  if (!bookings.length) {
    if (state.viewFilter === "date" && state.selectedDate) {
      list.appendChild(createAvailabilityCard(state.selectedDate));
    }
    return;
  }

  const frag = document.createDocumentFragment();
  // لا يُغلق اليوم بعد حجزه: أظهر إضافة حجز آخر عندما يُحدد تاريخ محدد.
  bookings.slice(0, state.renderLimit).forEach(b => frag.appendChild(createBookingCard(b)));
  // زر الإضافة يظهر أسفل آخر بطاقة، وليس فوقها.
  if(state.viewFilter==="date"&&state.selectedDate){
    const add=document.createElement("button");add.type="button";add.className="load-more";
    add.dataset.action="add-available";add.innerHTML='<i class="fa-solid fa-plus" aria-hidden="true"></i> إضافة حجز آخر في هذا اليوم';frag.appendChild(add);
  }

  if (bookings.length > state.renderLimit) {
    const more = document.createElement("button");
    more.className = "load-more";
    more.dataset.action = "load-more";
    more.innerHTML = `عرض المزيد <small>${en(bookings.length - state.renderLimit)} متبقي</small>`;
    frag.appendChild(more);
  }

  list.appendChild(frag);
  scheduleTimelineCenter();
}

function createAvailabilityCard(value){
  const d=parseIso(value), card=document.createElement("article"); card.className="availability-card";
  card.innerHTML=`<div class="availability-card__date"><span class="availability-card__day"><i class="fa-solid fa-calendar-day"></i>${WEEKDAY_AR[d.getDay()]}</span><strong>${formatGregorianDate(value)}</strong><span><i class="fa-solid fa-moon"></i>${formatHijriDate(value)}</span></div><div class="availability-card__action-wrap"><span class="availability-card__status"><i class="fa-solid fa-circle-check"></i>متوفر</span><button class="availability-card__add" data-action="add-available"><i class="fa-solid fa-plus"></i>إضافة حجز</button></div>`;
  return card;
}
function createBookingCard(booking){
  const card=document.createElement("article"); card.className="booking-card"; card.dataset.id=booking.id; card.tabIndex=0;
  const status=STATUS[booking.status]||STATUS.confirmed;
  const bookingNo=bookingNumberFor(booking);
  const clientName=booking.name||"بدون اسم";
  const packageInfo=allPackages().find(p=>p.id===booking.packageId)
    ||allPackages().find(p=>p.name===booking.type)||null;
  const packageName=booking.type||packageInfo?.name||'بدون باقة';
  const packageIcon=/^fa-[a-z0-9-]+$/.test(packageInfo?.icon||'')?packageInfo.icon:'fa-box-open';
  const dateText=booking.date?formatDateLabel(booking.date):"بدون تاريخ";
  const amount=Number(booking.amount||0);
  const amountRow=amount>0
    ? `<div class="booking-meta booking-meta--amount"><i class="fa-solid fa-wallet"></i><span>${numberText(amount)} ${currencyLabel(booking)}</span></div>`
    : `<div class="booking-meta booking-meta--empty" aria-hidden="true"><i class="fa-solid fa-wallet"></i><span>0</span></div>`;
  card.innerHTML=`
    <button class="booking-card__action" type="button" aria-label="فتح المعاينة"><i class="fa-solid fa-chevron-left"></i></button>
    <div class="booking-card__main">
      <div class="booking-card__row booking-card__row--number"><span class="booking-id-icon" aria-hidden="true">#</span><span>#${escapeHtml(bookingNo)}</span></div>
      <div class="booking-card__row booking-card__row--client"><i class="fa-solid fa-user"></i><span>${escapeHtml(clientName)}</span></div>
      <div class="booking-card__row"><i class="fa-solid ${escapeHtml(packageIcon)}" aria-hidden="true"></i><span>${escapeHtml(packageName)}</span></div>
    </div>
    <div class="booking-card__meta">
      <div class="booking-meta"><i class="fa-solid fa-calendar-days"></i><span>${escapeHtml(dateText)}</span></div>
      ${amountRow}
      <div class="booking-meta booking-meta--status"><i class="fa-solid ${status.icon}"></i><span class="booking-meta__status-text ${status.className}">${status.label}</span></div>
      <div class="booking-meta booking-meta--sync booking-sync--${escapeHtml(booking.syncStatus||'local')}"><i class="fa-solid fa-cloud"></i><span>${escapeHtml(({pending:'بانتظار المزامنة',sending:'جارٍ الإرسال',synced:'متزامن',conflict:'تعارض مزامنة',failed:'فشل المزامنة',local:'محلي'})[booking.syncStatus]||'محلي')}</span></div>
    </div>`;
  return card;
}

/* ---------- full-screen smart window manager ---------- */

// إدارة الحجز والدفعات والفواتير وإدارة البيانات
// الربط بمعرّف الباقة يحمي الحجز من تغيّر اسم الباقة بعد التحرير.
function renderPackageChips(selected="", selectedId=""){
  const box=$("#packageChips");
  // selectedId is supplied as an ID; keep the selected hidden package visible during edits.
  const byId=selectedId?allPackages().find(p=>p.id===selectedId):null;
  const chosen=byId||(!selectedId&&selected?allPackages().find(p=>p.name===selected):null);
  box.innerHTML=allPackages().filter(p=>p.status!=="hidden"||p.id===chosen?.id).map(p=>`<button type="button" class="smart-chip ${p.id===chosen?.id?"is-active":""}" aria-pressed="${p.id===chosen?.id}" data-package-id="${escapeHtml(p.id)}" data-package-name="${escapeHtml(p.name)}"><i class="fa-solid ${p.icon||"fa-star"}"></i><span>${escapeHtml(p.name)}</span></button>`).join("");
  $("#eventType").value=chosen?.name||"";
  return chosen||null;
}
function setTemporaryDuration(hours=0){
  const value=[12,24,48].includes(Number(hours))?Number(hours):0;
  const input=$("#bookingTemporaryHours"); if(input) input.value=value?String(value):"";
  $$("#temporaryDurationChips [data-hours]").forEach(b=>{const selected=value>0&&Number(b.dataset.hours)===value;b.classList.toggle("is-active",selected);b.setAttribute("aria-pressed",String(selected));});
}
function syncTemporaryDurationVisibility(){
  const pending=$("#bookingStatus")?.value==="pending"; const wrap=$("#temporaryDurationWrap"); if(wrap) wrap.hidden=!pending;
}
function temporaryRemainingText(booking){
  if(booking?.status!=="pending") return "";
  if(booking.depositPending)return `بانتظار استكمال العربون: ${numberText(Math.max(0,Number(booking.depositRequired||0)-Number(booking.paid||0)))} ${currencyLabel(booking)}`;
  if(!booking.temporaryExpiresAt)return "مؤقت دون تاريخ انتهاء";
  const ms=Math.max(0,Number(booking.temporaryExpiresAt)-Date.now()), hours=Math.ceil(ms/3600000);
  return ms<=0?"انتهت مدة المؤقت":`متبقي ${en(hours)} ساعة للمؤقت`;
}
function renderStatusChips(selected=""){
  const allowed=["confirmed","pending"],normalized=allowed.includes(selected)?selected:"";
  $("#statusChips").innerHTML=allowed.map(key=>{const v=STATUS[key];return `<button type="button" aria-pressed="${key===normalized}" class="booking-kind-chip ${key===normalized?"is-active":""}" data-status="${key}"><i class="fa-solid ${v.icon}"></i><span>${key==="confirmed"?"مؤكد":"مؤقت"}</span></button>`;}).join("");
  $("#bookingStatus").value=normalized;
  syncTemporaryDurationVisibility();
}
function updateDateMeta(){
  const value=$("#bookingDate").value;
  if(!value){$("#dateWeekday").textContent="—";$("#dateHijri").textContent="—";$("#dateTags").innerHTML="";return;}
  const d=parseIso(value); $("#dateWeekday").textContent=formatAppDate(value); $("#dateHijri").textContent=formatHijriDate(value);
  const diff=daysFromToday(value), currentId=$("#bookingId").value; const available=activeBookingsOnDate(value,currentId).length===0; const special=getSpecialDay(value);
  const tags=[],ui=appSettings().bookingUi||{};
  if(ui.showDaysRemaining!==false&&diff>=0) tags.push(`<span class="smart-tag"><i class="fa-solid fa-clock"></i>${diff===0?"اليوم":`متبقي ${en(diff)} يوم`}</span>`);
  if(isSeasonDate(value)) tags.push(`<span class="smart-tag smart-tag--season"><i class="fa-solid fa-star"></i>${escapeHtml(appSettings().season.name||"موسم")}</span>`);
  if(ui.showAvailability!==false)tags.push(`<span class="smart-tag ${available?"smart-tag--available":"smart-tag--busy"}"><i class="fa-solid ${available?"fa-circle-check":"fa-circle-info"}"></i>${available?"لا توجد حجوزات":"يوجد حجوزات — يمكنك المتابعة"}</span>`);
  if(special) tags.push(`<span class="smart-tag smart-tag--special"><i class="fa-solid fa-star"></i>${escapeHtml(special.label)}</span>`);
  $("#dateTags").innerHTML=tags.join("");
}
function updateRemaining(){
  const amount=Number($("#bookingAmount").value||0), paid=Number($("#bookingPaid").value||0), remaining=Math.max(0,amount-paid);
  $("#bookingRemaining").value=numberText(remaining);
  const code=selectedBookingPackage()?.currency||bookingById($("#bookingId")?.value)?.currency||appSettings().preferences?.currency||"YER";
  for(const [id,v] of [["bookingAmountWords",amount],["bookingPaidWords",paid],["bookingRemainingWords",remaining]]){
    const e=$("#"+id);if(!e)continue;
    const amountDigits=toEnglishDigits($("#bookingAmount")?.value||"").replace(/\D/g,"").length;
    const paidDigits=toEnglishDigits($("#bookingPaid")?.value||"").replace(/\D/g,"").length;
    // لا نظهر كتابة المبلغ حتى يكتب المستخدم رقمين على الأقل في الحقل نفسه.
    const enough=id==="bookingAmountWords"?amountDigits>=2:id==="bookingPaidWords"?paidDigits>=2:amountDigits>=2;
    e.hidden=!enough||appSettings().bookingUi?.showAmountWords===false;
    e.textContent=enough?amountWords(v,code):"";
  }
  const pct=amount>0?Math.min(100,(paid/amount)*100):0; $("#remainingMeter").style.width=`${pct}%`;
}
// مصدر موحّد للباقة الحالية؛ لا نستخدم أول باقة كخيار افتراضي.
let ozBookingAmountMode="auto";
function selectedBookingPackage(){
  const id=$("#packageChips .smart-chip.is-active")?.dataset.packageId;
  return id?packageById(id):null;
}
function packagePriceForDate(packageOrName,date){
  const p=typeof packageOrName==="object"?packageOrName:allPackages().find(x=>x.id===packageOrName)||allPackages().find(x=>x.name===packageOrName);
  if(!p)return null;
  const price=Number(p.price),season=Number(p.seasonPrice);
  if(!Number.isFinite(price)||price<0||!Number.isFinite(season)||season<0)return null;
  // القيم القديمة تجعل 0 في سعر الموسم علامة على عدم تخصيص سعر مستقل.
  return isSeasonDate(date)&&season>0?season:price;
}
function selectedPackageFinancials(){
  const p=selectedBookingPackage(),date=$("#bookingDate")?.value||"";
  if(!p)return {package:null,price:null,deposit:null,currency:appSettings().preferences?.currency||"YER",pendingDate:false};
  const deposit=Number(p.deposit);
  const pendingDate=!date&&Number(p.seasonPrice)>0&&Number(p.seasonPrice)!==Number(p.price);
  return {package:p,price:pendingDate?null:packagePriceForDate(p,date),deposit:Number.isFinite(deposit)&&deposit>=0?deposit:null,
    currency:p.currency||appSettings().preferences?.currency||"YER",pendingDate,season:Boolean(date&&isSeasonDate(date)&&Number(p.seasonPrice)>0)};
}
function bookingAdjustmentDelta(){
  const existing=bookingById($("#bookingId")?.value);
  return [...(existing?.adjustments||[]),...ozDraftAdjustments].reduce((sum,a)=>sum+(a.kind==="discount"?-1:1)*Number(a.value||0),0);
}
// يعرض السعر والعربون المرتبطين بمعرّف الباقة، ويُحدّث الإجمالي عند تبديل الباقة أو التاريخ.
function syncSelectedPackagePricing(cause="package"){
  const {package:p,price,deposit,currency,pendingDate,season}=selectedPackageFinancials();
  const amount=$("#bookingAmount"),pricing=$("#bookingPricingHint"),hint=$("#bookingDepositHint");
  const currencyName=CURRENCIES[currency]||CURRENCIES.YER;
  if(!p){if(pricing){pricing.textContent="";pricing.hidden=true;}if(hint){hint.textContent="يظهر عربون الباقة بعد اختيارها.";delete hint.dataset.state;}if(!$("#bookingId")?.value&&ozBookingAmountMode==="auto")amount.value="";updateRemaining();return;}
  if(pricing){pricing.hidden=false;pricing.textContent=pendingDate?"اختر تاريخ المناسبة لاحتساب سعر الموسم أو غير الموسم.":price===null?"راجع سعر الباقة في إدارة الباقات.":`سعر ${season?"الموسم":"غير الموسم"}: ${numberText(price)} ${currencyName}${!$("#bookingDate").value?" · اختر التاريخ لتأكيده":""}`;}
  const isNew=!$("#bookingId")?.value;
  const changePackage=cause==="package";
  // Never change an existing contract when a package price, season or date changes.
  const existing=bookingById($("#bookingId")?.value);
  if(existing && existing.packageId===p.id){
    if(pricing)pricing.textContent=`السعر المتفق عليه عند الحجز: ${numberText(existing.amount)} ${CURRENCIES[existing.currency]||CURRENCIES.YER} · لا يتغير بتعديل الباقة`;
    refreshBookingDepositHint();updateRemaining();return;
  }
  const shouldApply=(isNew||changePackage)&&(changePackage||cause==='date'||cause==='admin')&&(changePackage||ozBookingAmountMode==='auto');
  if(shouldApply){
    if(price===null){if(isNew&&ozBookingAmountMode==="auto")amount.value="";}
    else{
      // التعديلات المسجلة على حجز قديم تحفظ قيمتها دون نسخها مرتين.
      const adjusted=price+(!isNew?bookingAdjustmentDelta():ozDraftAdjustments.reduce((s,a)=>s+(a.kind==="discount"?-1:1)*Number(a.value||0),0));
      if(adjusted>=0)amount.value=String(adjusted);
    }
    ozBookingAmountMode="auto";
  }
  // لا تعبّئ المدفوع آليًا مهما كانت الباقة أو حالة إلزام العربون.
  refreshBookingDepositHint();
  updateRemaining();
}
function refreshBookingDepositHint(){
  // لا نعدّل الإجمالي أثناء كتابة المستخدم للمدفوع.
  const hint=$("#bookingDepositHint"),{package:p,price,deposit,currency}=selectedPackageFinancials();
  if(!hint)return;
  if(!p){hint.textContent="يظهر الحد الأدنى للعربون بعد اختيار الباقة.";delete hint.dataset.state;return;}
  if(deposit===null){hint.textContent="عربون الباقة غير صالح؛ راجع إدارة الباقات.";hint.dataset.state="error";return;}
  const existing=bookingById($("#bookingId")?.value);
  if(existing?.packageId===p.id && existing.pricingSnapshot){
    const frozen=Number(existing.pricingSnapshot.depositRequired||0);
    hint.textContent=frozen===0?'هذا الحجز لا يشترط عربونًا؛ يمكنك تسجيل أي مبلغ ضمن قيمة الحجز':`عربون الحجز المثبت: ${numberText(frozen)} ${CURRENCIES[existing.currency]||CURRENCIES.YER}. تعديل الباقة لا يغيره`;
    hint.dataset.state='ok';return;
  }
  if(deposit===0){hint.textContent='لا يوجد عربون إلزامي؛ أدخل أي مبلغ مناسب ضمن قيمة الحجز.';hint.dataset.state='ok';return;}
  const required=Boolean(appSettings().bookingUi?.requireExactDeposit),raw=$("#bookingPaid").value.trim(),given=Number(raw||0);
  const remaining=Math.max(0,deposit-given),invalidPrice=price!==null&&deposit>price;
  hint.textContent=`عربون «${p.name}»: ${numberText(deposit)} ${CURRENCIES[currency]||CURRENCIES.YER}`+
    (invalidPrice?" · العربون أعلى من سعر الباقة؛ راجع إعداداتها":
    !required?" · اختياري، يمكنك دفع أي مبلغ":
    raw===""?" · مطلوب للتأكيد، اترك المدفوع فارغًا أو اكتب المبلغ":
    remaining>0?` · ينقصك ${numberText(remaining)} لاستكمال العربون؛ يمكن اعتماده مؤقتًا عند الحفظ`:
    " · تم استيفاء الحد الأدنى، يمكنك دفع مبلغ أكبر");
  hint.dataset.state=invalidPrice||required&&raw!==""&&remaining>0?"error":"ok";
}

function requiredFieldConfig(){ return { ...(appSettings().bookingUi?.requiredFields||{}), name:true, date:true }; }
function applyBookingUiSettings(){
  const ui=appSettings().bookingUi||{};
  document.body.classList.toggle("calendar-pinned",Boolean(ui.calendarPinned));
  document.body.classList.toggle("calendar-collapsed",Boolean(ui.calendarCollapsed));
  const req=requiredFieldConfig();
  const map={name:"customerName",phone:"customerPhone",date:"bookingDate",amount:"bookingAmount",paid:"bookingPaid",notes:"bookingNotes",address:"bookingAddress"};
  for(const [key,id] of Object.entries(map)){ const el=$("#"+id); if(el) el.required=Boolean(req[key]); }
  const addressField=$("#bookingAddressField");
  if(addressField)addressField.hidden=!Boolean(ui.showAddress||req.address||$('#bookingAddress')?.value);
  const visible={showHijri:'#dateHijri',showClockButton:'#dateTimeToggle',showTodayButton:'#dateTodayBtn',showNearestButton:'#dateNextAvailableBtn'};
  for(const [key,selector] of Object.entries(visible)){
    const el=$(selector);if(!el)continue;
    const keepTime=key==='showClockButton'&&!$('#bookingTimePanel')?.hidden;
    el.hidden=ui[key]===false&&!keepTime;
  }
  const dateControl=$('#bookingForm .date-control');
  if(dateControl){const count=[...dateControl.querySelectorAll(':scope > .mini-icon-btn')].filter(button=>!button.hidden).length;
    dateControl.style.setProperty('--mf-visible-date-actions',String(count));
  }
  const labels=$('#dateHijri')?.closest('.date-summary');if(labels)labels.classList.toggle('mf-hijri-disabled',ui.showHijri===false);
  const notes=$('#bookingNotes')?.closest('.field');if(notes)notes.hidden=ui.showNotes===false&&!req.notes&&!$('#bookingNotes')?.value;
  for(const id of ['bookingAmountWords','bookingPaidWords','bookingRemainingWords']){
    const el=$('#'+id);if(el&&ui.showAmountWords===false)el.hidden=true;
  }

  const packageLabel=$("#packageFieldLabel"); if(packageLabel) packageLabel.classList.toggle("is-required",Boolean(req.package));
  $$('[data-required-indicator]').forEach(el=>{ const key=el.dataset.requiredIndicator; el.hidden=!req[key]; });
}
function fillBookingUiSettings(){
  const ui=appSettings().bookingUi||{}; const req=requiredFieldConfig();
  const pin=$("#calendarPinnedSetting"); if(pin) pin.checked=Boolean(ui.calendarPinned);
  const deposit=$("#requireExactDepositSetting");if(deposit)deposit.checked=Boolean(ui.requireExactDeposit);
  const address=$("#showBookingAddressSetting");if(address)address.checked=Boolean(ui.showAddress);
  const overpay=$("#allowBookingOverpaymentSetting");if(overpay)overpay.checked=Boolean(ui.allowBookingOverpayment);
  const overReceipt=$("#allowReceiptOverRemainingSetting");if(overReceipt)overReceipt.checked=Boolean(ui.allowReceiptOverRemaining);
  $$('[data-required-field]').forEach(el=>window.MyfntChoice?.set?.(el,Boolean(req[el.dataset.requiredField])));
  $$('[data-booking-visible]').forEach(el=>window.MyfntChoice?.set?.(el,ui[el.dataset.bookingVisible]!==false));
}
async function saveBookingUiSettings(event){
  event.preventDefault();
  const requiredFields={}; $$('[data-required-field]').forEach(el=>requiredFields[el.dataset.requiredField]=window.MyfntChoice?.pressed?.(el)===true);requiredFields.name=true;requiredFields.date=true;
  const visible={};$$('[data-booking-visible]').forEach(el=>visible[el.dataset.bookingVisible]=window.MyfntChoice?.pressed?.(el)===true);
  if(requiredFields.address)$('#showBookingAddressSetting').checked=true;
  if(requiredFields.notes)visible.showNotes=true;
  try{await settingsRepository()?.mutateDurable?.(cfg=>{cfg.bookingUi={ ...(cfg.bookingUi||{}), ...visible, calendarPinned:Boolean($("#calendarPinnedSetting")?.checked), requireExactDeposit:Boolean($("#requireExactDepositSetting")?.checked), allowBookingOverpayment:Boolean($("#allowBookingOverpaymentSetting")?.checked), allowReceiptOverRemaining:Boolean($("#allowReceiptOverRemainingSetting")?.checked), showAddress:Boolean($("#showBookingAddressSetting")?.checked), requiredFields };});applyBookingUiSettings();refreshBookingDepositHint();showToast("تم حفظ إعدادات الحجز والتقويم");}catch(err){console.error('[booking-ui settings durable save]',err);showToast('تعذر تثبيت إعدادات الحجز؛ تم التراجع','warning');}
}
function validateRequiredBookingFields(booking){
  const req=requiredFieldConfig();
  if(req.name&&!booking.name) return "اسم العميل حقل إجباري";
  if(req.phone&&!booking.phone) return "رقم الهاتف حقل إجباري";
  if(req.date&&!booking.date) return "التاريخ حقل إجباري";
  if(req.package&&!booking.type) return "الباقة حقل إجباري";
  if(req.amount&&!(Number(booking.amount)>0)) return "المبلغ حقل إجباري ويجب أن يكون أكبر من 0";
  if(req.paid&&!String($("#bookingPaid")?.value||"").trim()) return "المدفوع حقل إجباري";
  if(req.notes&&!booking.notes) return "الملاحظات حقل إجباري";
  if(req.address&&!booking.address) return "عنوان المناسبة حقل إجباري";
  return "";
}
// Quiet customer entry: only decide about duplicates when saving.
function showBookingCustomerHint(){};
function linkBookingCustomer(id){
  const c=window.MyfntCustomers.byId(id);if(!c)return false;
  $('#bookingCustomerId').value=c.id;$('#customerName').value=c.name;$('#customerPhone').value=window.MyfntPhone?.display?.(c.phone)||c.phone||'';
  // Do not focus another field, reset chips, reprice or rebuild the booking form.
  // A chosen package and event type must survive linking an existing customer.
  return true;
}
function chooseExistingBookingCustomer(matches){
 const overlay=$('#bookingCustomerDecision'),list=$('#bookingCustomerDecisionList'),cancel=$('#bookingCustomerDecisionCancel'),create=$('#bookingCustomerDecisionCreate');
 if(!overlay||!list)return Promise.resolve({action:'cancel'});
 list.innerHTML=matches.slice(0,12).map(c=>`<button type="button" data-existing-customer="${escapeHtml(c.id)}"><span class="mf-decision-avatar"><i class="fa-solid fa-user"></i></span><span class="mf-decision-main"><strong>${escapeHtml(c.name)}</strong><small>#${escapeHtml(c.customerNo)} · ${escapeHtml(window.MyfntPhone?.display?.(c.phone)||c.phone||'بدون هاتف')}</small></span><i class="fa-solid fa-chevron-left"></i></button>`).join('');
 overlay.hidden=false;
 return new Promise(resolve=>{
   const previous=document.activeElement;
   const finish=answer=>{overlay.hidden=true;list.removeEventListener('click',pick);cancel.removeEventListener('click',cancelled);create?.removeEventListener('click',separate);overlay.removeEventListener('click',outside);document.removeEventListener('keydown',keys,true);if(previous?.isConnected)previous.focus({preventScroll:true});resolve(answer);};
   const pick=e=>{const b=e.target.closest('[data-existing-customer]');if(b)finish({action:'link',id:b.dataset.existingCustomer});};
   const separate=()=>finish({action:'create'});
   const cancelled=()=>finish({action:'cancel'});const outside=e=>{if(e.target===overlay)finish({action:'cancel'});};
   const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish({action:'cancel'});} if(e.key==='Tab'){
     const nodes=[...overlay.querySelectorAll('button:not([disabled])')];if(!nodes.length)return;
     const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }};
   list.addEventListener('click',pick);cancel.addEventListener('click',cancelled);create?.addEventListener('click',separate);overlay.addEventListener('click',outside);document.addEventListener('keydown',keys,true);list.querySelector('button')?.focus({preventScroll:true});
 });
}
function setBookingSaving(saving){
 const windowEl=$('#bookingWindow'), overlay=$('#bookingBusyOverlay'),body=windowEl?.querySelector('.window__body');
 if(windowEl)windowEl.classList.toggle('mf-form-saving',saving);
 if(overlay)overlay.hidden=!saving;
 if(body)body.setAttribute('aria-busy',String(saving));
}
function openBookingForm(existing=null){
 if(window.MyfntAccess?.requireWrite?.())return;if(window.OzanGate?.require?.("إضافة الحجوزات وإدارتها"))return;if(window.OzanPermissions?.denied('bookings.write'))return;
  setBookingSaving(false);ozDraftAdjustments=[];ozBookingAmountMode=existing?"manual":"auto";
  $("#bookingForm").reset(); $("#bookingTimeFrom").value=existing?.timeFrom||"09:00";$("#bookingTimeTo").value=existing?.timeTo||"21:00";setBookingTimeVisible(Boolean(existing?.hasTime)); $("#bookingId").value=existing?.id||""; $('#bookingCustomerId').value=existing?.customerId||''; $("#customerName").value=existing?.name||""; $("#customerPhone").value=window.MyfntPhone?.display?.(existing?.phone)||existing?.phone||""; $("#bookingAddress").value=existing?.address||""; applyBookingUiSettings();
  // إضافة من خلية التقويم تحتفظ بتاريخ اختاره المستخدم صراحة؛ زر الإضافة العادي يبدأ بلا تاريخ.
  $("#bookingDate").value=existing?.date||(state.hasExplicitDateSelection?state.selectedDate:""); syncDateDisplay($("#bookingDate"));
  const old=existing?.packageId?allPackages().find(p=>p.id===existing.packageId):null;
  renderPackageChips(old?.name||existing?.type||"",old?.id||"");renderStatusChips(existing?.status||"confirmed");
  // مدة المؤقت تصبح خيارًا فقط بعد اختيار «مؤقت»؛ لا اختيار افتراضي ظاهر.
  setTemporaryDuration(existing?.status==="pending"?(existing.temporaryHours||24):0);
  $("#bookingAmount").value=existing?.amount??""; $("#bookingPaid").value=existing?.paid??"";
  // Once a booking exists, all payment changes must go through audited receipts.
  $("#bookingPaid").readOnly=Boolean(existing); $("#bookingPaid").title=existing?'تغيير المدفوع من تبويب الدفعات فقط، مع سجل تدقيق':'';
  $("#bookingNotes").value=existing?.notes||""; renderDraftAdjustments(existing?.adjustments||[]);
  $("#formEyebrow").textContent=existing?"تعديل الحجز":"حجز جديد"; $("#formTitle").textContent=existing?existing.name:"إضافة حجز";
  applyBookingUiSettings();updateDateMeta();syncSelectedPackagePricing("open"); updateRemaining(); openWindow("bookingWindow");
  // Never steal focus mid-typing on touch devices: the old 120ms timeout could
  // send the next field's text back to the customer's name and corrupt entries.
  if(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches){
    requestAnimationFrame(()=>{if($('#bookingWindow')?.classList.contains('is-open')&&document.activeElement===document.body)$('#customerName')?.focus({preventScroll:true});});
  }
}
// حاجز حفظ على مستوى الدالة، يمنع إرسال العملية مرتين أثناء نافذة التأكيد.
let ozBookingSubmitBusy=false;
async function submitBooking(event){
  event.preventDefault();
  if(window.MyfntAccess?.requireWrite?.())return;
  if(window.MyfntFinance?.isRecoveryBlocked?.()){
    await ozWarn('توجد معاملة مالية غير مكتملة. أعد فتح التطبيق لاسترجاعها قبل إنشاء أو تعديل أي حجز، ولا تحذف بيانات المتصفح.');
    return;
  }
  if(ozBookingSubmitBusy)return;
  const submit=event.submitter;if(submit?.disabled)return;
  ozBookingSubmitBusy=true;
  try{
  const id=$("#bookingId").value||uid("b"), previous=bookingById(id);
  if(!previous&&window.MyfntVisitorTrial?.canCreate&&!window.MyfntVisitorTrial.canCreate('bookings'))return;
  if(!previous){const gate=window.MyfntFeatureGate?.checkCount?.('bookings_limit',allBookings().length,{message:'تم بلوغ عدد الحجوزات المسموح في خطتك'});if(gate&&!gate.ok){await ozWarn(gate.message);return;}}
  const pkg=selectedBookingPackage(),status=$("#bookingStatus").value;
  if(previous && !pkg){await ozWarn('لا يمكن تعديل الحجز دون اختيار الباقة الأصلية أو بديل واضح');return;}
  if(previous && pkg?.id!==previous.packageId && !await ozConfirm('تغيير الباقة يعني عقدًا جديدًا لهذا الحجز بسعر وعربون مختلفين. هذا الاستثناء يغيّر الحجز الحالي فقط، ولا يغيّر بقية الحجوزات. هل تؤكد؟',{title:'تغيير الباقة المتعاقد عليها',danger:true,confirmLabel:'تأكيد الاستثناء'}))return;
  // Avoid a noisy inline duplicate warning. Present the relevant records only after Save.
  // In Lazy Domain mode the canonical directory is not fully resident in RAM, so
  // prime exact (name + phone) matches from IndexedDB before the synchronous chooser runs.
  if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.customerMatches){try{const remoteMatches=await window.MyfntQuery.customerMatches($('#customerName').value,$('#customerPhone').value);for(const c of remoteMatches){const i=state.customers.findIndex(x=>String(x.id)===String(c.id));if(i<0)state.customers.push(c);else Object.assign(state.customers[i],c);}}catch(error){console.warn('[lazy customer duplicate check]',error);await ozWarn('تعذر التحقق من دليل العملاء المحلي قبل الحفظ. حاول مرة أخرى.');return;}}
  const knownCustomer=window.MyfntCustomers.byId($('#bookingCustomerId').value||previous?.customerId||'');
  const originalContact=Boolean(knownCustomer&&window.MyfntCustomers.nameKey(knownCustomer.name)===window.MyfntCustomers.nameKey($('#customerName').value)
    &&window.MyfntCustomers.phoneKey(knownCustomer.phone)===window.MyfntCustomers.phoneKey($('#customerPhone').value));
  const duplicates=originalContact?[]:window.MyfntCustomers.conflicts($('#customerName').value,$('#customerPhone').value,knownCustomer?.id||'');
  let allowDuplicate=false;
  if(duplicates.length){
    const decision=await chooseExistingBookingCustomer(duplicates);
    if(decision.action==='cancel')return;
    if(decision.action==='link'){
      if(!linkBookingCustomer(decision.id)){await ozWarn('ملف العميل لم يعد موجودًا؛ حاول مجددًا.');return;}
    }else if(decision.action==='create'){
      // A separate customer gets a fresh customer ID and display number even if
      // their name AND phone are identical to an existing customer's.
      if(previous){await ozWarn('للحفاظ على سندات الحجز القديم، أنشئ حجزًا جديدًا لعميل مستقل بدل تبديل هوية حجز قائم.');return;}
      $('#bookingCustomerId').value='';allowDuplicate=true;
    }
  }
  let allocatedCustomerNo='';if(window.MyfntDomainRuntime?.lazy&&!($('#bookingCustomerId').value||previous?.customerId)&&window.MyfntLocal?.nextDisplaySequence){try{allocatedCustomerNo=await window.MyfntLocal.nextDisplaySequence('customer');}catch(error){await ozWarn(error.message||'تعذر حجز رقم العميل');return;}}
  let prepared;try{prepared=window.MyfntCustomers.prepare($('#customerName').value,$('#customerPhone').value,{selectedId:$('#bookingCustomerId').value,existingId:previous?.customerId,allowDuplicate,customerNo:allocatedCustomerNo});}
  catch(err){await ozWarn(err.message);return;}
  if(prepared.isNew){const gate=window.MyfntFeatureGate?.checkCount?.('clients_limit',window.MyfntCustomers.all?.().length??state.customers.length,{message:'تم بلوغ عدد العملاء المسموح في خطتك'});if(gate&&!gate.ok){await ozWarn(gate.message);return;}}
  const currentActor=window.OzanScope?.read?.(),currentActorName=window.OzanAuth?.data?.users?.find(u=>u.id===currentActor?.userId)?.name||'المستخدم المحلي';
  let allocatedBookingNo=previous?.bookingNo||'';if(!allocatedBookingNo&&window.MyfntDomainRuntime?.lazy&&window.MyfntLocal?.nextDisplaySequence){try{allocatedBookingNo=await window.MyfntLocal.nextDisplaySequence('booking');}catch(error){await ozWarn(error.message||'تعذر حجز رقم الحجز');return;}}
  const booking={ id, bookingNo:allocatedBookingNo||nextBookingNumber(), name:$("#customerName").value.trim(), phone:normalizePhone($("#customerPhone").value.trim()), address:$("#bookingAddress").value.trim(), date:$("#bookingDate").value, hasTime:!$("#bookingTimePanel").hidden, timeFrom:$("#bookingTimeFrom").value||"09:00", timeTo:$("#bookingTimeTo").value||"21:00", type:pkg?.name||"", packageId:pkg?.id||"", currency:(previous&&pkg?.id===previous.packageId?previous.currency:pkg?.currency)||appSettings().preferences?.currency||"YER", status, amount:Number($("#bookingAmount").value||0), paid:previous?Number(previous.paid):Number($("#bookingPaid").value||0), notes:$("#bookingNotes").value.trim(), adjustments:[...(previous?.adjustments||[]),...ozDraftAdjustments], annualRepeat:previous?Boolean(previous.annualRepeat):true,temporaryHours:Number($("#bookingTemporaryHours").value||24), temporaryExpiresAt:0, depositPending:false, depositRequired:0, depositPackageId:"", createdById:previous?.createdById||currentActor?.userId||'local', createdBy:previous?.createdBy||currentActorName, updatedById:currentActor?.userId||'local', updatedBy:currentActorName, createdAt:previous?.createdAt||Date.now(), updatedAt:Date.now(), syncStatus:'pending',
      customerId:prepared.customer.id,
      pricingSnapshot:(previous&&previous.packageId===pkg?.id)?(previous.pricingSnapshot||{packageId:previous.packageId,packageName:previous.type,listPrice:previous.amount,depositRequired:Number(previous.depositRequired||0),currency:previous.currency,source:'legacy-agreed-booking',effectiveAt:previous.createdAt}):{packageId:pkg?.id||'',packageName:pkg?.name||'',listPrice:Number(pkg?packagePriceForDate(pkg,$("#bookingDate").value):0),depositRequired:Number(pkg?.deposit||0),currency:pkg?.currency||appSettings().preferences?.currency||'YER',source:'catalogue-at-create',effectiveAt:Date.now()}
    };
  booking.name=prepared.customer.name;booking.phone=prepared.customer.phone;
  const beforeHistory=previous?JSON.parse(JSON.stringify(previous)):null;
  const requiredError=validateRequiredBookingFields(booking); if(requiredError){await ozWarn(requiredError);return;}
  if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.bookingsMonthView){try{const [yy,mm]=booking.date.split('-').map(Number),sameDay=(await window.MyfntQuery.bookingsMonthView(yy,mm,{limit:5000})).filter(x=>x.date===booking.date);for(const row of sameDay){const i=state.bookings.findIndex(x=>String(x.id)===String(row.id));if(i<0)state.bookings.push(row);else Object.assign(state.bookings[i],row);}}catch(error){console.warn('[lazy date validation]',error);await ozWarn('تعذر التحقق من حجوزات هذا التاريخ داخل قاعدة البيانات. حاول مرة أخرى.');return;}}
  const error=validateBookingDraft(booking,previous); if(error){await ozWarn(error);return;}
  // «إلزام العربون» يعني دفع الحد الأدنى للتأكيد؛ دفع أكثر منه صحيح.
  const mandatory=Boolean(appSettings().bookingUi?.requireExactDeposit);
  if(mandatory){
    if(!pkg){await ozWarn("اختر الباقة أولًا لتحديد حد العربون الأدنى");return;}
    const requiredDeposit=(previous&&previous.packageId===pkg.id)?Number(previous.pricingSnapshot?.depositRequired??previous.depositRequired??pkg.deposit):Number(pkg.deposit);
    if(!Number.isSafeInteger(requiredDeposit)||requiredDeposit<0){await ozWarn(`عربون «${pkg.name}» غير صالح؛ صححه من إدارة الباقات`);return;}
    if(requiredDeposit>booking.amount){await ozWarn(`عربون «${pkg.name}» (${numberText(requiredDeposit)} ${currencyLabel(booking)}) أكبر من إجمالي الحجز (${numberText(booking.amount)} ${currencyLabel(booking)}). راجع سعر الباقة أو العربون.`);return;}
    // الباقة والحد المطلوب يتجمدان للحجوزات المؤقتة الموجودة حتى استكمال العربون.
    const sameDeposit=Boolean(previous?.depositPending && previous.packageId===pkg.id);
    const depositDue=sameDeposit?Number(previous.depositRequired):requiredDeposit;
    const unchangedPending=Boolean(sameDeposit&&previous.status==="pending"&&booking.status==="pending"&&Number(previous.paid)===booking.paid);
    if(depositDue>0 && booking.paid<depositDue){
      if(!unchangedPending){
        const choice=await ozAskDepositShortfall({packageName:pkg.name,required:depositDue,paid:booking.paid,currency:currencyLabel(booking)});
        if(choice!=="temporary"){
          if(choice==="edit"){$("#bookingPaid").focus();if($("#bookingPaid").value)$("#bookingPaid").select?.();}
          return;
        }
      }
      booking.status="pending";booking.depositPending=true;booking.depositRequired=depositDue;booking.depositPackageId=pkg.id;
      booking.temporaryHours=0;booking.temporaryExpiresAt=0; // حتى الوفاء بالعربون، لا مؤقت 24 ساعة مخفي.
    } else if(sameDeposit && status==='confirmed') {
      booking.status='confirmed';
    } else if(sameDeposit && status==='pending') {
      booking.status='pending';booking.depositPending=false;
    }
  }else if(previous?.depositPending&&booking.status==="pending"){
    booking.depositPending=true;booking.depositRequired=Number(previous.depositRequired)||0;booking.depositPackageId=previous.depositPackageId||previous.packageId;
    if(booking.paid>=booking.depositRequired){booking.status=status;booking.depositPending=false;}
  }
  if(Number(booking.pricingSnapshot?.depositRequired)===0){booking.depositPending=false;booking.depositRequired=0;}
  if(booking.status==="pending"&&!booking.depositPending){
    if(![12,24,48].includes(Number($("#bookingTemporaryHours").value))){await ozWarn("اختر مدة الحجز المؤقت: 12 أو 24 أو 48 ساعة");return;}
    const changed=!previous||previous.status!=="pending"||Number(previous.temporaryHours)!==booking.temporaryHours||previous.depositPending;
    booking.temporaryExpiresAt=changed?Date.now()+booking.temporaryHours*3600000:Number(previous.temporaryExpiresAt||Date.now()+booking.temporaryHours*3600000);
  }
  const others=filterBookings(b=>b.id!==booking.id&&b.date===booking.date&&!["cancelled","archived"].includes(b.status)&&b.packageId!==booking.packageId);
  if(others.length){const detail=others.slice(0,3).map(b=>`• ${b.name}${b.hasTime?' — '+bookingTimeLabel(b):''}`).join('\n');if(!await ozConfirm(`يوجد ${others.length} حجز في هذا اليوم:\n${detail}\n\nهل تريد متابعة إضافة الحجز؟`,{title:"تنبيه بتكرار تاريخ المناسبة",confirmLabel:"متابعة الحجز"}))return;}
  setBookingSaving(true);
  if(submit){submit.disabled=true;submit.classList.add("is-busy");submit.setAttribute("aria-busy","true");submit.dataset.originalHtml=submit.innerHTML;submit.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> جارٍ حفظ الحجز...';}
  try{
    // Give the browser one paint cycle for the progress overlay; no artificial 1s delay.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!navigator.onLine)booking.offlineQueued=true;
    const unchangedCustomer=window.MyfntCustomers.byId(prepared.customer.id);
    const sameContact=Boolean(unchangedCustomer&&window.MyfntCustomers.nameKey(unchangedCustomer.name)===window.MyfntCustomers.nameKey(booking.name)
      &&window.MyfntCustomers.phoneKey(unchangedCustomer.phone)===window.MyfntCustomers.phoneKey(booking.phone));
    const conflictAtCommit=sameContact?[]:window.MyfntCustomers.conflicts(booking.name,booking.phone,prepared.customer.id);
    if(conflictAtCommit.length&&!prepared.allowDuplicate){await ozWarn('يوجد عميل بنفس الاسم والهاتف؛ أعد اختيار ملف العميل أو إنشاء ملف مستقل.');return;}
    if(prepared.allowDuplicate&&conflictAtCommit.some(c=>!duplicates.some(approved=>approved.id===c.id))){await ozWarn('تغيّر دليل العملاء أثناء تأكيد العميل؛ أعد محاولة الحفظ.');return;}
    if(previous&&prepared.customer.id!==previous.customerId&&paymentsForBooking(previous.id).length>0){
      await ozWarn('لا يمكن تغيير ملف عميل حجز لديه سندات مالية. أنشئ حجزًا جديدًا حفاظًا على ارتباط السندات.');return;
    }
    if(!prepared.isNew&&!window.MyfntCustomers.byId(prepared.customer.id)){await ozWarn('ملف العميل المحدد لم يعد موجودًا؛ أعد اختيار العميل.');return;}
    const i=bookingRepository()?.indexOf?.(id)??allBookings().findIndex(b=>b.id===id),beforeSave=i>=0?allBookings()[i]:null;
    let initialReceipt=null;
    if(!previous&&booking.paid>0){
      const txGate=window.MyfntFeatureGate?.checkCount?.('transactions_limit',allPayments().filter(r=>r?.status!=='voided').length,{message:'تم بلوغ عدد الحركات المالية المسموح في خطتك'});if(txGate&&!txGate.ok){await ozWarn(txGate.message);return;}
      // The customer record is committed alongside booking, receipt and audit.
      try{
        if(!window.MyfntFinance?.commitBookingCustomer)throw Error('وحدة معاملات العميل غير محمّلة؛ لم يُحفظ الحجز.');
        const actor=window.OzanScope?.read?.();
        initialReceipt={id:uid('r'),receiptNo:(window.MyfntDomainRuntime?.lazy&&window.MyfntLocal?.nextDisplaySequence?await window.MyfntLocal.nextDisplaySequence('receipt'):window.MyfntFinance.nextReceiptNumber()),movementNo:(window.MyfntDomainRuntime?.lazy&&window.MyfntLocal?.nextDisplaySequence?await window.MyfntLocal.nextDisplaySequence('movement'):window.MyfntFinance.nextMovementNumber()),bookingId:booking.id,customerId:booking.customerId,
          direction:'in',amount:booking.paid,date:isoDate(new Date()),method:'cash',reference:'',tag:'',
          note:'دفعة أولية عند إنشاء الحجز',source:'initial',status:'active',createdAt:Date.now(),
          createdById:actor?.userId||'local',createdBy:window.OzanAuth?.data?.users?.find(u=>u.id===actor?.userId)?.name||'المستخدم المحلي'};
        await window.MyfntFinance.commitBookingCustomer(booking,prepared.customer,initialReceipt,{allowCustomerDuplicate:prepared.allowDuplicate});
      }catch(error){setBookingSaving(false);await ozWarn(error.message||'تعذر حفظ الحجز والعربون بصورة متسقة. راجع مساحة التخزين.');return;}
    }else{
      try{await window.MyfntFinance.commitBookingCustomer(booking,prepared.customer,null,{allowCustomerDuplicate:prepared.allowDuplicate});}
      catch(error){setBookingSaving(false);await ozWarn(error.message||'تعذر حفظ العميل والحجز معًا؛ لم يعتمد التعديل.');return;}
    }
    markBookingPending(booking);recordBookingHistory(booking.id,i>=0?'update':'create',i>=0?'تعديل بيانات الحجز':'إنشاء الحجز',beforeHistory?{before:beforeHistory,after:booking}:{after:booking});if(!previous&&booking.paid>0)recordBookingHistory(booking.id,'initial-payment','عربون أولي بقيمة '+numberText(booking.paid)+' ريال',{amount:booking.paid});
    for(const change of ozDraftAdjustments)recordBookingHistory(booking.id,change.kind==="add"?"amount-add":"amount-discount",`${change.kind==="add"?"إضافة":"خصم"} ${numberText(change.value)} ${currencyLabel(booking)} — ${change.reason}`,change);
    // commitBookingCustomer() already committed booking/customer/payment atomically to IndexedDB.
    ozDraftAdjustments=[];renderDraftAdjustments();
    state.selectedDate=booking.date;state.hasExplicitDateSelection=false;state.viewDate=startOfMonth(parseIso(booking.date));state.viewFilter="date";
    // Hide the saving state before the booking window starts its close animation.
    // This prevents the busy layer and success window from being visible together.
    setBookingSaving(false);closeWindow("bookingWindow",{skipHistory:true});renderAll();checkUpcomingReminders();
    if(i>=0){ if(state.activeBookingId===id&&state.windowStack.includes("previewWindow"))openPreview(booking);showToast("تم تحديث الحجز");window.OzanSounds?.play("save"); }
    else{ window.OzanSounds?.play("booking");await new Promise(resolve=>setTimeout(resolve,240));openSuccessWindow(booking); }
    // Fires for both a newly created booking and the first successful edit, not for failed validation/storage.
    document.dispatchEvent(new CustomEvent('ozan:booking-saved',{
      detail:{id:booking.id,kind:i>=0?'update':'create',customerId:prepared.customer?.id||booking.customerId||'',customerCreated:Boolean(i<0&&prepared.isNew),paymentId:initialReceipt?.id||'',userId:window.OzanScope?.read()?.userId||null,userName:currentActorName,companyId:window.OzanScope?.read()?.companyId||null}
    }));
  } finally { setBookingSaving(false);if(submit){submit.disabled=false;submit.classList.remove("is-busy");submit.removeAttribute("aria-busy");if(submit.dataset.originalHtml){submit.innerHTML=submit.dataset.originalHtml;delete submit.dataset.originalHtml;}} }
  }finally{ozBookingSubmitBusy=false;}
}
function findNextAvailable(startValue){
  const d=parseIso(startValue||isoDate(new Date()));
  for(let i=0;i<365;i++){ const v=isoDate(d); if(activeBookingsOnDate(v,$("#bookingId").value).length===0) return v; d.setDate(d.getDate()+1); }
  return startValue;
}

function previewContactActions(normalizedPhone){
  const p=String(normalizedPhone||""); if(!p) return "";
  return `<span class="preview-contact-actions" aria-label="إجراءات الهاتف"><a href="tel:${escapeHtml(p)}" title="اتصال" aria-label="اتصال"><i class="fa-solid fa-phone"></i></a><a href="sms:${escapeHtml(p)}" title="رسالة نصية" aria-label="رسالة نصية"><i class="fa-solid fa-message"></i></a><a href="https://api.whatsapp.com/send?phone=${encodeURIComponent(p)}" target="_blank" rel="noopener" title="واتساب" aria-label="واتساب"><i class="fa-solid fa-comments"></i></a></span>`;
}
function bookingPhonePreviewModel(value){
  const normalized=window.MyfntPhone?.digits?.(value)||normalizePhone(value||"");
  if(!normalized) return Object.freeze({normalized:"",display:"",actions:""});
  const display=window.MyfntPhone?.display?.(normalized)||normalized;
  return Object.freeze({normalized,display,actions:previewContactActions(normalized)});
}
function openPreview(booking){
  if(!booking) return;
  state.activeBookingId=booking.id;
  renderBookingHistory(booking.id);
  const title=$("#previewTitle"); if(title) title.textContent="معاينة الحجز";
  const status=STATUS[booking.status]||STATUS.confirmed;
  const remain=remainingFor(booking), diff=daysFromToday(booking.date), season=isSeasonDate(booking.date);
  const contact=bookingPhonePreviewModel(booking.phone);
  const rows=[
    ["hash","رقم الحجز",`#${bookingNumberFor(booking)}`,false,true],
    ["id-card","رقم العميل",`#${escapeHtml(window.MyfntCustomers?.byId(booking.customerId)?.customerNo||"—")}`,false],
    contact.normalized?["phone","الهاتف",`<span class="preview-phone-line"><b dir="ltr">${escapeHtml(contact.display)}</b>${contact.actions}</span>`,true]:null,
    booking.address?["fa-location-dot","عنوان المناسبة",booking.address]:null,
    booking.hasTime?["fa-clock","وقت المناسبة",bookingTimeLabel(booking)]:null,
    ["fa-clock","الأيام المتبقية",diff===0?"اليوم":diff>0?`${en(diff)} يوم`:`منذ ${en(Math.abs(diff))} يوم`],
    ["fa-star","الموسم",season?(appSettings().season.name||"موسم"):"غير موسم"],
    Number(booking.amount)>0?["fa-money-bill-wave","الإجمالي",`${numberText(booking.amount)} ${currencyLabel(booking)}`]:null,
    Number(booking.paid)>0?["fa-wallet","المدفوع",`${numberText(booking.paid)} ${currencyLabel(booking)}`]:null,
    Number(booking.amount)>0?["fa-coins","المتبقي",`${numberText(remain)} ${currencyLabel(booking)}`]:null,
    [status.icon,"الحالة",status.label],
    ["fa-cloud","حالة المزامنة",({pending:"بانتظار المزامنة",sending:"جارٍ الإرسال",synced:"متزامن مع الخادم",conflict:"تعارض يحتاج مراجعة",failed:"فشلت المزامنة",local:"محلي فقط"})[booking.syncStatus]||"محلي فقط"],
    ["fa-paper-plane","تأكيد آلي","غير مفعل — نسخة محلية بدون خادم"],
    ["fa-message","التأكيد اليدوي",(booking.manualMessageAttempts||[]).length?`تم فتح تطبيق الإرسال (${en(booking.manualMessageAttempts.length)} مرة)` : "لم يُفتح تطبيق الإرسال"],
    booking.status==="pending"?["fa-hourglass-half",booking.depositPending?"استكمال العربون":"مدة المؤقت",temporaryRemainingText(booking)]:null,
    ["fa-clock-rotate-left","آخر تعديل",formatAuditTimestamp(booking.updatedAt)],
    ["fa-user-pen","إنشاء بواسطة",booking.createdBy||"المستخدم المحلي"],
    booking.notes?["fa-note-sticky","ملاحظات",booking.notes,false,false,true]:null
  ].filter(Boolean);
  // اسم الحقل في سطر مستقل فوق القيمة، والأيقونة مع الاسم في الصف نفسه.
  const details=rows.map(r=>`<div class="preview-row oz-preview-row ${r[5]?"preview-row--full":""}"><span class="oz-preview-row__label">${r[4]?`<i class="fa-solid fa-hashtag"></i>`:`<i class="fa-solid ${r[0]==="phone"?"fa-phone":r[0]}"></i>`}<span>${escapeHtml(r[1])}</span></span><strong>${r[3]?r[2]:escapeHtml(en(r[2]))}</strong></div>`).join("");
  const review=[];
  if(!contact.normalized)review.push('<button type="button" class="oz-preview-tip" data-oz-tip="phone"><i class="fa-solid fa-phone-slash"></i> لا يوجد رقم هاتف — أضف رقم التواصل <i class="fa-solid fa-chevron-left"></i></button>');
  if(Number(booking.amount||0)<=0)review.push('<button type="button" class="oz-preview-tip" data-oz-tip="amount"><i class="fa-solid fa-coins"></i> لم يُحدد مبلغ الحجز — أضف المبلغ <i class="fa-solid fa-chevron-left"></i></button>');
  else if(remain>0)review.push('<button type="button" class="oz-preview-tip" data-oz-tip="receipt"><i class="fa-solid fa-wallet"></i> مبلغ غير مسدد — إضافة دفعة <i class="fa-solid fa-chevron-left"></i></button>');
  const expiredBadge=diff<0?'<span class="oz-preview-ended"><i class="fa-solid fa-calendar-check"></i> مناسبة سابقة</span>':'';
  const adjustmentNote=(booking.adjustments||[]).map(x=>`<div class="oz-adjustment-line"><i class="fa-solid ${x.kind==="discount"?"fa-tag":"fa-circle-plus"}"></i><span>${x.kind==="discount"?"سبب الخصم":"سبب الإضافة"}: ${escapeHtml(x.reason||"غير محدد")}</span><b>${x.kind==="discount"?"−":"+"}${numberText(x.value)} ${currencyLabel(booking)}</b></div>`).join("");
  $("#previewContent").innerHTML=`<div class="preview-date-hero preview-date-hero--clean"><strong>${escapeHtml(formatAppDate(booking.date))}</strong>${expiredBadge}<span class="preview-date-hero__hijri"><i class="fa-solid fa-moon"></i>${escapeHtml(formatHijriDate(booking.date))}</span><div class="preview-hero-person"><i class="fa-solid fa-user"></i><div><b>${escapeHtml(booking.name||"بدون اسم")}</b><small>${escapeHtml(booking.type||"بدون باقة")}</small></div></div></div><div class="preview-grid preview-grid--pairs">${details}</div>${adjustmentNote?`<section class="oz-adjustment-reasons"><h3><i class="fa-solid fa-receipt"></i> تفاصيل الخصم والإضافة</h3>${adjustmentNote}</section>`:""}${review.length?`<div class="oz-preview-tips">${review.join("")}</div>`:""}`;
  const isPending=booking.status==="pending";
  const confirmBtn=$("#previewConfirmBtn");
  if(confirmBtn){confirmBtn.hidden=!isPending; confirmBtn.setAttribute("aria-hidden",String(!isPending));}
  confirmBtn?.closest(".window-actions")?.classList.toggle("has-confirm",isPending);
  if(state.windowStack.at(-1)==="notificationsWindow"||state.windowStack.at(-1)==="searchWindow")switchWindow("previewWindow");else openWindow("previewWindow");
}
async function confirmActiveBooking(){
  const b=bookingById(state.activeBookingId); if(!b||b.status!=="pending") return;
  if(appSettings().bookingUi?.requireExactDeposit && b.depositPending && Number(b.paid)<Number(b.depositRequired)){await ozWarn(`لا يمكن تأكيد هذا الحجز قبل استكمال العربون. المتبقي ${numberText(Number(b.depositRequired)-Number(b.paid))} ${currencyLabel(b)}. أضف دفعة أو عدّل الحجز أولًا.`);return;}
  bookingRepository()?.mutate?.(b.id,item=>{item.status="confirmed";item.depositPending=false;item.temporaryExpiresAt=0;item.updatedAt=Date.now();});recordBookingHistory(b.id,"confirm","تأكيد الحجز"); renderAll(); openPreview(b); showToast("تم تأكيد الحجز");
}
function askCancellationSettlement(booking){
 return new Promise(resolve=>{
  const paid=Math.max(0,Number(booking?.paid||0));
  let overlay=document.getElementById('bookingCancelSettlement');
  if(!overlay){overlay=document.createElement('div');overlay.id='bookingCancelSettlement';overlay.className='mf-cancel-settlement';overlay.hidden=true;overlay.innerHTML=`<div class="mf-cancel-settlement__card" role="dialog" aria-modal="true" aria-labelledby="cancelSettleTitle"><div class="mf-cancel-settlement__icon"><i class="fa-solid fa-triangle-exclamation"></i></div><h3 id="cancelSettleTitle">إلغاء الحجز والتعامل مع الدفعات</h3><p class="mf-cancel-settlement__intro"></p><div class="mf-cancel-settlement__options"><button type="button" data-cancel-settle="refund" class="mf-cancel-choice mf-cancel-choice--refund"><i class="fa-solid fa-money-bill-transfer"></i><span><strong>تسجيل حركة صرف</strong><small>إرجاع إجمالي المبلغ المقبوض وتصفير رصيد الحجز</small></span></button><button type="button" data-cancel-settle="keep" class="mf-cancel-choice"><i class="fa-solid fa-hand-holding-dollar"></i><span><strong>إلغاء بدون حركة صرف</strong><small>استخدم هذا الخيار إذا كان العربون أو المبلغ المدفوع غير مسترد</small></span></button></div><button type="button" class="secondary-btn mf-cancel-settlement__close" data-cancel-settle="abort">تراجع</button></div>`;document.body.appendChild(overlay);}
  const intro=overlay.querySelector('.mf-cancel-settlement__intro'),refund=overlay.querySelector('[data-cancel-settle="refund"]');
  if(intro)intro.innerHTML=paid>0?`إجمالي الرصيد المقبوض المرتبط بالحجز حاليًا <b>${numberText(paid)} ${escapeHtml(currencyLabel(booking))}</b>. اختر كيف تريد معالجة هذا الرصيد قبل نقل الحجز إلى المهملات.`:'لا توجد دفعات صافية مرتبطة بهذا الحجز. يمكنك إلغاء الحجز بدون إنشاء حركة صرف.';
  if(refund){refund.disabled=paid<=0;refund.classList.toggle('is-disabled',paid<=0);}
  overlay.hidden=false;document.body.classList.add('has-system-dialog');
  const finish=value=>{overlay.hidden=true;document.body.classList.remove('has-system-dialog');overlay.removeEventListener('click',click);document.removeEventListener('keydown',key,true);resolve(value);};
  const click=e=>{const b=e.target.closest('[data-cancel-settle]');if(b&&!b.disabled)finish(b.dataset.cancelSettle);else if(e.target===overlay)finish('abort');};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();finish('abort');}};
  overlay.addEventListener('click',click);document.addEventListener('keydown',key,true);
 });
}
async function trashActiveBooking(){
  const id=state.activeBookingId;if(!id)return;const b=bookingById(id);if(!b)return;
  const decision=await askCancellationSettlement(b);if(decision==='abort')return;
  if(decision==='refund'&&Number(b.paid||0)>0){
    try{window.MyfntFinance?.postPayment?.(b,Number(b.paid),isoDate(new Date()),'صرف مقابل إلغاء حجز تم ارجاع العربون والمبالغ المدفوعة',{direction:'out',method:'cash',tag:'إلغاء حجز'});}
    catch(err){await ozWarn(err.message||'تعذر تسجيل حركة الصرف؛ لم يتم إلغاء الحجز.');return;}
  }
  bookingRepository()?.mutate?.(b.id,item=>{item.status='cancelled';item.updatedAt=Date.now();item.cancellationSettlement=decision;});
  recordBookingHistory(b.id,'trash',decision==='refund'?'إلغاء الحجز مع تسجيل حركة صرف للمبالغ المدفوعة':'إلغاء الحجز بدون تسجيل حركة صرف');
  closeWindow('previewWindow');renderAll();showToast(decision==='refund'?'تم إلغاء الحجز وتسجيل حركة الصرف':'تم إلغاء الحجز بدون حركة صرف');
}
function openBookingPhoneField(booking){
 if(!booking)return;openBookingForm(booking);
 const phone=$("#customerPhone");if(!phone)return;
 requestAnimationFrame(()=>setTimeout(()=>{
  phone.scrollIntoView({behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth",block:"center"});
  phone.focus({preventScroll:true});if(phone.value)phone.select();
 },190));
}
function editActiveBooking(){ const b=bookingById(state.activeBookingId); if(!b) return; openBookingForm(b); }
function activeReceiptBooking(){return bookingById($("#receiptBookingId").value);}
function renderReceiptBookingSummary(b){
 const sum=$("#receiptBookingSummary"),history=$("#receiptPaymentHistory");
 if(!b){sum.textContent="اختر حجزًا من البحث أولًا";history.replaceChildren();return;}
 sum.innerHTML=`<strong><i class="fa-solid fa-circle-user"></i> ${escapeHtml(b.name)} · #${escapeHtml(String(bookingNumberFor(b)))}</strong><small>${escapeHtml(b.type||'مناسبة')} · ${escapeHtml(b.date)}</small><div class="oz-receipt-stats"><span><small>إجمالي الحجز</small><b>${numberText(b.amount)} ${currencyLabel(b)}</b></span><span><small>المدفوع</small><b>${numberText(b.paid)} ${currencyLabel(b)}</b></span><span><small>المتبقي</small><b>${numberText(remainingFor(b))} ${currencyLabel(b)}</b></span></div>`;
 const records=paymentsForBooking(b.id,{activeOnly:true}).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
 history.innerHTML=`<strong>سجل الدفعات (${en(records.length)})</strong>${Number(b.paid)>records.reduce((n,r)=>n+(r.direction==='out'?-1:1)*Number(r.amount||0),0)?`<div>الدفعة عند الحجز: ${numberText(Number(b.paid)-records.reduce((n,r)=>n+(r.direction==='out'?-1:1)*Number(r.amount||0),0))}</div>`:""}${records.map(r=>`<div>${escapeHtml(r.date||"—")} · ${numberText(r.amount)} ${currencyLabel(b)} ${r.note?`· ${escapeHtml(r.note)}`:""}</div>`).join("")||"<small>لا توجد سندات إضافية</small>"}`;
}
function chooseReceiptBooking(id){
 const b=bookingById(id);if(!b)return;
 clearTimeout(window.__ozReceiptSearchTimer);
 $("#receiptBookingId").value=b.id;$("#receiptBookingSearch").value=`${b.name} · #${bookingNumberFor(b)}`;$("#receiptSuccessNote").hidden=true;
 $("#receiptBookingResults").hidden=true;$("#receiptBookingSearch").setAttribute("aria-expanded","false");
 $("#receiptAmount").value="";$("#receiptAmountWords").textContent="أدخل المبلغ";$("#receiptNote").value=`دفعة على الحجز${b.hasTime?" — "+bookingTimeLabel(b):""}`;
 const related=$("#receiptAdjustmentSummary");if(related){const lines=(b.adjustments||[]).map(x=>`<div class="oz-draft-adjustment"><span>${x.kind==="discount"?"خصم":"إضافة"}: ${escapeHtml(x.reason)}</span><b>${numberText(x.value)} ${currencyLabel(b)}</b></div>`).join("");related.innerHTML=lines;related.hidden=!lines;}
 renderReceiptBookingSummary(b);
 updateReceiptDirectionUI();
}
function searchReceiptBookings(query=""){
 const selected=$('#receiptBookingId')?.value;
 if(selected)return; // A delayed search must never re-open after the booking was chosen.

 const host=$("#receiptBookingResults");if(!host)return;
 const q=normalizeSearch(query.trim());const matches=[];for(const b of allBookings()){if(b.status==='cancelled')continue;if(!q||normalizeSearch([b.name,b.phone,b.date,String(bookingNumberFor(b)),b.type].join(' ')).includes(q)){matches.push(b);if(matches.length>=25)break;}}
 host.innerHTML=matches.map(b=>`<button type="button" data-receipt-booking="${escapeHtml(b.id)}"><strong>${escapeHtml(b.name)}</strong><small>#${escapeHtml(String(bookingNumberFor(b)))} · ${escapeHtml(b.date)} · متبقي ${numberText(remainingFor(b))} ${currencyLabel(b)}</small></button>`).join("")||"<div>لا توجد حجوزات مطابقة</div>";
 host.hidden=false;$("#receiptBookingSearch").setAttribute("aria-expanded","true");
}
function openReceipt({useActive=true}={}){
 clearTimeout(window.__ozReceiptSearchTimer);
 $("#receiptForm").reset();$("#receiptSuccessNote").hidden=true;$("#receiptAmountWords").textContent="أدخل المبلغ";$("#receiptDate").value=isoDate(new Date());syncDateDisplay($("#receiptDate"));const receiptDateMeta=document.getElementById('receiptDateMeta');if(receiptDateMeta)receiptDateMeta.textContent='يُحفظ بتاريخ اليوم تلقائيًا: '+formatDateLabel($("#receiptDate").value);
 $("#receiptBookingId").value="";$("#receiptBookingSearch").value="";$("#receiptBookingResults").hidden=true;
 const b=useActive?bookingById(state.activeBookingId):null;if(b)chooseReceiptBooking(b.id);else renderReceiptBookingSummary(null);
 const kind=document.getElementById('receiptDirection');if(kind)kind.value='in';document.querySelectorAll('#receiptDirectionChips .mf-choice').forEach(c=>{const on=c.dataset.receiptDirection==='in';c.classList.toggle('is-active',on);c.setAttribute('aria-pressed',String(on));});const method=document.getElementById('receiptMethod');if(method)method.value='cash';document.getElementById('receiptTag').value='عربون';document.querySelectorAll('#receiptTagChips .mf-choice').forEach(c=>{const on=c.dataset.receiptTag==='عربون';c.classList.toggle('is-active',on);c.setAttribute('aria-pressed',String(on));});
 openWindow("receiptWindow");
 updateReceiptDirectionUI();
}
function updateReceiptDirectionUI(){
 const b=activeReceiptBooking(),out=$('#receiptDirection')?.value==='out';
 const hint=$('#receiptDirectionHint'),amount=$('#receiptAmount'),label=$('#receiptDateLabel'),submit=$('#receiptSubmitBtn'),hero=$('#receiptActionTitle');
 const max=b?(out?Number(b.paid||0):Math.max(0,remainingFor(b))):null;
 if(hint)hint.textContent=b?`${out?'الصرف لا يتجاوز المدفوع سابقًا':'القبض لا يتجاوز المتبقي'} · المتاح: ${numberText(max)} ${currencyLabel(b)} · يُنشأ رقم السند تلقائيًا.`:'اختر الحجز لعرض الحد المتاح قبل تسجيل الحركة.';
 if(amount){if(max!==null)amount.max=String(max);else amount.removeAttribute('max');amount.placeholder=max!==null?numberText(max):'0';}
 if(label)label.innerHTML=`<i class="fa-solid fa-calendar-check" aria-hidden="true"></i> ${out?'تاريخ الصرف *':'تاريخ القبض *'}`;
 if(submit&&!submit.disabled)submit.innerHTML=`<i class="fa-solid fa-${out?'arrow-up-right-dots':'floppy-disk'}"></i> ${out?'حفظ سند الصرف':'حفظ سند القبض'}`;
 if(hero)hero.textContent=out?'إنشاء سند صرف':'إنشاء سند قبض';
}
function paymentReceiptText(b,amount,kind="in"){return en(`${appSettings().company.name||"مايفنت"}\n${kind==="out"?"تأكيد صرف مبلغ":"تأكيد استلام دفعة"}\nالعميل: ${b.name}\nرقم الحجز: #${bookingNumberFor(b)}\nالمبلغ المستلم: ${numberText(amount)} ${currencyLabel(b)}\nالمتبقي: ${numberText(remainingFor(b))} ${currencyLabel(b)}`);}
function showReceiptSuccess(b,amount,kind="in",receipt=null){
 const host=$("#receiptSuccessNote");if(!host)return;
 host.innerHTML=`<strong>تم ${kind==="out"?"صرف":"قبض"} مبلغ ${numberText(amount)} ${currencyLabel(b)}</strong><span>المتبقي: ${numberText(remainingFor(b))} ${currencyLabel(b)}</span><div><button type="button" id="receiptImageAction"><i class="fa-solid fa-image"></i> معاينة وتنزيل صورة</button><button type="button" id="receiptSmsAction" ${!b.phone?"disabled":""}>رسالة نصية</button><button type="button" id="receiptWhatsappAction" ${!b.phone?"disabled":""}>واتساب</button></div><small>يفتح تطبيق المراسلة مع رسالة جاهزة؛ لا يمكن التأكد من وصولها.</small>`;
 host.hidden=false;
 const send=(channel)=>{const phone=normalizePhone(b.phone||"");if(!phone)return;markBookingMessageOpened(b,channel);const msg=encodeURIComponent(paymentReceiptText(b,amount,kind));if(channel==="sms")location.href=`sms:${phone}?body=${msg}`;else window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${msg}`,"_blank","noopener");};
 $("#receiptImageAction").onclick=()=>window.MyfntReceiptImage?.open(receipt?.id);$("#receiptSmsAction").onclick=()=>send("sms");$("#receiptWhatsappAction").onclick=()=>send("whatsapp");
 const saved=$("#receiptSavedWindow");if(saved){
   $("#receiptSavedTitle").textContent=`تم حفظ سند ${kind==="out"?"الصرف":"القبض"} #${receipt?.receiptNo||"—"}`;
   $("#receiptSavedSubtitle").textContent=`${b.name} · ${numberText(amount)} ${currencyLabel(b)} · المتبقي ${numberText(remainingFor(b))} ${currencyLabel(b)}`;
   $("#receiptSavedPreview").onclick=()=>window.MyfntReceiptImage?.open(receipt?.id);
   $("#receiptSavedSms").disabled=!normalizePhone(b.phone||"");
   $("#receiptSavedWhatsApp").disabled=!normalizePhone(b.phone||"");
   $("#receiptSavedSms").onclick=()=>send("sms");
   $("#receiptSavedWhatsApp").onclick=()=>send("whatsapp");
   openWindow("receiptSavedWindow");
 }
}
async function submitReceipt(event){
  event.preventDefault();if(window.MyfntAccess?.requireWrite?.())return;if(window.OzanPermissions?.denied('payments.write'))return;
  const b=activeReceiptBooking();if(!b)return showToast('اختر الحجز أولًا','warning');
  if(window.MyfntVisitorTrial?.canCreate&&!window.MyfntVisitorTrial.canCreate('payments'))return;
  const txGate=window.MyfntFeatureGate?.checkCount?.('transactions_limit',allPayments().filter(r=>r?.status!=='voided').length,{message:'تم بلوغ عدد الحركات المالية المسموح في خطتك'});if(txGate&&!txGate.ok)return showToast(txGate.message,'warning');
  const amount=Number($("#receiptAmount").value||0),date=isoDate(new Date()),kind=$("#receiptDirection")?.value||'in',method=$("#receiptMethod")?.value||'cash';
  if(!Number.isSafeInteger(amount)||amount<=0)return showToast('أدخل مبلغًا صحيحًا أكبر من الصفر','warning');
  if(kind==='in'&&amount>remainingFor(b)&&!Boolean(appSettings().bookingUi?.allowReceiptOverRemaining))return showToast('الدفعة تتجاوز المبلغ المتبقي؛ فعّل السماح بسند قبض زائد من إعدادات الحجز إذا كان ذلك مقصودًا','warning');
  if(kind==='out'&&amount>Number(b.paid||0))return showToast('المبلغ المصروف يتجاوز المدفوع السابق لهذا الحجز','warning');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return showToast('تعذر احتساب تاريخ الحركة تلقائيًا','warning');
  const btn=$('#receiptSubmitBtn');if(btn?.disabled)return;
  const busyOverlay=$('#receiptBusyOverlay'),receiptWindow=$('#receiptWindow');
  if(busyOverlay)busyOverlay.hidden=false;
  receiptWindow?.classList.add('mf-form-saving');
  if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.dataset.saving='1';btn.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> جاري حفظ السند…';}
  try{
    // Paint the loading indicator before the synchronous, atomic local financial commit.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const {completedDeposit,receipt}=await window.MyfntFinance.postPayment(b,amount,date,$('#receiptNote').value.trim(),{direction:kind,method,reference:$('#receiptReference').value.trim(),tag:$('#receiptTag').value.trim()});
    renderReceiptBookingSummary(b);$("#receiptAmount").value='';$("#receiptAmountWords").textContent="أدخل المبلغ";showReceiptSuccess(b,amount,kind,receipt);
    window.OzanSounds?.play('save');
    showToast(completedDeposit?'تم استكمال العربون وتأكيد الحجز':kind==='out'?'تم حفظ سند الصرف وسجل التدقيق':'تم حفظ سند القبض مع سجل التدقيق');
  }catch(err){ozWarn(err.message||'تعذر حفظ الدفعة');}
  finally{if(busyOverlay)busyOverlay.hidden=true;receiptWindow?.classList.remove('mf-form-saving');if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');delete btn.dataset.saving;}updateReceiptDirectionUI();}
}
// الضغط على JPG والفاتورة يفتحان نفس المعاينة؛ زر JPG يصدر نفس HTML المرئي.
function downloadBookingJpg(){openInvoice();}
async function exportInvoiceJpg(){
 const booking=bookingById(state.activeBookingId);
 if(!booking){showToast('اختر حجزًا أولًا','warning');return;}
 const button=document.getElementById('invoiceJpgBtn');if(button?.disabled)return;
 if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
 try{await window.OzanInvoiceCanvas.download(booking,allPayments(),appSettings().company,downloadBlob);showToast('تم تجهيز صورة السند');}
 catch(error){console.warn('[invoice-canvas]',error.message);showToast('تعذر تنزيل الصورة؛ يمكنك طباعة الفاتورة PDF','warning');}
 finally{if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
}

const bookingSearchCache=new WeakMap();
function bookingSearchText(b){
 const fields=[b.bookingNo,bookingNumberFor(b),b.name,b.phone,b.type,b.date,b.notes];
 const key=fields.join('\u001f');const old=bookingSearchCache.get(b);
 if(old?.key===key)return old.value;
 const value=normalizeSearch([...fields,formatDateLabel(b.date)].join(' '));
 bookingSearchCache.set(b,{key,value});return value;
}
let bookingSearchToken=0;
async function searchBookings(query){
  const box=$("#searchResults"),q=normalizeSearch(query),token=++bookingSearchToken;if(!q){box.innerHTML='<div class="search-empty">ابدأ بكتابة الاسم أو الهاتف أو المناسبة أو التاريخ.</div>';return;}
  if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.searchBookings){box.innerHTML='<div class="search-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري البحث في قاعدة البيانات…</div>';try{const results=await window.MyfntQuery.searchBookings(q,{limit:30});if(token!==bookingSearchToken)return;box.replaceChildren();if(!results.length){box.innerHTML='<div class="search-empty">لا توجد نتائج مطابقة.</div>';return;}results.forEach(b=>box.appendChild(createBookingCard(b)));return;}catch(error){console.warn('[lazy booking search]',error);}}
  const results=[];for(const b of allBookings()){if(bookingSearchText(b).includes(q)){results.push(b);if(results.length===30)break;}}box.replaceChildren();if(!results.length){box.innerHTML='<div class="search-empty">لا توجد نتائج مطابقة.</div>';return;}results.forEach(b=>box.appendChild(createBookingCard(b)));
}
async function fullExportDataset(){if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.exportLegacyDataset)return window.MyfntQuery.exportLegacyDataset();return {bookings:allBookings(),customers:(window.MyfntRepositories?.customers?.snapshot?.()||[]),receipts:(window.MyfntRepositories?.payments?.snapshot?.()||[])};}
async function exportJson(){try{const data=await fullExportDataset(),blob=new Blob([JSON.stringify({version:APP_VERSION,owner:window.OzanScope?.owner()||null,exportedAt:new Date().toISOString(),bookings:data.bookings,customers:data.customers,packages:(packageRepository()?.snapshot?.()||[]),receipts:data.receipts,specialDays:(specialRepository()?.snapshot?.()||[]),settings:(settingsRepository()?.snapshot?.()||{})},null,2)],{type:"application/json"});downloadBlob(blob,`ozan-bookings-${isoDate(new Date())}.json`);showToast("تم تجهيز JSON من قاعدة البيانات المحلية");}catch(error){showToast(error.message||'تعذر تجهيز JSON','warning');}}
async function exportCsv(){try{const data=await fullExportDataset(),rows=[["bookingNo","id","name","phone","address","date","type","status","amount","paid","remaining","adjustments"],...data.bookings.map(b=>[bookingNumberFor(b),b.id,b.name,b.phone,b.address||"",b.date,b.type,b.status,b.amount,b.paid,remainingFor(b),JSON.stringify(b.adjustments||[])])];const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`ozan-bookings-${isoDate(new Date())}.csv`);showToast("تم تجهيز CSV من قاعدة البيانات المحلية");}catch(error){showToast(error.message||'تعذر تجهيز CSV','warning');}}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
async function importData(file){
 try{
  if(!window.MyfntAccess?.isActive?.())throw Error('يشترط اشتراك نشط لاستيراد النسخ الاحتياطية');
  const owner=window.OzanScope?.owner();if(!owner)throw Error('سجّل الدخول أولًا');
  const parsed=JSON.parse(await file.text());if(!parsed||Array.isArray(parsed)||!parsed.owner||parsed.owner.companyId!==owner.companyId||parsed.owner.userId!==owner.userId)throw Error('النسخة لا تخص حساب الشركة الحالي أو لا تحتوي على معرف مالك مثبت');
  if(!Array.isArray(parsed.bookings))throw Error('لا يوجد جدول حجوزات');
  const clean=dedupeBookings(parsed.bookings),ids=new Set(clean.map(b=>b.id));
  if(clean.length!==parsed.bookings.length)throw Error('تكرار أو تلف في سجلات الحجز');
  if(parsed.receipts&&!Array.isArray(parsed.receipts))throw Error('جدول سندات غير صالح');
  if((parsed.receipts||[]).some(r=>!r.id||!ids.has(r.bookingId)||!Number.isSafeInteger(Number(r.amount))||Number(r.amount)<0))throw Error('سند بلا حجز صالح أو بمبلغ خاطئ');
  // v2.9.2's old full/secure exports accidentally replaced canonical customers
  // with {name,phone} contacts. Rebuild from stable booking.customerId instead.
  const legacyContacts=Array.isArray(parsed.customers)&&parsed.customers.length>0&&
    parsed.customers.every(c=>c&&typeof c.name==='string'&&!c.id);
  if(!await ozConfirm(`ستستبدل جميع البيانات المحلية للحساب الحالي (${en(clean.length)} حجزًا). ${legacyContacts?'تحتوي النسخة القديمة على أسماء فقط؛ ستُسترجع معرفات العملاء من الحجوزات دون دمج تلقائي. ':''}نزّل نسخة احتياطية أولًا. هل توافق؟`,{title:'استيراد محصور بمالك الشركة',confirmLabel:'استبدال البيانات',danger:true}))return;
  if(legacyContacts)parsed.customers=undefined;
  if(parsed.customers!==undefined){
   if(!Array.isArray(parsed.customers)||parsed.customers.some(c=>!c||typeof c.id!=='string'||!c.id||typeof c.name!=='string'||!c.name.trim()))throw Error('دليل العملاء في النسخة غير صالح');
   const customerIds=new Set(),customerNos=new Set();
   for(const c of parsed.customers){
    if(!/^[1-9]\d*$/.test(String(c.customerNo||''))||customerIds.has(c.id)||customerNos.has(String(c.customerNo)))throw Error('يوجد معرّف أو رقم عميل مكرر في النسخة');
    customerIds.add(c.id);customerNos.add(String(c.customerNo));
   }
  }
  if(parsed.customers){
   const link=new Map(clean.map(b=>[b.id,b.customerId]));
   if(clean.some(b=>!parsed.customers.some(c=>c.id===b.customerId)))throw Error('بعض الحجوزات لا ترتبط بعميل موجود في النسخة');
   if((parsed.receipts||[]).some(r=>r.customerId && r.customerId!==link.get(r.bookingId)))throw Error('سند مرتبط بعميل لا يطابق عميل الحجز');
  }
  const old={bookings:allBookings(),customers:(window.MyfntRepositories?.customers?.snapshot?.()||[]),packages:(packageRepository()?.snapshot?.()||[]),receipts:(window.MyfntRepositories?.payments?.snapshot?.()||[]),specialDays:(specialRepository()?.snapshot?.()||[]),settings:(settingsRepository()?.snapshot?.()||{})};
  bookingRepository()?.replaceLocal?.(clean.map(b=>({...b,...owner})),{persist:false});window.MyfntRepositories?.customers?.replaceLocal?.(Array.isArray(parsed.customers)?parsed.customers:[],{persist:false});if(Array.isArray(parsed.packages))packageRepository()?.replaceLocal?.(normalizePackages(parsed.packages),{persist:false});
  if(Array.isArray(parsed.receipts)){const rows=parsed.receipts.map(r=>({...r,...owner}));paymentRepository()?.replaceLocal?.(rows,{persist:false});}if(Array.isArray(parsed.specialDays)){specialRepository()?.replaceLocal?.(parsed.specialDays,{persist:false});}
  if(parsed.settings)settingsRepository()?.mutate?.(cfg=>Object.assign(cfg,parsed.settings),{persist:false,sync:false,profileEvent:false});
  if(!parsed.customers)window.MyfntCustomers.migrate(allBookings(),allPayments(),{ignoreSaved:true});
  else{const bookingCustomer=new Map(allBookings().map(b=>[b.id,b.customerId]));for(const r of allPayments()){const expected=bookingCustomer.get(r.bookingId);if(expected)r.customerId=expected;}}
  window.MyfntSequences?.migrate?.({force:true});
  try{await window.MyfntOffline?.acceptRestoredData?.();}
  catch(error){bookingRepository()?.replaceLocal?.(old.bookings,{persist:false});window.MyfntRepositories?.customers?.replaceLocal?.(old.customers,{persist:false});packageRepository()?.replaceLocal?.(old.packages,{persist:false});paymentRepository()?.replaceLocal?.(old.receipts,{persist:false});specialRepository()?.replaceLocal?.(old.specialDays,{persist:false});settingsRepository()?.mutate?.(cfg=>{Object.keys(cfg).forEach(k=>delete cfg[k]);Object.assign(cfg,old.settings);},{persist:false,sync:false,profileEvent:false});throw Error('فشل تثبيت النسخة داخل IndexedDB؛ أُعيدت الواجهة إلى البيانات السابقة. '+(error?.message||''));}
  // Legacy shadows are compatibility hints only; a quota failure here must not undo a successful canonical import.
  try{window.MyfntCustomers.save();saveBookings();savePackages();saveReceipts();saveSettings({sync:false});saveSpecialDays();}catch(error){console.warn('[import legacy shadows]',error);}
  window.MyfntFinance?.reload?.();renderAll();showToast('تم الاستيراد وتثبيت البيانات في قاعدة IndexedDB للحساب الحالي');
 }catch(e){showToast(e.message||'ملف غير صالح','warning');}
}

/* ---------- administration ---------- */
function renderPackagesAdmin(){ if(window.OzanAdvanced?.renderPackages)return window.OzanAdvanced.renderPackages(); }
function renderSeasonPricing(){
  $("#seasonPricingList").innerHTML=allPackages().map(p=>`<label class="admin-price-row"><span>${escapeHtml(p.name)} <small>غير الموسم: ${en(p.price||0)} · العربون: ${en(p.deposit||0)}</small></span><input class="english-number" type="number" min="0" data-season-price="${p.id}" value="${en(p.seasonPrice||0)}" placeholder="سعر الموسم"></label>`).join("");
}
function renderSpecialDays(){
  if(window.OzanAdvanced?.renderSpecialDays)return window.OzanAdvanced.renderSpecialDays();
  const days=allSpecialDays();$("#specialDaysList").innerHTML=days.length?[...days].sort((a,b)=>String(a.date||a.from||'').localeCompare(String(b.date||b.from||''))).map(x=>`<div class="admin-row"><div><strong>${escapeHtml(x.label)}</strong><span>${formatDateLabel(x.date)}</span></div><button class="mini-icon-btn" data-delete-special="${x.id}"><i class="fa-solid fa-trash"></i></button></div>`).join(""):'<div class="search-empty">لا توجد أيام مميزة.</div>';
}
function renderReminders(){ if(window.OzanAdvanced?.renderAlerts)return window.OzanAdvanced.renderAlerts(); $("#reminderGrid").innerHTML=appSettings().reminders.map((v,i)=>`<label class="reminder-item"><span>التنبيه ${en(i+1)}</span><div><input class="english-number" type="number" min="0" max="365" data-reminder-index="${i}" value="${en(v)}"><small>يوم قبل</small></div></label>`).join(""); }
function renderSeasonForm(){ const s=appSettings().season; $("#seasonEnabled").checked=!!s.enabled; $("#seasonName").value=s.name||"موسم"; $("#seasonStart").value=s.start||""; $("#seasonEnd").value=s.end||""; syncDateDisplay($("#seasonStart")); syncDateDisplay($("#seasonEnd")); }
function renderAdminBookings(){
  if(window.OzanAdvanced?.renderAdmin)return window.OzanAdvanced.renderAdmin();
  const total=allBookings().length, upcoming=filterBookings(b=>b.date>=isoDate(new Date())&&!["cancelled","archived"].includes(b.status)).length, confirmed=filterBookings(b=>b.status==="confirmed").length;
  $("#adminSummary").innerHTML=`<div><strong>${en(total)}</strong><span>كل الحجوزات</span></div><div><strong>${en(upcoming)}</strong><span>القادمة</span></div><div><strong>${en(confirmed)}</strong><span>المؤكدة</span></div>`;
  $("#adminBookingsList").innerHTML=allBookings().slice(0,100).map(b=>`<div class="admin-row"><div><strong>${escapeHtml(b.name)}</strong><span>${formatDateLabel(b.date)} · ${escapeHtml(b.type)}</span></div><span class="status-badge ${STATUS[b.status]?.className||""}">${STATUS[b.status]?.label||"—"}</span></div>`).join("");
}
function renderTrashWindow(){
  const list=$("#trashList"); if(!list) return;
  const items=filterBookings(b=>b.status==="cancelled").sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  if(!items.length){list.innerHTML='<div class="trash-empty"><i class="fa-solid fa-trash"></i><strong>سلة المهملات فارغة</strong><span>الحجوزات المحذوفة ستظهر هنا للاستعادة.</span></div>';return;}
  list.innerHTML=items.map(b=>`<article class="trash-card"><div class="trash-card__info"><strong>#${bookingNumberFor(b)} · ${escapeHtml(b.name)}</strong><span>${escapeHtml(formatAppDate(b.date))} · ${escapeHtml(b.type||"مناسبة")}</span></div><div class="trash-card__actions"><button type="button" data-restore-booking="${escapeHtml(b.id)}"><i class="fa-solid fa-arrows-rotate"></i>استعادة</button><button class="is-danger" type="button" data-delete-booking="${escapeHtml(b.id)}"><i class="fa-solid fa-trash"></i>أرشفة وإخفاء</button></div></article>`).join("");
}
function restoreBookingFromTrash(id){const b=bookingById(id);if(!b)return;bookingRepository()?.mutate?.(b.id,item=>{item.status="confirmed";item.updatedAt=Date.now();});recordBookingHistory(b.id,"restore","استعادة الحجز من المهملات");renderTrashWindow();renderAll();showToast("تمت استعادة الحجز");}
// أرشفة محلية محافظة: الاحتفاظ بنسخة دائمة وسجل تدقيق قبل إزالة الحجز من الواجهة القديمة.
async function permanentlyDeleteBooking(id){
 const b=bookingById(id);
 if(!b||!await ozConfirm("إخفاء الحجز من الواجهة مع حفظ نسخة مؤرشفة منه وسجل التدقيق المحلي؟ لا يمكن إخفاء حجز له دفعات مالية.",{title:"تحذير الأرشفة",confirmLabel:"أرشفة وإخفاء",danger:true}))return;
 if(paymentsForBooking(id).length){await ozWarn('هذا الحجز مرتبط بسندات مالية تاريخية. لا يمكن الحذف النهائي؛ اتركه في المهملات للأرشفة.');return;}
 try{await window.MyfntLocal?.archiveBooking?.(id,'أرشفة بعد حذف من سلة المهملات');}catch(err){await ozWarn('تعذر حفظ نسخة الأرشيف المحلية، لم يُحذف الحجز: '+err.message);return;}
 bookingRepository()?.removeLocal?.(id);
 if(paymentRepository()?.byBooking?.(id)?.length===0){/* no related payment rows to remove */}
 // لا يُحذف أثر حجز آخر ولا باقة مشتركة.
 if(typeof ozHistory!=="undefined"&&ozHistory&&Object.hasOwn(ozHistory,id)){
  delete ozHistory[id];safeStorage.set(OZ_HISTORY_KEY,JSON.stringify(ozHistory));
 }
 const relatedIds=new Set();
 for(const [key,info] of Object.entries(state.notificationReadAt||{})){
  if(info?.snapshot?.bookingId===id||key.includes(":"+id+":" )||key.endsWith(":"+id))relatedIds.add(key);
 }
 for(const key of state.notificationRead)if(key.includes(":"+id+":")||key.endsWith(":"+id))relatedIds.add(key);
 for(const key of relatedIds){state.notificationRead.delete(key);delete state.notificationReadAt[key];}
 saveNotificationRead();
 const sent=ozRead(OZ_REMINDER_SENT_KEY,{});
 for(const key of Object.keys(sent))if(key.includes(":"+id+":")||key.endsWith(":"+id))delete sent[key];
 safeStorage.set(OZ_REMINDER_SENT_KEY,JSON.stringify(sent));
 state.syncAudit.pending=(state.syncAudit.pending||[]).filter(x=>x.id!==id);
 state.syncAudit.simulated=(state.syncAudit.simulated||[]).filter(x=>x.id!==id);
 saveSyncAudit();saveBookings();saveReceipts();
 if(state.activeBookingId===id)state.activeBookingId=null;
 renderTrashWindow();renderAll();showToast("أُرشف الحجز وأُخفي من الواجهة مع الاحتفاظ بنسخة مراجعة محلية","warning");
}
// تُطبق التعديلات أولاً على نموذج الحجز؛ لا تحفظ فعلياً حتى الضغط على «حفظ الحجز».
let ozAdjustmentMode="add";
let ozDraftAdjustments=[];
// عرض أسباب التعديل فوق حقل المتبقي، مع إظهار التعديلات السابقة والمسودة.
function renderDraftAdjustments(previous=[]){
 const host=$("#bookingAdjustmentsSummary");if(!host)return;
 const saved=Array.isArray(previous)?previous:bookingById($("#bookingId")?.value)?.adjustments||[];
 const all=[...saved,...ozDraftAdjustments];host.hidden=!all.length;
 host.innerHTML=all.map(x=>`<div class="oz-draft-adjustment"><i class="fa-solid ${x.kind==="discount"?"fa-tag":"fa-circle-plus"}"></i><span>${x.kind==="discount"?"خصم":"إضافة"}: ${escapeHtml(x.reason||"بدون سبب")}</span><b>${x.kind==="discount"?"−":"+"}${numberText(x.value)}</b></div>`).join("");
}
function quickAdjustBookingAmount(mode){
 const requested=mode==="discount"?"discount":"add";
 const selected=packageById($("#packageChips .smart-chip.is-active")?.dataset.packageId||bookingById($("#bookingId")?.value)?.packageId||"");
 if(requested==="discount"&&selected?.allowDiscount===false){ozWarn(`الباقة «${selected.name}» لا تسمح بخصم مبلغ`).catch?.(()=>{});return;}
 ozAdjustmentMode=requested;
 $("#amountAdjustmentTitle").textContent=ozAdjustmentMode==="add"?"إضافة مبلغ":"خصم مبلغ";
 $("#adjustmentValue").value="";$("#adjustmentReason").value="";
 updateAdjustmentPreview();openWindow("amountAdjustmentWindow");
 setTimeout(()=>$("#adjustmentValue")?.focus(),160);
}
function updateAdjustmentPreview(){
 const current=Number($("#bookingAmount")?.value||0),v=Number($("#adjustmentValue")?.value||0);
 const after=ozAdjustmentMode==="add"?current+v:current-v;
 const currency=bookingById($("#bookingId")?.value)?.currency||appSettings().preferences?.currency||"YER";
 $("#adjustmentCurrent").textContent=`القيمة الحالية: ${numberText(current)} ${CURRENCIES[currency]||CURRENCIES.YER}`;
 $("#adjustmentPreview").textContent=after<0?"لا يمكن أن يتجاوز الخصم قيمة المناسبة":`القيمة بعد التعديل: ${numberText(after)} — ${amountWords(after,currency)}`;
}
async function submitAdjustment(e){
 e.preventDefault();const value=Number($("#adjustmentValue").value),reason=$("#adjustmentReason").value.trim(),amount=$("#bookingAmount"),current=Number(amount.value||0);
 if(!Number.isSafeInteger(value)||value<=0){await ozWarn("أدخل مبلغًا صحيحًا أكبر من صفر");return;}
 if(!reason){await ozWarn("اذكر سبب التعديل");return;}
 if(ozAdjustmentMode==="discount"){
   const selected=packageById($("#packageChips .smart-chip.is-active")?.dataset.packageId||bookingById($("#bookingId")?.value)?.packageId||"");
   if(selected?.allowDiscount===false){await ozWarn(`الباقة «${selected.name}» لا تسمح بخصم مبلغ`);return;}
   if(value>current){await ozWarn("لا يمكن أن يتجاوز الخصم سعر المناسبة");return;}
 }
 const next=ozAdjustmentMode==="add"?current+value:current-value;
 if(next<Number($("#bookingPaid").value||0)){await ozWarn("القيمة الجديدة لا يمكن أن تقل عن المدفوع");return;}
 amount.value=String(next);
 ozDraftAdjustments.push({kind:ozAdjustmentMode,value,reason,at:Date.now()});
 closeWindow("amountAdjustmentWindow");updateRemaining();renderDraftAdjustments();showToast("تم تحديث قيمة النموذج، احفظ الحجز لاعتماد التعديل");
}


function prepareAdminWindow(id){ if(id==="packagesWindow")renderPackagesAdmin(); if(id==="seasonPricingWindow")renderSeasonPricing(); if(id==="specialDaysWindow")renderSpecialDays(); if(id==="remindersWindow")renderReminders(); if(id==="bookingsAdminWindow")renderAdminBookings(); if(id==="companySettingsWindow")fillCompanyForm(); if(id==="syncWindow")renderSyncWindow(); if(id==="bookingUiSettingsWindow")fillBookingUiSettings(); if(id==="trashWindow")renderTrashWindow(); }


// سند الحجز: صفوف اختيارية وشروط مستقلّة وآمنة عند عرضها أو طباعتها.
function openInvoice(){
  const b=bookingById(state.activeBookingId);if(!b)return;
  const c=appSettings().company||{},fmt=n=>numberText(Number(n||0))+' '+currencyLabel(b);
  const safe=v=>escapeHtml(String(v??''));
  const row=(label,value,{always=false}={})=>{
    const text=String(value??'').trim();
    if(!always&&(!text||text==='—'))return '';
    return `<div class="invoice-detail"><span>${safe(label)}</span><b>${safe(text)}</b></div>`;
  };
  const validLogo=typeof c.logo==='string'&&/^(?:blob:|data:image\/(?:png|jpeg|webp);base64,)/i.test(c.logo);
  const logo=validLogo?`<img class="invoice-logo" src="${c.logo}" alt="شعار الشركة">`:'<div class="invoice-logo invoice-logo--fallback">م</div>';
  const payments=paymentsForBooking(b.id,{activeOnly:true}).sort((a,z)=>Number(a.createdAt||0)-Number(z.createdAt||0));
  const conditions=String(c.terms||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const htmlTerms=conditions.length?`<div class="invoice-section-title">شروط الحجز</div><ol class="invoice-terms">${conditions.map(t=>`<li>${safe(t)}</li>`).join('')}</ol>`:'';
  const summary=payments.map((r,i)=>row('دفعة '+(i+1)+(r.date?' · '+r.date:'')+(r.note?' · '+r.note:''),fmt(r.amount),{always:true})).join('');
  const adjustments=(b.adjustments||[]).filter(x=>x&&x.reason?.trim()).map(x=>row(x.kind==='discount'?'خصم':'إضافة',(x.reason||'')+' · '+(x.kind==='discount'?'−':'+')+fmt(x.value))).join('');
  document.getElementById('invoiceContent').innerHTML=`<div class="invoice-heading">${logo}<div><h2>${safe(c.name||'مايفنت')}</h2>${c.description?`<p>${safe(c.description)}</p>`:''}${c.addresses||c.phone||c.phone2?`<small>${safe([c.addresses,window.MyfntPhone?.display?.(c.phone)||c.phone,window.MyfntPhone?.display?.(c.phone2)||c.phone2].filter(Boolean).join(' · '))}</small>`:''}</div></div>
    <div class="invoice-band"><div><small>سند الحجز</small><strong>#${safe(bookingNumberFor(b))}</strong></div><div><small>تاريخ الإصدار</small><strong>${safe(formatAppDate(isoDate(new Date())))}</strong></div></div>
    <div class="invoice-section-title">بيانات العميل والمناسبة</div><div class="invoice-details">
    ${row('العميل',b.name)}${row('رقم الهاتف',b.phone)}${row('عنوان المناسبة',b.address)}${row('المناسبة / الباقة',b.type)}
    ${row('تاريخ المناسبة',b.date?formatAppDate(b.date):'')}${row('التاريخ الهجري',b.date?formatHijriDate(b.date):'')}
    ${b.hasTime?row('وقت المناسبة',bookingTimeLabel(b)):''}${row('حالة الحجز',(STATUS[b.status]||STATUS.confirmed).label)}
    ${b.depositPending?row('العربون المطلوب',fmt(b.depositRequired))+row('الناقص من العربون',fmt(Math.max(0,Number(b.depositRequired)-Number(b.paid)))):''}
    ${b.createdAt?row('وقت الإنشاء',formatAuditTimestamp(b.createdAt)):''}</div>
    <div class="invoice-section-title">الملخص المالي</div><div class="invoice-totals">
    ${row('إجمالي قيمة الحجز',fmt(b.amount)+' — '+amountWords(b.amount,b.currency),{always:true})}
    ${row('المدفوع',fmt(b.paid)+' — '+amountWords(b.paid,b.currency),{always:true})}
    <div class="invoice-due">${row('المبلغ المتبقي',fmt(remainingFor(b))+' — '+amountWords(remainingFor(b),b.currency),{always:true})}</div></div>
    ${adjustments?`<div class="invoice-section-title">أسباب الخصم والإضافة</div><div class="invoice-details">${adjustments}</div>`:''}
    ${summary?`<div class="invoice-section-title">سجل الدفعات</div><div class="invoice-payments">${summary}</div>`:''}
    ${b.notes?.trim()?`<div class="invoice-section-title">ملاحظات المناسبة</div><p class="invoice-notes">${safe(b.notes)}</p>`:''}
    ${c.receiptNotes?.trim()?`<div class="invoice-section-title">ملاحظات السندات</div><p class="invoice-notes">${safe(c.receiptNotes)}</p>`:''}${htmlTerms}<div class="invoice-footer"><strong>${safe(c.name||'مايفنت')}</strong>
    ${c.addresses||c.phone||c.phone2?`<small>${safe([c.addresses,window.MyfntPhone?.display?.(c.phone)||c.phone,window.MyfntPhone?.display?.(c.phone2)||c.phone2].filter(Boolean).join(' · '))}</small>`:''}
    <span>أُنشئت إلكترونيًا من بيانات الحجز المحلية — يُرجى مراجعتها قبل الاعتماد.</span></div>`;
  openWindow('invoiceWindow');
}

// تصدير الفاتورة: فتح مستند طباعة مستقل بنفس HTML وCSS الخاصين بالمعاينة.
// يمكن للمستخدم اختيار «حفظ كملف PDF» من نافذة الطباعة في Chrome أو Safari.
function printInvoicePreview(){
  const sheet=document.getElementById("invoiceContent");
  if(!sheet?.innerHTML?.trim()){showToast("اعرض الفاتورة أولاً","warning");return;}
  const booking=bookingById(state.activeBookingId);
  const number=booking?bookingNumberFor(booking):"مايفنت";
  const popup=window.open("","_blank");
  if(!popup){showToast("اسمح بالنوافذ المنبثقة لطباعة الفاتورة","warning");return;}
  const cssHref=new URL('assets/css/invoice-print.css',location.href).href;
  const safeTitle=escapeHtml(`فاتورة الحجز ${number}`);
  const safeMarkup=sheet.innerHTML;
  // لا نستخدم نافذة التطبيق كاملة: ملف الطباعة مستقل، مما يمنع إخفاء الفاتورة بسبب قواعد طباعة الواجهة.
  popup.document.open();
  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap"><link rel="stylesheet" href="${cssHref}"></head><body><div class="print-tools"><button type="button" onclick="window.print()">حفظ PDF / طباعة</button></div><article class="invoice-sheet">${safeMarkup}</article></body></html>`);
  popup.document.close();
  // لا نغلق المستند آليًا: يظل المستخدم قادرًا على حفظ PDF أو معاينة الطباعة مجددًا.
  popup.focus();
}

/* Core Choice: booking settings chips */
document.addEventListener('click',e=>{const btn=e.target.closest('[data-required-field],[data-booking-visible]');if(!btn||btn.disabled)return;e.preventDefault();e.stopPropagation();window.MyfntChoice?.toggle?.(btn);},{passive:false});
