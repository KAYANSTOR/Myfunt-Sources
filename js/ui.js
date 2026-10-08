// OZAN V1.9.1 — assets/js/ui.js
// رسم الواجهة والتقويم والإشعارات
function safeRun(name, fn){ try{return fn();}catch(error){console.error(`[OZAN:${name}]`,error);return null;} }
function uiBookingRepo(){return window.MyfntRepositories?.bookings||null;}
function uiPackageRepo(){return window.MyfntRepositories?.packages||null;}
function uiSettingsRepo(){return window.MyfntRepositories?.settings||null;}
function uiSettings(){return uiSettingsRepo()?.all?.()||{};}
function renderAll() {
  state._notificationCache=null;
  safeRun("identity",renderAppIdentity);
  safeRun("connection",renderConnectionStatus);
  renderCalendar();
  safeRun("filters",renderFilterState);
  safeRun("bookings",renderBookings);
  safeRun("notifications",renderNotificationBadge);
}

// هل انتهى سبب الإشعار؟ لا نحذف إشعاراً غير منفّذ ولو مضت 24 ساعة.
function notificationResolved(n){
 if(n?.eventNotification)return !!n?.resolved;
 const b=uiBookingRepo()?.get?.(n.bookingId);
 if(!b||["cancelled","archived"].includes(b.status))return true;
 if(n.type==="phone")return !!String(b.phone||"").trim();
 if(n.type==="overdue"||n.type==="balance")return remainingFor(b)<=0;
 if(n.type==="pending")return b.status!=="pending";
 if(n.type==="today"||n.type==="reminder")return (n.date||b.date)<isoDate(new Date());
 return false;
}
// تاريخ وقوع المناسبة: في التنبيه السنوي نبحث في السنة الحالية والقادمة والسنة الماضية
// حتى تعمل قواعد «قبل/بعد» وتظل المواعيد المضافة محليًا متزامنة مع الحالة الراهنة.
function bookingOccurrences(b){
 if(!b.annualRepeat)return [b.date];
 const now=new Date(),original=Number(b.date.slice(0,4)),dates=[];
 for(const y of [now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1]){
  if(y<original)continue;
  const date=y+b.date.slice(4),parsed=parseIso(date);
  if(isoDate(parsed)===date)dates.push(date);
 }
 return dates;
}
/* Smart collection reminders: 10/5-day upcoming dues first; only then historic arrears. */
function balanceReminderText(booking,stage='10',occurrenceDate=''){
 const first=String(booking.name||'عميلنا العزيز').trim().split(/\s+/)[0],company=uiSettingsRepo()?.get?.('company.name')||'مايفنت';
 const money=numberText(remainingFor(booking))+' '+currencyLabel(booking);
 const date=formatDateLabel(occurrenceDate||booking.date),event=booking.type||'مناسبتكم';
 if(stage==='5')return `مرحبًا ${first}، معك فريق ${company}. يسعدنا قرب موعد ${event} يوم ${date}. للتجهيز بكل عناية، نذكّرك بالمبلغ المتبقي ${money}. هل يناسبك استكماله قبل المناسبة؟ نتمنى لكم مناسبة جميلة.`;
 if(stage==='past')return `أهلًا ${first}، تحية طيبة من ${company}. نراجع حساب ${event} بتاريخ ${date}، ويظهر لدينا مبلغ متبقٍ قدره ${money}. إذا سبق السداد، نرجو إرسال التفاصيل لتحديث السجل. شكرًا لتعاونك.`;
 return `أهلًا ${first}، معك فريق ${company}. نتطلع لخدمتكم في ${event} بتاريخ ${date}. نود تذكيركم بلطف بالمبلغ المتبقي ${money}، ويسعدنا التنسيق معكم لاستكماله قبل المناسبة في الوقت المناسب لكم.`;
}
window.OzanReminderMessage=balanceReminderText;

function notificationEpoch(day,hour='09:00'){
 const value=String(day||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return 0;
 const ts=Date.parse(`${value}T${hour}:00+03:00`);return Number.isFinite(ts)?ts:0;
}
function notificationSortAt(n){
 const explicit=Number(n?.sortAt||n?.updatedAt||n?.createdAt||0);if(explicit>0)return explicit;
 const scheduled=typeof n?.scheduledAt==='number'?n.scheduledAt:Date.parse(n?.scheduledAt||'');if(Number.isFinite(scheduled)&&scheduled>0)return scheduled;
 return notificationEpoch(n?.date||'');
}

function notificationItems(){
 if(state._notificationCache&&Date.now()-state._notificationCache.at<10000)return state._notificationCache.items;
 const today=isoDate(new Date()),items=[],historical=[],priorityBalances=[];
 const alertTemplates=window.MyfntRepositories?.alerts?.all?.()||[];
 const reminders=new Set(alertTemplates.length?[]:[...((uiSettings().reminders||[]).map(Number)),Number(window.ozPreferences?.reminderDays||1)]);
 const byPackage=new Map((uiPackageRepo()?.all?.()||[]).map(p=>[p.id,p]));
 for(const b of (uiBookingRepo()?.all?.()||[])){
  if(b.status==='cancelled')continue;
  const occurrences=bookingOccurrences(b),nextDate=occurrences.find(date=>date>=today)||b.date;
  const days=daysFromToday(nextDate),remain=remainingFor(b);
  if(remain>0){
   if(days===10||days===5)priorityBalances.push({id:`balance-focus:${b.id}:${nextDate}:${days}`,type:'balance',bookingId:b.id,priority:-10,date:nextDate,icon:'fa-hand-holding-dollar',tone:'danger',title:`متبقي ${days} أيام · متابعة دفعة`,text:`${b.name} · ${numberText(remain)} ${currencyLabel(b)} · ${formatDateLabel(nextDate)}`,actions:[{action:'sms',label:'رسالة نصية'},{action:'whatsapp',label:'واتساب'},{action:'receipt',label:'تسجيل دفعة'}],stage:String(days),createdAt:Math.max(0,notificationEpoch(nextDate)-days*86400000)});
   else if(days<0)historical.push({id:`overdue:${b.id}`,type:'overdue',bookingId:b.id,priority:-5,date:b.date,icon:'fa-wallet',tone:'warning',title:'متابعة رصيد سابق',text:`${b.name} · ${numberText(remain)} ${currencyLabel(b)} · ${formatDateLabel(b.date)}`,actions:[{action:'sms',label:'رسالة نصية'},{action:'whatsapp',label:'واتساب'},{action:'receipt',label:'تسجيل دفعة'}],stage:'past',createdAt:notificationEpoch(b.date)+86400000});
  }
  // v2.5 schedules the same custom rules against the company timezone and preferred time.
  if(!window.MyfntAlertScheduler) for(const t of alertTemplates){
   if(!['staff','both'].includes(t.recipient)||!Array.isArray(t.channels)||!t.channels.includes('inApp'))continue;
   const unit={days:86400000,hours:3600000,minutes:60000}[t.unit]||86400000;
   if(!Number.isFinite(Number(t.value))||Number(t.value)<0)continue;
   for(const occurrence of occurrences){
    const event=new Date(occurrence+'T'+(b.hasTime?b.timeFrom:'09:00')+':00');const at=event.getTime()+(t.direction==='after'?1:-1)*Number(t.value)*unit;
    if(Date.now()>=at&&Date.now()-at<86400000){
     const pkg=byPackage.get(b.packageId),vars={name:b.name,phone:b.phone,number:b.bookingNo,package:pkg?.name||b.type,date:occurrence,amount:b.amount,paid:b.paid,remaining:remain};
     const message=String(t.staffMessage||t.name||'تذكير الحجز').replace(/\{(name|phone|number|package|date|amount|paid|remaining)\}/g,(_,key)=>String(vars[key]??''));
     items.push({id:`template:${t.id}:${b.id}:${occurrence}`,type:'reminder',bookingId:b.id,priority:3,date:occurrence,icon:'fa-bell',tone:'primary',title:String(t.name||'تذكير'),text:message,createdAt:at});
    }
   }
  }
  if(b.status==='pending'&&b.date>=today)items.push({id:`pending:${b.id}:${b.date}`,type:'pending',bookingId:b.id,priority:2,date:b.date,icon:'fa-clock',tone:'warning',title:'حجز بانتظار التأكيد',text:`${b.name} · ${formatDateLabel(b.date)}`,createdAt:Number(b.updatedAt||b.createdAt||notificationEpoch(b.date))});
  if(days===0)items.push({id:`today:${b.id}:${nextDate}`,type:'today',bookingId:b.id,priority:1,date:b.date,icon:'fa-calendar-day',tone:'primary',title:'مناسبة اليوم',text:`${b.name} · ${b.type||'مناسبة'}`,createdAt:notificationEpoch(nextDate)});
  if(days>=0&&reminders.has(days))items.push({id:`reminder:${b.id}:${nextDate}:${days}`,type:'reminder',bookingId:b.id,priority:3,date:b.date,icon:'fa-bell',tone:'primary',title:`تذكير مناسبة بعد ${days} يوم`,text:`${b.name} · ${b.type||'مناسبة'}`,createdAt:Math.max(0,notificationEpoch(nextDate)-days*86400000)});
  if(!String(b.phone||'').trim()&&days>=0&&days<=10)items.push({id:`phone:${b.id}`,type:'phone',bookingId:b.id,priority:4,date:b.date,icon:'fa-phone-slash',tone:'warning',title:'حجز دون رقم هاتف',text:`${b.name} · ${formatDateLabel(b.date)}`,actions:[{action:'phone',label:'إضافة الهاتف'}],createdAt:Math.max(Number(b.updatedAt||b.createdAt||0),notificationEpoch(nextDate)-10*86400000)});
 }
 if(priorityBalances.length)items.push(...priorityBalances);
 else items.push(...historical.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,25));
 const activeIds=new Set(items.map(n=>n.id)),now=Date.now();let changed=false;
 for(const [id,meta] of Object.entries(state.notificationReadAt||{})){
  const n=meta?.snapshot;if(!state.notificationRead.has(id)||!n)continue;
  if(now-Number(meta.at||now)>=86400000&&notificationResolved(n)){state.notificationRead.delete(id);delete state.notificationReadAt[id];changed=true;continue;}
  // Reuse only still-relevant snapshots; do not resurrect old overdue alerts while upcoming alerts have priority.
  if(!activeIds.has(id)&&n.type!=='balance'&&!notificationResolved(n)&&!(priorityBalances.length&&n.type==='overdue'))items.push(n);
 }
 if(changed)saveNotificationRead();
 if(window.MyfntAlertScheduler)items.push(...window.MyfntAlertScheduler.due());
 if(window.MyfntNotificationCenter)items.push(...window.MyfntNotificationCenter.items());
 const merged=window.MyfntNotificationCenter?.mergeItems?.(items)||items;
 merged.sort((a,b)=>notificationSortAt(b)-notificationSortAt(a)||(Number(a.priority||0)-Number(b.priority||0))||String(b.id||'').localeCompare(String(a.id||'')));
 state._notificationCache={at:now,items:merged};return merged;
}

function unreadNotifications(){ return notificationItems().filter(n=>!n.resolved&&!state.notificationRead.has(n.id)); }
let previousUnreadCount = null;
function renderNotificationBadge() {
  const count = unreadNotifications().length;
  // لا نشغّل صوتاً عند تحميل الصفحة لأول مرة، بل عند ظهور تنبيه جديد بعد ذلك.
  if(previousUnreadCount !== null && count > previousUnreadCount) window.OzanSounds?.play("notification");
  previousUnreadCount = count;
  const el = $("#notificationBadge"); el.hidden = count === 0; el.textContent = count > 99 ? "99+" : en(count);
}
function notificationVisualMeta(n){
  const map={
    balance:{label:'مالي',icon:'fa-hand-holding-dollar'},overdue:{label:'رصيد',icon:'fa-wallet'},pending:{label:'حجز مؤقت',icon:'fa-hourglass-half'},
    reminder:{label:'تذكير',icon:'fa-calendar-check'},today:{label:'اليوم',icon:'fa-calendar-day'},phone:{label:'بيانات ناقصة',icon:'fa-phone-slash'},
    booking:{label:'حجز',icon:'fa-calendar-check'},'booking-update':{label:'تحديث حجز',icon:'fa-pen-to-square'},payment:{label:'دفعة',icon:'fa-file-invoice-dollar'},
    message:{label:'رسالة',icon:'fa-comment-sms'},sync:{label:'مزامنة',icon:'fa-cloud-arrow-up'},'smart.balance':{label:'رصيد',icon:'fa-wallet'},
    'smart.missing-phone':{label:'بيانات ناقصة',icon:'fa-phone-slash'},'smart.missing-price':{label:'بيانات ناقصة',icon:'fa-money-bill-wave'},
    'smart.missing-number':{label:'بيانات ناقصة',icon:'fa-hashtag'},'smart.no-payment':{label:'متابعة',icon:'fa-coins'},
    'smart.event-today':{label:'اليوم',icon:'fa-calendar-day'},'smart.event-tomorrow':{label:'غدًا',icon:'fa-calendar-plus'},'smart.event-two-days':{label:'بعد يومين',icon:'fa-calendar-check'},
    'smart.overdue-balance':{label:'متابعة',icon:'fa-triangle-exclamation'},'smart.pending-expiring':{label:'حجز مؤقت',icon:'fa-hourglass-half'},'smart.pending-expired':{label:'منتهي',icon:'fa-clock-rotate-left'},
    'smart.bundle':{label:'يحتاج انتباه',icon:'fa-wand-magic-sparkles'},'smart.digest':{label:'ملخص اليوم',icon:'fa-chart-line'}
  };
  return map[n?.type]||{label:n?.eventNotification?'نشاط':'تنبيه',icon:n?.icon||'fa-bell'};
}
function notificationTimeLabel(n){
  const raw=Number(n?.createdAt||0);if(raw>0){
    const diff=Math.max(0,Date.now()-raw),m=Math.floor(diff/60000),h=Math.floor(m/60),d=Math.floor(h/24);
    if(m<1)return 'الآن';if(m<60)return `منذ ${en(m)} د`;if(h<24)return `منذ ${en(h)} س`;if(d<7)return `منذ ${en(d)} ي`;
  }
  if(n?.date)return formatDateLabel(n.date);return '';
}
function notificationDefaultActions(n){
  if(n?.resolved)return [];
  if(Array.isArray(n?.actions)&&n.actions.length)return n.actions;
  const t=n?.target||{},out=[];
  if(n?.type==='smart.bundle'&&Array.isArray(n.issues)){
    for(const issue of n.issues){if(issue?.action&&!out.some(x=>x.action===issue.action))out.push({action:issue.action,label:issue.label||'فتح'});if(out.length>=3)break;}
  } else if(t.kind==='payment')out.push({action:'payment',label:'فتح الحركة'});
  else if(t.kind==='customer')out.push({action:'customer',label:'فتح العميل'});
  else if(t.kind==='messages'||n?.type==='message')out.push({action:'messages',label:'سجل الرسائل'});
  else if(n?.bookingId)out.push({action:'preview',label:'فتح الحجز'});
  if(window.MyfntNotificationCenter?.needsAttention?.(n))out.push({action:'snooze',label:'تذكير لاحقًا'});
  return out;
}
function notificationActionIcon(action){
  return ({receipt:'fa-money-bill-wave',phone:'fa-phone',sms:'fa-comment-sms',whatsapp:'fa-whatsapp',payment:'fa-file-invoice-dollar',customer:'fa-user',messages:'fa-comments',preview:'fa-arrow-up-right-from-square',snooze:'fa-clock', 'snooze-hour':'fa-hourglass-half','snooze-evening':'fa-moon','snooze-tomorrow':'fa-calendar-plus'})[action]||'fa-eye';
}
let notificationInboxFilter='all';
function setNotificationInboxFilter(value){notificationInboxFilter=value==='attention'?'attention':'all';renderNotifications();}
function renderNotifications() {
  const all = notificationItems(), attention=all.filter(n=>window.MyfntNotificationCenter?.needsAttention?.(n)), unread = all.filter(n=>!n.resolved&&!state.notificationRead.has(n.id));
  const shown=notificationInboxFilter==='attention'?attention:all;
  const list = $("#notificationsList"), summary = $("#notificationsSummary");
  if (!list || !summary) return;
  summary.innerHTML = `<div class="notifications-summary__stats"><div class="notification-summary__item"><strong>${en(unread.length)}</strong><span>غير مقروء</span></div><div class="notification-summary__divider"></div><div class="notification-summary__item"><strong>${en(attention.length)}</strong><span>يحتاج انتباه</span></div></div><div class="notification-filterbar" role="tablist" aria-label="تصفية الإشعارات"><button type="button" role="tab" aria-selected="${notificationInboxFilter==='all'}" class="${notificationInboxFilter==='all'?'is-active':''}" data-notification-filter="all">الكل <b>${en(all.length)}</b></button><button type="button" role="tab" aria-selected="${notificationInboxFilter==='attention'}" class="${notificationInboxFilter==='attention'?'is-active':''}" data-notification-filter="attention"><i class="fa-solid fa-triangle-exclamation"></i> يحتاج انتباه <b>${en(attention.length)}</b></button></div>`;
  if (!shown.length) {
    list.innerHTML = notificationInboxFilter==='attention'?'<div class="notification-empty is-success"><i class="fa-solid fa-circle-check"></i><strong>لا يوجد شيء يحتاج انتباهك</strong><span>كل الحجوزات المهمة تبدو مستقرة الآن.</span></div>':'<div class="notification-empty"><i class="fa-solid fa-bell-slash"></i><strong>لا توجد إشعارات الآن</strong><span>ستظهر هنا تنبيهات المواعيد والدفعات والحجوزات المعلقة.</span></div>';
    return;
  }
  list.innerHTML = shown.map(n => {
    const read=state.notificationRead.has(n.id),meta=notificationVisualMeta(n),actions=notificationDefaultActions(n),time=notificationTimeLabel(n);
    const urgent=Number(n.priority)<=0||n.tone==='danger',bookingLabel=n.bookingId?`#${escapeHtml(String(uiBookingRepo()?.get?.(n.bookingId)?.bookingNo||n.bookingId))}`:'';
    const severityLabel=({critical:'عاجل',high:'أولوية عالية',normal:'متابعة',low:'منخفض'})[n.severity]||'';
    const issues=Array.isArray(n.issues)?n.issues:[];
    return `<article class="notification-card ${read?'is-read':'is-unread'} ${n.resolved?'is-resolved':''} is-tone-${escapeHtml(n.tone||'primary')} ${urgent?'is-urgent':''}" data-notification-id="${escapeHtml(n.id)}" data-booking-id="${escapeHtml(n.bookingId||'')}" data-target-kind="${escapeHtml(n.target?.kind||'')}" data-target-id="${escapeHtml(n.target?.id||'')}">
      <span class="notification-card__rail" aria-hidden="true"></span>
      <span class="notification-card__icon is-${escapeHtml(n.tone||'primary')}"><i class="fa-solid ${escapeHtml(n.icon||meta.icon||'fa-bell')}"></i></span>
      <div class="notification-card__content">
        <div class="notification-card__topline"><span class="notification-card__kind"><i class="fa-solid ${escapeHtml(meta.icon||'fa-bell')}"></i>${escapeHtml(meta.label)}</span>${severityLabel&&!n.resolved?`<span class="notification-card__severity is-${escapeHtml(n.severity)}">${escapeHtml(severityLabel)}</span>`:''}${n.resolved?'<span class="notification-card__resolved"><i class="fa-solid fa-check"></i> تمت المعالجة</span>':!read?'<span class="notification-card__new">جديد</span>':''}<span class="notification-card__time">${escapeHtml(time)}</span></div>
        <button type="button" class="notification-card__open" aria-label="${escapeHtml(n.title)}: فتح العنصر المرتبط"><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.text)}</small></button>
        ${issues.length?`<div class="notification-card__issues">${issues.slice(0,4).map(x=>`<span class="is-${escapeHtml(x.level||'normal')}"><i class="fa-solid fa-circle"></i>${escapeHtml(x.title)}</span>`).join('')}${issues.length>4?`<span>+${en(issues.length-4)}</span>`:''}</div>`:''}
        <div class="notification-card__meta">${bookingLabel?`<span><i class="fa-solid fa-hashtag"></i>${bookingLabel}</span>`:''}${n.date?`<span><i class="fa-regular fa-calendar"></i>${escapeHtml(formatDateLabel(n.date))}</span>`:''}${n.actorName&&n.actorName!=='Myfnt'?`<span><i class="fa-regular fa-user"></i>${escapeHtml(n.actorName)}</span>`:''}</div>
        ${actions.length?`<div class="notification-card__actions">${actions.map((a,i)=>`<button type="button" class="notification-card__action ${i===0?'is-primary':''}" data-smart-action="${escapeHtml(a.action)}"><i class="fa-solid ${notificationActionIcon(a.action)}" aria-hidden="true"></i><span>${escapeHtml(a.label)}</span></button>`).join('')}</div>`:''}
        ${actions.some(a=>a.action==='snooze')?`<div class="notification-card__snooze" hidden><button type="button" data-smart-action="snooze-hour"><i class="fa-solid fa-hourglass-half"></i> بعد ساعة</button><button type="button" data-smart-action="snooze-evening"><i class="fa-solid fa-moon"></i> المساء</button><button type="button" data-smart-action="snooze-tomorrow"><i class="fa-solid fa-calendar-plus"></i> غدًا</button></div>`:''}
      </div>
      <i class="fa-solid fa-chevron-left notification-card__arrow" aria-hidden="true"></i>
    </article>`;
  }).join('');
}

function openNotifications(){
  // نُصدر نغمة عند وجود إشعارات غير مقروءة فقط، بعد تفاعل المستخدم.
  if(unreadNotifications().length)window.OzanSounds?.play("notification");
  renderNotifications();openWindow("notificationsWindow");
}
function setCalendarCollapsed(value,{persist=true}={}){
  const collapsed=Boolean(value),repo=uiSettingsRepo();
  if(repo){
    if(persist)repo.mutateDurable?.(cfg=>{cfg.bookingUi={...(cfg.bookingUi||{}),calendarCollapsed:collapsed};},{profileEvent:false}).catch(error=>{console.warn('[calendar collapsed durable]',error);showToast?.('تعذر تثبيت حالة التقويم','warning');});
    else repo.mutateLocal?.(cfg=>{cfg.bookingUi={...(cfg.bookingUi||{}),calendarCollapsed:collapsed};},{profileEvent:false});
  }else if(persist)saveSettings({sync:false,profileEvent:false});
  document.body.classList.toggle("calendar-collapsed",collapsed);
  requestAnimationFrame(()=>window.OzanCalendar?.syncCollapsedState?.());
}
function initCalendarCore(){
  try{
    if(!window.OzanCalendar) throw new Error("CALENDAR_MODULE_NOT_LOADED");
    return window.OzanCalendar.init({
      elements:{grid:$("#calendarGrid"),card:$("#calendarCard"),title:$("#monthTitle"),prevBtn:$("#prevMonthBtn"),nextBtn:$("#nextMonthBtn"),todayBtn:$("#todayBtn"),foldHandle:$("#calendarFoldHandle")},
      getViewDate:()=>state.viewDate,setViewDate:v=>{state.viewDate=v;},getSelectedDate:()=>state.selectedDate,setSelectedDate:v=>{state.selectedDate=v;},
      getBookings:()=>window.MyfntMonthData?.current?.()||uiBookingRepo()?.all?.()||[],isSpecialDate:value=>Boolean(getSpecialDay(value)),isSeasonDate:value=>isSeasonDate(value),monthNames:MONTH_AR,en,isoDate,parseIso,
      isCollapsed:()=>Boolean(uiSettingsRepo()?.get?.('bookingUi.calendarCollapsed')),setCollapsed:value=>setCalendarCollapsed(value),
      onMonthChanged:(next)=>{syncAvailableDatesMonth(next);state.hasExplicitDateSelection=false;state.viewFilter="all";state.renderLimit=40;state.timelinePositioned=false;safeRun("filters",renderFilterState);safeRun("bookings",renderBookings);window.MyfntMonthData?.refresh?.({force:true});},
      onDateSelected:(value)=>{
        state.hasExplicitDateSelection=Boolean(value);
        state.viewFilter=value?"date":"all";state.renderLimit=40;
        safeRun("filters",renderFilterState);safeRun("bookings",renderBookings);
        if(value && (window.MyfntMonthData?.forDate?.(value)||[]).length)openDayBookings(value);
      },
      onDateLongPress:(value)=>{
        state.selectedDate=value;state.hasExplicitDateSelection=true;
        state.viewDate=startOfMonth(parseIso(value));
        renderCalendar();openBookingForm();
      },
      onToday:()=>{state.hasExplicitDateSelection=false;state.viewFilter="all";state.renderLimit=40;safeRun("filters",renderFilterState);safeRun("bookings",renderBookings);}
    });
  }catch(error){console.error("[CalendarCore] init failed",error);return false;}
}
function renderCalendar(){ try{window.OzanCalendar?.render();}catch(error){console.error("[CalendarCore] render bridge failed",error);} }
function syncCalendarSelection(){ try{window.OzanCalendar?.syncSelection();}catch(error){console.error("[CalendarCore] selection bridge failed",error);} }
function moveMonth(delta){ window.OzanCalendar?.moveMonth(delta); }
function selectDate(value){ window.OzanCalendar?.selectDate(value); }
function goToday(){ if(window.OzanCalendar) window.OzanCalendar.goToday(); else { const d=new Date(); state.viewDate=startOfMonth(d); state.selectedDate=""; state.hasExplicitDateSelection=false; state.viewFilter="all"; state.renderLimit=40; safeRun("bookings",renderBookings); } }
function setViewFilter(view){ state.viewFilter=view; state.renderLimit=40; state.timelinePositioned=false; if(view!=="date") state.hasExplicitDateSelection=false; renderFilterState(); renderBookings(); }


// مدير نوافذ موحّد: لا نجمع بين إغلاق DOM و history.back للأزرار.
// آخر ثلاث شاشات فقط في ذاكرة التنقل؛ الرجوع الرابع من الرئيسية يعرض تأكيد المغادرة.
const WINDOW_LAYER=Object.freeze({BASE:500,UNDER:510,TOP:520});
function syncWindowLayers(){
  const top=state.windowStack.at(-1);
  $$('.window').forEach(win=>{
    const inStack=state.windowStack.includes(win.id),isTop=win.id===top;
    win.classList.toggle('is-open',inStack);
    win.classList.toggle('is-under',inStack&&!isTop);
    win.setAttribute('aria-hidden',isTop?'false':'true');
    win.setAttribute('aria-modal',String(isTop));
    win.style.zIndex=String(isTop?WINDOW_LAYER.TOP:inStack?WINDOW_LAYER.UNDER:WINDOW_LAYER.BASE);
    if('inert' in win)win.inert=!isTop;
  });
  document.body.classList.toggle('has-window',Boolean(top));
  const backdrop=$('#drawerBackdrop');
  if(backdrop){backdrop.hidden=top!=='menuWindow';backdrop.classList.toggle('is-open',top==='menuWindow');}
}
let ozNavReady=false,ozNavExiting=false,ozNavPosition=0;
const OZ_MAX_BACK_STEPS=3;
function navState(){return {ozanNavigation:true,ozanHomeGuard:!state.windowStack.length,ozanStack:state.windowStack.slice(-OZ_MAX_BACK_STEPS)};}
function replaceOzanNavigation(){if(ozNavReady)history.replaceState({...history.state,...navState()},'');}
function initOzanNavigation(){
  if(ozNavReady)return;
  ozNavReady=true;
  state.windowStack=[];
  history.replaceState({...history.state,...navState()},'');
  history.pushState(navState(),'');ozNavPosition=1; // يحمي الصفحة من الخروج دون موافقة.
  window.addEventListener('popstate',()=>{
    if(ozNavExiting){ozNavExiting=false;return;}
    ozNavPosition=Math.max(0,ozNavPosition-1);
    // نعتمد على تكدّس النوافذ الحالي بدل حالات متصفح قديمة قد تعيد قائمة أُغلقت.
    if(state.windowStack.length){
      state.windowStack.pop();
      ++state.transitionToken;
      syncWindowLayers();
      replaceOzanNavigation();
    }else{
      // العودة من الرئيسية هي الحالة الوحيدة التي تعرض تأكيد المغادرة.
      history.pushState(navState(),'');ozNavPosition++;
      showExitDialog();
    }
  });
}
function pushOzanNavigation(){if(ozNavReady){history.pushState(navState(),'');ozNavPosition++;}}

// حالة الأسطح المرئية المركزية: تستخدمها عناصر الظهور التلقائي حتى لا تتزاحم فوق النوافذ أو الحوارات.
function myfntSurfaceActuallyVisible(node){
  if(!node||!node.isConnected)return false;
  if(node.closest('[hidden]'))return false;
  if(node.closest('[aria-hidden="true"]'))return false;
  const style=getComputedStyle(node);
  if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return false;
  return node.getClientRects().length>0;
}
function myfntBlockingSurfaceOpen(excludeIds=[]){
  const excluded=new Set(Array.isArray(excludeIds)?excludeIds:[excludeIds]);
  const openWindow=document.querySelector('.window.is-open');
  if(openWindow&&myfntSurfaceActuallyVisible(openWindow)&&!excluded.has(openWindow.id))return true;
  const selectors=[
    '[role="dialog"]','[role="alertdialog"]',
    '.mf-visitor-overlay',
    '#ozAuth','#ozSetupWelcome','#ozLocalSync','#ozGuestGate','#ozAuthAccount','#ozSetupProgress',
    '#ozQuickSetup','#ozCountryDialog','#ozPrivacyDialog','#ozExitDialog','#installGuide'
  ];
  for(const selector of selectors){
    for(const node of document.querySelectorAll(selector)){
      if(excluded.has(node.id))continue;
      if(node.id==='ozTourHint'||node.id==='installBanner')continue;
      if(!myfntSurfaceActuallyVisible(node))continue;
      return true;
    }
  }
  return false;
}
const myfntUiSchedules=new Map();
function myfntScheduleWhenClear({key,delayMs=0,excludeIds=[],callback,pollMs=500}={}){
  if(typeof callback!=='function')return ()=>{};
  const id=String(key||('schedule:'+Date.now()+':'+Math.random()));
  const previous=myfntUiSchedules.get(id);if(previous)previous.cancel();
  let cancelled=false,timer=0;
  const startedAt=Date.now(),eligibleAt=startedAt+Math.max(0,Number(delayMs)||0);
  const run=()=>{
    if(cancelled)return;
    const wait=Math.max(0,eligibleAt-Date.now());
    if(wait>0){timer=setTimeout(run,Math.min(wait,1000));return;}
    if(myfntBlockingSurfaceOpen(excludeIds)){timer=setTimeout(run,Math.max(200,Number(pollMs)||500));return;}
    myfntUiSchedules.delete(id);
    try{callback({startedAt,eligibleAt,shownAt:Date.now()});}catch(error){console.error('[MyfntUiState schedule]',id,error);}
  };
  const handle={cancel(){cancelled=true;clearTimeout(timer);myfntUiSchedules.delete(id);},eligibleAt};
  myfntUiSchedules.set(id,handle);timer=setTimeout(run,Math.min(Math.max(0,delayMs),1000));return handle.cancel;
}
window.MyfntUiState=Object.freeze({
  blockingSurfaceOpen:myfntBlockingSurfaceOpen,
  isClear:(excludeIds=[])=>!myfntBlockingSurfaceOpen(excludeIds),
  scheduleWhenClear:myfntScheduleWhenClear,
  cancelSchedule:key=>myfntUiSchedules.get(String(key||''))?.cancel?.()
});

function openWindow(id){
  if(!document.getElementById(id))return;
  if(window.OzanGate?.blockedWindow?.(id))return;
  if(state.windowStack.at(-1)===id)return;
  hideExitDialog();
  state.windowStack=state.windowStack.filter(x=>x!==id);
  state.windowStack.push(id);
  // نافذة رابعة تستبدل أقدم خطوة من دون الاحتفاظ برحلة طويلة قديمة.
  if(state.windowStack.length>OZ_MAX_BACK_STEPS)state.windowStack=state.windowStack.slice(-OZ_MAX_BACK_STEPS);
  ++state.transitionToken;
  syncWindowLayers();pushOzanNavigation();
  const body=document.querySelector('#'+CSS.escape(id)+' .window__body');if(body)body.scrollTop=0;
}
function closeWindow(id=null,{skipHistory=false}={}){
  const target=id||state.windowStack.at(-1);
  if(!target||!state.windowStack.includes(target))return;
  ++state.transitionToken;
  const previous=state.windowStack[state.windowStack.lastIndexOf(target)-1];
  state.windowStack=state.windowStack.filter(x=>x!==target);
  // Top-level finance pages were launched from the drawer; × returns home, not a stale drawer.
  if(previous==='menuWindow'&&['myfntPaymentsWindow','myfntCustomersWindow'].includes(target)){
    state.windowStack=state.windowStack.filter(x=>x!=='menuWindow');
  }
  syncWindowLayers();
  // لا تستخدم history.back هنا: حدث popstate متأخر قد يغلق النافذة التالية أو يعيد القائمة.
  replaceOzanNavigation();
}
function closeAllWindows(){
  if(!state.windowStack.length)return;
  ++state.transitionToken;
  state.windowStack=[];syncWindowLayers();replaceOzanNavigation();
}
function switchWindow(id){openWindow(id);}
function showExitDialog(){const dialog=$('#ozExitDialog');if(!dialog)return;dialog.hidden=false;dialog.querySelector('#ozExitCancel')?.focus();}
function hideExitDialog(){const dialog=$('#ozExitDialog');if(dialog)dialog.hidden=true;}
function requestOzanExit(){
  hideExitDialog();
  // نتجاوز حالة الحراسة التي أضفناها؛ المتصفح وحده يقرر إمكان الرجوع خارج التطبيق.
  ozNavExiting=true;
  history.go(-(ozNavPosition+1));
}
function initExitDialog(){
  $('#ozExitCancel')?.addEventListener('click',hideExitDialog);
  $('#ozExitYes')?.addEventListener('click',requestOzanExit);
  $('#ozExitSync')?.addEventListener('click',async()=>{
    const btn=$('#ozExitSync');btn.disabled=true;
    try{const ok=await performRefresh({returnHome:false});if(ok)requestOzanExit();else showToast('لم تكتمل المزامنة؛ لم يتم الخروج','warning');}
    finally{btn.disabled=false;}
  });
}

// التنبيهات والثيم وعامل الخدمة
function showToast(message,type="success"){
  const t=$("#toast"), text=en(message), now=Date.now();
  if(showToast.lastText===text&&now-(showToast.lastAt||0)<1400)return;
  showToast.lastText=text;showToast.lastAt=now;
  const icon=type==="error"?"fa-circle-xmark":type==="warning"?"fa-circle-info":"fa-circle-check";
  t.setAttribute("role",type==="error"?"alert":"status");t.setAttribute("aria-live",type==="error"?"assertive":"polite");
  t.className=`toast toast--${type}`;t.innerHTML=`<i class="fa-solid ${icon}"></i><span>${escapeHtml(text)}</span>`;t.classList.add("is-show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("is-show"),2400);
}


function toggleTheme(){
  const nextTheme=document.documentElement.dataset.theme==="dark"?"light":"dark";
  uiSettingsRepo()?.mutateLocal?.(settings=>{settings.theme=nextTheme;},{profileEvent:false});
  document.documentElement.dataset.theme=uiSettingsRepo()?.get?.('theme')||nextTheme;
}
async function registerServiceWorker(){
  if(!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return null;
  try{
    const registration=await navigator.serviceWorker.register(`service-worker.js?v=2.14.18`,{scope:"./",updateViaCache:"none"});
    await navigator.serviceWorker.ready;
    return registration;
  }catch(error){
    console.error("[SW:register]",error);
    return null;
  }
}

// تحسين التاريخ وإمكانية الوصول والتحقق الذاتي
function formatDateInputDisplay(value){
  const raw=String(value||"").trim();
  const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return "";
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}`;
}
function syncDateDisplay(input){
  if(!input) return;
  const shell=input.closest(".date-picker-shell");
  const display=shell?.querySelector(".date-picker-display");
  if(display) display.textContent=formatDateInputDisplay(input.value)||"YYYY/M/D";
}
function refreshDateDisplays(root=document){
  root.querySelectorAll?.('input[type="date"].date-picker-native').forEach(syncDateDisplay);
}
function enhanceDateInputs(root=document){
  root.querySelectorAll?.('input[type="date"]:not(.date-picker-native)').forEach(input=>{
    const shell=document.createElement("span");
    shell.className="date-picker-shell";
    input.parentNode.insertBefore(shell,input);
    shell.appendChild(input);
    input.classList.add("date-picker-native");
    input.lang="en";
    input.setAttribute("inputmode","none");
    const display=document.createElement("span");
    display.className="date-picker-display";
    display.setAttribute("aria-hidden","true");
    shell.appendChild(display);
    const sync=()=>syncDateDisplay(input);
    input.addEventListener("input",sync);
    input.addEventListener("change",sync);
    input.addEventListener("blur",sync);
    sync();
  });
  root.addEventListener?.("reset",e=>{if(e.target instanceof HTMLFormElement)requestAnimationFrame(()=>refreshDateDisplays(e.target));},true);
}

function runtimeIntegrityCheck(){
  const checks={
    renderBookings:typeof renderBookings,
    scheduleTimelineCenter:typeof scheduleTimelineCenter,
    renderFilterState:typeof renderFilterState,
    createBookingCard:typeof createBookingCard,
    createAvailabilityCard:typeof createAvailabilityCard,
    bookingsForViewMonth:typeof bookingsForViewMonth,
    bookingsForCurrentFilter:typeof bookingsForCurrentFilter,
    bindEvents:typeof bindEvents
  };
  const missing=Object.entries(checks).filter(([,type])=>type!=="function").map(([name])=>name);
  if(missing.length){console.error("[OZAN:INTEGRITY] Missing runtime functions:",missing);document.documentElement.dataset.runtimeIntegrity="fail";return false;}
  document.documentElement.dataset.runtimeIntegrity="pass";
  return true;
}
function runCoreSelfTest(){
  const result={calendar:false,bookings:false,availability:false,card:false};
  try{result.calendar=Boolean(window.OzanCalendar&&typeof window.OzanCalendar.render==="function");}catch{}
  try{result.bookings=runtimeIntegrityCheck();}catch{}
  try{result.availability=createAvailabilityCard(isoDate(new Date())) instanceof HTMLElement;}catch{}
  try{
    const sample={id:"self-test",name:"اختبار",phone:"",date:isoDate(new Date()),type:"مناسبة",status:"confirmed",amount:1,paid:0,createdAt:Date.now()};
    result.card=createBookingCard(sample) instanceof HTMLElement;
  }catch{}
  const pass=Object.values(result).every(Boolean);
  document.documentElement.dataset.coreSelfTest=pass?"pass":"fail";
  console.info("[OZAN:SELF-TEST]",result);
  return pass;
}

