/* Myfnt 2.14.8 — canonical recipient & channel resolver. */
'use strict';
(()=>{
 const repo=n=>window.MyfntRepositories?.[n];
 const cleanPhone=value=>window.MyfntPhone?.digits?.(value)||String(value||'').replace(/\D/g,'');
 const CHANNELS=Object.freeze([
  {id:'sms',label:'SMS',icon:'fa-message'},
  {id:'whatsapp',label:'WhatsApp',icon:'fa-brands fa-whatsapp'}
 ]);
 function settings(){return repo('settings')?.get?.()||window.state?.settings||{};}
 function normalizeChannel(value){return String(value||'').toLowerCase()==='whatsapp'?'whatsapp':'sms';}
 function makeId(channel,phone,index=0){return `msg-${normalizeChannel(channel)}-${cleanPhone(phone)||'empty'}-${index}`;}
 function normalizeEntry(raw,index=0){
  const channel=normalizeChannel(raw?.channel),phone=cleanPhone(raw?.phone);
  return {id:String(raw?.id||makeId(channel,phone,index)),phone,channel,label:String(raw?.label||'').trim()||`رقم ${channel==='sms'?'SMS':'WhatsApp'}`,active:raw?.active!==false,primary:raw?.primary===true};
 }
 function dedupe(rows){
  const out=[],seen=new Set();
  (Array.isArray(rows)?rows:[]).forEach((raw,i)=>{const row=normalizeEntry(raw,i),key=`${row.channel}:${row.phone}`;if(!row.phone||seen.has(key))return;seen.add(key);out.push(row);});
  for(const channel of ['sms','whatsapp']){const group=out.filter(x=>x.channel===channel&&x.active);if(group.length&&!group.some(x=>x.primary))group[0].primary=true;let found=false;for(const row of out.filter(x=>x.channel===channel)){if(row.primary&&!found)found=true;else if(row.primary)row.primary=false;}}
  return out;
 }
 function legacyRows(){
  const c=settings().company||{},rows=[];
  if(cleanPhone(c.sms))rows.push({id:'legacy-message-sms',phone:c.sms,channel:'sms',label:'رقم الرسائل SMS',active:true,primary:true});
  if(cleanPhone(c.whatsapp))rows.push({id:'legacy-message-whatsapp',phone:c.whatsapp,channel:'whatsapp',label:'رقم الرسائل WhatsApp',active:true,primary:true});
  return dedupe(rows);
 }
 function hasCanonicalStore(){return Array.isArray(settings().communication?.messageNumbers);}
 function all(){
  const canonical=settings().communication?.messageNumbers;
  return dedupe(Array.isArray(canonical)?canonical:legacyRows());
 }
 function byChannel(channel,{activeOnly=true}={}){const ch=normalizeChannel(channel);return all().filter(x=>x.channel===ch&&(!activeOnly||x.active));}
 function company(channel='sms'){
  return byChannel(channel).map(row=>({kind:'staff',recipientType:'company_message_number',messageNumberId:row.id,userId:null,role:'staff',name:row.label,phone:row.phone,channel:row.channel,source:'message_numbers'}));
 }
 function client(booking,channel='sms'){
  const phone=cleanPhone(booking?.phone);if(!phone)return null;
  return {kind:'client',recipientType:'customer',userId:null,role:'client',name:booking?.name||'العميل',phone,channel:normalizeChannel(channel),source:'booking_customer'};
 }
 function sessions(){const id=String(window.OzanScope?.read?.()?.userId||'');return id?[{kind:'session_principal',userId:id,role:'owner',name:'جميع جلسات الشركة'}]:[];}
 function validate(rows){
  const normalized=dedupe(rows),raw=(Array.isArray(rows)?rows:[]).map((x,i)=>normalizeEntry(x,i));
  const invalid=raw.filter(x=>!x.phone),keys=new Set(),duplicates=[];
  for(const x of raw){if(!x.phone)continue;const k=`${x.channel}:${x.phone}`;if(keys.has(k))duplicates.push(x);keys.add(k);}
  return {ok:!invalid.length&&!duplicates.length,rows:normalized,invalid,duplicates};
 }
 function save(rows){
  const check=validate(rows);if(!check.ok){const e=Error(check.invalid.length?'يوجد رقم رسائل غير صالح':'لا يمكن تكرار نفس الرقم على نفس القناة');e.code=check.invalid.length?'invalid_message_number':'duplicate_message_number';throw e;}
  repo('settings')?.mutate?.(s=>{
   s.communication=s.communication&&typeof s.communication==='object'?s.communication:{};
   s.communication.messageNumbers=structuredClone(check.rows);
   // Compatibility shadow only. New messaging code must never resolve recipients from these fields.
   s.company=s.company||{};
   s.company.sms=check.rows.find(x=>x.active&&x.channel==='sms')?.phone||'';
   s.company.whatsapp=check.rows.find(x=>x.active&&x.channel==='whatsapp')?.phone||'';
  });
  document.dispatchEvent(new CustomEvent('myfnt:message-numbers-changed',{detail:{count:check.rows.length}}));
  return check.rows;
 }
 function migrateLegacy(){
  if(hasCanonicalStore())return {migrated:false,rows:all()};
  const legacy=legacyRows();if(!legacy.length)return {migrated:false,rows:[]};
  try{save(legacy);return {migrated:true,rows:legacy};}catch{return {migrated:false,rows:legacy};}
 }
 window.MyfntRecipientResolver=Object.freeze({channels:CHANNELS,all,byChannel,company,client,sessions,validate,save,migrateLegacy,cleanPhone,normalizeChannel});
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>migrateLegacy(),{once:true}):migrateLegacy();
})();
