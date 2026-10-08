/* Myfnt 2.14.0 — canonical compact .db backup container (MYFNTDB1). */
'use strict';
(()=>{
 const MAGIC_GZIP='MYFNTDB1:GZIP\n',MAGIC_JSON='MYFNTDB1:JSON\n';
 const EXCLUDED_STORES=new Set(['media','sync_queue','sync_conflicts','notification_jobs','notifications','local_meta','outbox','snapshots','users','company_memberships','plans','company_subscriptions','error_logs','company_backups','entity_tombstones']);
 const SECRET_KEYS=/password|passwordhash|salt|token|secret|authorization|credential|oauth|bearer|sessiontoken/i;
 const enc=new TextEncoder(),dec=new TextDecoder();
 const cloneSafe=(value)=>{
  const seen=new WeakSet();
  const walk=(v)=>{
   if(v===null||typeof v!=='object')return v;
   if(seen.has(v))return null;seen.add(v);
   if(Array.isArray(v))return v.map(walk);
   const out={};for(const [k,x] of Object.entries(v)){if(SECRET_KEYS.test(k))continue;out[k]=walk(x);}return out;
  };
  return walk(value);
 };
 async function sha256Text(text){if(!crypto?.subtle)throw Error('SHA-256 غير متاح');const hash=await crypto.subtle.digest('SHA-256',enc.encode(text));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 function owner(){return window.OzanScope?.owner?.()||window.OzanScope?.read?.()||null;}
 async function normalizedTables(){
  const exp=await window.MyfntLocal?.exportRows?.();const src=exp?.tables||{},tables={};
  for(const [name,rows] of Object.entries(src)){if(EXCLUDED_STORES.has(name)||!Array.isArray(rows))continue;tables[name]=cloneSafe(rows);}
  return tables;
 }
 async function buildPayload(){
  const full=window.MyfntDomainRuntime?.lazy&&window.MyfntQuery?.exportLegacyDataset?await window.MyfntQuery.exportLegacyDataset():null;
  const settings=cloneSafe(window.MyfntRepositories?.settings?.snapshot?.()||window.MyfntRepositories?.settings?.get?.()||window.state?.settings||{});
  const payload={
   schema:'ozan-backup-v1',databaseSchema:'myfnt-db-v2',owner:cloneSafe(owner()),createdAt:new Date().toISOString(),appVersion:String(window.APP_VERSION||'2.14.5'),
   bookings:cloneSafe(full?.bookings||(window.MyfntRepositories?.bookings?.snapshot?.()||[])),
   customers:cloneSafe(full?.customers||(window.MyfntRepositories?.customers?.snapshot?.()||[])),
   packages:cloneSafe(window.MyfntRepositories?.packages?.snapshot?.()||[]),
   receipts:cloneSafe(full?.receipts||(window.MyfntRepositories?.payments?.snapshot?.()||[])),
   specialDays:cloneSafe(window.MyfntRepositories?.specialDays?.snapshot?.()||[]),settings,
   financeAudit:cloneSafe(window.MyfntFinance?.audit?.()||[]),financeCustomerNotes:cloneSafe(window.MyfntFinance?.notes?.()||{}),
   bookingHistory:cloneSafe(window.ozHistory||{}),experience:cloneSafe(window.ozPreferences||{}),
   alertTemplates:cloneSafe(window.MyfntRepositories?.alerts?.snapshot?.()||[]),
   database:{engine:'indexeddb',format:'normalized-tables-v1',tables:await normalizedTables()}
  };
  // Keep optional non-secret advanced settings only.
  try{const extra=cloneSafe(window.OzanAdvanced?.settingsBackup?.()||{});Object.assign(payload,extra);}catch{}
  // Derived/transient notification read state is intentionally not exported.
  delete payload.notificationRead;delete payload.notificationReadAt;delete payload.notifications;delete payload.syncAudit;
  return payload;
 }
 async function makeWrapper(payload=null){payload=payload||await buildPayload();const raw=JSON.stringify(payload),sha256=await sha256Text(raw);return {type:'myfnt-db-backup',containerVersion:1,hashAlgorithm:'SHA-256',sha256,payload};}
 async function compress(bytes){if(typeof CompressionStream==='undefined')return null;const cs=new CompressionStream('gzip'),writer=cs.writable.getWriter();await writer.write(bytes);await writer.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer());}
 async function decompress(bytes){if(typeof DecompressionStream==='undefined')throw Error('المتصفح لا يدعم فك ضغط هذه النسخة');const ds=new DecompressionStream('gzip'),writer=ds.writable.getWriter();await writer.write(bytes);await writer.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer());}
 async function encodeWrapper(wrapper){const body=enc.encode(JSON.stringify(wrapper)),gz=await compress(body);const header=enc.encode(gz?MAGIC_GZIP:MAGIC_JSON),data=gz||body,out=new Uint8Array(header.length+data.length);out.set(header,0);out.set(data,header.length);return out;}
 async function decodeBytes(bytes){
  const prefix=dec.decode(bytes.slice(0,Math.min(bytes.length,32))),gzip=prefix.startsWith(MAGIC_GZIP),plain=prefix.startsWith(MAGIC_JSON);
  if(!gzip&&!plain)throw Error('ملف .db لا يحمل توقيع MYFNTDB1');const header=enc.encode(gzip?MAGIC_GZIP:MAGIC_JSON).length;const body=gzip?await decompress(bytes.slice(header)):bytes.slice(header);const wrapper=JSON.parse(dec.decode(body));
  if(!wrapper?.payload||!['myfnt-db-backup','ozan-backup'].includes(wrapper.type))throw Error('حاوية النسخة غير صالحة');
  const digest=await sha256Text(JSON.stringify(wrapper.payload));if(wrapper.sha256!==digest)throw Error('فشل فحص SHA-256 للنسخة');return wrapper;
 }
 async function decodeFile(file){
  if(!file)throw Error('اختر ملف نسخة احتياطية');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const prefix=dec.decode(bytes.slice(0,Math.min(bytes.length,32)));
  if(prefix.startsWith('MYFNTDB1:'))return decodeBytes(bytes);
  // Legacy JSON import remains supported.
  const wrapper=JSON.parse(dec.decode(bytes));if(!wrapper?.payload)throw Error('ملف النسخة غير مدعوم');const digest=await sha256Text(JSON.stringify(wrapper.payload));if(wrapper.sha256&&wrapper.sha256!==digest)throw Error('فشل فحص سلامة النسخة');return wrapper;
 }
 function filename(day=new Date().toISOString().slice(0,10)){return `myfnt-backup-${day}.db`;}
 async function downloadBytes(bytes,name=filename()){const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);const blob=new Blob([data],{type:'application/octet-stream'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);return {bytes:data.byteLength,name};}
 async function downloadWrapper(wrapper,name=filename()){const bytes=await encodeWrapper(wrapper);return downloadBytes(bytes,name); }
 function summary(payload){const tables=payload?.database?.tables||{};return {bookings:Number(payload?.bookings?.length||tables.bookings?.length||0),payments:Number(payload?.receipts?.length||tables.payments?.length||0),customers:Number(payload?.customers?.length||tables.customers?.length||0),tables:Object.keys(tables).length};}
 window.MyfntBackup=Object.freeze({buildPayload,makeWrapper,encodeWrapper,decodeFile,decodeBytes,downloadWrapper,downloadBytes,filename,summary,excludedStores:[...EXCLUDED_STORES]});
})();
