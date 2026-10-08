/* Myfnt 2.10.1 Step 21B — canonical in-memory customer directory persisted by IndexedDB aggregate transactions. */
'use strict';
(()=>{
 const KEY='ozan.customers.directory.v1';let ready=false,externalChange=false;
 const nameKey=value=>normalizeSearch(String(value||'').normalize('NFKC').replace(/\s+/g,' '));
 const phoneKey=value=>normalizePhone(value||'');
 const repository=()=>window.MyfntRepositories?.customers||null;
 const listed=()=>repository()?.all?.()||(Array.isArray(state.customers)?state.customers:[]);
 const byId=id=>repository()?.get?.(id)||listed().find(c=>c.id===id)||null;
 const numberUsed=()=>new Set(listed().map(c=>String(c.customerNo||'')));
 function nextNumber(){return window.MyfntSequences?.nextCustomer?.()||String(Math.max(0,...listed().map(c=>Number(c.customerNo)||0))+1);
 }
 function candidate(name,phone,exceptId=''){
  const n=nameKey(name),p=phoneKey(phone);
  return n&&p?listed().find(c=>c.id!==exceptId&&nameKey(c.name)===n&&phoneKey(c.phone)===p)||null:null;
 }
 function conflicts(name,phone,exceptId=''){
  const n=nameKey(name),p=phoneKey(phone);
  return n&&p?listed().filter(c=>c.id!==exceptId&&nameKey(c.name)===n&&phoneKey(c.phone)===p):[];
 }
 function prepare(name,phone,{selectedId='',existingId='',allowDuplicate=false,customerNo=''}={}){
  if(!ready||externalChange||window.MyfntTabGuard?.isStale?.())throw Error('دليل العملاء يحتاج تحديثًا آمنًا؛ أعد فتح التطبيق قبل إضافة حجز جديد.');
  name=String(name||'').replace(/\s+/g,' ').trim();phone=phoneKey(phone);
  if(!name)throw Error('اسم العميل مطلوب');if(phone&&!/^\d{7,15}$/.test(phone))throw Error('رقم العميل غير صالح');
  let linked=byId(selectedId||existingId);
  if((selectedId||existingId)&&!linked)throw Error('لم يُعثر على ملف العميل المختار. أعد اختيار العميل.');
  // Editing an existing canonical customer without changing their contact details is safe,
  // even when an intentionally independent customer happens to share those details.
  const unchanged=Boolean(linked&&nameKey(linked.name)===nameKey(name)&&phoneKey(linked.phone)===phone);
  const matches=unchanged?[]:conflicts(name,phone,linked?.id||'');
  if(matches.length&&!allowDuplicate){const c=matches[0];
   throw Error(`يوجد ملف عميل بنفس الاسم والهاتف: ${c.name} (#${c.customerNo}). اختر الملف أو أنشئ عميلًا مستقلًا من نافذة التأكيد.`);
  }
  if(linked){return {customer:{...linked,name,phone,updatedAt:Date.now()},isNew:false,allowDuplicate:Boolean(allowDuplicate)};}
  return {customer:{id:uid('customer'),customerNo:String(customerNo||nextNumber()),name,phone,createdAt:Date.now(),updatedAt:Date.now(),...(allowDuplicate?{intentionalDuplicate:true}:{})},isNew:true,allowDuplicate:Boolean(allowDuplicate)};
 }
 function migrate(bookings,receipts=[],{ignoreSaved=false}={}){
  ready=false;
  const previous=listed().map(c=>({...c}));
  const migrated=previous.filter(c=>c&&c.id&&c.name).map(c=>({...c,customerNo:String(c.customerNo||'')}));
  if(repository()?.replaceLocal)repository().replaceLocal(migrated,{persist:false});else state.customers=migrated;
  let changed=previous.some(c=>typeof c.customerNo!=='string');
  // A stable index avoids repeatedly scanning the entire directory for each old booking.
  // Preserve legacy IDs exactly: a matching name or phone NEVER silently merges people.
  const byLegacyId=new Map(listed().map(c=>[String(c.id),c]));
  const reserved=numberUsed();
  let next=1;
  const allocateNumber=()=>{while(reserved.has(String(next)))next++;const value=String(next++);reserved.add(value);return value;};
  // Upgrade missing/legacy display numbers to simple positive sequential references.
  for(const c of listed())if(!/^[1-9]\d*$/.test(String(c.customerNo||''))){c.customerNo=allocateNumber();changed=true;}
  for(const b of bookings){
   const oldId=String(b.customerId||'');const id=oldId||('legacy-booking:'+String(b.id));
   let c=byLegacyId.get(id);
   if(!c){
    c={id,customerNo:allocateNumber(),name:b.name||'عميل',phone:phoneKey(b.phone),createdAt:Number(b.createdAt)||Date.now(),updatedAt:Date.now(),legacy:!!oldId};
    listed().push(c);byLegacyId.set(id,c);changed=true;
   }
   if(b.customerId!==c.id){b.customerId=c.id;changed=true;}
  }
  // Receipts retain their original amounts while receiving a direct canonical customer link.
  const bookingIds=new Map(bookings.map(b=>[b.id,b.customerId]));
  for(const r of receipts){const id=bookingIds.get(r.bookingId);if(id&&r.customerId!==id){r.customerId=id;changed=true;}}
  ready=true;return {changed,customers:listed().length,duplicates:duplicateReport()};
 }
 function duplicateReport(){
  // Only an exact (name + phone) match is a potential duplicate. Deliberately
  // independent customers are valid and should not be reported as damaged data.
  const seen=new Map(),result=[];
  for(const c of listed()){
   const n=nameKey(c.name),p=phoneKey(c.phone);if(!n||!p)continue;
   const key=JSON.stringify([n,p]),first=seen.get(key);
   if(first&&first.id!==c.id&&!first.intentionalDuplicate&&!c.intentionalDuplicate)
     result.push({type:'name-and-phone',firstId:first.id,secondId:c.id});
   else if(!first)seen.set(key,c);
  }
  return result;
 }
 function invalidate(){ready=false;}
 function save(){
  if(!ready||externalChange||window.MyfntTabGuard?.isStale?.())return false;
  // Persistence is owned by IndexedDB aggregate transactions; no full directory JSON write.
  return true;
 }
 function all(){return repository()?.snapshot?.()||listed().map(c=>({...c}));}
 window.MyfntCustomers=Object.freeze({KEY,ready:()=>ready&&!externalChange,invalidate,nameKey,phoneKey,byId,all,candidate,conflicts,prepare,migrate,duplicateReport,save,nextNumber});
})();
