/* Myfnt 2.9.8 r14 — workspace display sequences.
   Visible business references are simple positive integers starting at 1.
   Internal sync UUIDs remain separate inside IndexedDB. */
'use strict';
(()=>{
 const MIGRATION_KEY='ozan.sequence.display.v1';
 const positive=value=>{const n=Number(String(value??'').replace(/\D/g,''));return Number.isSafeInteger(n)&&n>0?n:0;};
 const ordered=list=>[...(Array.isArray(list)?list:[])].sort((a,b)=>Number(a?.createdAt||0)-Number(b?.createdAt||0)||String(a?.id||'').localeCompare(String(b?.id||'')));
 const nextFor=(list,field)=>{let max=0;for(const item of Array.isArray(list)?list:[])max=Math.max(max,positive(item?.[field]));return String(max+1);};
 const renumber=(list,field)=>{let changed=false,n=1;for(const item of ordered(list)){const value=String(n++);if(String(item?.[field]||'')!==value){item[field]=value;changed=true;}}return changed;};
 function migrate({force=false}={}){
  if(!force&&safeStorage.get(MIGRATION_KEY)==='1')return {changed:false,alreadyMigrated:true,bookings:state.bookings?.length||0,customers:state.customers?.length||0,receipts:state.receipts?.length||0};
  let changed=false;
  changed=renumber(window.state?.bookings,'bookingNo')||changed;
  changed=renumber(window.state?.customers,'customerNo')||changed;
  changed=renumber(window.state?.receipts,'receiptNo')||changed;
  changed=renumber(window.state?.receipts,'movementNo')||changed;
  safeStorage.set(MIGRATION_KEY,'1');
  return {changed,bookings:state.bookings?.length||0,customers:state.customers?.length||0,receipts:state.receipts?.length||0};
 }
 const api={
  valid:value=>positive(value)>0,
  nextBooking:()=>nextFor(state.bookings,'bookingNo'),
  nextCustomer:()=>nextFor(window.MyfntRepositories?.customers?.all?.()||state.customers,'customerNo'),
  nextReceipt:()=>nextFor(window.MyfntRepositories?.payments?.all?.()||state.receipts,'receiptNo'),
  nextMovement:()=>nextFor(window.MyfntRepositories?.payments?.all?.()||state.receipts,'movementNo'),
  migrate
 };
 window.MyfntSequences=Object.freeze(api);
})();
