// OZAN V1.9.1 — assets/js/core.js
// النواة: إعدادات التطبيق وحالته والتخزين المحلي وأساسيات المزامنة
"use strict";

const APP_VERSION = "2.14.18";
const MF_DEFAULTS = window.MyfntDefaults || {};
const STORAGE_KEY = "ozan.bookings.v1";
const SETTINGS_KEY = "ozan.settings.v2";
const PACKAGES_KEY = "ozan.packages.v1";
const RECEIPTS_KEY = "ozan.receipts.v1";
const SPECIAL_DAYS_KEY = "ozan.special-days.v1";
const NOTIFICATION_READ_KEY = "ozan.notifications.read.v1";
const SYNC_AUDIT_KEY = "ozan.sync-audit.v1";
let installPromptEvent = null;

const WEEKDAY_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const STATUS = {
  confirmed: { label: "مؤكد", className: "status-badge--confirmed", icon: "fa-circle-check" },
  pending: { label: "مؤقت", className: "status-badge--pending", icon: "fa-clock" },
  cancelled: { label: "ملغي", className: "status-badge--cancelled", icon: "fa-circle-xmark" },
  completed: { label: "مكتمل", className: "status-badge--completed", icon: "fa-circle-check" },
  archived: { label: "مؤرشف", className: "status-badge--archived", icon: "fa-box-archive" }
};

// Fallback catalogue when no company activity is known yet. Signed-in workspaces use their activity catalogue.
const DEFAULT_PACKAGES = [
 {id:"p1",name:"العرض الأول",icon:"fa-star",price:0,seasonPrice:0,deposit:0,status:"active",builtIn:true,allowDoubleBooking:false,allowDiscount:true},
 {id:"p2",name:"العرض الثاني",icon:"fa-crown",price:0,seasonPrice:0,deposit:0,status:"active",builtIn:true,allowDoubleBooking:false,allowDiscount:true},
 {id:"p3",name:"العرض الثالث",icon:"fa-gem",price:0,seasonPrice:0,deposit:0,status:"active",builtIn:true,allowDoubleBooking:false,allowDiscount:true},
 {id:"p4",name:"العرض الرابع",icon:"fa-gift",price:0,seasonPrice:0,deposit:0,status:"active",builtIn:true,allowDoubleBooking:false,allowDiscount:true},
 {id:"p5",name:"العرض الخامس",icon:"fa-calendar-days",price:0,seasonPrice:0,deposit:0,status:"active",builtIn:true,allowDoubleBooking:false,allowDiscount:true}
];
function activityDefaultPackages(){
 try{
  const scope=window.OzanScope?.read?.(),raw=JSON.parse(localStorage.getItem('ozan.auth.demo.v1')||'null');
  const company=raw?.companies?.find(c=>c.id===scope?.companyId),activity=window.OzanAuthData?.businessTypes?.find(t=>t.id===company?.type);
  if(!activity?.packages?.length)return DEFAULT_PACKAGES;
  return activity.packages.map((entry,i)=>{const item=typeof entry==='string'?{name:entry,icon:'fa-star'}:entry;return {id:'p'+(i+1),name:item.name,icon:item.icon||'fa-star',price:0,seasonPrice:0,deposit:0,status:'active',builtIn:true,allowDoubleBooking:false,allowDiscount:true};});
 }catch{return DEFAULT_PACKAGES;}
}
function normalizePackages(list){
 const defaults=activityDefaultPackages(),source=Array.isArray(list)?list:[];
 const existing=new Map(source.filter(x=>x&&typeof x.id==="string"&&x.id).map(x=>[x.id,x]));
 const base=defaults.map(d=>({...d,...existing.get(d.id),id:d.id,builtIn:true,status:existing.get(d.id)?.status==="hidden"?"hidden":"active",allowDoubleBooking:Boolean(existing.get(d.id)?.allowDoubleBooking??d.allowDoubleBooking),allowDiscount:(existing.get(d.id)?.allowDiscount??d.allowDiscount)!==false}));
 const defaultIds=new Set(defaults.map(d=>d.id));
 const custom=source.filter(x=>x&&typeof x.id==="string"&&!defaultIds.has(x.id));
 return [...base,...custom.map(x=>({...x,builtIn:Boolean(x.builtIn),status:x.status==="hidden"?"hidden":"active",deposit:Number(x.deposit||0),allowDoubleBooking:Boolean(x.allowDoubleBooking),allowDiscount:x.allowDiscount!==false}))];
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// V2.9.3: another live tab changes the same account: freeze editing instead of
// silently overwriting its bookings, customer directory or financial journal.
// This protects against ordinary background-tab edits, NOT simultaneous cross-device writes.
const MyfntTabGuard=(()=>{
 const tracked=new Set(['ozan.bookings.v1','ozan.receipts.v1','ozan.customers.directory.v1',
  'ozan.finance.audit.v1','ozan.finance.journal.v1','ozan.finance.customers.v1',
  'ozan.packages.v1','ozan.settings.v2','ozan.special-days.v1']);
 let stale=false;
 const protectedKey=key=>tracked.has(key);
 const tabId=crypto?.randomUUID?.()||('tab-'+Math.random().toString(36).slice(2));
 const workspace=()=>String(window.OzanScope?.read?.()?.companyId||'');
 const SIGNAL='myfnt.tab-signal.v1';
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('myfnt-domain-v1'):null;
 function show(){
  if(document.getElementById('myfntStaleTab'))return;
  const root=document.createElement('div');root.id='myfntStaleTab';
  root.setAttribute('role','alertdialog');root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','تم تحديث البيانات في تبويب آخر');
  root.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(18,19,30,.88);direction:rtl;font-family:inherit';
  const panel=document.createElement('div');panel.style.cssText='max-width:420px;width:100%;padding:28px;border-radius:20px;background:#fff;color:#27222a;box-shadow:0 10px 35px #0005;text-align:center';
  const title=document.createElement('h2');title.textContent='البيانات تغيّرت في نافذة أخرى';
  const msg=document.createElement('p');msg.textContent='أوقفنا التعديلات في هذه النافذة حتى لا تُستبدل الحجوزات أو السندات ببيانات قديمة. أعد تحميل التطبيق لمتابعة العمل بأحدث البيانات.';
  const btn=document.createElement('button');btn.type='button';btn.textContent='إعادة تحميل البيانات';
  btn.style.cssText='padding:12px 20px;border:none;border-radius:12px;color:white;background:#C4014D;font:inherit;cursor:pointer';
  btn.addEventListener('click',()=>window.location.reload());panel.append(title,msg,btn);root.append(panel);document.body.append(root);btn.focus();
 }
 function markStale(){
  if(stale)return;stale=true;
  if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
 }
 window.addEventListener('storage',event=>{
  if(!event.key || event.key==='ozan.auth.session.v1')return;
  if(event.key===SIGNAL){try{const msg=JSON.parse(event.newValue||'null');if(msg?.sender!==tabId&&msg?.workspace===workspace())markStale();}catch{}return;}
  const key=[...tracked].find(k=>event.key===window.OzanScope?.scopedKey(k));
  if(key)markStale();
 });
 if(channel)channel.addEventListener('message',event=>{const msg=event.data||{};if(msg.sender===tabId||!msg.workspace||msg.workspace!==workspace())return;markStale();});
 function announce(kind='indexeddb-write'){const ws=workspace();if(!ws||stale)return;const msg={sender:tabId,workspace:ws,kind,at:Date.now()};try{channel?.postMessage(msg);}catch{}try{localStorage.setItem(SIGNAL,JSON.stringify(msg));}catch{}}
 return Object.freeze({isStale:()=>stale,protectedKey,announce,markStale});
})();
window.MyfntTabGuard=MyfntTabGuard;

// A memory-only write is never reported as durable. A failed booking/receipt save must roll back.
const safeStorage = {
  memory: new Map(),
  known: new Map(),
  get(key) {
    const scoped=window.OzanScope?.scopedKey(key)||key;
    if(this.memory.has(scoped))return this.memory.get(scoped);
    if(this.known.has(scoped))return this.known.get(scoped);
    try { const value=localStorage.getItem(scoped);this.known.set(scoped,value);return value; } catch { return null; }
  },
  set(key, value) {
    if(MyfntTabGuard.isStale()&&MyfntTabGuard.protectedKey(key))return false;
    const scoped=window.OzanScope?.scopedKey(key)||key;
    if(this.known.has(scoped)&&this.known.get(scoped)===value&&!this.memory.has(scoped))return true;
    try { localStorage.setItem(scoped,value);this.memory.delete(scoped);this.known.set(scoped,value);return true; }
    catch(error) { this.memory.set(scoped,value);this.known.delete(scoped);console.error('[OZAN storage] write failed; data is NOT durable',error?.name||'unknown');return false; }
  },
  remove(key) {
    if(MyfntTabGuard.isStale()&&MyfntTabGuard.protectedKey(key))return false;
    const scoped=window.OzanScope?.scopedKey(key)||key;this.memory.delete(scoped);this.known.delete(scoped);
    try { localStorage.removeItem(scoped);return true; } catch { return false; }
  },
  invalidate(scopedKey){if(scopedKey)this.known.delete(scopedKey);else this.known.clear();}
};
window.addEventListener('storage',event=>{if(event.key)safeStorage.invalidate(event.key);else safeStorage.invalidate();});

const state = {
  viewDate: startOfMonth(new Date()),
  selectedDate: "",
  bookings: [],
  customers: [],
  packages: [],
  receipts: [],
  specialDays: [],
  settings: {
    theme: MF_DEFAULTS.theme || "light",
    season: structuredClone(MF_DEFAULTS.season || { enabled: true, name: "موسم", start: `${new Date().getFullYear()}-03-10`, end: `${new Date().getFullYear()}-09-30` }),
    reminders: [...(MF_DEFAULTS.reminderDays || [10, 7, 3, 1, 0])],
    company: { name: "مايفنت", logo: "", description: "", phone: "", phone2: "", addresses: MF_DEFAULTS.defaultAddress || "الجمهورية اليمنية صنعاء", terms: "", receiptNotes: "", notifyTime: MF_DEFAULTS.notifyTime || "09:00", sms: "", whatsapp: "" },
    sync: { lastAt: 0, mode: "local", endpoint: MF_DEFAULTS.apiEndpoint || "/api/v1" },
    preferences:{currency:MF_DEFAULTS.currency||"YER",calendar:MF_DEFAULTS.calendar||"gregorian",language:MF_DEFAULTS.language||"ar",syncMode:MF_DEFAULTS.syncMode||"manual",backupHour:"03:00"},
    alertTemplates:null,
    bookingUi: { calendarPinned: false, calendarCollapsed: false, requireExactDeposit: false, allowBookingOverpayment: false, allowReceiptOverRemaining: false, showAddress: false, requiredFields: { name: true, phone: false, date: true, package: false, amount: false, paid: false, notes: false, address: false }, showHijri: true, showDaysRemaining: true, showAvailability: true, showAmountWords: true, showClockButton: true, showTodayButton: true, showNearestButton: true, showNotes: true }
  },
  viewFilter: "all",
  renderLimit: 40,
  searchTimer: null,
  swipeStart: null,
  isSwiping: false,
  activeBookingId: null,
  windowStack: [],
  notificationRead: new Set(),
  notificationReadAt: {},
  suppressCalendarClickUntil: 0,
  lastCreatedBookingId: null,
  refreshBusy: false,
  timelinePositioned: false,
  hasExplicitDateSelection: false,
  transitionToken: 0, syncAudit: { lastAt:0, simulated:[], pending:[] }
};

/* ---------- English digits everywhere ---------- */
function toEnglishDigits(value = "") {
  return String(value)
    .replace(/[٠-٩]/g, d => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, d => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);
}
function en(value = "") { return toEnglishDigits(value); }
function numberText(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value || 0));
}
function normalizeNumericInput(input) {
  const next = toEnglishDigits(input.value);
  if (next !== input.value) input.value = next;
}

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function parseIso(value) {
  const [y,m,d] = String(value).split("-").map(Number);
  return new Date(y, m-1, d);
}
function uid(prefix="id") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function escapeHtml(value="") {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function formatAppDate(value, options={}) {
  if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return "—";
  const d=parseIso(value); if(Number.isNaN(d.getTime())) return "—";
  const cfg={weekday:true,monthName:true,monthNumber:true,year:true,...options};
  const parts=[];
  if(cfg.weekday) parts.push(WEEKDAY_AR[d.getDay()]);
  parts.push(en(d.getDate()));
  if(cfg.monthName) parts.push(MONTH_AR[d.getMonth()]);
  if(cfg.monthNumber) parts.push(`(${en(d.getMonth()+1)})`);
  if(cfg.year) parts.push(en(d.getFullYear()));
  return parts.join(" ");
}
function formatDateLabel(value) { return formatAppDate(value); }
function formatGregorianDate(value) { return formatAppDate(value,{weekday:false}); }
function formatHijriDate(value) {
  try {
    const d=parseIso(value);
    const longParts=new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).formatToParts(d);
    const pick=t=>longParts.find(x=>x.type===t)?.value||"";
    const monthNo=new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura",{month:"numeric"}).format(d);
    return `${en(pick("day"))} ${pick("month")} (${en(monthNo)}) ${en(pick("year"))} هـ`.replace(/\s+/g," ").trim();
  } catch { return "التاريخ الهجري غير متاح"; }
}

function daysFromToday(value) {
  const a = parseIso(isoDate(new Date()));
  const b = parseIso(value);
  return Math.round((b-a)/86400000);
}
function formatAuditTimestamp(value){
  const d=new Date(Number(value||0)); if(Number.isNaN(d.getTime())) return "—";
  return `${WEEKDAY_AR[d.getDay()]} ${en(d.getDate())} ${MONTH_AR[d.getMonth()]} (${en(d.getMonth()+1)}) ${en(d.getFullYear())} · ${en(String(d.getHours()).padStart(2,"0"))}:${en(String(d.getMinutes()).padStart(2,"0"))}`;
}

function bookingWord(count) {
  if (count === 0) return "0 حجوزات";
  if (count === 1) return "حجز واحد";
  if (count === 2) return "حجزان";
  if (count >= 3 && count <= 10) return `${en(count)} حجوزات`;
  return `${en(count)} حجز`;
}
function normalizeSearch(value="") {
  return toEnglishDigits(value).toLowerCase().replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ًٌٍَُِّْـ]/g,"").replace(/\s+/g," ").trim();
}
// الموسم سنوي: نأخذ الشهر واليوم فقط، ويعمل حتى مع مواسم تعبر نهاية السنة.
function isSeasonDate(value) {
  const s=state.settings.season;
  if(!s?.enabled || !/^\d{4}-\d{2}-\d{2}$/.test(value||"") || !s.start || !s.end)return false;
  const day=value.slice(5),start=String(s.start).slice(5),end=String(s.end).slice(5);
  return start<=end ? day>=start&&day<=end : day>=start||day<=end;
}
function activeBookingsOnDate(value, ignoreId="") {
  return (window.MyfntRepositories?.bookings?.all?.()||state.bookings).filter(b => b.date === value && b.id !== ignoreId && b.status !== "cancelled");
}
function getSpecialDay(value) {
 const days=window.MyfntRepositories?.specialDays?.all?.()||state.specialDays;
 return days.find(x=>x.date===value||
  (x.kind==="range"&&value>=x.from&&value<=x.to)||
  (x.kind==="weekday"&&(!x.from||value>=x.from)&&(!x.to||value<=x.to)&&Array.isArray(x.weekdays)&&x.weekdays.includes(parseIso(value).getDay())))||null;
}
const CURRENCIES={YER:"ريال يمني",SAR:"ريال سعودي",USD:"دولار أمريكي"};
function currencyLabel(b){const code=state.settings?.preferences?.currency||b?.currency||"YER";return CURRENCIES[code]||CURRENCIES.YER;}
function remainingFor(booking) { return Math.max(0, Number(booking.amount || 0) - Number(booking.paid || 0)); }
// تحويل المبالغ الصحيحة إلى كلمات عربية، مع فصل اسم العملة عن الحساب المالي.
function amountWords(value, currency="YER") {
 const n=Number(value);if(!Number.isFinite(n)||n<0)return "—";
 const singular={YER:"ريال يمني",SAR:"ريال سعودي",USD:"دولار أمريكي"}[currency]||"ريال يمني";
 const ones=["","واحد","اثنان","ثلاثة","أربعة","خمسة","ستة","سبعة","ثمانية","تسعة"];
 const tens=["","عشرة","عشرون","ثلاثون","أربعون","خمسون","ستون","سبعون","ثمانون","تسعون"];
 const teens=["عشرة","أحد عشر","اثنا عشر","ثلاثة عشر","أربعة عشر","خمسة عشر","ستة عشر","سبعة عشر","ثمانية عشر","تسعة عشر"];
 const hundreds=["","مائة","مائتان","ثلاثمائة","أربعمائة","خمسمائة","ستمائة","سبعمائة","ثمانمائة","تسعمائة"];
 const and=arr=>arr.filter(Boolean).join(" و");
 function belowThousand(x){const h=Math.floor(x/100),r=x%100;
  const tail=r<10?ones[r]:r<20?teens[r-10]:and([ones[r%10],tens[Math.floor(r/10)]]);
  return and([hundreds[h],tail]);
 }
 function whole(x){if(x===0)return "صفر";const groups=[];
  for(const [div,single,dual,plural] of [[1000000000,"مليار","ملياران","مليارات"],[1000000,"مليون","مليونان","ملايين"],[1000,"ألف","ألفان","آلاف"]]){
   const part=Math.floor(x/div);x%=div;if(!part)continue;
   groups.push(part===1?single:part===2?dual:part<=10?belowThousand(part)+" "+plural:belowThousand(part)+" "+single);
  }
  if(x)groups.push(belowThousand(x));return and(groups);
 }
 // لا نحذف الأجزاء الكسرية بصمت: نعبر عنها بفلسين/سنتين عند وجودها.
 const units=Math.floor(n),fraction=Math.round((n-units)*100);
 if(units>999999999999)return numberText(n)+" "+singular;
 const fractionName=currency==="USD"?"سنت":"هللة";
 return whole(units)+" "+singular+(fraction?" و"+whole(fraction)+" "+fractionName:"");
}
function bookingDeposit(b){if(b?.pricingSnapshot && Number.isSafeInteger(Number(b.pricingSnapshot.depositRequired)))return Number(b.pricingSnapshot.depositRequired);if(Number.isSafeInteger(Number(b?.depositRequired))&&Number(b.depositRequired)>0)return Number(b.depositRequired);const p=state.packages.find(p=>p.id===b?.packageId)||state.packages.find(p=>p.name===b?.type);return p?Number(p.deposit||0):null;}

function isValidBookingNumber(value){
  const digits=toEnglishDigits(String(value||"" )).replace(/\D/g,"");
  return /^[1-9]\d*$/.test(digits);
}
function allocateBookingNumber(){
  return window.MyfntSequences?.nextBooking?.()||String(Math.max(0,...(window.MyfntRepositories?.bookings?.all?.()||state.bookings).map(b=>Number(b.bookingNo)||0))+1);
}
function ensureBookingNumbers(list=[]){
  // R14 migration is completed after customers/finance load so all visible sequences
  // can be renumbered together. Here we only normalize valid positive references.
  let changed=false;const used=new Set(),pending=[],out=[];
  for(const booking of list){const b={...booking};const digits=toEnglishDigits(String(b.bookingNo||"")).replace(/\D/g,"");
    if(isValidBookingNumber(digits)&&!used.has(digits)){b.bookingNo=String(Number(digits));used.add(b.bookingNo);}else{b.bookingNo="";pending.push(b);changed=true;}out.push(b);}
  let next=1;for(const b of pending){while(used.has(String(next)))next++;b.bookingNo=String(next++);used.add(b.bookingNo);}
  return {list:out,changed};
}
function nextBookingNumber(){return allocateBookingNumber();}
function bookingNumberFor(booking){const digits=toEnglishDigits(String(booking?.bookingNo||"")).replace(/\D/g,"");return isValidBookingNumber(digits)?String(Number(digits)):"—";}

function normalizeBooking(raw) {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.name || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date || "")) return null;
  let status = raw.status === "tentative" ? "pending" : raw.status;
  if (!STATUS[status]) status = "confirmed";
  return {
    id: String(raw.id), bookingNo: raw.bookingNo ? toEnglishDigits(String(raw.bookingNo)) : "", name: String(raw.name||"").trim(), phone: toEnglishDigits(String(raw.phone||"").trim()), address: String(raw.address||"").trim().slice(0,300),
    date: raw.date, type: String(raw.type||"مناسبة خاصة"), packageId: String(raw.packageId||""), status,
    hasTime:Boolean(raw.hasTime),timeFrom:String(raw.timeFrom||"09:00"),timeTo:String(raw.timeTo||"21:00"),annualRepeat:Boolean(raw.annualRepeat),currency:CURRENCIES[String(raw.currency||"YER")]?String(raw.currency||"YER"):"YER",externalCalendarUid:String(raw.externalCalendarUid||""),
    amount: Number(raw.amount||0), paid: Number(raw.paid||0), notes: String(raw.notes||""), customerId:String(raw.customerId||""), pricingSnapshot:raw.pricingSnapshot&&typeof raw.pricingSnapshot==="object"?{...raw.pricingSnapshot}:null,
    adjustments:Array.isArray(raw.adjustments)?raw.adjustments.filter(x=>x&&["add","discount"].includes(x.kind)&&Number.isFinite(Number(x.value))&&Number(x.value)>0).slice(-100).map(x=>({kind:x.kind,value:Number(x.value),reason:String(x.reason||"").slice(0,200),at:Number(x.at||0)})):[],
    temporaryHours: [12,24,48].includes(Number(raw.temporaryHours)) ? Number(raw.temporaryHours) : 24,
    temporaryExpiresAt: Number(raw.temporaryExpiresAt||0),
    depositPending:status==="pending"&&Boolean(raw.depositPending),depositRequired:Number.isFinite(Number(raw.depositRequired))&&Number(raw.depositRequired)>=0?Number(raw.depositRequired):0,depositPackageId:String(raw.depositPackageId||""),
    userId:String(raw.userId||""), companyId:String(raw.companyId||""),
    createdBy: String(raw.createdBy||"المستخدم المحلي"), createdAt: Number(raw.createdAt||Date.now()), updatedAt: Number(raw.updatedAt||raw.createdAt||Date.now()),
    serverVersion: Number(raw.serverVersion||0), syncStatus:String(raw.syncStatus||((Number(raw.serverVersion||0)>0)?'synced':'local'))
  };
}


function dedupeBookings(list=[]){
  const byId=new Map();
  for(const raw of list){ const b=normalizeBooking(raw); if(!b)continue; const prev=byId.get(b.id); if(!prev||b.updatedAt>=prev.updatedAt)byId.set(b.id,b); }
  // Different IDs are distinct transactions, even if all visible fields happen to match.
  return [...byId.values()].sort((a,b)=>a.createdAt-b.createdAt);
}
const OZ_DEFAULT_SETTINGS=JSON.parse(JSON.stringify(state.settings));
function loadState({readOnly=false}={}) {
  state.settings=JSON.parse(JSON.stringify(OZ_DEFAULT_SETTINGS));
  state.syncAudit={lastAt:0,simulated:[],pending:[]};
  // Step 21B fresh-start: domain arrays are hydrated from IndexedDB after shell startup.
  state.bookings = [];
  try { const x = JSON.parse(safeStorage.get(PACKAGES_KEY)||"[]"); state.packages = normalizePackages(x); } catch { state.packages = normalizePackages([]); }
  // Freeze the current interpretation of legacy bookings once. No historical catalogue prices
  // can be reconstructed if the old file did not record them. Preserve the agreed booking amount.
  let migratedHistoricalPricing=false;
  for(const b of state.bookings){
    if(b.pricingSnapshot)continue;
    const p=state.packages.find(x=>x.id===b.packageId)||state.packages.find(x=>x.name===b.type);
    b.pricingSnapshot={packageId:b.packageId,packageName:b.type,listPrice:b.amount,
      depositRequired:b.depositPending?b.depositRequired:(b.depositRequired>0?b.depositRequired:Number(p?.deposit||0)),
      currency:b.currency,source:'legacy-migration-current-reference-unverified',effectiveAt:Date.now()};
    migratedHistoricalPricing=true;
  }
  if(migratedHistoricalPricing&&!readOnly)saveBookings();
  state.receipts = []; // hydrated from IndexedDB
  try { const x = JSON.parse(safeStorage.get(SPECIAL_DAYS_KEY)||"[]"); state.specialDays = Array.isArray(x) ? x : []; } catch { state.specialDays = []; }
  try {
    const x = JSON.parse(safeStorage.get(SETTINGS_KEY)||"{}");
    state.settings = {
      theme: x.theme === "dark" ? "dark" : "light",
      season: (x.season?.start&&x.season?.end)
        ? { ...state.settings.season, ...x.season }
        : { ...state.settings.season, ...x.season, enabled:true, start:state.settings.season.start, end:state.settings.season.end },
      reminders: Array.isArray(x.reminders) && x.reminders.length >= 1 ? x.reminders.map(Number) : state.settings.reminders,
      company: { ...state.settings.company, ...(x.company||{}) },
      sync: { ...state.settings.sync, ...(x.sync||{}) },
      preferences:{...state.settings.preferences,...(x.preferences||{})},
      alertTemplates:Array.isArray(x.alertTemplates)?x.alertTemplates:state.settings.alertTemplates,
      bookingUi: {
        ...state.settings.bookingUi,
        ...(x.bookingUi||{}),
        requiredFields: { ...state.settings.bookingUi.requiredFields, ...(x.bookingUi?.requiredFields||{}) }
      }
    };
  } catch {}
  // تغيير اسم القالب القديم فقط؛ لا نمسّ أسماء المؤسسات التي اختارها المستخدم.
  if(!state.settings.company.name || state.settings.company.name==='ماي بوك برو للمناسبات')
    state.settings.company.name='مايفنت';
  try { const x = JSON.parse(safeStorage.get(NOTIFICATION_READ_KEY)||"[]"); state.notificationRead = new Set(Array.isArray(x) ? x : []); } catch { state.notificationRead = new Set(); }
  // ترقية تدريجية: الإشعارات المقروءة قديماً لا نختلق لها وقت قراءة سابقاً.
  try { const x = JSON.parse(safeStorage.get(NOTIFICATION_READ_AT_KEY)||"{}"); state.notificationReadAt=x&&typeof x==="object"&&!Array.isArray(x)?x:{}; } catch {state.notificationReadAt={};}
  for(const id of state.notificationRead) if(!state.notificationReadAt[id])state.notificationReadAt[id]={at:Date.now()};
  if(!readOnly)saveNotificationRead();
  try { const log=JSON.parse(safeStorage.get(SYNC_AUDIT_KEY)||"null"); if(log&&typeof log==="object")state.syncAudit={...state.syncAudit,...log}; } catch {}
  document.documentElement.dataset.theme = state.settings.theme;
}
// V2.10.3 Step 21B: checkpoint only after a durable write, coalescing customer/booking/receipt
// changes in one quiet-time IndexedDB emergency snapshot. Existing full mirror
// remains a fallback if the offline module is not yet loaded.
function scheduleLocalCheckpoint(){
 // One persistence gateway for legacy durable writes. MyfntOffline owns the
 // emergency checkpoint and delegates normalization to MyfntLocal.
 if(window.MyfntOffline?.requestCheckpoint)window.MyfntOffline.requestCheckpoint();
 else if(window.MyfntOffline?.scheduleSnapshot)window.MyfntOffline.scheduleSnapshot();
 else window.MyfntOffline?.requestCheckpoint?.();
}
function saveBookings(){
  // Step 21B: never serialize the full booking array to localStorage.
  // Specific booking commits are durable before UI success; bulk legacy callers
  // fall back to an idle IndexedDB reconcile.
  window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;
  window.MyfntOffline?.requestCheckpoint?.();
  if(typeof buildAvailableDatesText==="function"&&document.getElementById("availableDatesWindow")?.classList.contains("is-open"))queueMicrotask(buildAvailableDatesText);
  return true;
}
function markBookingPending(booking){
  if(!booking)return;
  booking.syncStatus='pending';
  const list=Array.isArray(state.syncAudit.pending)?state.syncAudit.pending:[];
  state.syncAudit.pending=[...list.filter(x=>x.id!==booking.id),{id:booking.id,name:booking.name,date:booking.date,at:Date.now()}].slice(-300);
  saveSyncAudit();
}
function saveSyncAudit(){safeStorage.set(SYNC_AUDIT_KEY,JSON.stringify(state.syncAudit));}
function savePackages(){
 // 2.14.18: compatibility shadow only. IndexedDB booking_packages is authoritative.
 const saved=safeStorage.set(PACKAGES_KEY, JSON.stringify(state.packages));
 if(saved===false)console.warn('[Myfnt legacy shadow] packages LocalStorage write failed; IndexedDB remains authoritative');
 queueMicrotask(()=>{document.dispatchEvent(new CustomEvent('ozan:packages-updated'));document.dispatchEvent(new Event('ozan:profile-updated'));});
 return saved;
}
function saveReceipts(){
  // Payments are persisted atomically through MyfntLocal.recordOne/commitBookingAggregate.
  window.MyfntOffline?.requestCheckpoint?.();
  return true;
}
function saveSpecialDays(){ const saved=safeStorage.set(SPECIAL_DAYS_KEY, JSON.stringify(state.specialDays));if(saved===false)console.warn('[Myfnt legacy shadow] specialDays LocalStorage write failed; IndexedDB remains authoritative');return saved; }
function saveSettings({sync=false,profileEvent=true}={}){ const persisted=JSON.parse(JSON.stringify(state.settings));if(String(persisted?.company?.logo||'').startsWith('blob:'))persisted.company.logo='';const saved=safeStorage.set(SETTINGS_KEY, JSON.stringify(persisted));if(saved===false)console.warn('[Myfnt legacy shadow] settings LocalStorage write failed; IndexedDB remains authoritative');if(sync)console.warn('[Myfnt authority] saveSettings(sync=true) is deprecated; use settingsRepository().mutateDurable()');if(profileEvent)queueMicrotask(()=>document.dispatchEvent(new Event('ozan:profile-updated')));return saved; }
const NOTIFICATION_READ_AT_KEY="ozan.notifications.read-at.v1";
// حفظ توقيت القراءة ونص الإشعار لتمكين الحذف بعد 24 ساعة فقط إذا أُنجز الإجراء.
function markNotificationRead(notification){
 if(!notification)return;
 state.notificationRead.add(notification.id);
 if(!state.notificationReadAt[notification.id])state.notificationReadAt[notification.id]={at:Date.now(),snapshot:{...notification}};
 else if(!state.notificationReadAt[notification.id].snapshot)state.notificationReadAt[notification.id].snapshot={...notification};
 saveNotificationRead();
}
function saveNotificationRead(){
 const ids=[...state.notificationRead].slice(-1000);safeStorage.set(NOTIFICATION_READ_KEY,JSON.stringify(ids));
 const kept=Object.fromEntries(Object.entries(state.notificationReadAt||{}).filter(([id])=>state.notificationRead.has(id)).slice(-1000));
 safeStorage.set(NOTIFICATION_READ_AT_KEY,JSON.stringify(kept));
}


function normalizePhone(value="") {
  let digits = toEnglishDigits(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith("7")) digits = "967" + digits;
  return digits;
}
function displayPhone(value="") { const d=normalizePhone(value); return d.startsWith("967")&&d.length===12?d.slice(3):d; }
function phoneE164(value="") { const d=normalizePhone(value); return d?`+${d}`:""; }
function validPhone(value="") { const d=normalizePhone(value); return !d || /^\d{7,15}$/.test(d); }
window.MyfntPhone=Object.freeze({normalize:normalizePhone,digits:normalizePhone,display:displayPhone,e164:phoneE164});
function renderAppIdentity(){
 const title=state.settings.company?.name?.trim()||'مايفنت';
 const el=$('#appCompanyName');
 if(el){
   let label=[...el.childNodes].find(node=>node.nodeType===3);
   if(!label){label=document.createTextNode('');el.prepend(label);}
   label.nodeValue=title+' ';
   if(!el.querySelector('i')){const icon=document.createElement('i');icon.className='fa-solid fa-cloud-arrow-up';icon.setAttribute('aria-hidden','true');el.append(icon);}
 }
 document.title=title;
}
function renderConnectionStatus(){
  const online=navigator.onLine;
  const o=$("#onlineStatus"), sy=$("#syncStatus");
  if(o){o.classList.toggle("is-offline",!online);o.innerHTML=`<i class="fa-solid ${online?"fa-wifi":"fa-circle-xmark"}"></i> ${online?"متصل":"بدون إنترنت"}`;}
  if(sy){const last=Number(state.settings.sync?.lastAt||0),mode=String(state.settings.sync?.mode||'');const label=state.refreshBusy?(window.MyfntSync?.enabled?.()?"جاري المزامنة":"جاري التحديث"):last?(mode==='server'?"مزامن مع الخادم":"بيانات محلية محدثة"):"بيانات محلية";sy.innerHTML=`<i class="fa-solid fa-cloud"></i> ${label}`;}
}
async function performRefresh({returnHome=false}={}){
  if(state.refreshBusy)return;
  state.refreshBusy=true;document.body.classList.add("oz-sync-loading");
  const btn=$("#refreshBtn");btn?.classList.add("is-loading");btn?.setAttribute("aria-busy","true");renderConnectionStatus();
  try{
    if(!navigator.onLine){showToast("لا يوجد اتصال: بياناتك محفوظة محليًا وستتم المزامنة عند عودة الإنترنت","warning");}
    else if(window.MyfntSync?.enabled?.()){
      // Refresh is never Bootstrap/Reimport: push pending local operations as one batch, then pull after the saved cursor.
      const result=await window.MyfntSync.syncCycle({pushLimit:50,pullLimit:250});
      const pushed=Number(result?.push?.processed||0),pulled=Number(result?.pull?.pulled||0);
      const conflicts=Number(result?.pull?.conflicts||0)+(result?.push?.results||[]).filter(x=>x?.status==='conflict').length;
      const at=Date.now();state.syncAudit.lastAt=at;saveSyncAudit();state.settings.sync.lastAt=at;state.settings.sync.mode='server';
      await window.MyfntRepositories?.settings?.mutateDurable?.(cfg=>{cfg.sync={...(cfg.sync||{}),lastAt:at,mode:'server'};},{profileEvent:false});
      window.MyfntOffline?.display?.();
      showToast(conflicts?`تمت المزامنة مع ${conflicts} تعارض يحتاج مراجعة.`:`تمت المزامنة · رفع ${pushed} تغيير · استلام ${pulled} تغيير.`,conflicts?'warning':'success');
    }else{
      // Static/mock fallback: refresh local UI only. Never drain the production sync queue.
      const response=await window.OzanApi.sync({bookings:state.bookings.length,updatedAt:Date.now()});
      if(!response?.ok)throw new Error("SYNC_MOCK_FAILED");
      const pending=state.syncAudit.pending||[];state.syncAudit.simulated=[...pending].reverse().slice(0,50);
      state.syncAudit.lastAt=Date.now();saveSyncAudit();state.settings.sync.lastAt=state.syncAudit.lastAt;state.settings.sync.mode="mock";
      window.MyfntOffline?.display?.();showToast(`تم تحديث العرض المحلي. ${pending.length} عملية تنتظر ربط Laravel؛ لم تُرسل البيانات إلى الإنترنت.`);
    }
    if(state.settings.bookingUi?.calendarCollapsed)setCalendarCollapsed(false);
    const now=new Date();state.viewDate=startOfMonth(now);state.selectedDate="";state.hasExplicitDateSelection=false;state.viewFilter="all";state.renderLimit=40;state.timelinePositioned=true;
    renderAll();renderSyncWindow();if(typeof syncAvailableDatesMonth==="function")syncAvailableDatesMonth(state.viewDate);window.OzanCalendar?.syncCollapsedState?.();window.OzanSounds?.play(navigator.onLine?"sync":"warning");
    if(returnHome)closeAllWindows();
    requestAnimationFrame(()=>{if(document.body.classList.contains("calendar-pinned"))$("#bookingList")?.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});else{window.scrollTo({top:0,behavior:"smooth"});document.scrollingElement?.scrollTo({top:0,behavior:"smooth"});}});
    return navigator.onLine;
  }catch(error){console.error("[MYFNT:refresh]",error);showToast(error?.message||"تعذرت المزامنة؛ بقيت البيانات المحلية محفوظة","warning");return false;}
  finally{state.refreshBusy=false;document.body.classList.remove("oz-sync-loading");btn?.classList.remove("is-loading");btn?.removeAttribute("aria-busy");renderConnectionStatus();}
}
