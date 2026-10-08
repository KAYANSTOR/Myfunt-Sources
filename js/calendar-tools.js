"use strict";
/* OZAN 1.9.7 — محرك موحد للتواريخ المتاحة.
   مصدر بيانات الدومين عبر BookingRepository؛ فتح النافذة يبدأ بالشهر الحالي،
   والتنقل من داخلها مستقل، وأي تغيير لشهر التقويم يُحدّثها تلقائياً. */
let ozAvailableDatesText="";
let ozAvailabilityMonth=null;
const ozAvailabilityStatus=new Set(["confirmed","pending","completed"]);

// تحويل التاريخ إلى أول يوم من الشهر دون التأثر بوقت الجهاز.
function availabilityMonthDate(value){
 const d=value instanceof Date?value:new Date();
 return Number.isFinite(d.getTime())?new Date(d.getFullYear(),d.getMonth(),1):new Date(new Date().getFullYear(),new Date().getMonth(),1);
}
// تُحسب الأيام بناء على البيانات الفعلية، مع استبعاد الملغى والمحذوف،
// وعدم احتساب أيام الشهر السابق حتى إن ظهرت ضمن شبكة التقويم.
function getAvailableMonthData(monthDate,bookings=window.MyfntRepositories?.bookings?.all?.()||[],todayDate=new Date()){
 const shown=availabilityMonthDate(monthDate),year=shown.getFullYear(),month=shown.getMonth();
 const today=isoDate(todayDate),busy=new Set();
 for(const b of Array.isArray(bookings)?bookings:[]){
  if(!b||typeof b.date!=="string"||!/^(\d{4})-(\d{2})-(\d{2})$/.test(b.date))continue;
  if(b.status==="cancelled"||b.status==="archived"||b.status==="deleted"||b.deletedAt||b.trashedAt||b.isDeleted)continue;
  // أي حالة غير ملغاة تحفظ انشغال اليوم، بما فيها الحالات القديمة المحتملة.
  busy.add(b.date);
 }
 const days=[],past=[],booked=[];
 for(let day=1,total=new Date(year,month+1,0).getDate();day<=total;day++){
  const date=new Date(year,month,day),iso=isoDate(date);
  if(iso<today){past.push(iso);continue;}
  if(busy.has(iso)){booked.push(iso);continue;}
  days.push({iso,label:`${WEEKDAY_AR[date.getDay()]} ${en(day)} ${MONTH_AR[month]} ${en(year)}`});
 }
 return {year,month,heading:`${MONTH_AR[month]} (${en(String(month+1).padStart(2,"0"))}) ${en(year)}`,days,pastCount:past.length,bookedCount:booked.length,
  total:new Date(year,month+1,0).getDate(),today};
}
function buildAvailableDatesText(){
 const data=getAvailableMonthData(ozAvailabilityMonth||new Date());
 const host=$("#availableDatesList"),label=$("#availableMonthLabel");
 if(label)label.textContent=data.heading;
 const company=window.MyfntRepositories?.settings?.get?.("company.name")||"مايفنت";
 const reason=data.pastCount===data.total?"هذا الشهر مضى بالكامل؛ انتقل إلى شهر قادم.":
  data.bookedCount?"لا توجد أيام خالية قادمة في هذا الشهر؛ اختر شهراً آخر.":"لا توجد أيام قادمة في هذا الشهر.";
 ozAvailableDatesText=`${company} — التواريخ المتاحة في ${data.heading}\n${data.days.length?data.days.map(d=>`• ${d.label}`).join("\n"):reason}\nملاحظة: التوافر قابل للتغيير.`;
 if(!host)return data;
 host.innerHTML=`<div class="oz-available-heading"><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> ${escapeHtml(data.heading)} · ${en(data.days.length)} يوم متاح</div><div class="oz-available-dates">${data.days.map(d=>`<div class="oz-available-day"><i class="fa-solid fa-calendar-day" aria-hidden="true"></i><span>${escapeHtml(d.label)}</span></div>`).join("")||`<div class="oz-available-empty"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>${reason}</span><button type="button" id="availableJumpBtn" class="secondary-btn"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> اختيار شهر آخر</button></div>`}</div>`;
 return data;
}
function syncAvailableDatesMonth(month,{force=false}={}){
 ozAvailabilityMonth=availabilityMonthDate(month);
 // النافذة المفتوحة تتبع التقويم في نفس اللحظة. لا داعي لرسم نافذة مغلقة.
 if(force||$("#availableDatesWindow")?.classList.contains("is-open"))buildAvailableDatesText();
}
function moveAvailabilityMonth(delta){
 const d=ozAvailabilityMonth||new Date();
 syncAvailableDatesMonth(new Date(d.getFullYear(),d.getMonth()+delta,1),{force:true});
}
async function copyAvailableDates(){
 buildAvailableDatesText();
 try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(ozAvailableDatesText);
 else{const t=document.createElement("textarea");t.value=ozAvailableDatesText;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();if(!document.execCommand("copy"))throw Error("COPY_UNAVAILABLE");t.remove();}
 showToast("تم نسخ تواريخ الشهر المعروض");}
 catch(e){showToast("تعذر النسخ؛ يمكنك استخدام زر المشاركة","warning");}
}
async function shareAvailableDates(){
 buildAvailableDatesText();
 try{if(navigator.share)await navigator.share({title:"التواريخ المتاحة",text:ozAvailableDatesText});else await copyAvailableDates();}
 catch(e){if(e.name!=="AbortError")showToast("تعذرت المشاركة، استخدم النسخ","warning");}
}
function renderMonthPicker(){
 const host=$("#monthPickerGrid"),now=new Date(),cur=state.viewDate;
 if(!host)return;
 host.innerHTML=[now.getFullYear(),now.getFullYear()+1].map(year=>`<section><h3>${en(year)}</h3><div class="oz-month-grid">${MONTH_AR.map((name,m)=>`<button type="button" class="oz-month-option ${cur.getFullYear()===year&&cur.getMonth()===m?"is-current":""}" data-year="${year}" data-month="${m}" aria-label="الانتقال إلى ${name} ${year}"><strong>${escapeHtml(name)}</strong><small>${en(String(m+1).padStart(2,"0"))}</small></button>`).join("")}</div></section>`).join("");
}
function initCalendarTools(){
 $("#availablePrevMonth")?.addEventListener("click",()=>moveAvailabilityMonth(-1));
 $("#availableNextMonth")?.addEventListener("click",()=>moveAvailabilityMonth(1));
 $("#availableDatesBtn")?.addEventListener("click",()=>{
   // عند كل فتح ابدأ بالشهر الحالي، حتى بعد التصفح اليدوي السابق.
   syncAvailableDatesMonth(state.viewDate||new Date(),{force:true});openWindow("availableDatesWindow");
 });
 $("#availableDatesList")?.addEventListener("click",e=>{if(e.target.closest("#availableJumpBtn")){renderMonthPicker();switchWindow("monthPickerWindow");}});
 $("#monthPickerBtn")?.addEventListener("click",()=>{renderMonthPicker();openWindow("monthPickerWindow");});
 $("#copyAvailableDates")?.addEventListener("click",copyAvailableDates);
 $("#shareAvailableDates")?.addEventListener("click",shareAvailableDates);
 $("#monthPickerGrid")?.addEventListener("click",event=>{
  const btn=event.target.closest("[data-year][data-month]");if(!btn)return;
  const year=Number(btn.dataset.year),month=Number(btn.dataset.month);
  if(!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11)return;
  state.viewDate=new Date(year,month,1);state.selectedDate="";state.hasExplicitDateSelection=false;
  state.viewFilter="all";state.renderLimit=40;state.timelinePositioned=false;
  renderCalendar();renderFilterState();renderBookings();syncAvailableDatesMonth(state.viewDate,{force:true});closeWindow("monthPickerWindow");
  showToast(`تم الانتقال إلى ${MONTH_AR[month]} ${en(year)}`);
 });
}
// نافذة يوم محدد: الحجوزات الفعلية وزر إضافة حجز آخر في الأسفل.
function openDayBookings(value){
 const heading=$("#dayBookingsTitle"),host=$("#dayBookingsList");if(!heading||!host)return;
 heading.textContent=formatDateLabel(value);host.replaceChildren();
 const records=(window.MyfntMonthData?.forDate?.(value)||[]).filter(b=>!["cancelled","archived"].includes(b.status)&&!b.deletedAt);
 const group=document.createDocumentFragment();records.forEach(b=>group.appendChild(createBookingCard(b)));
 host.appendChild(group);$("#dayBookingsAdd").dataset.date=value;openWindow("dayBookingsWindow");
}
function initDayBookings(){
 $("#dayBookingsList")?.addEventListener("click",e=>{
  const card=e.target.closest(".booking-card[data-id]");if(!card)return;
  const b=window.MyfntRepositories?.bookings?.get?.(card.dataset.id);if(b)openPreview(b);
 });
 $("#dayBookingsAdd")?.addEventListener("click",e=>{state.selectedDate=e.currentTarget.dataset.date;state.hasExplicitDateSelection=true;openBookingForm();});
}
