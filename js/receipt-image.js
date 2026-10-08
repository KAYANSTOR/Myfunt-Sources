/* Myfnt 2.9 — image preview of a stored receipt or an explicitly labelled unsaved draft.
   All rendering is local; never sends customer data to an external service. */
'use strict';
window.MyfntReceiptImage=(()=>{
 const $=id=>document.getElementById(id);
 let shown=null,working=false;
 const money=v=>Number(v||0).toLocaleString('en-US',{maximumFractionDigits:0});
 const fmt=v=>String(v||'—');
 const planAllows=name=>{const p=window.MyfntPlans;if(!p?.current?.())return true;return p.allowed(name);};
 const fields=(receipt,booking,draft)=>[
  ['رقم السند',draft?'معاينة غير محفوظة':fmt(receipt.receiptNo||'—')],
  ['رقم الحركة',draft?'—':fmt(receipt.movementNo||'—')],
  ['رقم الحجز',fmt(booking.bookingNo||booking.id)],
  ['العميل',fmt(booking.name)],
  ['تاريخ الحركة',fmt(receipt.date)],
  ['نوع الحركة',receipt.direction==='out'?'سند صرف':'سند قبض'],
  ['طريقة الدفع',receipt.method==='voucher'?'سند':'كاش'],
  ['الرقم المرجعي',fmt(receipt.reference)],
  ['الوسم',fmt(receipt.tag)],
  ['البيان',fmt(receipt.note)]
 ];
 async function draw(receipt,booking,draft=false){
  await document.fonts?.ready;
  const cn=$('receiptImageCanvas');if(!cn)return;
  const width=840,scale=2,margin=52,inner=width-margin*2;
  const c=cn.getContext('2d',{alpha:false});if(!c)throw Error('متصفحك لا يدعم معاينة الصور');
  // Keep labels and customer data inside the printed page, even with a long note.
  const f='Almarai, Tahoma, Arial, sans-serif';
  const measure=document.createElement('canvas').getContext('2d');
  const split=(text,max,fontSize=21)=>{
   const lines=[];measure.font=`700 ${fontSize}px ${f}`;
   for(const paragraph of String(text??'').split(/\r?\n/)){
    let line='';for(const word of paragraph.split(/\s+/)){
     if(!word)continue;
     const merged=line?line+' '+word:word;
     if(measure.measureText(merged).width<=max){line=merged;continue;}
     if(line){lines.push(line);line='';}
     let fragment='';
     for(const ch of word){
       const candidate=fragment+ch;
       if(fragment&&measure.measureText(candidate).width>max){lines.push(fragment);fragment=ch;}
       else fragment=candidate;
     }
     line=fragment;
    }if(line)lines.push(line);
   }return lines.length?lines:['—'];
  };
  const entries=fields(receipt,booking,draft).map(([label,value])=>({label,lines:split(value,inner-20,21)}));
  const height=Math.max(970,415+entries.reduce((n,row)=>n+25+Math.max(1,row.lines.length)*30+19,0)+210);
  cn.width=width*scale;cn.height=height*scale;c.setTransform(scale,0,0,scale,0,0);c.direction='rtl';
  c.fillStyle='#fff';c.fillRect(0,0,width,height);c.fillStyle='#C4014D';c.fillRect(0,0,width,11);
  function text(value,x,y,size=20,color='#251922',weight=700,align='right'){
    c.textAlign=align;c.font=`${weight} ${size}px ${f}`;c.fillStyle=color;c.fillText(String(value),x,y);
  }
  function rule(y){c.beginPath();c.strokeStyle='#eadddf';c.lineWidth=1;c.moveTo(margin,y);c.lineTo(width-margin,y);c.stroke();}
  const company=window.MyfntRepositories?.settings?.get?.('company')||{};
  text(company.name||'مايفنت',width-margin,72,34,'#C4014D',800);
  text('MYFNT',margin,72,22,'#C4014D',800,'left');rule(98);
  text(draft?'معاينة حركة غير محفوظة':receipt.direction==='out'?'سند صرف':'سند قبض',width-margin,155,35,'#24151e',800);
  text(draft?'للمراجعة فقط':'إيصال حركة مالية',width-margin,186,17,'#8c657b');
  if(draft){c.save();c.translate(width/2,490);c.rotate(-.36);c.globalAlpha=.10;text('غير معتمد',0,0,95,'#C4014D',800,'center');c.restore();}
  c.fillStyle='#fff3f7';c.beginPath();if(c.roundRect)c.roundRect(margin,218,inner,125,18);else c.rect(margin,218,inner,125);c.fill();
  text('المبلغ',width-margin-24,255,18,'#7f566c');
  text(money(receipt.amount)+' '+(state.settings?.preferences?.currency||booking.currency||'YER'),width-margin-24,306,35,'#C4014D',800);
  const words=typeof amountWords==='function'?amountWords(receipt.amount,booking.currency||'YER'):'';
  if(words){const lines=split(words,inner-40,15);lines.slice(0,2).forEach((line,i)=>text(line,width-margin-24,364+i*23,15,'#87566e',700));}
  let y=words?417:384;
  for(const row of entries){
   text(row.label,width-margin,y,16,'#9a7085',700);y+=29;
   row.lines.forEach(line=>{text(line,width-margin,y,21,'#211720',700);y+=30;});
   rule(y+8);y+=29;
  }
  text(draft?'هذه الصورة ليست سندًا محاسبيًا':'إصدار إلكتروني · يحتفظ النظام بسجل التعديلات',width-margin,y+35,16,'#7c6671');
  if(receipt.status==='voided'){c.save();c.translate(width/2,280);c.rotate(-.25);c.globalAlpha=.35;text('ملغى محاسبيًا',0,0,67,'#b91c1c',800,'center');c.restore();}
  // Exact image height is based on contents; no clipping for expanded notes.
  shown={canvas:cn,number:draft?'draft':(receipt.receiptNo||receipt.id)};
 }
 async function show(r,b,draft){
  if(working)return;working=true;shown=null;
  $('receiptImageDownload').disabled=true;$('receiptImageCanvas').hidden=true;
  $('receiptImageLoading').hidden=false;$('receiptImageDraftNotice').hidden=!draft;
  openWindow('receiptImageWindow');
  try{
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   await draw(r,b,draft);
   $('receiptImageCanvas').hidden=false;$('receiptImageDownload').disabled=false;
  }catch(error){console.error('[receipt image]',error);showToast('تعذرت معاينة الصورة: '+error.message,'warning');}
  finally{$('receiptImageLoading').hidden=true;working=false;}
 }
 function open(id){
  if(!id)return showToast('لم يُحفظ السند بعد','warning');
  const r=window.MyfntRepositories?.payments?.get?.(id),b=window.MyfntRepositories?.bookings?.get?.(r?.bookingId);
  if(!r||!b)return showToast('تعذر العثور على السند أو الحجز','warning');
  return show(r,b,false);
 }
 function openDraft(){
  const b=window.MyfntRepositories?.bookings?.get?.($('receiptBookingId')?.value);
  const amount=Number($('receiptAmount')?.value||0);
  if(!b)return showToast('اختر حجزًا أولًا','warning');
  if(!Number.isSafeInteger(amount)||amount<=0)return showToast('أدخل مبلغًا صحيحًا للمعاينة','warning');
  const direction=$('receiptDirection')?.value||'in';
  if(direction==='in'&&amount>remainingFor(b)&&!Boolean(window.MyfntRepositories?.settings?.get?.('bookingUi.allowReceiptOverRemaining')))return showToast('المبلغ يتجاوز المتبقي؛ فعّل السماح بسند قبض زائد من إعدادات الحجز إذا كان ذلك مقصودًا','warning');
  if(direction==='out'&&amount>Number(b.paid||0))return showToast('المبلغ يتجاوز الحد المتاح','warning');
  return show({amount,direction,date:$('receiptDate').value,method:$('receiptMethod').value,reference:$('receiptReference').value,tag:$('receiptTag').value,note:$('receiptNote').value},b,true);
 }
 async function download(){
  if(!shown||working)return;if(!planAllows('payment_receipt_download'))return showToast('تنزيل سند القبض غير متاح في خطتك الحالية','warning');const btn=$('receiptImageDownload');btn.disabled=true;btn.setAttribute('aria-busy','true');
  try{
   const blob=await new Promise((resolve,reject)=>shown.canvas.toBlob(b=>b?resolve(b):reject(Error('تعذر إنشاء الصورة')),'image/png'));
   downloadBlob(blob,`myfnt-receipt-${String(shown.number).replace(/[^\w-]/g,'')}.png`);
   showToast('تم تجهيز صورة السند');
  }catch(e){showToast(e.message||'فشل تجهيز الصورة','warning');}
  finally{btn.disabled=false;btn.removeAttribute('aria-busy');}
 }
 document.addEventListener('DOMContentLoaded',()=>{$('receiptImageDownload')?.addEventListener('click',download)});
 return Object.freeze({open,openDraft});
})();
