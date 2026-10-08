/* OZAN Excel: منشئ مصنف مستقل، بلا CDN. مكتبة JSZip المحلية تتولى ضغط XLSX. */
(function(root){'use strict';
 const XML='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const esc=v=>String(v??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]));
 const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const numberKeys=new Set(['amount','paid','temporaryHours']);
 function sheetXml(rows,fields,progress){
  const parts=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
   `<worksheet xmlns="${XML}"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`,
   '<sheetFormatPr defaultRowHeight="21"/><cols>',
   ...fields.map(([k],i)=>`<col min="${i+1}" max="${i+1}" width="${k==='notes'?44:k==='name'?28:k==='id'?27:19}" customWidth="1"/>`),
   '</cols><sheetData>'];
  const rowXml=(row,index)=>{
   const cells=fields.map(([key,label],j)=>{
    const address=column(j)+(index+1),value=index===0?label:key==='adjustments'?JSON.stringify(row.adjustments||[]):row[key];
    if(index>0&&numberKeys.has(key)&&value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value))){
     return `<c r="${address}" s="2"><v>${Number(value)}</v></c>`;
    }
    // inlineStr يحافظ على العربية والأرقام الهاتفية والأصفار الأولى، ولا يفسّرها كمعادلات.
    return `<c r="${address}" s="${index===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
   }).join('');
   return `<row r="${index+1}" ${index===0?'ht="27" customHeight="1"':''}>${cells}</row>`;
  };
  parts.push(rowXml({},0));
  const total=Math.max(rows.length,1);
  for(let i=0;i<rows.length;i++){
   parts.push(rowXml(rows[i],i+1));
   if(i%250===0)progress?.(Math.min(28,Math.floor((i+1)/total*28)),'تجهيز سجلات الحجوزات: '+(i+1)+' / '+rows.length);
  }
  parts.push('</sheetData>',`<autoFilter ref="A1:${column(fields.length-1)}${rows.length+1}"/>`,'<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>');
  return parts.join('');
 }
 async function exportWorkbook({rows,fields,filename,onProgress}){
  if(typeof root.JSZip!=='function')throw new Error('مكتبة JSZip غير محمّلة');
  if(!Array.isArray(rows)||!Array.isArray(fields)||!fields.length)throw new Error('بيانات التصدير غير صالحة');
  if(rows.length>100000)throw new Error('عدد السجلات كبير؛ صدّر البيانات على دفعات');
  const progress=(n,desc)=>{try{onProgress?.(n,desc);}catch(_){/* واجهة التقدم لا تعطل التصدير */}};
  progress(1,'إنشاء جدول Excel…');
  const sheet=sheetXml(rows,fields,progress),zip=new root.JSZip();
  const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="'+XML+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="الحجوزات" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="'+XML+'"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF9C1644"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE7D8DE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment vertical="center" horizontal="right"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  zip.file('[Content_Types].xml',contentTypes);zip.file('_rels/.rels',rels);
  zip.file('xl/workbook.xml',wb);zip.file('xl/_rels/workbook.xml.rels',wbRels);
  zip.file('xl/worksheets/sheet1.xml',sheet);zip.file('xl/styles.xml',styles);
  progress(30,'ضغط ملف Excel…');
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}},m=>progress(30+Math.floor(m.percent*0.65),'ضغط Excel: '+Math.floor(m.percent)+'٪'));
  if(!blob.size)throw Error('فشل إنشاء ملف Excel');
  progress(97,'تجهيز التنزيل…');
  const url=URL.createObjectURL(new Blob([blob],{type:mime})),a=document.createElement('a');
  a.href=url;a.download=filename||'myevent-bookings.xlsx';a.style.display='none';document.body.appendChild(a);a.click();a.remove();
  // تأخير تحرير الرابط حتى يتمكن Chrome على Android من بدء الحفظ.
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  progress(100,'تم تجهيز الملف وبدء التنزيل');
  return blob;
 }
 root.OzanExcel={exportWorkbook,sheetXml};
})(window);
