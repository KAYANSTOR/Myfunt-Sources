"use strict";
/* OZAN 1.9.9 — إدارة مستقلة للباقات والأيام المميزة والتقويم والتصدير. جميع البيانات محلية. */
(() => {
 const root=window, KEY='ozan.advanced.usage.v1', MAX=25;
 const iconNames=('1 2 3 4 5 6 7 8 9 calendar-days calendar-check calendar-plus calendar-week microphone microphone-lines music compact-disc headphones drum guitar radio record-vinyl volume-high camera image palette wand-magic-sparkles cake-candles gift gifts heart star crown gem trophy medal award ticket tag house building hotel users user-group people-group utensils mug-hot wallet coins money-bill-wave file-invoice receipt').split(' ');
 let editingPackage='', editingSpecial='', adminQuick='all', table={page:1,sort:'date',asc:true,query:'',from:'',to:'',month:'',year:'',status:'',pkg:''}, usage={};
 const planAllows=name=>{const p=window.MyfntPlans;if(!p?.current?.())return true;return p.allowed(name);};
 const el=id=>document.getElementById(id), esc=v=>escapeHtml(v==null?'':String(v));
 const persistUsage=()=>{try{safeStorage.set(KEY,JSON.stringify(usage));}catch{}};
 const metrics=(kind,delta=1)=>{usage[kind]=(usage[kind]||0)+delta;persistUsage();};
 const dateString=()=>isoDate(new Date());
 const money=b=>new Intl.NumberFormat('en-US').format(Number(b||0));
 const bookingRepo=()=>window.MyfntRepositories?.bookings||null;
 const bookings=()=>bookingRepo()?.all?.()||[];
 const customerRepo=()=>window.MyfntRepositories?.customers||null;
 const customers=()=>customerRepo()?.all?.()||[];
 const paymentRepo=()=>window.MyfntRepositories?.payments||null;
 const receipts=()=>paymentRepo()?.all?.()||[];
 const packageRepo=()=>window.MyfntRepositories?.packages||null;
 const packages=()=>packageRepo()?.all?.()||[];
 const settingsRepo=()=>window.MyfntRepositories?.settings||null;
 const settings=()=>settingsRepo()?.all?.()||{};
 const specialRepo=()=>window.MyfntRepositories?.specialDays||null;
 const specialDays=()=>specialRepo()?.all?.()||[];
 const alertRepo=()=>window.MyfntRepositories?.alerts||null;
 const save=()=>{const chosen=el('packageChips')?.querySelector('.is-active')?.dataset.packageId||'';try{const p=packageRepo()?.get?.(chosen)||packages().find(x=>x.id===chosen);renderPackageChips(p?.name||'',chosen);if(el('bookingWindow')?.classList.contains('is-open'))syncSelectedPackagePricing('admin');}catch{};};
 function packageRecord(){return packageRepo()?.get?.(editingPackage)||packages().find(x=>x.id===editingPackage)||null;}
 function packageOptions(selected=''){return packages().map(p=>`<option value="${esc(p.id)}" ${selected===p.id?'selected':''}>${esc(p.name)}</option>`).join('');}
 function iconButtons(selected='fa-star'){
  const current=String(selected||'fa-star').replace(/^fa-/,'');const choices=iconNames.includes(current)?iconNames:[current,...iconNames];
  return `<input type="hidden" name="icon" value="${esc(selected)}"><div class="oz-a-icon-grid oz-a-icon-grid--event" role="group" aria-label="اختر أيقونة الباقة">${choices.map((i,index)=>`<button type="button" class="oz-icon-choice${'fa-'+i===selected?' is-active':''}" data-package-icon="fa-${esc(i)}" aria-pressed="${'fa-'+i===selected?'true':'false'}" title="${esc(i)}"><span class="oz-icon-order">${index+1}</span><i class="fa-solid fa-${esc(i)}" aria-hidden="true"></i></button>`).join('')}</div>`;
 }
 function renderPackages(){
  const host=el('ozPackageEditor'), list=el('packagesList');if(!host||!list)return;
  const p=packageRecord();
  const visible=packages().filter(x=>x.status!=='hidden').length,hidden=packages().length-visible;
  host.innerHTML=`<div class="ozpkg-toolbar"><div><strong><i class="fa-solid fa-boxes-stacked"></i> ${packages().length} باقة</strong><small>${visible} ظاهرة · ${hidden} مخفية</small></div><button type="button" class="ozm-btn ozm-btn-primary ozpkg-add" data-oz-add-package><i class="fa-solid fa-plus"></i> إضافة باقة</button></div><p class="oz-a-help">الباقات الافتراضية لا تُحذف؛ يمكن إخفاؤها. حالة «مخفية» تمنع ظهور الباقة في الحجز الجديد مع بقاء الحجوزات السابقة كما هي.</p>`;
  const modal=el('ozPackageDialog');
  if(modal&&!modal.hidden)modal.querySelector('.ozpkg-dialog-content').innerHTML=`<form id="ozPackageForm" class="oz-a-form ozpkg-compact-form"><div class="ozpkg-form-title"><div class="ozpkg-form-icon"><i class="fa-solid ${esc(p?.icon||'fa-box-open')}"></i></div><div><h3>${p?'تعديل الباقة':'إضافة باقة'}</h3><small>${p?.builtIn?'باقة افتراضية · يمكن إخفاؤها ولا يمكن حذفها':'باقة مخصصة للنشاط'}</small></div></div><label class="ozpkg-name">اسم الباقة<input name="name" required maxlength="80" value="${esc(p?.name||'')}"></label><div class="ozpkg-money-grid"><label>غير الموسم<input name="price" type="number" min="0" step="1" value="${Number(p?.price||0)}"></label><label>الموسم<input name="seasonPrice" type="number" min="0" step="1" value="${Number(p?.seasonPrice||0)}"></label><label>العربون<input name="deposit" type="number" min="0" step="1" value="${Number(p?.deposit||0)}"></label><label>العملة<select name="currency">${Object.entries(CURRENCIES).map(([code,name])=>`<option value="${code}" ${(p?.currency||settings().preferences?.currency||'YER')===code?'selected':''}>${esc(name)}</option>`).join('')}</select></label></div><input type="hidden" name="status" value="${p?.status==='hidden'?'hidden':'active'}"><div class="ozpkg-status-choice" role="group" aria-label="ظهور الباقة"><span>ظهور الباقة</span><button type="button" class="ozpkg-status-btn ${p?.status!=='hidden'?'is-active':''}" data-package-status="active" aria-pressed="${p?.status!=='hidden'?'true':'false'}"><b><i class="fa-solid fa-eye"></i> ظاهرة</b></button><button type="button" class="ozpkg-status-btn ${p?.status==='hidden'?'is-active':''}" data-package-status="hidden" aria-pressed="${p?.status==='hidden'?'true':'false'}"><b><i class="fa-solid fa-eye-slash"></i> مخفية</b></button></div><div class="ozpkg-rules ozpkg-rules--compact"><label class="oz-option"><span><i class="fa-solid fa-clone"></i><b>الحجز المزدوج</b><small>أكثر من حجز لنفس الباقة والتاريخ</small></span><input name="allowDoubleBooking" type="checkbox" ${p?.allowDoubleBooking?'checked':''}></label><label class="oz-option"><span><i class="fa-solid fa-tag"></i><b>السماح بالخصم</b><small>تمكين خصم مبلغ لهذه الباقة</small></span><input name="allowDiscount" type="checkbox" ${p?.allowDiscount!==false?'checked':''}></label></div><details class="ozpkg-icon-picker"><summary><span><i class="fa-solid ${esc(p?.icon||'fa-star')}"></i> أيقونة الباقة</span><small>اضغط للتغيير</small></summary>${iconButtons(p?.icon||'fa-star')}</details><p class="myfnt-warning ozpkg-warning" role="alert"><i class="fa-solid fa-circle-info"></i> السعر والعربون الجديدان يطبقان على الحجوزات الجديدة فقط.</p><div class="oz-a-actions ozpkg-actions"><button class="primary-btn" type="submit"><i class="fa-solid fa-floppy-disk"></i> ${p?'حفظ':'إضافة'}</button><button class="secondary-btn" type="button" data-oz-clear-package>إلغاء</button></div></form>`;
  list.innerHTML=packages().map(x=>{const hidden=x.status==='hidden';return `<article class="ozpkg-card ${hidden?'is-hidden':'is-visible'}"><div class="ozpkg-card__icon"><i class="fa-solid ${esc(x.icon||'fa-star')}"></i></div><div class="ozpkg-card__main"><div class="ozpkg-card__title"><strong>${esc(x.name)}</strong><span class="ozpkg-state ${hidden?'is-off':'is-on'}"><i class="fa-solid fa-${hidden?'eye-slash':'eye'}"></i>${hidden?'مخفية':'ظاهرة'}</span>${x.builtIn?'<span class="ozpkg-default"><i class="fa-solid fa-shield"></i> افتراضية</span>':'<span class="ozpkg-custom">مضافة</span>'}</div><div class="ozpkg-card__money"><span><small>غير الموسم</small><b>${money(x.price)} ${esc(CURRENCIES[x.currency||'YER'])}</b></span><span><small>الموسم</small><b>${money(x.seasonPrice)} ${esc(CURRENCIES[x.currency||'YER'])}</b></span><span><small>العربون</small><b>${money(x.deposit)} ${esc(CURRENCIES[x.currency||'YER'])}</b></span></div><div class="ozpkg-card__rules"><span class="${x.allowDoubleBooking?'yes':'no'}"><i class="fa-solid fa-clone"></i>${x.allowDoubleBooking?'حجز مزدوج':'حجز واحد'}</span><span class="${x.allowDiscount!==false?'yes':'no'}"><i class="fa-solid fa-tag"></i>${x.allowDiscount!==false?'الخصم مسموح':'بدون خصم'}</span></div></div><div class="ozpkg-card__actions"><button class="mini-icon-btn" data-oz-edit-pkg="${esc(x.id)}" title="تعديل"><i class="fa-solid fa-pen"></i></button><button class="mini-icon-btn" data-oz-toggle-pkg="${esc(x.id)}" title="${hidden?'إظهار':'إخفاء'}"><i class="fa-solid fa-${hidden?'eye':'eye-slash'}"></i></button>${x.builtIn?'':`<button class="mini-icon-btn oz-quiet-danger" data-oz-delete-pkg="${esc(x.id)}" title="حذف"><i class="fa-solid fa-trash"></i></button>`}</div></article>`}).join('');
 }
 // نموذج الباقات المنبثق: إدارة التركيز والإغلاق عبر Escape والعودة لزر الفتح.
 let packageDialogOpener=null;
 function openPackageDialog(id=''){
  editingPackage=id;
  const modal=el('ozPackageDialog');if(!modal)return;
  packageDialogOpener=document.activeElement;
  modal.hidden=false;modal.setAttribute('aria-hidden','false');
  renderPackages();
  modal.querySelector('[name=name]')?.focus({preventScroll:true});
 }
 function closePackageDialog(){
  const modal=el('ozPackageDialog');if(!modal)return;
  modal.hidden=true;modal.setAttribute('aria-hidden','true');editingPackage='';
  if(packageDialogOpener?.isConnected)packageDialogOpener.focus({preventScroll:true});
 }
 async function storePackage(form){if(window.MyfntAccess?.requireWrite?.())return;
  const data=new FormData(form), name=String(data.get('name')||'').trim(),icon=String(data.get('icon')||'fa-star');
  if(!name||!/^fa-[a-z0-9-]+$/i.test(icon)){showToast('اختر اسماً وأيقونة صالحة','warning');return;}
  if(packages().some(p=>p.id!==editingPackage&&normalizeSearch(p.name)===normalizeSearch(name))){showToast('الباقة موجودة','warning');return;}
  const current=packageRecord();if(!current&&packages().length>=15){await ozWarn('الحد الأقصى 15 باقة لكل شركة؛ أخف الباقات غير المستخدمة بدل حذف المرتبطة بحجوزات');return;}
  const record={...(current||{}),id:current?.id||uid('pkg'),name,icon,price:Math.max(0,Number(data.get('price')||0)),seasonPrice:Math.max(0,Number(data.get('seasonPrice')||0)),deposit:Math.max(0,Number(data.get('deposit')||0)),currency:String(data.get('currency')||current?.currency||settings().preferences?.currency||'YER'),status:data.get('status')==='hidden'?'hidden':'active',builtIn:!!current?.builtIn,allowDoubleBooking:data.get('allowDoubleBooking')==='on',allowDiscount:data.get('allowDiscount')==='on'};
  for(const k of ['price','seasonPrice','deposit'])if(!Number.isSafeInteger(Number(data.get(k)))||Number(data.get(k))<0){await ozWarn('الأسعار والعربون يجب أن تكون أرقامًا صحيحة غير سالبة');return;}
  if(!CURRENCIES[record.currency]){await ozWarn('عملة غير مدعومة');return;}
  const prior=current?JSON.stringify(current):'';
  if(!await ozConfirm('تحذير شديد: هذه الأسعار والعربون سيتم اعتمادها للحجوزات الجديدة فقط. أي تغيير لاحق لا يطبَّق بأثر رجعي على الحجوزات السابقة. هل راجعت الأسعار والعملة ووافقت؟',{title:'اعتماد أسعار الباقة نهائيًا للحجوزات الجديدة',danger:true,confirmLabel:'نعم، اعتماد'}))return;
  try{if(current)await packageRepo()?.mutateDurable?.(current.id,item=>Object.assign(item,record),{operation:'update'});else await packageRepo()?.addDurable?.(record);}catch(err){console.error('[package durable save]',err);if(current)Object.assign(current,JSON.parse(prior));await ozWarn('فشل الحفظ الدائم؛ لم يتم اعتماد الباقة');return;}
  document.dispatchEvent(new CustomEvent('myfnt:package-saved',{detail:{id:record.id,kind:current?'update':'create'}}));
  editingPackage='';closePackageDialog();save();renderPackages();metrics('packageEdits');showToast('تم حفظ الباقة');
 }
 /* تصدير ICS بدلاً من ICO؛ ICS صيغة تقويم، وJSON التفصيلي يُحفظ في DESCRIPTION. */
 const icsEscape=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const icsLine=line=>{const bytes=[...line];let out='',pos=0;for(const c of bytes){const n=new TextEncoder().encode(c).length;if(pos+n>70){out+='\r\n ';pos=1;}out+=c;pos+=n;}return out;};
 const compactDate=v=>String(v).replaceAll('-','');
 const dateTime=(day,hm)=>compactDate(day)+'T'+String(hm||'09:00').replace(':','').padEnd(4,'0')+'00';
 function bookingCalendarEvent(b){
  const pkg=packages().find(p=>p.id===b.packageId),time=Boolean(b.hasTime),title=b.name+' - '+(b.type||pkg?.name||'حجز');
  const details={schema:'ozan-calendar-event-v1',bookingId:b.id,number:b.bookingNo,client:{name:b.name,phone:b.phone},package:{id:b.packageId,name:b.type||pkg?.name},status:b.status,date:b.date,allDay:!time,timeFrom:time?b.timeFrom:null,timeTo:time?b.timeTo:null,repeat:b.annualRepeat?'yearly':'none',amount:b.amount,paid:b.paid,currency:b.currency||"YER",remaining:remainingFor(b),address:b.address||'',adjustments:b.adjustments||[],notes:b.notes,alertPolicy:{localHour:'21:00',daysBefore:[10,3,1]}};
  const dtStart=time?`DTSTART:${dateTime(b.date,b.timeFrom)}`:`DTSTART;VALUE=DATE:${compactDate(b.date)}`;
  let dtEnd;
  if(time){let d=b.date;if((b.timeTo||'21:00')<=(b.timeFrom||'09:00')){const next=parseIso(b.date);next.setDate(next.getDate()+1);d=isoDate(next);}dtEnd=`DTEND:${dateTime(d,b.timeTo)}`;}
  else{const next=parseIso(b.date);next.setDate(next.getDate()+1);dtEnd=`DTEND;VALUE=DATE:${compactDate(isoDate(next))}`;}
  // النسب من بداية حدث الساعة 09:00 أو 00:00: تنبيه 21:00 في اليوم المحدد قبل الحدث.
  const shiftHours=time?(Number((b.timeFrom||'09:00').slice(0,2))+Number((b.timeFrom||'09:00').slice(3,5))/60):0;
  const alarms=[10,3,1].map(days=>{const hrs=days*24+shiftHours-21;if(hrs<0)return '';let preceding=Math.floor(hrs/24),remainder=hrs%24;const mins=Math.round(remainder*60);return `BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:${icsEscape('تذكير: '+title)}\nTRIGGER:-P${preceding?preceding+'D':''}${mins?'T'+(Math.floor(mins/60)?Math.floor(mins/60)+'H':'')+(mins%60?mins%60+'M':''):''}\nEND:VALARM`;}).join('\n');
  const event=['BEGIN:VEVENT','UID:'+String(b.id).replace(/[^a-zA-Z0-9-]/g,'-')+'@ozan.local','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'').replace('Z','Z'),dtStart,dtEnd,'SUMMARY:'+icsEscape(title),'DESCRIPTION:'+icsEscape(JSON.stringify(details)),b.annualRepeat?'RRULE:FREQ=YEARLY':'',alarms,'END:VEVENT'].filter(Boolean).join('\n');return event.split('\n').map(icsLine).join('\r\n');
 }
 function exportICS(records){const gate=window.MyfntFeatureGate?.check?.('exports_monthly_limit',{message:'تم بلوغ حد التصدير الشهري لخطتك'});if(gate&&!gate.ok){showToast(gate.message,'warning');return false;}const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//OZAN//Smart Booking//AR','CALSCALE:GREGORIAN','METHOD:PUBLISH',...records.filter(b=>b.status!=='cancelled').map(bookingCalendarEvent),'END:VCALENDAR'].join('\r\n')+'\r\n';downloadBlob(new Blob([body],{type:'text/calendar;charset=utf-8'}),`myevent-${records.length===1?(records[0].bookingNo||'event'):'calendar'}-${dateString()}.ics`);window.MyfntFeatureGate?.consume?.('exports_monthly_limit',1);metrics('calendarExports');return true;}
 const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 const fields=[['bookingNo','رقم الحجز'],['id','المعرف'],['name','اسم العميل'],['phone','الهاتف'],['address','عنوان المناسبة'],['date','التاريخ'],['timeFrom','من الساعة'],['timeTo','إلى الساعة'],['hasTime','وقت محدد'],['packageId','معرف الباقة'],['type','نوع الباقة'],['status','حالة الحجز'],['amount','المبلغ'],['paid','المدفوع'],['adjustments','تفاصيل الخصم والإضافة JSON'],['notes','الملاحظات'],['temporaryHours','مدة الحجز المؤقت'],['annualRepeat','التكرار السنوي'],['currency','العملة']];
 const csv=rows=>'\uFEFF'+[fields.map(x=>csvCell(x[1])).join(','),...rows.map(b=>fields.map(x=>csvCell(x[0]==='adjustments'?JSON.stringify(b.adjustments||[]):b[x[0]])).join(','))].join('\r\n');

 // استيراد تقويم iCalendar محدود بحقول VEVENT الأساسية؛ يُتحقق من التاريخ والمعرف قبل الدمج.
 const unfoldICS=text=>text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
 const icsUnescape=v=>String(v||'').replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
 const parseCalDate=v=>{const x=String(v||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);return x?{date:`${x[1]}-${x[2]}-${x[3]}`,time:x[4]?`${x[4]}:${x[5]}`:null}:null;};
 async function importICS(file){
  if(!file||file.size>3e6)throw Error('الملف أكبر من الحد المسموح');
  const text=await file.text();if(!text.includes('BEGIN:VCALENDAR'))throw Error('ملف التقويم غير صالح');
  const lines=unfoldICS(text),blocks=[];let current=null;
  for(const line of lines){if(line==='BEGIN:VEVENT'){current=[];continue;}if(line==='END:VEVENT'){if(current)blocks.push(current);current=null;continue;}if(current)current.push(line);}
  if(!blocks.length)throw Error('لم يُعثر على أحداث');
  const incoming=[];
  for(const block of blocks){
   const get=key=>{const line=block.find(x=>x.startsWith(key+':')||x.startsWith(key+';'));return line?line.slice(line.indexOf(':')+1):'';};
   const rawStart=get('DTSTART'),rawEnd=get('DTEND'),start=parseCalDate(rawStart),end=parseCalDate(rawEnd),uidExternal=get('UID');
   if(!start||Number.isNaN(parseIso(start.date).getTime())||!uidExternal)continue;
   let data={};try{const desc=icsUnescape(get('DESCRIPTION'));const first=desc.indexOf('{');if(first>=0)data=JSON.parse(desc.slice(first));}catch{}
   const title=icsUnescape(get('SUMMARY'))||'حجز مستورد';
   const hasTime=!!start.time;
   const b=normalizeBooking({id:data.bookingId||uid('cal'),bookingNo:'',name:data.client?.name||title,phone:data.client?.phone||'',date:start.date,type:data.package?.name||'مناسبة',packageId:data.package?.id||'',status:STATUS[data.status]?data.status:'confirmed',amount:Number(data.amount||0),paid:Number(data.paid||0),currency:data.currency||"YER",address:data.address||'',adjustments:data.adjustments||[],notes:data.notes||'',hasTime,timeFrom:start.time||'09:00',timeTo:end?.time||'21:00',annualRepeat:block.some(x=>x.startsWith('RRULE:')&&x.includes('FREQ=YEARLY')),externalCalendarUid:uidExternal,createdAt:Date.now(),updatedAt:Date.now()});
   if(b)incoming.push(b);
  }
  if(!incoming.length)throw Error('لا توجد أحداث بتاريخ قابل للقراءة');
  const known=new Set(bookings().map(b=>b.externalCalendarUid).filter(Boolean)),ids=new Set(bookings().map(b=>b.id));const selected=incoming.filter(b=>!known.has(b.externalCalendarUid)&&!ids.has(b.id));
  if(!selected.length){showToast('كل الأحداث مستوردة من قبل');return;}
  const importGate=window.MyfntFeatureGate?.check?.('imports_monthly_limit',{message:'تم بلوغ حد الاستيراد الشهري لخطتك'});if(importGate&&!importGate.ok)return showToast(importGate.message,'warning');const bookingGate=window.MyfntFeatureGate?.checkCount?.('bookings_limit',bookings().length,{delta:selected.length,message:'الاستيراد يتجاوز عدد الحجوزات المسموح في خطتك'});if(bookingGate&&!bookingGate.ok)return showToast(bookingGate.message,'warning');if(!await ozConfirm(`استيراد ${selected.length} حدثًا كتسجيلات حجز محلية؟ راجع التواريخ والساعات بعد الاستيراد.`,{title:"استيراد أحداث التقويم"}))return;
  bookingRepo()?.replaceLocal?.(dedupeBookings([...bookings(),...selected]),{persist:false});window.MyfntSequences?.migrate?.({force:true});saveBookings();window.MyfntOffline?.reconcile?.({reason:'import',enqueue:false});window.MyfntFeatureGate?.consume?.('imports_monthly_limit',1);renderAll();renderAdmin();metrics('calendarImports');showToast('تم استيراد '+selected.length+' حدثًا');
 }
 // فلاتر سريعة لا تغيّر البيانات ولا تؤثر على معرّفات الحجوزات.
 function adminQuickMatch(b){
  const today=dateString(),active=b.status!=='cancelled';
  if(adminQuick==='upcoming')return active&&b.date>=today;
  if(adminQuick==='past')return active&&b.date<today;
  if(adminQuick==='due')return active&&remainingFor(b)>0;
  if(adminQuick==='today')return active&&b.date===today;
  if(adminQuick==='cancelled')return !active;
  return true;
 }
 function resetAdminFilters(){adminQuick='all';table={page:1,sort:'date',asc:false,query:'',from:'',to:'',month:'',year:'',status:'',pkg:''};}
 const rowsFiltered=()=>bookings().filter(b=>(!table.query||normalizeSearch([b.name,b.phone,b.bookingNo,b.type,b.packageId].join(' ')).includes(normalizeSearch(table.query)))&&(!table.from||b.date>=table.from)&&(!table.to||b.date<=table.to)&&(!table.month||Number(b.date.slice(5,7))===Number(table.month))&&(!table.year||b.date.slice(0,4)===table.year)&&(!table.status||b.status===table.status)&&(!table.pkg||b.packageId===table.pkg)&&adminQuickMatch(b)).sort((a,b)=>{const av=table.sort==='remaining'?remainingFor(a):a[table.sort]??'',bv=table.sort==='remaining'?remainingFor(b):b[table.sort]??'';return (typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'ar',{numeric:true}))*(table.asc?1:-1);});
 const sortable=[['date','التاريخ'],['name','العميل'],['packageId','الباقة'],['amount','المبلغ'],['paid','المدفوع'],['remaining','المتبقي'],['status','الحالة']];
 function renderAdmin(){
  const host=el('ozAdminTools'),sum=el('adminSummary'),list=el('adminBookingsList');if(!host||!sum||!list)return;
  const rows=rowsFiltered(),today=dateString(),active=rows.filter(b=>b.status!=='cancelled');
  const amountByCurrency=new Map(),paidByCurrency=new Map(),remainingByCurrency=new Map(),pkgCounts=new Map();
  for(const b of active){const c=b.currency||'YER';amountByCurrency.set(c,(amountByCurrency.get(c)||0)+Number(b.amount||0));paidByCurrency.set(c,(paidByCurrency.get(c)||0)+Number(b.paid||0));remainingByCurrency.set(c,(remainingByCurrency.get(c)||0)+remainingFor(b));pkgCounts.set(b.packageId,(pkgCounts.get(b.packageId)||0)+1);}
  const currencyLines=map=>[...map.entries()].map(([code,n])=>`<span class="ozm-money-line"><b>${money(n)}</b> <small>${esc(CURRENCIES[code]||code)}</small></span>`).join('')||'<b>0</b>';
  const stat=(icon,title,value,detail='',klass='')=>`<article class="ozm-stat ${klass}"><span class="ozm-stat-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><div class="ozm-stat-content"><span class="ozm-stat-label">${title}</span><strong>${value}</strong>${detail?`<small>${detail}</small>`:''}</div></article>`;
  sum.classList.add('ozm-dashboard');
  sum.innerHTML=`${stat('fa-clipboard-list','الحجوزات المطابقة',money(rows.length),'وفق الفلاتر المحددة')}${stat('fa-calendar-day','القادمة',money(active.filter(b=>b.date>=today).length),'من اليوم فصاعدًا','ozm-upcoming')}${stat('fa-hourglass-end','الماضية',money(active.filter(b=>b.date<today).length),'دون الحجوزات الملغاة')}${stat('fa-calendar-xmark','الملغاة',money(rows.filter(b=>b.status==='cancelled').length),'ضمن النتائج الحالية')}${stat('fa-chart-line','إجمالي قيمة الحجوزات',currencyLines(amountByCurrency),'من دون تحويل العملات','ozm-wide')}${stat('fa-coins','إجمالي المدفوع',currencyLines(paidByCurrency),'لكل عملة على حدة','ozm-wide')}${stat('fa-file-invoice-dollar','المبالغ المتبقية',currencyLines(remainingByCurrency),'للحجوزات غير الملغاة','ozm-wide')}`;
  const pageCount=Math.ceil(rows.length/MAX);table.page=Math.min(Math.max(1,table.page),Math.max(1,pageCount));
  const quicks=[['all','fa-layer-group','الكل'],['today','fa-sun','اليوم'],['upcoming','fa-calendar-days','القادمة'],['past','fa-clock-rotate-left','المنتهية'],['due','fa-wallet','غير المسددة'],['cancelled','fa-ban','الملغاة']];
  const bookingRows=bookings();
  const quickCounts={all:bookingRows.length,today:bookingRows.filter(b=>b.status!=='cancelled'&&b.date===today).length,upcoming:bookingRows.filter(b=>b.status!=='cancelled'&&b.date>=today).length,past:bookingRows.filter(b=>b.status!=='cancelled'&&b.date<today).length,due:bookingRows.filter(b=>b.status!=='cancelled'&&remainingFor(b)>0).length,cancelled:bookingRows.filter(b=>b.status==='cancelled').length};
  host.innerHTML=`<div class="ozm-panel">
   <div class="ozm-toolbar"><div><div class="ozm-overline"><i class="fa-solid fa-sliders" aria-hidden="true"></i> مركز الإدارة</div><h3>استكشف الحجوزات</h3><p>فلاتر دقيقة وإحصاءات تتحدث وفق اختياراتك</p></div><div class="ozm-toolbar-actions"><button type="button" class="ozm-btn ozm-btn-ghost" data-oz-reset aria-label="إعادة جميع الفلاتر للوضع الافتراضي"><i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i> إعادة الافتراضي</button><button type="button" class="ozm-btn ozm-btn-primary" data-oz-show-all><i class="fa-solid fa-layer-group" aria-hidden="true"></i> عرض الكل</button></div></div>
   <div class="ozm-chips" role="group" aria-label="تصفية الحجوزات السريعة">${quicks.map(([key,icon,label])=>`<button type="button" data-oz-quick="${key}" class="ozm-chip ${adminQuick===key?'is-active':''}" aria-pressed="${adminQuick===key}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span><b>${money(quickCounts[key])}</b></button>`).join('')}</div>
   <div class="ozm-filters"><label class="ozm-search"><span><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> البحث الموحد</span><input id="ozAdminSearch" type="search" enterkeyhint="search" autocomplete="off" placeholder="الاسم، الهاتف، رقم الحجز أو الباقة" value="${esc(table.query)}"></label>
   <label><span>من تاريخ</span><input type="date" data-oz-filter="from" value="${esc(table.from)}"></label><label><span>إلى تاريخ</span><input type="date" data-oz-filter="to" value="${esc(table.to)}"></label>
   <label><span>الشهر</span><select data-oz-filter="month"><option value="">جميع الأشهر</option>${MONTH_AR.map((m,i)=>`<option value="${i+1}" ${table.month==i+1?'selected':''}>${esc(m)}</option>`).join('')}</select></label>
   <label><span>السنة</span><select data-oz-filter="year"><option value="">جميع السنوات</option>${[...new Set(bookings().map(b=>String(b.date||'').slice(0,4)).filter(x=>/^\d{4}$/.test(x)))].sort().reverse().map(y=>`<option value="${esc(y)}" ${y===table.year?'selected':''}>${esc(y)}</option>`).join('')}</select></label>
   <label><span>حالة الحجز</span><select data-oz-filter="status"><option value="">جميع الحالات</option>${Object.keys(STATUS).map(k=>`<option value="${k}" ${k===table.status?'selected':''}>${esc(STATUS[k].label)}</option>`).join('')}</select></label>
   <label><span>الباقة</span><select data-oz-filter="pkg"><option value="">جميع الباقات</option>${packageOptions(table.pkg)}</select></label></div>
   <div class="ozm-package-head"><span><i class="fa-solid fa-boxes-stacked" aria-hidden="true"></i> الحجوزات حسب الباقة</span><small>انقر على باقة لتصفية النتائج</small></div>
   <div class="ozm-package-chips">${packages().map(p=>`<button type="button" class="ozm-package-chip ${table.pkg===p.id?'is-active':''}" data-oz-package="${esc(p.id)}" aria-pressed="${table.pkg===p.id}"><i class="fa-solid ${esc(p.icon||'fa-star')}" aria-hidden="true"></i><span>${esc(p.name)}</span><b>${pkgCounts.get(p.id)||0}</b></button>`).join('')}</div>
   <details class="ozm-export"><summary><span><i class="fa-solid fa-file-export" aria-hidden="true"></i> التصدير والاستيراد <small>Excel، CSV، تقويم، نسخة احتياطية</small></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><div class="ozm-export-actions">
   <button type="button" data-oz-export="backup"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> نسخة احتياطية JSON</button><button type="button" data-oz-export="xlsx"><i class="fa-solid fa-file-excel" aria-hidden="true"></i> تصدير Excel</button><button type="button" data-oz-export="csv"><i class="fa-solid fa-file-csv" aria-hidden="true"></i> تصدير CSV</button><button type="button" data-oz-export="ics"><i class="fa-solid fa-calendar-plus" aria-hidden="true"></i> تصدير التقويم ICS</button><button type="button" data-oz-template><i class="fa-solid fa-file-circle-plus" aria-hidden="true"></i> نموذج الاستيراد</button><label><i class="fa-solid fa-file-import" aria-hidden="true"></i> استيراد CSV<input type="file" id="ozCsvImport" accept=".csv,text/csv" hidden></label><label><i class="fa-solid fa-file-import" aria-hidden="true"></i> استيراد Excel<input type="file" id="ozXlsxImport" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label><label><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> استيراد ICS<input type="file" id="ozIcsImport" accept=".ics,text/calendar" hidden></label></div><div id="ozExcelProgress" class="ozm-excel-progress" role="status" aria-live="polite" hidden><div class="ozm-excel-progress__head"><i class="fa-solid fa-file-excel" aria-hidden="true"></i><span id="ozExcelProgressLabel">جاري تجهيز ملف Excel…</span></div><progress id="ozExcelProgressBar" max="100" value="0" aria-label="تقدم تصدير Excel"></progress></div><p class="ozm-note">تطبق الفلاتر على صادرات Excel وCSV وICS. النسخة الاحتياطية JSON تشمل جميع بيانات النظام المحلية بصرف النظر عن الفلاتر.</p></details>
   </div>`;
  const cols=[['date','التاريخ'],['name','العميل'],['packageId','الباقة'],['amount','المبلغ'],['paid','المدفوع'],['remaining','المتبقي'],['status','الحالة']];
  list.innerHTML=`<div class="ozm-results-header"><div><h3><i class="fa-solid fa-list-check" aria-hidden="true"></i> سجل الحجوزات</h3><p>عرض ${rows.length?((table.page-1)*MAX+1):0}–${Math.min(table.page*MAX,rows.length)} من أصل ${rows.length} حجز</p></div><span class="ozm-count">${money(rows.length)} نتيجة</span></div><div class="oz-a-table-wrap ozm-table-wrap"><table class="oz-a-table ozm-table"><thead><tr>${cols.map(([key,label])=>`<th scope="col"><button type="button" data-oz-sort="${key}" aria-label="فرز ${label} ${table.sort===key?(table.asc?'تنازليًا':'تصاعديًا'):'تصاعديًا'}" aria-sort="${table.sort===key?(table.asc?'ascending':'descending'):'none'}">${label}<i class="fa-solid fa-${table.sort===key?(table.asc?'arrow-up':'arrow-down'):'sort'}" aria-hidden="true"></i></button></th>`).join('')}<th scope="col">الإجراء</th></tr></thead><tbody>${rows.slice((table.page-1)*MAX,table.page*MAX).map(b=>{const pkg=packages().find(p=>p.id===b.packageId),vals=[b.date,b.name,b.type||pkg?.name,money(b.amount),money(b.paid),money(remainingFor(b)),STATUS[b.status]?.label||b.status],remaining=remainingFor(b);return `<tr>${vals.map((v,i)=>`<td data-label="${cols[i][1]}" ${i===1?'class="ozm-name"':i===5&&remaining>0?'class="ozm-due"':''}>${i===6?`<span class="ozm-status ${b.status==='cancelled'?'is-cancelled':b.date<today?'is-past':'is-next'}">${esc(v)}</span>`:esc(v)}</td>`).join('')}<td data-label="الإجراء"><button type="button" data-oz-open="${esc(b.id)}" class="ozm-open"><i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> معاينة</button></td></tr>`;}).join('')||'<tr class="ozm-empty"><td colspan="8"><i class="fa-solid fa-filter-circle-xmark" aria-hidden="true"></i><strong>لا توجد حجوزات مطابقة</strong><span>جرّب عرض الكل أو تغيير الفلاتر.</span></td></tr>'}</tbody></table></div>${pageCount>1?`<nav class="oz-a-pages ozm-pages" aria-label="صفحات الحجوزات"><button type="button" data-oz-page="prev" ${table.page===1?'disabled':''} aria-label="الصفحة السابقة"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i> السابق</button><span>صفحة <b>${table.page}</b> من <b>${pageCount}</b></span><button type="button" data-oz-page="next" ${table.page===pageCount?'disabled':''} aria-label="الصفحة التالية">التالي <i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button></nav>`:''}`;
 }
 // تصدير Excel: يعتمد على مكتبة JSZip المحلية مع تقدم حقيقي لضغط المصنف.
 async function exportExcel(rows,onProgress){
  if(!window.OzanExcel||!window.JSZip)throw Error('مكتبة Excel غير متاحة. تحقق من assets/js/excel-export.js وjszip.min.js');
  const list=Array.isArray(rows)?rows:[];
  await window.OzanExcel.exportWorkbook({rows:list,fields,filename:`myevent-bookings-${dateString()}.xlsx`,onProgress});
  metrics('excelExports');
 }
 // يمنع تكرار النقر ويعرض مرحلة تجهيز الملف وضغطه ثم بدء التنزيل.
 let excelBusy=false;
 async function runExcelExport(button,rows){
  if(excelBusy)return;
  excelBusy=true;
  const box=el('ozExcelProgress'),bar=el('ozExcelProgressBar'),label=el('ozExcelProgressLabel');
  const buttons=[...document.querySelectorAll('[data-oz-export="xlsx"],[data-oz-template]')];
  buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');});
  if(box)box.hidden=false;
  const update=(percent,message)=>{if(bar)bar.value=Math.max(0,Math.min(100,Math.round(percent)));if(label)label.textContent=message;};
  try{
   update(0,'بدء تجهيز ملف Excel…');
   const gate=window.MyfntFeatureGate?.check?.('exports_monthly_limit',{message:'تم بلوغ حد التصدير الشهري لخطتك'});if(gate&&!gate.ok)throw Error(gate.message);
   await exportExcel(rows,update);
   window.MyfntFeatureGate?.consume?.('exports_monthly_limit',1);
   update(100,'تم تجهيز الملف وبدء التنزيل بنجاح');
   showToast('تم تجهيز Excel وبدأ تنزيل الملف');
  }catch(error){
   update(0,'تعذر التصدير: '+(error?.message||'خطأ غير معروف'));
   showToast('فشل تصدير Excel: '+(error?.message||''),'warning');
  }finally{excelBusy=false;buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy');});}
 }
 async function importCSV(file){if(!window.MyfntFeatureGate?.require?.('excel_import_enabled',{message:'الاستيراد غير متاح في خطتك الحالية'}))return;const importGate=window.MyfntFeatureGate?.check?.('imports_monthly_limit',{message:'تم بلوغ حد الاستيراد الشهري لخطتك'});if(importGate&&!importGate.ok)return showToast(importGate.message,'warning');if(!file||file.size>8e6){showToast('ملف كبير أو غير صالح','warning');return;}
  let s=(await file.text()).replace(/^\uFEFF/,'');const lines=s.split(/\r?\n/).filter(Boolean);
  // CSV متعدد الأسطر والحقول المحاطة باقتباس: استخدم محللًا صغيرًا يدعم علامات الاقتباس.
  const cells=[],all=[];let val='',quoted=false,row=[];for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){val+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(val);val='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(val);if(row.some(Boolean))all.push(row);row=[];val='';}else val+=c;}row.push(val);if(row.some(Boolean))all.push(row);
  const headers=all.shift()||[],ix=fields.map(([,ar])=>headers.indexOf(ar));if(ix[2]<0||ix[5]<0)throw Error('الملف يحتاج عمود الاسم والتاريخ من النموذج');
  const items=[];for(const record of all){const r={};fields.forEach(([key],j)=>{r[key]=ix[j]>=0?record[ix[j]]:'';});r.id=r.id||uid('import');r.createdAt=Date.now();r.updatedAt=Date.now();r.amount=Number(r.amount||0);r.paid=Number(r.paid||0);try{r.adjustments=JSON.parse(r.adjustments||'[]');}catch{r.adjustments=[];}r.hasTime=/^(true|1)$/i.test(r.hasTime);r.annualRepeat=/^(true|1)$/i.test(r.annualRepeat);const b=normalizeBooking(r);if(!b)throw Error('صف غير صالح في الملف، الاسم والتاريخ مطلوبان');items.push(b);}
  const bookingGate=window.MyfntFeatureGate?.checkCount?.('bookings_limit',bookings().length,{delta:items.length,message:'الاستيراد يتجاوز عدد الحجوزات المسموح في خطتك'});if(bookingGate&&!bookingGate.ok)return showToast(bookingGate.message,'warning');if(!await ozConfirm(`استيراد ${items.length} حجز دون حذف البيانات الحالية؟`,{title:"استيراد CSV"}))return;bookingRepo()?.replaceLocal?.(dedupeBookings([...bookings(),...items]),{persist:false});window.MyfntSequences?.migrate?.({force:true});saveBookings();window.MyfntOffline?.reconcile?.({reason:'import',enqueue:false});window.MyfntFeatureGate?.consume?.('imports_monthly_limit',1);renderAll();renderAdmin();metrics('csvImports');showToast('تم استيراد '+items.length+' حجز');
 }
 async function importXLSX(file){
  if(!window.MyfntFeatureGate?.require?.('excel_import_enabled',{message:'استيراد Excel غير متاح في خطتك الحالية'}))return;const importGate=window.MyfntFeatureGate?.check?.('imports_monthly_limit',{message:'تم بلوغ حد الاستيراد الشهري لخطتك'});if(importGate&&!importGate.ok)throw Error(importGate.message);
  if(!file||file.size>8e6||!window.JSZip)throw Error('ملف Excel غير مدعوم أو كبير الحجم');
  const archive=await JSZip.loadAsync(file),entry=archive.file('xl/worksheets/sheet1.xml');
  if(!entry)throw Error('لم يتم العثور على ورقة العمل الأولى');
  const xml=new DOMParser().parseFromString(await entry.async('text'),'application/xml');
  if(xml.querySelector('parsererror'))throw Error('XML غير صالح في Excel');
  const wbNamespace='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const textOf=(node,tag)=>[...node.getElementsByTagNameNS(wbNamespace,tag)].map(n=>n.textContent).join('');
  const sst=archive.file('xl/sharedStrings.xml');let shared=[];
  if(sst){const sx=new DOMParser().parseFromString(await sst.async('text'),'application/xml');shared=[...sx.getElementsByTagNameNS(wbNamespace,'si')].map(x=>textOf(x,'t'));}
  const rows=[...xml.getElementsByTagNameNS(wbNamespace,'row')].map(row=>{
   const values=[];for(const cell of row.getElementsByTagNameNS(wbNamespace,'c')){
    const col=String(cell.getAttribute('r')||'').match(/^[A-Z]+/)?.[0];if(!col)continue;
    let index=0;for(const ch of col)index=index*26+ch.charCodeAt(0)-64;index--;
    const raw=cell.getAttribute('t')==='inlineStr'?textOf(cell,'t'):textOf(cell,'v');
    values[index]=cell.getAttribute('t')==='s'?(shared[Number(raw)]||''):raw;
   }return values;
  }).filter(r=>r.some(x=>x!==undefined&&x!==''));
  const headers=rows.shift()||[],ix=fields.map(([,ar])=>headers.indexOf(ar));
  if(ix[2]<0||ix[4]<0)throw Error('استخدم نموذج مايفنت: يجب وجود أعمدة الاسم والتاريخ');
  const incoming=rows.map((cells,i)=>{const b={};fields.forEach(([key],j)=>b[key]=ix[j]>=0?String(cells[ix[j]]??''):'');b.id=b.id||uid('excel');b.createdAt=Date.now();b.updatedAt=Date.now();try{b.adjustments=JSON.parse(b.adjustments||'[]');}catch{b.adjustments=[];}b.hasTime=/^(true|1)$/i.test(b.hasTime);b.annualRepeat=/^(true|1)$/i.test(b.annualRepeat);const value=normalizeBooking(b);if(!value)throw Error('بيانات غير صالحة في الصف '+(i+2));return value;});
  const bookingGate=window.MyfntFeatureGate?.checkCount?.('bookings_limit',bookings().length,{delta:incoming.length,message:'الاستيراد يتجاوز عدد الحجوزات المسموح في خطتك'});if(bookingGate&&!bookingGate.ok)throw Error(bookingGate.message);if(!await ozConfirm('هل تريد استيراد '+incoming.length+' حجز دون حذف الموجود؟',{title:'استيراد Excel'}))return;
  bookingRepo()?.replaceLocal?.(dedupeBookings([...bookings(),...incoming]),{persist:false});window.MyfntSequences?.migrate?.({force:true});saveBookings();window.MyfntOffline?.reconcile?.({reason:'import',enqueue:false});window.MyfntFeatureGate?.consume?.('imports_monthly_limit',1);renderAll();renderAdmin();metrics('excelImports');showToast('تم استيراد '+incoming.length+' حجز');
 }
 function renderSpecialDays(){
  const host=el('ozSpecialEditor'),list=el('specialDaysList');if(!host||!list)return;
  const current=specialRepo()?.get?.(editingSpecial)||specialDays().find(x=>x.id===editingSpecial);host.innerHTML=`<form id="ozSpecialForm" class="oz-a-form"><label>الوصف<input name="label" required maxlength="80" placeholder="يوم مميز" value="${esc(current?.label||'')}"></label><label>نوع التحديد<select name="kind" id="ozSpecialKind"><option value="single" ${!current||current.kind==='single'?'selected':''}>يوم محدد</option><option value="range" ${current?.kind==='range'?'selected':''}>نطاق من إلى</option><option value="weekday" ${current?.kind==='weekday'?'selected':''}>أيام أسبوع متكررة</option></select></label><label>تاريخ / بداية<input type="date" name="from" required value="${esc(current?.from||current?.date||dateString())}"></label><label>نهاية (اختياري لأيام الأسبوع)<input type="date" name="to" value="${esc(current?.to||'')}"></label><div class="oz-a-weekdays">${WEEKDAY_AR.map((d,i)=>`<label><input type="checkbox" name="wd" value="${i}" ${(current?.weekdays||[]).includes(i)?'checked':''}>${esc(d)}</label>`).join('')}</div><button type="submit" class="primary-btn">${current?'حفظ التعديل':'إضافة يوم مميز'}</button>${current?'<button type="button" class="secondary-btn" data-oz-special-cancel>إلغاء التعديل</button>':''}</form>`;
  list.innerHTML=specialDays().map(x=>`<div class="admin-row"><div><strong>${esc(x.label)}</strong><span>${x.kind==='weekday'?(x.weekdays||[]).map(d=>WEEKDAY_AR[d]).join(' / '):esc(x.from||x.date)} ${x.to?'— '+esc(x.to):''}</span></div><div class="oz-a-actions"><button class="mini-icon-btn" data-oz-edit-special="${esc(x.id)}" aria-label="تعديل ${esc(x.label)}"><i class="fa-solid fa-pen"></i></button><button class="mini-icon-btn" data-oz-delete-special="${esc(x.id)}" aria-label="حذف ${esc(x.label)}"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');
 }
 const DEFAULT_ALERTS=[
 {id:'default-before-10',name:'قبل المناسبة بـ10 أيام',direction:'before',value:10,unit:'days',channels:['inApp'],recipient:'staff'},
 {id:'default-before-3',name:'قبل المناسبة بـ3 أيام',direction:'before',value:3,unit:'days',channels:['inApp'],recipient:'staff'},
 {id:'default-before-1',name:'قبل المناسبة بيوم',direction:'before',value:1,unit:'days',channels:['inApp'],recipient:'staff'},
 {id:'default-event-day',name:'يوم المناسبة',direction:'before',value:0,unit:'days',channels:['inApp'],recipient:'staff'},
 {id:'default-overdue',name:'بعد المناسبة بيوم',direction:'after',value:1,unit:'days',channels:['inApp'],recipient:'staff'}
 ].map(x=>({...x,clientMessage:'مرحباً {name}، موعد حجز {package} بتاريخ {date}، المتبقي {remaining}.',staffMessage:'تذكير بالحجز {number}: {name} - {date} - {package} - {remaining}'}));
 function getAlerts(){const raw=settings().alertTemplates;if(!Array.isArray(raw)){alertRepo()?.replaceLocal?.(structuredClone(DEFAULT_ALERTS),{persist:true,reconcile:false});}return alertRepo()?.all?.()||(Array.isArray(settings().alertTemplates)?settings().alertTemplates:[]);}
 function renderAlerts(){const host=el('ozAlertEditor');if(!host)return;host.innerHTML=`<div class="oz-a-form"><div class="oz-alert-toolbar"><div><strong><i class="fa-solid fa-bell"></i> قواعد الإشعارات</strong><small>يمكن اختيار أكثر من قناة لكل تنبيه يدويًا.</small></div><div class="oz-a-actions"><button type="button" class="secondary-btn" data-oz-reset-alerts>استعادة الافتراضي</button><button type="button" class="primary-btn" data-oz-add-alert>إضافة</button></div></div><p class="oz-a-help">المتغيرات: {name} {phone} {number} {package} {date} {amount} {paid} {remaining}</p>${getAlerts().map(a=>`<details class="oz-a-alert"><summary><span><i class="fa-solid fa-bell"></i> ${esc(a.name)}</span><small>${esc(a.direction==='before'?'قبل':'بعد')} ${a.value} ${esc(a.unit)} · ${(a.channels||['inApp']).length} قناة</small></summary><form data-oz-alert="${esc(a.id)}"><label>الاسم<input name="name" maxlength="70" value="${esc(a.name)}"></label><div class="oz-a-cols"><label>التوقيت<select name="direction"><option value="before" ${a.direction==='before'?'selected':''}>قبل</option><option value="after" ${a.direction==='after'?'selected':''}>بعد</option></select></label><label>القيمة<input type="number" name="value" min="0" max="36500" value="${a.value}"></label><label>الوحدة<select name="unit">${['days','hours','minutes'].map(v=>`<option value="${v}" ${v===a.unit?'selected':''}>${{days:'أيام',hours:'ساعات',minutes:'دقائق'}[v]}</option>`).join('')}</select></label><label>المستلم<select name="recipient"><option value="staff" ${a.recipient==='staff'?'selected':''}>أرقام الرسائل</option><option value="client" ${a.recipient==='client'?'selected':''}>العميل فقط</option><option value="both" ${a.recipient==='both'?'selected':''}>العميل وأرقام الرسائل</option></select></label></div><fieldset class="oz-alert-channels"><legend>قنوات التواصل</legend>${[['inApp','fa-bell','داخل التطبيق'],['sms','fa-comment-sms','SMS'],['whatsapp','fa-brands fa-whatsapp','واتساب'],['email','fa-envelope','البريد']].map(([v,i,l])=>`<button type="button" class="oz-alert-channel${(a.channels||['inApp']).includes(v)?' is-active':''}" data-alert-channel="${v}" aria-pressed="${(a.channels||['inApp']).includes(v)?'true':'false'}"><span><i class="${i.startsWith('fa-brands')?i:'fa-solid '+i}"></i>${l}</span></button>`).join('')}<small>القنوات الخارجية لا تُرسل إلا بعد ربط البوابة والصلاحيات.</small></fieldset><label>الأولوية<select name="priority">${[['low','منخفضة'],['normal','عادية'],['high','عالية'],['critical','قصوى - موافقة SMS إلزامية']].map(([v,l])=>`<option value="${v}" ${a.priority===v?'selected':''}>${l}</option>`).join('')}</select></label><label>رسالة العميل<textarea name="clientMessage">${esc(a.clientMessage)}</textarea></label><label>رسالة أرقام الرسائل<textarea name="staffMessage">${esc(a.staffMessage)}</textarea></label><div class="oz-a-actions"><button type="submit" class="primary-btn">حفظ</button><button type="button" class="secondary-btn" data-oz-delete-alert="${esc(a.id)}">حذف</button></div></form></details>`).join('')}</div>`;window.MyfntAlertScheduler?.renderApprovals?.();}
 async function renderUsage(){
  const host=el('ozUsageContent');if(!host)return;
  const bookingRows=bookings(),
    customerRows=customers(),
    receiptRows=receipts(),
    pkgs=packages(),alerts=getAlerts();
  const confirmed=bookingRows.filter(b=>b.status==='confirmed').length,
    temp=bookingRows.filter(b=>b.status==='temporary').length,
    cancelled=bookingRows.filter(b=>b.status==='cancelled').length,
    total=bookingRows.reduce((n,b)=>n+Number(b.amount||0),0),
    paid=receiptRows.filter(r=>r.status!=='voided'&&r.direction!=='out').reduce((n,r)=>n+Number(r.amount||0),0),
    remaining=Math.max(0,total-paid);
  const base=[
   ['fa-calendar-check','الحجوزات',bookingRows.length,`${confirmed} مؤكدة · ${temp} مؤقتة · ${cancelled} ملغاة`],
   ['fa-users','العملاء',customerRows.length,'إجمالي دليل العملاء'],
   ['fa-file-invoice-dollar','السندات والحركات',receiptRows.length,`${paid.toLocaleString('en-US')} محصل`],
   ['fa-boxes-stacked','الباقات',pkgs.length,`${pkgs.filter(x=>x.status!=='hidden').length} ظاهرة`],
   ['fa-money-bill-trend-up','قيمة الحجوزات',total.toLocaleString('en-US'),`المتبقي ${remaining.toLocaleString('en-US')}`]
  ];
  const paint=(extra=[],foot='جارٍ تحديث إحصاءات التخزين والمزامنة في الخلفية…')=>{
   const cards=[...base,...extra];
   host.innerHTML=`<div class="oz-usage-hero"><div><span>إحصاءات الشركة</span><h3>${esc(settings().company?.name||'نشاطك')}</h3><p>ملخص مباشر للحجوزات والعملاء والمالية والمزامنة والرسائل.</p></div><i class="fa-solid fa-chart-pie"></i></div><div class="oz-usage-grid">${cards.map(([icon,label,value,note])=>`<article><i class="fa-solid ${icon}"></i><div><small>${label}</small><strong>${value}</strong><span>${note}</span></div></article>`).join('')}</div><div class="oz-usage-foot"><i class="fa-solid fa-circle-info"></i><span>${esc(foot)}</span></div>`;
  };
  paint();
  const timeout=(ms)=>new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),ms));
  let queue=[],tables={},storageText='—',successMessages=0,failedMessages=0,partial=false;
  try{const r=await Promise.race([window.MyfntLocal?.queue?.()||Promise.resolve([]),timeout(1800)]);if(r?.timeout)partial=true;else queue=Array.isArray(r)?r:[];}catch{partial=true;}
  try{const ex=await Promise.race([window.MyfntLocal?.exportRows?.()||Promise.resolve(null),timeout(2200)]);if(ex?.timeout||!ex){partial=true;}else{tables=ex.tables||{};const sms=tables.sms_messages||[];successMessages=sms.filter(x=>['sent','delivered','success'].includes(String(x.status))).length;failedMessages=sms.filter(x=>['failed','error','rejected'].includes(String(x.status))).length;const bytes=new Blob([JSON.stringify(ex)]).size;storageText=bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(2)} MB`;}}catch{partial=true;try{const est=await Promise.race([navigator.storage?.estimate?.()||Promise.resolve(null),timeout(900)]);if(est&&!est.timeout&&est.usage!=null)storageText=`${(est.usage/1024/1024).toFixed(2)} MB`;}catch{}}
  const syncOpen=queue.filter(x=>!['synced','superseded'].includes(x.status)).length,
    syncFailed=queue.filter(x=>x.status==='failed').length,
    syncConflict=queue.filter(x=>x.status==='conflict').length;
  paint([
   ['fa-circle-check','الرسائل الناجحة',successMessages,'حسب سجل بوابة الرسائل'],
   ['fa-circle-xmark','الرسائل الفاشلة',failedMessages,'حسب سجل بوابة الرسائل'],
   ['fa-database','حجم نسخة قاعدة البيانات',storageText,'حجم التصدير المنظم المحلي'],
   ['fa-rotate','طلبات المزامنة',syncOpen,`${syncFailed} فشل · ${syncConflict} تعارض`],
   ['fa-bell','قواعد التنبيه',alerts.length,`${alerts.reduce((n,a)=>n+(a.channels?.length||1),0)} قناة معرفة`]
  ],partial?'تم عرض الإحصاءات الأساسية؛ بعض تفاصيل التخزين أو المزامنة لم تستجب ضمن المهلة.':'تم تحديث الإحصاءات المحلية بنجاح.');
 }

 function settingsBackup(){return {bookingContacts:[...new Map(bookings().map(b=>[normalizeSearch(b.phone)||normalizeSearch(b.name),{name:b.name,phone:b.phone}])).values()],notificationSnapshots:state.notificationReadAt,notifications:typeof notificationItems==='function'?notificationItems():[],alertTemplates:getAlerts(),usage};}

 // نسخة يومية مستقلة في IndexedDB، آخر 5 نسخ فقط لكل جهاز/مستخدم/شركة، ولا تُرسل البيانات لأي خادم.
 function dailyDatabase(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('IndexedDB غير متاح'));
  const req=indexedDB.open('ozan-daily-backups-v1'+(window.OzanScope?.owner()?'-'+encodeURIComponent(window.OzanScope.owner().userId)+'-'+encodeURIComponent(window.OzanScope.owner().companyId):''),1);req.onupgradeneeded=()=>req.result.createObjectStore('daily',{keyPath:'day'});
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('تعذر فتح النسخ اليومية'));
 });}
 function backupMarker(base){const o=window.OzanScope?.owner?.()||{};return `${base}:${o.companyId||'guest'}:${o.userId||'guest'}`;}
 function automaticBackupAllowed(){const p=window.MyfntPlans?.get?.(window.MyfntPlans?.companyCode?.());if(!p)return true;const caps=Array.isArray(p.backup_capabilities)?p.backup_capabilities:[];return caps.some(x=>['automatic_backup','scheduled_backup','cloud_basic_auto'].includes(String(x)));}
 async function compressedBackupRecord(day,wrapper){const bytes=await window.MyfntBackup.encodeWrapper(wrapper),sum=window.MyfntBackup.summary(wrapper.payload);return {day,bytes,summary:sum,sha256:wrapper.sha256,createdAt:wrapper.payload?.createdAt||new Date().toISOString(),format:'MYFNTDB1'};}
 async function recordWrapper(row){if(row?.wrapper)return row.wrapper;if(row?.bytes)return window.MyfntBackup.decodeBytes(row.bytes instanceof Uint8Array?row.bytes:new Uint8Array(row.bytes));return null;}
 async function downloadBackupRecord(row){if(row?.bytes){await window.MyfntBackup.decodeBytes(row.bytes instanceof Uint8Array?row.bytes:new Uint8Array(row.bytes));return window.MyfntBackup.downloadBytes(row.bytes,window.MyfntBackup.filename(row.day));}const w=await recordWrapper(row);if(!w)throw Error('النسخة المحلية غير صالحة');return window.MyfntBackup.downloadWrapper(w,window.MyfntBackup.filename(row.day));}
 async function dailySave(){
  const now=new Date(),today=isoDate(now),hhmm=now.toTimeString().slice(0,5),due=(settings().preferences?.backupHour||'03:00');
  if(!automaticBackupAllowed()||hhmm<due||safeStorage.get(backupMarker('ozan.daily-backup.last'))===today)return;
  if(!window.crypto?.subtle||!window.indexedDB)return;
  const db=await dailyDatabase();try{
   if(!window.MyfntBackup)throw Error('محرك النسخ الاحتياطية غير جاهز');
   const wrapper=await window.MyfntBackup.makeWrapper(),record=await compressedBackupRecord(today,wrapper);
   const tx=db.transaction('daily','readwrite'),store=tx.objectStore('daily');store.put(record);
   const request=store.getAllKeys();request.onsuccess=()=>{const lim=window.MyfntFeatureGate?.limit?.('backup_retention_limit'),keep=Number.isFinite(lim)?Math.max(1,Number(lim)):30;for(const key of request.result.sort().slice(0,-keep))store.delete(key);};
   await new Promise((ok,fail)=>{tx.oncomplete=ok;tx.onerror=()=>fail(tx.error||Error('فشل حفظ النسخة'));tx.onabort=()=>fail(tx.error||Error('ألغيت عملية النسخ'));});
   safeStorage.set(backupMarker('ozan.daily-backup.last'),today);metrics('automaticBackups');renderDailyBackups().catch(console.warn);
  }finally{db.close();}
 }
 async function downloadLatestDaily(){const db=await dailyDatabase();try{
  const tx=db.transaction('daily','readonly'),store=tx.objectStore('daily');const records=await new Promise((ok,fail)=>{const req=store.getAll();req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error);});
  const latest=records.sort((a,b)=>b.day.localeCompare(a.day))[0];if(!latest){showToast('لا توجد نسخة يومية بعد','warning');return;}
  await downloadBackupRecord(latest);
 }finally{db.close();}}
 async function dailyRecords(){const db=await dailyDatabase();try{return await new Promise((ok,fail)=>{const tx=db.transaction('daily','readonly'),req=tx.objectStore('daily').getAll();req.onsuccess=()=>{const lim=window.MyfntFeatureGate?.limit?.('backup_retention_limit'),keep=Number.isFinite(lim)?Math.max(1,Number(lim)):30;ok((req.result||[]).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,keep));};req.onerror=()=>fail(req.error);});}finally{db.close();}}
 const backupBytes=row=>{try{return Number(row?.bytes?.byteLength||row?.bytes?.length||0)||(row?.wrapper?new Blob([JSON.stringify(row.wrapper)]).size:0)}catch{return 0}};
 const backupSize=bytes=>bytes<1024?`${bytes} B`:bytes<1024*1024?`${(bytes/1024).toFixed(1)} KB`:`${(bytes/1024/1024).toFixed(2)} MB`;
 async function renderDailyBackups(){const host=el('ozDailyBackupList'),net=el('ozBackupNetworkState');if(net){net.textContent=navigator.onLine?'متصل · النسخ المحلية تعمل':'Offline · النسخ المحلية تعمل';net.dataset.online=String(navigator.onLine);}if(!host)return;let rows=[];try{rows=await dailyRecords();}catch(e){host.innerHTML=`<p class="oz-hint">تعذر قراءة النسخ المحلية: ${esc(e.message||e)}</p>`;return;}if(!rows.length){host.innerHTML='<p class="oz-hint">لا توجد نسخ يومية محفوظة على هذا الجهاز بعد.</p>';return;}host.innerHTML=rows.map((r,i)=>{const p=r.wrapper?.payload||{},sum=r.summary||{bookings:Number(p.bookings?.length||0),payments:Number(p.receipts?.length||0),customers:Number(p.customers?.length||0)},ok=(r.format==='MYFNTDB1'&&!!r.sha256)||(['ozan-backup','myfnt-db-backup'].includes(r.wrapper?.type)&&r.wrapper?.hashAlgorithm==='SHA-256');return `<article class="mf-backup-row" data-backup-day="${esc(r.day)}"><div class="mf-backup-row__icon"><i class="fa-solid fa-database"></i></div><div class="mf-backup-row__body"><div><strong>${i===0?'الأحدث · ':''}${esc(r.day)}</strong><span>${backupSize(backupBytes(r))}</span></div><small>${Number(sum.bookings||0)} حجز · ${Number(sum.payments||0)} سند · ${Number(sum.customers||0)} عميل · ${ok?'SHA-256':'صيغة غير معروفة'}</small><small>${(r.createdAt||p.createdAt)?new Date(r.createdAt||p.createdAt).toLocaleString('ar-YE'):'بدون وقت إنشاء'}</small></div><div class="mf-backup-row__actions"><button type="button" class="secondary-btn" data-backup-download="${esc(r.day)}" aria-label="تنزيل نسخة ${esc(r.day)}"><i class="fa-solid fa-download"></i></button><button type="button" class="secondary-btn" data-backup-restore="${esc(r.day)}" aria-label="استعادة نسخة ${esc(r.day)}"><i class="fa-solid fa-clock-rotate-left"></i></button><button type="button" class="secondary-btn" data-backup-delete="${esc(r.day)}" aria-label="حذف نسخة ${esc(r.day)}"><i class="fa-solid fa-trash"></i></button></div></article>`;}).join('');}
 async function getDailyRecord(day){const db=await dailyDatabase();try{return await new Promise((ok,fail)=>{const req=db.transaction('daily','readonly').objectStore('daily').get(day);req.onsuccess=()=>ok(req.result||null);req.onerror=()=>fail(req.error);});}finally{db.close();}}
 async function deleteDailyRecord(day){const db=await dailyDatabase();try{await new Promise((ok,fail)=>{const tx=db.transaction('daily','readwrite');tx.objectStore('daily').delete(day);tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);tx.onabort=()=>fail(tx.error);});}finally{db.close();}await renderDailyBackups();}
 async function handleBackupListClick(e){const btn=e.target.closest('[data-backup-download],[data-backup-restore],[data-backup-delete]');if(!btn)return;const day=btn.dataset.backupDownload||btn.dataset.backupRestore||btn.dataset.backupDelete,row=await getDailyRecord(day);if(!row)return showToast('لم تعد النسخة موجودة','warning');if(btn.dataset.backupDownload){try{await downloadBackupRecord(row);}catch(e){return showToast(e.message||'فشل فحص سلامة النسخة','warning');}return;}if(btn.dataset.backupDelete){if(await ozConfirm(`حذف النسخة المحلية ${day} من هذا الجهاز؟`,{title:'حذف نسخة محلية',confirmLabel:'حذف',danger:true}))await deleteDailyRecord(day);return;}if(btn.dataset.backupRestore){if(!window.MyfntBackupRestore?.fromFile)return showToast('مسار الاستعادة غير جاهز','warning');let file;if(row.bytes)file=new Blob([row.bytes],{type:'application/octet-stream'});else file=new Blob([JSON.stringify(row.wrapper)],{type:'application/json'});await window.MyfntBackupRestore.fromFile(file);await renderDailyBackups();}}

 async function createBackupNow(){
  if(!window.MyfntFeatureGate?.enabled?.('manual_backup_enabled')){showToast('النسخ الاحتياطي اليدوي غير متاح في خطتك الحالية','warning');return false;}
  const today=isoDate(new Date()),key=backupMarker('myfnt.manual-backup.last.v1');
  if(safeStorage.get(key)===today){showToast('تم إنشاء نسخة اليوم بالفعل؛ يسمح بإنشاء نسخة واحدة يدويًا كل يوم','warning');await renderDailyBackups();return false;}
  const plan=window.MyfntPlans?.get?.(window.MyfntPlans?.companyCode?.());
  if(plan&&Number(plan.backups_limit||0)===0)return showToast('النسخ الاحتياطية غير متاحة في خطتك الحالية','warning');
  const btn=el('ozCreateBackupNow');if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
  const result=el('backupResult');if(result)result.textContent='جاري إنشاء نسخة .db مضغوطة وفحص سلامتها…';
  try{
   if(!window.MyfntBackup)throw Error('محرك النسخ الاحتياطية غير جاهز');
   const wrapper=await window.MyfntBackup.makeWrapper(),record=await compressedBackupRecord(today,wrapper),db=await dailyDatabase();
   try{await new Promise((ok,fail)=>{const tx=db.transaction('daily','readwrite'),store=tx.objectStore('daily');store.put(record);const req=store.getAllKeys();req.onsuccess=()=>{const lim=window.MyfntFeatureGate?.limit?.('backups_limit'),keep=Number.isFinite(lim)?Math.max(1,Number(lim)):5;for(const d of req.result.sort().slice(0,-keep))store.delete(d);};tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);tx.onabort=()=>fail(tx.error);});}finally{db.close();}
   safeStorage.set(key,today);const summary=window.MyfntBackup.summary(wrapper.payload);if(result)result.textContent=`تم إنشاء نسخة اليوم: ${summary.bookings} حجز · ${summary.payments} سند · ${summary.customers} عميل · ${summary.tables} جدول.`;showToast('تم إنشاء نسخة اليوم بنجاح');await renderDailyBackups();return true;
  }catch(err){if(result)result.textContent=err.message||'تعذر إنشاء النسخة';showToast(err.message||'تعذر إنشاء النسخة','warning');return false;}
  finally{if(btn){btn.removeAttribute('aria-busy');btn.disabled=safeStorage.get(key)===today;updateCreateBackupButton();}}
 }
 function updateCreateBackupButton(){const btn=el('ozCreateBackupNow'),note=el('ozCreateBackupNowNote');if(!btn)return;const today=isoDate(new Date()),used=safeStorage.get(backupMarker('myfnt.manual-backup.last.v1'))===today;btn.disabled=used;btn.classList.toggle('is-done',used);const label=btn.querySelector('span');if(label)label.textContent=used?'تم إنشاء نسخة اليوم':'إنشاء نسخة الآن';if(note)note.textContent=used?'استخدمت النسخة اليدوية المتاحة لهذا اليوم. يمكنك تنزيلها من القائمة أدناه.':'يمكن إنشاء نسخة يدوية واحدة فقط كل يوم على هذا الجهاز.';}

 function fillPrefs(){
  const form=el('ozPrefsForm');
  if(!form)return;
  const prefs=settings()?.preferences||{};
  const values={
   currency:String(prefs.currency||'YER'),
   calendar:String(prefs.calendar||'gregorian'),
   language:String(prefs.language||'ar'),
   syncMode:String(prefs.syncMode||'manual'),
   backupHour:String(prefs.backupHour||'03:00')
  };
  for(const [name,value] of Object.entries(values)){
   const field=form.elements?.namedItem?.(name);
   if(field&&'value' in field)field.value=value;
  }
 }

 function advancedInit(){
  try{usage=JSON.parse(safeStorage.get(KEY)||'{}')||{};}catch{usage={};}
  // ترقية الباقات والتهيئات القديمة دون تغيير معرفات الحجوزات السابقة.
  packageRepo()?.replaceLocal?.(normalizePackages(packages()),{persist:true});getAlerts();
  document.addEventListener('ozan:packages-updated',()=>{if(!el('packagesWindow')?.classList.contains('is-open'))return;renderPackages();});
  el('ozPackageDialog')?.addEventListener('submit',e=>{if(e.target.id==='ozPackageForm'){e.preventDefault();storePackage(e.target);}});
  el('ozPackageEditor')?.addEventListener('click',e=>{if(e.target.closest('[data-oz-add-package]'))openPackageDialog();});
  el('ozPackageDialog')?.addEventListener('click',e=>{const status=e.target.closest('[data-package-status]');if(status){e.preventDefault();const form=status.closest('form');window.MyfntChoice?.single?.(status.parentElement,status,'[data-package-status]');const input=form?.querySelector('input[name=status]');if(input)input.value=status.dataset.packageStatus;return;}const icon=e.target.closest('[data-package-icon]');if(icon){e.preventDefault();const form=icon.closest('form');window.MyfntChoice?.single?.(icon.parentElement,icon,'[data-package-icon]');const input=form?.querySelector('input[name=icon]');if(input)input.value=icon.dataset.packageIcon;const preview=form?.querySelector('.ozpkg-form-icon i');if(preview)preview.className='fa-solid '+icon.dataset.packageIcon;return;}if(e.target===e.currentTarget||e.target.closest('[data-oz-clear-package],[data-oz-close-package]'))closePackageDialog();});
  document.addEventListener('keydown',e=>{const dlg=el('ozPackageDialog');if(dlg?.hidden)return;if(e.key==='Escape'){e.preventDefault();closePackageDialog();}if(e.key==='Tab'){const nodes=[...dlg.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter(x=>x.getClientRects().length);if(!nodes.length)return;const i=nodes.indexOf(document.activeElement);if(e.shiftKey&&(i<=0)){e.preventDefault();nodes[nodes.length-1].focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0].focus();}}});
  el('packagesList')?.addEventListener('click',async e=>{const btn=e.target.closest('[data-oz-edit-pkg],[data-oz-toggle-pkg],[data-oz-delete-pkg]');if(!btn)return;const id=btn.dataset.ozEditPkg||btn.dataset.ozTogglePkg||btn.dataset.ozDeletePkg,p=packageRepo()?.get?.(id)||packages().find(x=>x.id===id);if(!p)return;if(btn.hasAttribute('data-oz-edit-pkg')){openPackageDialog(id);return;}if(btn.hasAttribute('data-oz-toggle-pkg')){try{await packageRepo()?.mutateDurable?.(p.id,item=>{item.status=item.status==='hidden'?'active':'hidden';});renderPackages();}catch(err){console.error('[package visibility durable save]',err);showToast('تعذر تثبيت حالة الباقة؛ تم التراجع','warning');}return;}if(p.builtIn){showToast('الباقات الافتراضية للنشاط لا تقبل الحذف؛ يمكنك إخفاؤها','warning');return;}if(bookings().some(b=>b.packageId===id)){showToast('لا يمكن حذف باقة مرتبطة بحجوزات؛ أخفها بدلاً من ذلك','warning');return;}if(!await ozConfirm('حذف الباقة الإضافية؟',{title:'تأكيد الحذف',danger:true}))return;try{await window.MyfntOffline?.remove?.('booking_packages',id,{operation:'delete',reason:'حذف باقة إضافية'});}catch{return;}packageRepo()?.removeLocal?.(id);renderPackages();});
  el('ozExportIcs')?.addEventListener('click',()=>{const b=bookingRepo()?.get?.(state.activeBookingId);if(b)exportICS([b]);});
  el('ozAdminTools')?.addEventListener('input',e=>{if(e.target.id==='ozAdminSearch'){table.query=e.target.value;table.page=1;/* لا تستبدل الحقل أثناء الكتابة؛ ارسم عند توقف قصير */clearTimeout(root.ozAdminTimer);root.ozAdminTimer=setTimeout(()=>{const focus=document.activeElement===e.target,at=e.target.selectionStart;renderAdmin();if(focus){el('ozAdminSearch')?.focus();el('ozAdminSearch')?.setSelectionRange(at,at);}},170);}});
  el('ozAdminTools')?.addEventListener('change',async e=>{if(['ozCsvImport','ozIcsImport','ozXlsxImport'].includes(e.target.id)){try{if(e.target.id==='ozXlsxImport'&&!planAllows('excel_import_enabled'))throw Error('استيراد Excel غير متاح في خطتك الحالية');if(e.target.id==='ozCsvImport')await importCSV(e.target.files[0]);else if(e.target.id==='ozXlsxImport')await importXLSX(e.target.files[0]);else await importICS(e.target.files[0]);}catch(err){showToast(err.message,'warning');}e.target.value='';return;}const key=e.target.dataset.ozFilter;if(key){table[key]=e.target.value;table.page=1;renderAdmin();}});
  el('ozAdminTools')?.addEventListener('click',async e=>{const reset=e.target.closest('[data-oz-reset],[data-oz-show-all]'),quick=e.target.closest('[data-oz-quick]'),pkg=e.target.closest('[data-oz-package]');if(reset){resetAdminFilters();renderAdmin();return;}if(quick){adminQuick=quick.dataset.ozQuick;table.page=1;renderAdmin();return;}if(pkg){table.pkg=table.pkg===pkg.dataset.ozPackage?'':pkg.dataset.ozPackage;table.page=1;renderAdmin();return;}const btn=e.target.closest('[data-oz-export],[data-oz-template]');if(!btn)return;if(btn.hasAttribute('data-oz-template')){if(!planAllows('excel_export_enabled'))return showToast('تنزيل نموذج Excel غير متاح في خطتك الحالية','warning');runExcelExport(btn,[{id:'example-1',name:'عميل تجريبي',date:dateString(),status:'confirmed',amount:0,paid:0}]);return;}const type=btn.dataset.ozExport;if(type==='backup'){if(!planAllows('manual_backup_enabled'))return showToast('النسخ الاحتياطي اليدوي غير متاح في خطتك الحالية','warning');downloadFullBackup();return;}let rows=rowsFiltered();if(window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.exportLegacyDataset){btn.disabled=true;btn.setAttribute('aria-busy','true');try{const full=await window.MyfntQuery.exportLegacyDataset();rows=full.bookings.filter(b=>(!table.query||normalizeSearch([b.name,b.phone,b.bookingNo,b.type,b.packageId].join(' ')).includes(normalizeSearch(table.query)))&&(!table.from||b.date>=table.from)&&(!table.to||b.date<=table.to)&&(!table.month||Number(b.date.slice(5,7))===Number(table.month))&&(!table.year||b.date.slice(0,4)===table.year)&&(!table.status||b.status===table.status)&&(!table.pkg||b.packageId===table.pkg)&&adminQuickMatch(b));}catch(error){showToast(error.message||'تعذر قراءة بيانات التصدير','warning');return;}finally{btn.disabled=false;btn.removeAttribute('aria-busy');}}if(type==='csv'){const gate=window.MyfntFeatureGate?.check?.('exports_monthly_limit',{message:'تم بلوغ حد التصدير الشهري لخطتك'});if(gate&&!gate.ok)return showToast(gate.message,'warning');downloadBlob(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),`myevent-${dateString()}.csv`);window.MyfntFeatureGate?.consume?.('exports_monthly_limit',1);}if(type==='xlsx'){if(!planAllows('excel_export_enabled'))return showToast('تصدير Excel غير متاح في خطتك الحالية','warning');runExcelExport(btn,rows);}if(type==='ics')exportICS(rows);});
  el('adminBookingsList')?.addEventListener('click',e=>{const sort=e.target.closest('[data-oz-sort]'),page=e.target.closest('[data-oz-page]'),open=e.target.closest('[data-oz-open]');if(sort){const k=sort.dataset.ozSort;table.asc=table.sort===k?!table.asc:true;table.sort=k;renderAdmin();}if(page){table.page+=page.dataset.ozPage==='next'?1:-1;renderAdmin();}if(open){const b=bookingRepo()?.get?.(open.dataset.ozOpen);if(b)openPreview(b);}});
  el('ozSpecialEditor')?.addEventListener('submit',async e=>{if(e.target.id!=='ozSpecialForm')return;e.preventDefault();const d=new FormData(e.target),kind=d.get('kind'),from=d.get('from'),to=d.get('to');if(kind==='range'&&(!to||to<from)){showToast('حدد نهاية صحيحة للنطاق','warning');return;}const weekdays=d.getAll('wd').map(Number);if(kind==='weekday'&&!weekdays.length){showToast('اختر يومًا واحدًا على الأقل','warning');return;}const item={id:editingSpecial||uid('special'),kind,label:String(d.get('label')).trim(),date:kind==='single'?from:'',from,to:kind==='single'?'':to,weekdays};const current=specialRepo()?.get?.(item.id)||specialDays().find(x=>x.id===item.id);try{if(current)await specialRepo()?.mutateDurable?.(item.id,row=>Object.assign(row,item));else await specialRepo()?.addDurable?.(item);}catch(err){console.error('[special-day durable save]',err);showToast('تعذر تثبيت اليوم المميز؛ تم التراجع','warning');return;}editingSpecial='';renderSpecialDays();renderCalendar();});
  el('ozSpecialEditor')?.addEventListener('click',e=>{if(e.target.closest('[data-oz-special-cancel]')){editingSpecial='';renderSpecialDays();}});el('specialDaysList')?.addEventListener('click',async e=>{const edit=e.target.closest('[data-oz-edit-special]');if(edit){editingSpecial=edit.dataset.ozEditSpecial;renderSpecialDays();return;}const b=e.target.closest('[data-oz-delete-special]');if(!b)return;const id=b.dataset.ozDeleteSpecial;try{await window.MyfntOffline?.remove?.('calendar_blocks',id,{operation:'delete',reason:'حذف يوم مميز'});specialRepo()?.removeLocal?.(id);}catch{return;}if(editingSpecial===id)editingSpecial='';renderSpecialDays();renderCalendar();});
  el('ozAlertEditor')?.addEventListener('click',async e=>{const channel=e.target.closest('[data-alert-channel]');if(channel){e.preventDefault();e.stopPropagation();window.MyfntChoice?.toggle?.(channel);return;}if(e.target.closest('[data-oz-reset-alerts]')){if(!await ozConfirm('استعادة التنبيهات الافتراضية الخمسة؟',{title:'استعادة إعدادات التنبيهات'}))return;const before=alertRepo()?.snapshot?.()||getAlerts(),next=structuredClone(DEFAULT_ALERTS),nextIds=new Set(next.map(x=>String(x.id)));try{for(const old of before)if(!nextIds.has(String(old.id)))await window.MyfntOffline?.remove?.('alert_rules',old.id,{operation:'delete',reason:'استعادة قواعد التنبيه الافتراضية'});alertRepo()?.replaceLocal?.(next,{persist:true,reconcile:false});const oldIds=new Set(before.map(x=>String(x.id)));for(const row of next)await window.MyfntOffline?.record?.('alert_rules',row.id,oldIds.has(String(row.id))?'update':'create',row);}catch{return;}renderAlerts();window.MyfntAlertScheduler?.reschedule?.();return;}if(e.target.closest('[data-oz-add-alert]')){const a={...DEFAULT_ALERTS[0],id:uid('alert'),name:'تنبيه مخصص'};try{await alertRepo()?.addDurable?.(a);}catch(err){console.error('[alert durable add]',err);showToast('تعذر تثبيت قاعدة التنبيه','warning');return;}renderAlerts();return;}const b=e.target.closest('[data-oz-delete-alert]');if(b){const id=b.dataset.ozDeleteAlert;try{await window.MyfntOffline?.remove?.('alert_rules',id,{operation:'delete',reason:'حذف قاعدة تنبيه'});}catch{return;}try{alertRepo()?.removeLocal?.(id);}catch{return;}renderAlerts();}});
  el('ozAlertEditor')?.addEventListener('submit',async e=>{const form=e.target.closest('[data-oz-alert]');if(!form)return;e.preventDefault();const data=new FormData(form),id=form.dataset.ozAlert;if(!alertRepo()?.get?.(id))return;const channels=[...form.querySelectorAll('[data-alert-channel][aria-pressed="true"]')].map(btn=>String(btn.dataset.alertChannel||''));const recipient=String(data.get('recipient')||'staff'),staffMessage=String(data.get('staffMessage')||'').trim(),clientMessage=String(data.get('clientMessage')||'').trim();if(channels.includes('sms')&&(recipient==='staff'||recipient==='both')){const staffPhones=(window.MyfntRecipientResolver?.company?.('sms')||[]).map(x=>x.phone).filter(Boolean);if(!staffPhones.length){showToast('أضف رقمًا في «أرقام الرسائل» وحدد قناته SMS قبل تفعيل رسائل الشركة','warning');return;}if(!staffMessage){showToast('اكتب رسالة أرقام الرسائل قبل تفعيل SMS','warning');return;}}if(channels.includes('sms')&&(recipient==='client'||recipient==='both')&&!clientMessage){showToast('اكتب رسالة العميل قبل تفعيل SMS للعميل','warning');return;}try{await alertRepo().mutateDurable(id,a=>{['name','direction','unit','recipient','clientMessage','staffMessage','priority'].forEach(k=>a[k]=String(data.get(k)||''));a.value=Math.max(0,Number(data.get('value')||0));a.channels=channels.length?channels:['inApp'];});}catch(err){console.error('[alert durable save]',err);showToast('تعذر تثبيت التنبيه؛ تم التراجع','warning');return;}renderAlerts();window.MyfntAlertScheduler?.reschedule?.();showToast('تم حفظ التنبيه وتحديث جدولة القواعد');});
  el('ozPrefsForm')?.addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(e.target),backupHour=String(data.get('backupHour')||'03:00'),beforeCurrency=String(settings().preferences?.currency||'YER'),nextCurrency=String(data.get('currency')||'YER');settingsRepo()?.mutate?.(cfg=>{for(const k of ['currency','calendar','language','syncMode'])cfg.preferences[k]=String(data.get(k)||'');});settingsRepo()?.mutateLocal?.(cfg=>{cfg.preferences.backupHour=backupHour;},{profileEvent:false});if(nextCurrency!==beforeCurrency){for(const p of state.packages||[])p.currency=nextCurrency;for(const b of state.bookings||[]){b.currency=nextCurrency;if(b.pricingSnapshot)b.pricingSnapshot.currency=nextCurrency;}for(const r of state.receipts||[])r.currency=nextCurrency;try{await window.MyfntLocal?.applyWorkspaceCurrency?.(nextCurrency);}catch(err){console.warn('[currency authority]',err);showToast('تم تغيير العملة في الواجهة، وتعذر تحديث بعض الصفوف المحلية','warning');}window.__myfntBookingsRevision=(window.__myfntBookingsRevision||0)+1;document.dispatchEvent(new CustomEvent('myfnt:currency-changed',{detail:{currency:nextCurrency}}));try{renderAll?.();}catch{}}showToast('تم حفظ الإعدادات');});
  document.querySelectorAll('[data-open-admin]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.openAdmin==='usageWindow')renderUsage();if(button.dataset.openAdmin==='advancedPrefsWindow')fillPrefs();}));
  // حفظ نسخة تلقائية مذكّر بها عند فتح التطبيق في الساعة المحددة؛ لا تنزيل صامت.
  function checkBackupTime(){const prefs=settings().preferences||{},now=new Date(),stamp=isoDate(now);if(now.getHours()===Number((prefs.backupHour||'03:00').slice(0,2))&&safeStorage.get('ozan.backup-reminded-day')!==stamp){safeStorage.set('ozan.backup-reminded-day',stamp);showToast('حان موعد النسخة الاحتياطية؛ افتح مركز النسخ لتنزيلها');}}
  checkBackupTime();
  dailySave().catch(e=>console.warn('[OZAN backup]',e));
  window.setInterval(()=>{updateCreateBackupButton();if(!document.hidden)dailySave().catch(e=>console.warn('[OZAN backup]',e));},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)dailySave().catch(e=>console.warn('[OZAN backup]',e));});
  el('ozCreateBackupNow')?.addEventListener('click',()=>createBackupNow().catch(e=>showToast(e.message,'warning')));
  el('ozDownloadDailyBackup')?.addEventListener('click',()=>downloadLatestDaily().catch(e=>showToast(e.message,'warning')));
  el('ozDailyBackupList')?.addEventListener('click',e=>handleBackupListClick(e).catch(err=>showToast(err.message||'تعذر تنفيذ العملية','warning')));
  updateCreateBackupButton();renderDailyBackups().catch(console.warn);
  window.addEventListener('online',()=>renderDailyBackups().catch(console.warn));window.addEventListener('offline',()=>renderDailyBackups().catch(console.warn));
 }
 root.OzanAdvanced={openPreferences:()=>{fillPrefs();openWindow('advancedPrefsWindow');},init:advancedInit,reloadWorkspace:()=>{try{usage=JSON.parse(safeStorage.get(KEY)||'{}')||{}}catch{usage={}}},renderPackages,renderAdmin,renderSpecialDays,renderAlerts,renderUsage,exportICS,settingsBackup,bookingCalendarEvent,rowsFiltered};
 // يبدأ التشغيل من assets/js/app.js بعد تحميل الحالة وربط جميع الأزرار.
})();
