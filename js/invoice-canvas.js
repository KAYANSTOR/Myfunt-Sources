/* مايفنت 2.3.0: رسم Canvas مباشر بلا foreignObject؛ شروط مستقلة وارتفاع ديناميكي. */
'use strict';
window.OzanInvoiceCanvas=Object.freeze({
 async download(booking,receipts,company,save){
  if(!booking)throw Error('لا يوجد حجز محدد');
  await document.fonts?.ready;
  const b=booking,c=company||{},money=n=>Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0}),curr=state.settings?.preferences?.currency||b.currency||'YER';
  const rows=(receipts||[]).filter(r=>r.bookingId===b.id&&r.status!=='voided').sort((a,z)=>Number(a.createdAt||0)-Number(z.createdAt||0));
  const additions=(b.adjustments||[]).filter(x=>x?.reason?.trim());
  const terms=String(c.terms||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const receiptNotes=String(c.receiptNotes||'').trim();
  const detail=[['هاتف العميل',b.phone],['عنوان المناسبة',b.address],['الباقة / المناسبة',b.type],['التاريخ',b.date],['الوقت',b.hasTime?(b.timeFrom||'')+' — '+(b.timeTo||''):null],['الحالة',({confirmed:'مؤكد',pending:'مؤقت',cancelled:'ملغي',completed:'مكتمل'})[b.status]||b.status],['ملاحظات المناسبة',b.notes]].filter(([,v])=>String(v??'').trim());
  const w=920,margin=60,inner=w-margin*2,scale=2;
  const measure=document.createElement('canvas').getContext('2d');
  const wrap=(str,width,size=20)=>{measure.font=`700 ${size}px Almarai,Tahoma,Arial,sans-serif`;const result=[];for(const paragraph of String(str??'').split(/\r?\n/)){let run='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const candidate=run?run+' '+word:word;if(measure.measureText(candidate).width>width&&run){result.push(run);run=word;}else run=candidate;}if(run)result.push(run);}return result.length?result:[''];};
  const detailBlocks=detail.map(([label,value])=>({label,lines:wrap(value,inner,20)}));
  const termBlocks=terms.map((value,i)=>({label:String(i+1),lines:wrap(value,inner-52,18)}));
  const paymentBlocks=rows.map((r,i)=>({label:'دفعة '+(i+1)+(r.date?' · '+r.date:''),lines:wrap(r.note||'',inner-280,17),amount:r.amount}));
  const detailHeight=detailBlocks.reduce((sum,x)=>sum+42+29*x.lines.length,0);
  const termsHeight=termBlocks.reduce((sum,x)=>sum+27+25*x.lines.length,0);
  const paymentsHeight=paymentBlocks.reduce((sum,x)=>sum+44+x.lines.filter(Boolean).length*24,0);
  const receiptNotesHeight=receiptNotes?60+wrap(receiptNotes,inner-20,17).length*24:0;const h=Math.max(1120,440+detailHeight+(additions.length?64+additions.length*70:0)+155+75+paymentsHeight+receiptNotesHeight+(terms.length?74+termsHeight:0)+200);
  const canvas=document.createElement('canvas');canvas.width=w*scale;canvas.height=h*scale;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('تعذر إنشاء الصورة');ctx.scale(scale,scale);ctx.direction='rtl';ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.fillStyle='#C4014D';ctx.fillRect(0,0,w,14);
  const txt=(t,x,y,size=20,color='#30212c',weight=700,align='right')=>{ctx.font=`${weight} ${size}px Almarai,Tahoma,Arial,sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(t??''),x,y)};
  const line=y=>{ctx.strokeStyle='#e9dfe5';ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(w-margin,y);ctx.stroke()};
  const box=(x,y,wi,he,color)=>{ctx.fillStyle=color;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,wi,he,12);else ctx.rect(x,y,wi,he);ctx.fill()};
  txt(c.name||'مايفنت',w-margin,91,35,'#C4014D',800);txt('مايفنت',margin,91,23,'#C4014D',800,'left');
  if(typeof c.logo==='string'&&(/^(?:blob:|data:image\/(?:png|jpeg|webp);base64,)/i.test(c.logo)))try{const image=new Image();image.src=c.logo;await image.decode();ctx.drawImage(image,margin,110,78,78);}catch{}
  txt('سند حجز وتفاصيل المناسبة',w-margin,136,22,'#775c6c');line(162);
  txt('رقم الحجز',w-margin,203,17,'#806c77');txt(b.bookingNo||b.id,w-margin,246,28);
  txt('تاريخ المناسبة',440,203,17,'#806c77');txt(b.date||'',440,246,27);line(273);
  txt('اسم العميل',w-margin,321,18,'#806c77');txt(b.name||'',w-margin,364,29);line(392);
  let y=425;for(const entry of detailBlocks){txt(entry.label,w-margin,y,17,'#806c77');y+=29;for(const t of entry.lines){txt(t,w-margin,y,20);y+=29;}line(y+1);y+=14;}
  if(additions.length){txt('الإضافات والخصومات',w-margin,y+24,23,'#C4014D',800);y+=62;for(const a of additions){for(const t of wrap(a.reason,inner-230,18)){txt(t,w-margin,y,18);y+=24;}txt((a.kind==='discount'?'−':'+')+money(a.value)+' '+curr,margin,y-24,18,'#5e4451',800,'left');line(y+5);y+=18;}}
  const fin=y+28;[['الإجمالي',b.amount],['المدفوع',b.paid],['المتبقي',Math.max(0,Number(b.amount||0)-Number(b.paid||0))]].forEach(([label,value],i)=>{const x=margin+i*260;box(x,fin,246,102,i===2?'#fceaf1':'#f6f3f6');txt(label,x+220,fin+37,18,'#64505a');txt(money(value)+' '+curr,x+220,fin+75,20,i===2?'#C4014D':'#34232d',800)});
  y=fin+151;txt('سجل الدفعات',w-margin,y,22,'#C4014D',800);line(y+18);y+=61;
  const initial=Number(b.paid||0)-rows.reduce((sum,r)=>sum+Number(r.amount||0),0);
  if(initial>0){txt('الدفعة الأولية',w-margin,y,18);txt(money(initial)+' '+curr,margin,y,18,'#41313b',800,'left');y+=40;}
  for(const r of paymentBlocks){txt(r.label,w-margin,y,18);txt(money(r.amount)+' '+curr,margin,y,18,'#41313b',800,'left');y+=24;for(const note of r.lines.filter(Boolean)){txt(note,w-margin,y,16,'#806c77');y+=24;}line(y+4);y+=20;}
  if(receiptNotes){y+=20;txt('ملاحظات السندات',w-margin,y,22,'#C4014D',800);y+=38;for(const lineText of wrap(receiptNotes,inner-20,17)){txt(lineText,w-margin,y,17,'#6d5965');y+=24;}}
  if(terms.length){y+=22;txt('شروط الحجز',w-margin,y,23,'#C4014D',800);y+=42;for(const entry of termBlocks){box(margin,y-17,inner,12+entry.lines.length*25,'#fff5f8');txt(entry.label+'.',w-margin-14,y+3,18,'#C4014D',800);for(const lineText of entry.lines){txt(lineText,w-margin-55,y+3,18,'#34232d');y+=25;}y+=27;}}
  line(y+32);txt('نسخة إلكترونية من بيانات الحجز — تحقق من صحتها قبل المشاركة',w-margin,y+67,16,'#796876');
  if(y+100>h)throw Error('تعذر احتواء تفاصيل السند في الصورة');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(!blob||blob.size<1000)throw Error('تعذر إنشاء JPG');
  save(blob,`myevent-booking-${String(b.bookingNo||b.id).replace(/[^a-zA-Z0-9-]/g,'')}.jpg`);return {bytes:blob.size,rows:rows.length};
 }
});
