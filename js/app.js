// OZAN V1.9.3 — ملف التشغيل
// ربط الأزرار والأحداث
function packageRepository(){return window.MyfntRepositories?.packages||null;}
function bookingRepository(){return window.MyfntRepositories?.bookings||null;}
function paymentRepository(){return window.MyfntRepositories?.payments||null;}
function customerRepository(){return window.MyfntRepositories?.customers||null;}
function allPackagesRepo(){return packageRepository()?.all?.()||[];}
function allBookingsRepo(){return bookingRepository()?.all?.()||[];}
function settingsRepository(){return window.MyfntRepositories?.settings||null;}
const MYFNT_INSTALL_DELAY_MS=40000;
const MYFNT_INSTALL_ELIGIBLE_AT=Date.now()+MYFNT_INSTALL_DELAY_MS;
let myfntInstallVisibilityTimer=0;
function bindEvents(){
  const on=(selector,event,handler,options)=>{const el=$(selector);if(el)el.addEventListener(event,handler,options);};
  on("#menuBtn","click",()=>{refreshInstallSurfaces();openWindow("menuWindow");});
  // الأدوات الجديدة: تربط بعد تحميل ملف assets/js/enhancements.js
  bindEnhancementEvents();
  initCalendarTools();
  initExitDialog();
  initDayBookings();
  initOzanInfoPages();
  on("#drawerBackdrop","click",()=>closeWindow("menuWindow"));
  on("#searchBtn","click",()=>{openWindow("searchWindow");searchBookings("");setTimeout(()=>$("#searchInput")?.focus(),100);});
  let navSyncClicks=[];let navSyncLockTimer=0;
  on("#refreshBtn","click",()=>{
    const btn=$("#refreshBtn"),now=Date.now();navSyncClicks=navSyncClicks.filter(t=>now-t<10000);
    if(btn?.disabled)return;
    navSyncClicks.push(now);
    if(navSyncClicks.length>=2){
      if(btn){btn.disabled=true;btn.setAttribute('aria-disabled','true');btn.title='تم تقييد النقر المتكرر لمدة 10 ثوانٍ لحماية المزامنة';}
      clearTimeout(navSyncLockTimer);navSyncLockTimer=setTimeout(()=>{navSyncClicks=[];if(btn){btn.disabled=false;btn.removeAttribute('aria-disabled');btn.title='';}},10000);
    }
    performRefresh();
  });
  on("#appCompanyName","click",()=>{renderSyncWindow();openWindow("syncWindow");});
  on("#notificationBtn","click",openNotifications);
  on("#soundToggle","click",()=>{const enabled=window.OzanSounds?.toggle();updateSoundButton();ozPreferences.sounds=Boolean(enabled);safeStorage.set(OZ_PREF_KEY,JSON.stringify(ozPreferences));if(enabled)window.OzanSounds?.play("save");});
  on("#themeBtn","click",toggleTheme);
  on("#addBtn","click",()=>openBookingForm()); on("#emptyAddBtn","click",()=>openBookingForm()); on("#packageSettingsShortcut","click",()=>{closeWindow("bookingWindow",{skipHistory:true});renderPackagesAdmin();openWindow("packagesWindow");});
  on("#bookingFilters","click",e=>{const chip=e.target.closest(".filter-chip[data-view]");if(chip)setViewFilter(chip.dataset.view);});
  on("#bookingList","click",async e=>{const add=e.target.closest('[data-action="add-available"]');if(add){openBookingForm();return;}const more=e.target.closest('[data-action="load-more"]');if(more){state.renderLimit+=40;renderBookings();return;}const card=e.target.closest(".booking-card");if(!card)return;let booking=bookingRepository()?.get?.(card.dataset.id)||window.MyfntMonthData?.byId?.(card.dataset.id);if(!booking&&window.MyfntQuery?.ensureBooking){try{booking=await window.MyfntQuery.ensureBooking(card.dataset.id);}catch(error){showToast(error.message||"تعذر تحميل الحجز","warning");}}if(booking)openPreview(booking);});
  on("#searchResults","click",async e=>{const card=e.target.closest(".booking-card");if(!card)return;let booking=bookingRepository()?.get?.(card.dataset.id)||window.MyfntMonthData?.byId?.(card.dataset.id);if(!booking&&window.MyfntQuery?.ensureBooking){try{booking=await window.MyfntQuery.ensureBooking(card.dataset.id);}catch(error){console.warn("[lazy booking open]",error);showToast(error.message||"تعذر تحميل الحجز","warning");}}if(booking)openPreview(booking);});
  on("#searchInput","input",e=>{const q=e.target.value;const clear=$("#ozSearchClear");if(clear)clear.hidden=[...q].length<3;clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>searchBookings(q),140);});
  on("#ozSearchClear","click",()=>{const input=$("#searchInput");if(!input)return;input.value="";$("#ozSearchClear").hidden=true;clearTimeout(state.searchTimer);searchBookings("");input.focus();});
  const hideSearchDate=()=>{const sheet=$("#ozSearchCalendarPreview");if(sheet)sheet.hidden=true;$("#ozSearchCalendar")?.setAttribute("aria-expanded","false");};
  on("#ozSearchCalendar","click",()=>{const sheet=$("#ozSearchCalendarPreview");if(!sheet)return;sheet.hidden=!sheet.hidden;$("#ozSearchCalendar")?.setAttribute("aria-expanded",String(!sheet.hidden));});
  on("#ozSearchCalendarClose","click",hideSearchDate);
  on("#notificationReadAllBtn","click",()=>{notificationItems().forEach(markNotificationRead);renderNotifications();renderNotificationBadge();showToast("تم تعليم الكل كمقروء");});
  on("#notificationsSummary","click",e=>{const btn=e.target.closest("[data-notification-filter]");if(btn)setNotificationInboxFilter(btn.dataset.notificationFilter);});
  on("#notificationsList","click",async e=>{
  const target=e.target.closest("[data-smart-action]"),card=e.target.closest("[data-notification-id]");if(!card)return;
  const n=notificationItems().find(n=>n.id===card.dataset.notificationId);if(n)markNotificationRead(n);
  let booking=bookingRepository()?.get?.(card.dataset.bookingId);
  if(!booking&&card.dataset.bookingId&&window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.ensureBooking){try{booking=await window.MyfntQuery.ensureBooking(card.dataset.bookingId);}catch(error){console.warn('[notification booking hydrate]',error);}}
  renderNotificationBadge();
  const smart=n?.target||null;
  if(!target&&smart?.kind==='payment'&&smart.id){closeWindow('notificationsWindow',{skipHistory:true});window.MyfntFinance?.openPaymentRecord?.(smart.id);renderNotifications();return;}
  if(!target&&smart?.kind==='customer'&&smart.id){closeWindow('notificationsWindow',{skipHistory:true});window.MyfntFinance?.openCustomerRecord?.(smart.id);renderNotifications();return;}
  if(!target&&smart?.kind==='messages'){closeWindow('notificationsWindow',{skipHistory:true});openWindow('myfntMessagesWindow');document.dispatchEvent(new Event('myfnt:open-messages'));renderNotifications();return;}
  const action=target?.dataset.smartAction||"preview";
  if(action==="snooze"){const menu=card.querySelector('.notification-card__snooze');if(menu)menu.hidden=!menu.hidden;return;}
  if(action.startsWith("snooze-")){const mode=action==="snooze-hour"?"hour":action==="snooze-evening"?"evening":"tomorrow";if(n&&window.MyfntNotificationCenter?.snooze?.(n,mode)){renderNotifications();renderNotificationBadge();showToast(mode==="hour"?"تم تأجيل التنبيه ساعة":mode==="evening"?"تم تأجيل التنبيه إلى المساء":"تم تأجيل التنبيه إلى الغد");}return;}
  if(action==="payment"&&smart?.id){closeWindow('notificationsWindow',{skipHistory:true});window.MyfntFinance?.openPaymentRecord?.(smart.id);renderNotifications();return;}
  if(action==="customer"&&smart?.id){closeWindow('notificationsWindow',{skipHistory:true});window.MyfntFinance?.openCustomerRecord?.(smart.id);renderNotifications();return;}
  if(action==="messages"){closeWindow('notificationsWindow',{skipHistory:true});openWindow('myfntMessagesWindow');document.dispatchEvent(new Event('myfnt:open-messages'));renderNotifications();return;}
  if(!booking){renderNotifications();return;}
  if(action==="phone")openBookingPhoneField(booking);
  else if(action==="receipt"){openPreview(booking);openReceipt();}
  else if(action==="sms"||action==="whatsapp"){
    if(!String(booking.phone||'').trim()){openBookingPhoneField(booking);return;}
    const message=window.OzanReminderMessage?.(booking,n?.stage||'past',n?.date||booking.date)||bookingShareText(booking);
    const digits=window.MyfntPhone?.digits?.(booking.phone)||String(booking.phone||'').replace(/\D/g,'');
    if(action==='whatsapp')window.open('https://api.whatsapp.com/send?phone='+encodeURIComponent(digits)+'&text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
    else window.location.href='sms:'+digits+'?body='+encodeURIComponent(message);
    showToast('تم فتح تطبيق المراسلة؛ تحقق من الإرسال داخله');
  }
  else openPreview(booking);
 });
  on("#packageChips","click",e=>{const c=e.target.closest(".smart-chip");if(!c||c.classList.contains("is-active"))return;
    $$("#packageChips .smart-chip").forEach(x=>{const active=x===c;x.classList.toggle("is-active",active);x.setAttribute("aria-pressed",String(active));});
    $("#eventType").value=selectedBookingPackage()?.name||"";
    ozBookingAmountMode="auto";syncSelectedPackagePricing("package");
  });
  on("#statusChips","click",e=>{const c=e.target.closest(".booking-kind-chip[data-status]");if(!c)return;$$("#statusChips .booking-kind-chip[data-status]").forEach(x=>{const active=x===c;x.classList.toggle("is-active",active);x.setAttribute("aria-pressed",String(active));});$("#bookingStatus").value=c.dataset.status;syncTemporaryDurationVisibility();});
  on("#temporaryDurationChips","click",e=>{const c=e.target.closest("[data-hours]");if(c)setTemporaryDuration(Number(c.dataset.hours));});
  on("#dateTimeToggle","click",()=>setBookingTimeVisible($("#bookingTimePanel").hidden));
  on("#bookingTimeFrom","change",updateBookingTimeSummary);on("#bookingTimeTo","change",updateBookingTimeSummary);
  const bookingDateChanged=()=>{syncDateDisplay($("#bookingDate"));updateDateMeta();syncSelectedPackagePricing("date");};
  on("#bookingDate","change",bookingDateChanged);
  on("#dateTodayBtn","click",()=>{$("#bookingDate").value=isoDate(new Date());bookingDateChanged();});
  on("#dateNextAvailableBtn","click",()=>{$("#bookingDate").value=findNextAvailable($("#bookingDate").value||isoDate(new Date()));bookingDateChanged();showToast("تم اختيار أقرب يوم متاح");});
  on("#bookingAmount","input",e=>{normalizeNumericInput(e.target);ozBookingAmountMode="manual";updateRemaining();});
  on("#bookingPaid","input",e=>{normalizeNumericInput(e.target);updateRemaining();refreshBookingDepositHint();});
  on("#customerPhone","input",e=>{normalizeNumericInput(e.target);if(!$('#bookingId').value)$('#bookingCustomerId').value='';});
  on('#customerName','input',()=>{if(!$('#bookingId').value)$('#bookingCustomerId').value='';});
  // Duplicate customers are handled on submit only; no inline match suggestions.
  on("#bookingSettingsBtn","click",()=>{prepareAdminWindow('bookingUiSettingsWindow');openWindow('bookingUiSettingsWindow');});
  on("#bookingForm","submit",submitBooking); on("#receiptForm","submit",submitReceipt);
  on("#receiptBookingSearch","input",e=>{$("#receiptBookingId").value="";$("#receiptSuccessNote").hidden=true;renderReceiptBookingSummary(null);updateReceiptDirectionUI();clearTimeout(window.__ozReceiptSearchTimer);const query=e.target.value;const host=$("#receiptBookingResults");if(host&&query.trim().length>0){host.hidden=false;host.innerHTML='<div class="mf-search-skeleton" aria-busy="true" aria-live="polite"><span></span><span></span><span></span></div>';$("#receiptBookingSearch").setAttribute("aria-expanded","true");}window.__ozReceiptSearchTimer=setTimeout(()=>searchReceiptBookings(query),110);});
  on("#receiptBookingSearch","focus",e=>searchReceiptBookings(e.target.value));
  on("#receiptBookingResults","click",e=>{const btn=e.target.closest("[data-receipt-booking]");if(btn)chooseReceiptBooking(btn.dataset.receiptBooking);});
  on('#receiptDirection','change',updateReceiptDirectionUI);
  on('#receiptAmount','input',()=>{const a=Number($('#receiptAmount').value);const b=activeReceiptBooking();$('#receiptAmountWords').textContent=Number.isSafeInteger(a)&&a>0?amountWords(a,b?.currency||'YER'):'أدخل المبلغ';});
  on('#receiptDirectionChips','click',e=>{const chip=e.target.closest('[data-receipt-direction]');if(!chip)return;$('#receiptDirection').value=chip.dataset.receiptDirection;$$('#receiptDirectionChips .mf-choice').forEach(c=>{const selected=c===chip;c.classList.toggle('is-active',selected);c.setAttribute('aria-pressed',String(selected));});updateReceiptDirectionUI();});
  on('#receiptTagChips','click',e=>{const chip=e.target.closest('[data-receipt-tag]');if(!chip)return;$('#receiptTag').value=chip.dataset.receiptTag;$$('#receiptTagChips .mf-choice').forEach(c=>{const selected=c===chip;c.classList.toggle('is-active',selected);c.setAttribute('aria-pressed',String(selected));});});
  on('#receiptDraftPreviewBtn','click',()=>window.MyfntReceiptImage?.openDraft());
  on('#receiptBookingSearch','keydown',e=>{if(e.key==='Escape'){clearTimeout(window.__ozReceiptSearchTimer);$('#receiptBookingResults').hidden=true;$('#receiptBookingSearch').setAttribute('aria-expanded','false');}if(e.key==='Enter'&&$('#receiptBookingResults')?.hidden===false){const first=$('#receiptBookingResults [data-receipt-booking]');if(first){e.preventDefault();chooseReceiptBooking(first.dataset.receiptBooking);}}});
  on("#remainingAddBtn","click",()=>quickAdjustBookingAmount("add"));
  on("#remainingDiscountBtn","click",()=>quickAdjustBookingAmount("discount"));
  on("#amountAdjustmentForm","submit",submitAdjustment);on("#adjustmentValue","input",updateAdjustmentPreview);
  on("#trashList","click",e=>{const restore=e.target.closest("[data-restore-booking]");if(restore){restoreBookingFromTrash(restore.dataset.restoreBooking);return;}const del=e.target.closest("[data-delete-booking]");if(del)permanentlyDeleteBooking(del.dataset.deleteBooking);});
  on("#previewContent","click",e=>{const btn=e.target.closest("[data-oz-tip]");if(!btn)return;const booking=bookingRepository()?.get?.(state.activeBookingId);if(!booking)return;const action=btn.dataset.ozTip;if(action==="receipt")openReceipt();else if(action==="phone")openBookingPhoneField(booking);else openBookingForm(booking);});
  on("#previewConfirmBtn","click",confirmActiveBooking); on("#previewTrashBtn","click",trashActiveBooking); on("#previewEditBtn","click",editActiveBooking); on("#previewReceiptBtn","click",openReceipt); on("#previewJpgBtn","click",openInvoice);on("#previewInvoiceBtn","click",openInvoice);
  $$('[data-window-close]').forEach(b=>b.addEventListener('click',e=>{
    // يُغلق الزر نافذته حصراً، ولا يفتح حدث رجوع متأخر القائمة من جديد.
    const win=e.currentTarget.closest('.window');
    if(win)closeWindow(win.id);
  }));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeWindow();});
  $$('[data-open-admin]').forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.openAdmin;prepareAdminWindow(id);openWindow(id);}));
  on("#packagesList","click",async e=>{const b=e.target.closest("[data-delete-package]");if(!b)return;const id=b.dataset.deletePackage,p=packageRepository()?.get?.(id)||allPackagesRepo().find(x=>x.id===id);if(!p)return;if(p.builtIn){showToast("الباقات الافتراضية لا تقبل الحذف","warning");return;}if(allBookingsRepo().some(x=>x.packageId===id)){showToast("لا يمكن حذف باقة مرتبطة بحجوزات؛ أخفها بدلاً من ذلك","warning");return;}try{await window.MyfntOffline?.remove?.("booking_packages",id,{operation:"delete",reason:"حذف باقة إضافية"});}catch{return;}packageRepository()?.removeLocal?.(id);renderPackagesAdmin();});
  document.addEventListener('ozan:packages-updated',()=>{
    if(document.getElementById('seasonPricingWindow')?.classList.contains('is-open'))renderSeasonPricing();
    const chip=document.querySelector('#packageChips .is-active');
    if(document.getElementById('packageChips')){
      // لا نفرض أي خيار بعد تحديث قائمة الباقات. في الحجز القديم، حافظ على معرّف الباقة.
      const pkg=renderPackageChips(chip?.dataset.packageName||'',chip?.dataset.packageId||'');
      if(document.getElementById('bookingWindow')?.classList.contains('is-open')){
        syncSelectedPackagePricing('admin');
      }
    }
    if(typeof renderBookings==='function')renderBookings();
  });
  on("#seasonPricingForm","submit",async e=>{e.preventDefault();if(!await ozConfirm("تعديل سعر الموسم سيُعتمد للحجوزات الجديدة فقط، ولن يغيّر العقود السابقة. هل تؤكد؟",{title:"اعتماد تسعير الموسم",danger:true}))return;try{for(const inp of $$('[data-season-price]')){const p=packageRepository()?.get?.(inp.dataset.seasonPrice);if(p)await packageRepository()?.mutateDurable?.(p.id,item=>{item.seasonPrice=Number(inp.value||0);});}showToast("تم حفظ تسعيرات الموسم");}catch(err){console.error('[season-pricing durable save]',err);showToast('تعذر تثبيت تسعيرات الموسم؛ تم التراجع عن التغيير','warning');}});
  on("#specialDaysList","click",async e=>{const b=e.target.closest("[data-delete-special]");if(!b)return;const id=b.dataset.deleteSpecial;try{await window.MyfntOffline?.remove?.("calendar_blocks",id,{operation:"delete",reason:"حذف يوم مميز"});window.MyfntRepositories?.specialDays?.removeLocal?.(id);}catch{return;}renderSpecialDays();renderCalendar();});
  on("#exportJsonBtn","click",exportJson); on("#exportCsvBtn","click",exportCsv);
  on("#importInput","change",e=>{const f=e.target.files?.[0];if(f)importData(f);e.target.value="";});
  on("#resetBtn","click",async ()=>{if(!await ozConfirm("حذف بيانات الحجوزات والسندات من هذا الجهاز؟",{title:"تحذير حذف البيانات",danger:true,confirmLabel:"حذف البيانات"}))return;try{if(!window.MyfntLocal?.resetOperationalData)throw Error('بوابة الحذف الدائم غير جاهزة');await window.MyfntRepositories?.flush?.();await window.MyfntLocal.resetOperationalData();bookingRepository()?.replaceLocal?.([],{persist:false});paymentRepository()?.replaceLocal?.([],{persist:false});customerRepository()?.replaceLocal?.([],{persist:false});window.MyfntCustomers.save();state.syncAudit.pending=[];state.syncAudit.simulated=[];saveSyncAudit();saveBookings();saveReceipts();ozHistory={};safeStorage.remove(OZ_HISTORY_KEY);safeStorage.remove(OZ_REMINDER_SENT_KEY);closeAllWindows();renderAll();showToast("تمت إعادة الضبط وحذف البيانات الدائمة");}catch(err){console.error('[operational reset]',err);showToast('تعذر إكمال الحذف الدائم؛ لم يتم مسح الواجهة لحماية البيانات','warning');}});
  on("#successPreviewDownloadBtn","click",()=>{const b=bookingRepository()?.get?.(state.lastCreatedBookingId);if(b){state.activeBookingId=b.id;openInvoice();}});
  on("#successSmsBtn","click",()=>openSmsForBooking(bookingRepository()?.get?.(state.lastCreatedBookingId)));
  on("#successWhatsappBtn","click",()=>openWhatsappForBooking(bookingRepository()?.get?.(state.lastCreatedBookingId)));
  on("#companyForm","submit",async e=>{
    e.preventDefault();const name=$("#companyName").value.trim();if(!name){showToast("اسم الشركة مطلوب","warning");return;}
    const from=$('#companySeasonStart').value,to=$('#companySeasonEnd').value;
    if($('#companySeasonEnabled').checked&&(!from||!to)){ozWarn('حدد تاريخ بداية الموسم ونهايته لتفعيله.');return;}
    try{await settingsRepository()?.mutateDurable?.(settings=>{const c=settings.company;c.name=name;c.phone=normalizePhone($("#companyPhone1").value);c.phone2=normalizePhone($("#companyPhone2").value);c.description=$("#companyDescription").value.trim();c.addresses=$("#companyAddresses").value.trim()||"الجمهورية اليمنية صنعاء";c.terms=$("#companyTerms").value.trim();c.receiptNotes=$("#companyReceiptNotes").value.trim();settings.season={enabled:$('#companySeasonEnabled').checked,name:$('#companySeasonName').value.trim()||'موسم',start:from||settings.season?.start||'',end:to||settings.season?.end||''};});}catch(err){console.error('[company settings durable save]',err);showToast('تعذر تثبيت إعدادات الشركة؛ تم التراجع','warning');return;}
    window.MyfntAlertScheduler?.reschedule?.();
    renderCalendar();renderAppIdentity();showToast('حُفظت إعدادات الشركة والموسم');
  });
  on("#bookingUiSettingsForm","submit",saveBookingUiSettings);
  on("#companyLogo","change",async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>3*1024*1024||!/^image\/(png|jpeg|webp)$/i.test(file.type||'')){showToast("اختر شعار PNG أو JPG أو WebP أصغر من 3MB","warning");e.target.value="";return;}try{const bm=await createImageBitmap(file),max=320,scale=Math.min(1,max/Math.max(bm.width,bm.height)),w=Math.max(1,Math.round(bm.width*scale)),h=Math.max(1,Math.round(bm.height*scale)),c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d",{alpha:true});ctx.drawImage(bm,0,0,w,h);bm.close?.();const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error("تعذر ضغط الشعار")),"image/webp",.76));const url=await window.MyfntMedia?.put?.("company-logo",blob);if(!url)throw Error("تعذر حفظ الشعار في IndexedDB");await settingsRepository()?.mutateDurable?.(settings=>{settings.company.logo=url;});fillCompanyForm();showToast("تم ضغط الشعار وحفظه خارج LocalStorage");}catch(err){console.warn('[company-logo]',err);showToast("تعذر معالجة الشعار","warning");}finally{e.target.value="";}});
  on("#manualSyncBtn","click",()=>performRefresh({returnHome:false}));
  on("#invoicePrintBtn","click",printInvoicePreview);
  on("#invoiceJpgBtn","click",exportInvoiceJpg);
  on("#installAction","click",triggerInstall);
  on("#sidebarInstallBtn","click",()=>{closeWindow("menuWindow",{skipHistory:true});queueMicrotask(triggerInstall);});
  on("#installGuideClose","click",hideInstallGuide);
  on("#installGuideDone","click",hideInstallGuide);
  on("#installGuide","click",e=>{if(e.target.id==="installGuide")hideInstallGuide();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#installGuide")?.hidden)hideInstallGuide();});
  on("#installClose","click",()=>{safeStorage.set("ozan.install.dismissUntil",String(Date.now()+24*3600000));$("#installBanner").hidden=true;});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();safeStorage.remove("ozan.install.confirmed");installPromptEvent=e;refreshInstallSurfaces();});
  window.addEventListener("appinstalled",()=>{installPromptEvent=null;safeStorage.set("ozan.install.confirmed","1");refreshInstallSurfaces();});
  window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change",refreshInstallSurfaces);
  refreshInstallSurfaces();
  clearInterval(myfntInstallVisibilityTimer);
  const installReady=()=>refreshInstallSurfaces();
  if(window.MyfntUiState?.scheduleWhenClear){window.MyfntUiState.scheduleWhenClear({key:'install-banner',delayMs:MYFNT_INSTALL_DELAY_MS,excludeIds:['installBanner'],callback:installReady,pollMs:500});}
  else myfntInstallVisibilityTimer=window.setTimeout(installReady,MYFNT_INSTALL_DELAY_MS);
  initSelectAllInputs();
  window.addEventListener("online",()=>{renderConnectionStatus();if(state.syncAudit.pending?.length)showToast("عاد الاتصال: الحجوزات المحفوظة محليًا بانتظار ربط خادم المزامنة","warning");}); window.addEventListener("offline",renderConnectionStatus);
}


// التثبيت والتهيئة النهائية للتطبيق
function browserInstallInfo(){
  const ua=navigator.userAgent||"";
  const ios=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const mac=/Macintosh/i.test(ua)&&!ios;
  const safari=/Safari/i.test(ua)&&!/CriOS|Chrome|Chromium|FxiOS|Firefox|EdgiOS|Edg\//i.test(ua);
  const chrome=/Chrome|CriOS/i.test(ua)&&!/Edg|OPR|SamsungBrowser/i.test(ua);
  const samsung=/SamsungBrowser/i.test(ua);
  const firefox=/Firefox|FxiOS/i.test(ua);
  const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
  if(standalone)try{safeStorage.set("ozan.install.confirmed","1");}catch{}
  const remembered=String(safeStorage.get("ozan.install.confirmed")||"")==="1";
  if(standalone||remembered)return {installed:true};
  if(ios&&safari)return {name:"Safari على iPhone/iPad",instructions:"من زر المشاركة اختر «إضافة إلى الشاشة الرئيسية».",steps:["اضغط زر المشاركة (مربع مع سهم للأعلى) في Safari.","مرّر إلى «إضافة إلى الشاشة الرئيسية»؛ في بعض الإصدارات ستجده تحت «المزيد».","اختر «إضافة»، ثم افتح مايفنت من الشاشة الرئيسية."]};
  if(ios)return {name:"متصفح iPhone/iPad",instructions:"للتثبيت الموثوق افتح الصفحة في Safari ثم شاركها إلى الشاشة الرئيسية.",steps:["انسخ رابط الصفحة وافتحه في Safari.","اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».","اضغط «إضافة» وافتح التطبيق من الشاشة الرئيسية."]};
  if(mac&&safari)return {name:"Safari على macOS",instructions:"من قائمة ملف اختر «إضافة إلى Dock» إذا كان مدعومًا.",steps:["افتح الموقع عبر Safari على macOS Sonoma أو أحدث.","اختر «ملف» ثم «إضافة إلى Dock»، إن كان الخيار متاحًا.","أكّد الاسم واضغط «إضافة»."]};
  if(samsung)return {name:"Samsung Internet",instructions:"من قائمة المتصفح اختر «إضافة صفحة إلى» ثم الشاشة الرئيسية.",steps:["افتح قائمة Samsung Internet.","اختر «إضافة صفحة إلى» ثم «الشاشة الرئيسية» أو «تثبيت التطبيق» إذا ظهر.","أكّد الإضافة."]};
  if(chrome)return {name:"Google Chrome",instructions:"من قائمة ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».",steps:["افتح قائمة ⋮ في Chrome.","اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» إن كان الخيار متاحًا.","أكّد التثبيت؛ يجب أن يكون الموقع على HTTPS."]};
  if(firefox)return {name:"Firefox",instructions:"تحقق من قائمة المتصفح؛ يتفاوت دعم تثبيت التطبيقات حسب النظام.",steps:["افتح قائمة المتصفح.","ابحث عن «إضافة إلى الشاشة الرئيسية» إذا كانت متاحة.","إن لم تجد الخيار، افتح الرابط في Safari على iPhone أو Chrome على Android."]};
  return {name:"المتصفح الحالي",instructions:"من قائمة المتصفح اختر تثبيت التطبيق أو إضافته للشاشة الرئيسية إذا توفر الخيار.",steps:["افتح قائمة المتصفح.","ابحث عن «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».","إن لم يظهر، جرّب Chrome على Android أو Safari على أجهزة Apple."]};
}
function refreshSidebarInstallButton(){
  const btn=$("#sidebarInstallBtn");if(!btn)return;
  const info=browserInstallInfo();
  btn.hidden=Boolean(info.installed);
  btn.setAttribute('aria-hidden',String(Boolean(info.installed)));
  if(!info.installed){
    const label=btn.querySelector('.sidebar-install-label');
    const sub=btn.querySelector('.sidebar-install-sub');
    if(label)label.textContent=installPromptEvent?'تثبيت مايفنت الآن':'تثبيت مايفنت';
    if(sub)sub.textContent=installPromptEvent?'جاهز للتثبيت على جهازك':'وصول أسرع من الشاشة الرئيسية';
  }
}
function refreshInstallSurfaces(){refreshSidebarInstallButton();refreshInstallBanner();}
function refreshInstallBanner(){
  const bar=$("#installBanner");if(!bar)return;
  const info=browserInstallInfo();
  const tooEarly=Date.now()<MYFNT_INSTALL_ELIGIBLE_AT;
  const blocked=window.MyfntUiState?.blockingSurfaceOpen?.(['installBanner'])??Boolean(document.querySelector('.window.is-open'));
  if(info.installed||tooEarly||blocked||Date.now()<Number(safeStorage.get("ozan.install.dismissUntil")||0)){bar.hidden=true;return;}
  $("#installTitle").textContent=`ثبّت ${settingsRepository()?.get?.("company.name")||"مايفنت"}`;
  $("#installInstructions").textContent=info.instructions;
  $("#installAction").textContent=installPromptEvent?"تثبيت الآن":"طريقة التثبيت";
  bar.hidden=false;
}
function showInstallGuide(){
  const info=browserInstallInfo();
  $("#installGuideTitle").textContent=`تثبيت ${settingsRepository()?.get?.("company.name")||"مايفنت"}`;
  $("#installGuideIntro").textContent=`${info.name}: ${info.instructions}`;
  const list=$("#installGuideSteps");list.replaceChildren();
  (info.steps||[]).forEach(step=>{const li=document.createElement("li");li.textContent=step;list.append(li);});
  const diag=$("#installDiagnostics");
  if(diag){const secure=window.isSecureContext,manifest=Boolean(document.querySelector('link[rel="manifest"]'));
   const worker="serviceWorker" in navigator;
   diag.textContent=`فحص التثبيت: HTTPS ${secure?"✓":"✕"} · رابط ملف التعريف ${manifest?"✓":"✕"} · عامل الخدمة ${worker?"✓":"✕"}\nجاري التحقق من ملف التعريف الفعلي...`;
   fetch(document.querySelector('link[rel="manifest"]')?.href||"manifest.json",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("HTTP "+r.status);const m=await r.json();if(!m.icons?.length||!m.name)throw Error("بيانات التثبيت ناقصة");return m;}).then(()=>{if(!diag.isConnected)return;diag.textContent=`فحص التثبيت: HTTPS ${secure?"✓":"✕"} · ملف التعريف ✓ · عامل الخدمة ${worker?"✓":"✕"}\n${installPromptEvent?"يمكن عرض نافذة تثبيت Chrome الآن.":"افتح قائمة ⋮ في Chrome وابحث عن تثبيت التطبيق إذا لم تظهر المطالبة."}`;}).catch(err=>{if(diag.isConnected)diag.textContent=`ملف التثبيت غير متاح: ${err.message}. تأكد من رفع manifest.json في مجلد التطبيق.`;});
  }
  $("#installGuideFoot").textContent=location.protocol==="https:"||location.hostname==="localhost"?"قد لا يظهر التثبيت إن كان المتصفح لا يدعمه أو سبق تثبيت التطبيق.":"يلزم اتصال HTTPS لتثبيت التطبيق على الأجهزة الأخرى.";
  $("#installGuide").hidden=false;
  $("#installGuideClose")?.focus();
}
function hideInstallGuide(){$("#installGuide").hidden=true;$("#installAction")?.focus();}
async function triggerInstall(){
  if(installPromptEvent){
    const event=installPromptEvent;installPromptEvent=null;
    try{await event.prompt();const choice=await event.userChoice;if(choice?.outcome!=="accepted")showInstallGuide();}
    catch(e){console.warn("[PWA:prompt]",e);showInstallGuide();}
    refreshInstallSurfaces();return;
  }
  showInstallGuide();
}

// تحسينات الوصول: تسمية الأزرار الديناميكية ومزامنة حالة زر الأصوات.
function updateSoundButton(){
  const btn=$("#soundToggle"),enabled=window.OzanSounds?.enabled();if(!btn)return;
  btn.setAttribute("aria-pressed",String(Boolean(enabled)));
  btn.setAttribute("aria-label",enabled?"كتم أصوات التطبيق":"تفعيل أصوات التطبيق");
  btn.title=enabled?"كتم الأصوات":"تفعيل الأصوات";
  // زر الصوت الآن داخل القائمة الجانبية؛ حافظ على الأيقونة والوصف وسهم التنقل.
  btn.querySelector("i:first-child")?.setAttribute("class",`fa-solid ${enabled?"fa-volume-high":"fa-volume-xmark"}`);
  const label=btn.querySelector(".sound-toggle-label");
  if(label)label.textContent=enabled?"كتم الأصوات":"تفعيل الأصوات";
}
function enhanceAccessibleControls(root=document){
  // MutationObserver may deliver a node that has already been removed. Do not
  // assume parentElement exists, and include the root itself in the scan.
  if(!root || typeof root.querySelectorAll !== "function")return;
  const elements=selector=>{
    const descendants=[...root.querySelectorAll(selector)];
    if(root.nodeType===1 && root.matches(selector))descendants.unshift(root);
    return descendants;
  };
  elements("button:not([aria-label])").forEach(btn=>{
    const label=btn.textContent?.replace(/\s+/g," ").trim()||btn.getAttribute("title")||"";
    const purpose=btn.hasAttribute("data-delete-package")?"حذف الباقة":
      btn.hasAttribute("data-delete-special")?"حذف اليوم المميز":
      btn.hasAttribute("data-delete-booking")?"حذف الحجز نهائياً":
      btn.hasAttribute("data-restore-booking")?"استعادة الحجز":label;
    if(purpose)btn.setAttribute("aria-label",purpose);
  });
  elements(".window").forEach(win=>{
    win.setAttribute("role","dialog");
    // UI navigation owns aria-modal on already-open dialogs.
    if(!win.hasAttribute("aria-modal"))win.setAttribute("aria-modal",String(win.classList.contains("is-open")));
    if(!win.getAttribute("aria-label"))win.setAttribute("aria-label",win.querySelector("h2")?.textContent?.trim()||"نافذة التطبيق");
    win.querySelectorAll("[data-window-close]").forEach(btn=>btn.setAttribute("aria-label",`إغلاق ${win.getAttribute("aria-label")}`));
  });
  // Also label close buttons injected individually inside an existing dialog.
  elements("[data-window-close]").forEach(btn=>{
    const win=btn.closest(".window");
    if(win)btn.setAttribute("aria-label",`إغلاق ${win.getAttribute("aria-label")||win.querySelector("h2")?.textContent?.trim()||"نافذة التطبيق"}`);
  });
}
// افتح كل زيارة على بداية الرئيسية حتى عندما يعيد المتصفح وضع التمرير السابق.
if('scrollRestoration' in history)history.scrollRestoration='manual';
function resetHomeScroll(){
  if(state.windowStack.length)return;
  window.scrollTo({top:0,left:0,behavior:'instant'});
  document.scrollingElement?.scrollTo({top:0,left:0,behavior:'instant'});
  const list=document.getElementById('bookingList');if(list)list.scrollTop=0;
}
window.addEventListener('pageshow',()=>{state.timelinePositioned=true;requestAnimationFrame(resetHomeScroll);});
function init(){
  runtimeIntegrityCheck();
  // Recover a half-written initial deposit BEFORE any load-time migration/snapshot.
  const financePreflight=safeRun("finance-recover",()=>window.MyfntFinance?.recoverBeforeLoad?.());
  const financeBlocked=!financePreflight||Boolean(financePreflight.blocked);
  safeRun("load-state",()=>loadState({readOnly:financeBlocked}));
  // Clean-build Step 21B: remove obsolete full-domain localStorage copies.
  safeRun('remove-obsolete-domain-storage',()=>{
    [STORAGE_KEY,RECEIPTS_KEY,'ozan.customers.directory.v1','ozan.finance.audit.v1','ozan.finance.journal.v1','ozan.finance.customers.v1','ozan.hydration.journal.v1'].forEach(key=>safeStorage.remove(key));
  });
  if(!financeBlocked)safeRun('customer-migration',()=>{const bookingsBefore=bookingRepository()?.snapshot?.()||[],receiptsBefore=paymentRepository()?.snapshot?.()||[];try{const result=window.MyfntCustomers.migrate(allBookingsRepo(),paymentRepository()?.all?.()||[]);if(result.changed)window.MyfntFinance.commitCustomerMigration();if(result.duplicates.length)console.warn('[Myfnt legacy customers] pre-existing duplicate records for manual review:',result.duplicates.length);}catch(error){bookingRepository()?.replaceLocal?.(bookingsBefore,{persist:false});paymentRepository()?.replaceLocal?.(receiptsBefore,{persist:false});window.MyfntCustomers.invalidate();throw error;}});
  safeRun("finance-init",()=>window.MyfntFinance?.init?.());
  if(!financeBlocked)safeRun("sequential-reference-migration",()=>{
    const result=window.MyfntSequences?.migrate?.();if(!result?.changed)return;
    saveBookings();window.MyfntCustomers?.save?.();saveReceipts();
    try{window.MyfntOffline?.reconcile?.({reason:'repair',enqueue:false});}catch(e){console.warn('[sequence reconcile]',e);}
  });
  if(!financeBlocked)safeRun("offline-init",()=>window.MyfntOffline?.init?.());
  else safeRun("finance-recovery-warning",()=>ozWarn('تعذر استرجاع معاملة مالية غير مكتملة. أوقفنا تعديل الحجوزات والسندات والترحيل الآلي. لا تحذف بيانات المتصفح؛ وفّر مساحة التخزين ثم أعد فتح التطبيق.'));
  safeRun("alerts-init",()=>window.MyfntAlertScheduler?.init?.());
  safeRun("access-init",()=>window.MyfntAccess?.init?.());
  initOzanNavigation();
  loadEnhancements();
  $$('input[type="date"], input[type="number"]').forEach(el=>el.lang="en");
  enhanceDateInputs(document);
  ["#companyPhone1","#companyPhone2"].forEach(id=>$(id)?.addEventListener("input",e=>normalizeNumericInput(e.target)));
  applyBookingUiSettings();
  initCalendarCore();
  // لا تضع التمرير تلقائيا على حجز اليوم عند بداية التشغيل.
  state.timelinePositioned=true;
  safeRun("render-shell",()=>{renderAppIdentity();renderConnectionStatus();renderFilterState();renderBookings();renderNotificationBadge();});
  safeRun("bind-events",bindEvents);
  safeRun("advanced-init",()=>window.OzanAdvanced?.init?.());
  updateSoundButton();enhanceAccessibleControls();
  // تسمية الأزرار التي تُنشأ بعد الرسم دون التأثير على أحداث الواجهة.
  new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        // Work on the inserted node, never its parent: it may be null when
        // the DOM changes again before the observer callback is delivered.
        if((node.nodeType===1 || node.nodeType===11) && node.isConnected){
          enhanceAccessibleControls(node);
        }
      }
    }
  }).observe(document.body,{childList:true,subtree:true});
  // IndexedDB readiness is independent from account hydration. On the first public/guest
  // launch there is no company workspace yet, so opening the database is valid while hydration
  // must be skipped. This prevents a missing session from being misreported as database failure.
  const hydrateCurrentWorkspace=async(reason='startup-indexeddb')=>{
    const scope=window.OzanScope?.read?.();
    if(!scope?.companyId||!scope?.userId)return {skipped:true,reason:'no-workspace'};
    return window.MyfntHydration?.hydrate?.({reason});
  };
  Promise.resolve(window.MyfntLocal?.open?.()).then(()=>hydrateCurrentWorkspace()).catch(error=>{
    console.error('[startup IndexedDB]',error);
    const name=String(error?.name||'');
    const message=name==='MyfntIndexedDBBlockedError'?error.message:'تعذر فتح التخزين المحلي على هذا الجهاز. تحقق من مساحة التخزين وخصوصية المتصفح ثم أعد المحاولة.';
    window.showToast?.(message,'warning');
  });
  document.addEventListener('ozan:auth-changed',()=>hydrateCurrentWorkspace('auth-changed').catch(error=>console.error('[auth hydration]',error)));
  document.addEventListener('ozan:scope-changed',()=>hydrateCurrentWorkspace('scope-changed').catch(error=>console.error('[scope hydration]',error)));
  safeRun("service-worker",registerServiceWorker);
  safeRun("install-banner",refreshInstallBanner);
  safeRun("core-self-test",runCoreSelfTest);
  requestAnimationFrame(()=>requestAnimationFrame(resetHomeScroll));
}
document.addEventListener("DOMContentLoaded",init);

// OZAN 2.1.0: تحديد النص كله عند لمس الحقول المعبأة، مع لوحة مفاتيح رقمية للأرقام.
// date/time/file/password/hidden/readonly ليست حقول تحرير نصي ولا نعبث بها.
function initSelectAllInputs(){
  const allowed=new Set(["text","tel","email","search","url","number","textarea"]);
  const valid=el=>el&&el.matches?.("input,textarea")&&!el.disabled&&!el.readOnly&&allowed.has(el.tagName==="TEXTAREA"?"textarea":el.type);
  const restore=el=>{
    if(el?.dataset?.ozOriginalType==="number"){
      delete el.dataset.ozOriginalType;
      el.type="number";
    }
  };
  document.addEventListener("focusin",event=>{
    const el=event.target;if(!valid(el))return;
    if(el.type==="number"&&el.value.trim()){
      // HTML input[type=number] لا يدعم select()/setSelectionRange في متصفحات عديدة.
      el.dataset.ozOriginalType="number";
      if(!el.hasAttribute("inputmode"))el.inputMode=el.step&&el.step!=="1"?"decimal":"numeric";
      el.type="text";
    }
    if(el.value)try{el.select();}catch{}
  });
  // عند اللمسة الثانية، أزل التحديد الكامل للسماح بوضع المؤشر داخل القيمة.
  document.addEventListener("pointerdown",event=>{
    const el=event.target;if(!valid(el)||document.activeElement!==el||!el.value)return;
    const full=el.selectionStart===0&&el.selectionEnd===el.value.length;
    if(full){
      el.dataset.ozSecondPointer="1";
      el.addEventListener("pointerup",()=>{
        if(el.dataset.ozSecondPointer==="1"){
          delete el.dataset.ozSecondPointer;
          requestAnimationFrame(()=>{
            if(document.activeElement===el&&el.selectionStart===0&&el.selectionEnd===el.value.length)
              try{el.setSelectionRange(el.value.length,el.value.length);}catch{}
          });
        }
      },{once:true});
    }
  },true);
  // التحديد عند الدخول الأول فقط، والنقرة التالية تسمح بوضع المؤشر والتعديل الطبيعي.
  // focusin سبق أن حدّد النص؛ إعادة select عند click كانت تمنع المستخدم من تحرير جزء منه.

  document.addEventListener("focusout",event=>restore(event.target));
  document.addEventListener("keydown",event=>{if(event.key==="Enter")restore(event.target);},true);
}
