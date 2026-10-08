/* Myfnt 2.14.7 — non-destructive architecture regression tests.
 * These tests never create/delete production rows. They verify pure contracts and canonical identity behavior only.
 */
'use strict';
(()=>{
 const UUID='123e4567-e89b-42d3-a456-426614174000';
 const result=(name,ok,detail='')=>({name,ok:Boolean(ok),detail:String(detail||'')});
 async function run(){
  const tests=[];
  try{
   const row={id:UUID,legacy_id:'standalone-receipt-1',booking_id:null,booking_legacy_id:'',customer_id:null,amount_minor:12500,currency:'YER',direction:'in',receipt_no:'900001',movement_no:'900001',posted_at:'2026-10-02T12:00:00.000Z',status:'posted'};
   const payment=window.MyfntMappers?.payment?.fromRow?.(row,{bookingByUuid:new Map(),customerByUuid:new Map()});
   const keep=window.MyfntHydration?.testHooks?.keepHydratedPayment?.(payment);
   tests.push(result('سند بدون حجز يبقى بعد Hydration/إعادة التشغيل',payment?.id==='standalone-receipt-1'&&payment?.bookingId===''&&keep===true,`bookingId=${payment?.bookingId??'null'}`));
  }catch(e){tests.push(result('سند بدون حجز يبقى بعد Hydration/إعادة التشغيل',false,e.message));}
  try{
   const canonical=await window.MyfntLocal?.uuidFor?.('bookings',UUID);
   tests.push(result('UUID القانوني لا يتغير',canonical===UUID,canonical||'no-result'));
  }catch(e){tests.push(result('UUID القانوني لا يتغير',false,e.message));}
  try{
   const policy=window.MyfntOffline?.restorePolicy?.();
   tests.push(result('Restore لا ينشئ Sync Queue',policy?.enqueue===false&&policy?.createsQueue===false&&policy?.reason==='restore',JSON.stringify(policy||{})));
  }catch(e){tests.push(result('Restore لا ينشئ Sync Queue',false,e.message));}
  try{
   const display=window.MyfntPhone?.display?.('+967777123456'),digits=window.MyfntPhone?.digits?.('777123456');
   tests.push(result('عرض الهاتف محلي والإرسال يعيد 967',display==='777123456'&&digits==='967777123456',`display=${display}; digits=${digits}`));
  }catch(e){tests.push(result('عرض الهاتف محلي والإرسال يعيد 967',false,e.message));}
  try{
   const b=window.MyfntBackup,ok=!!b&&b.filename?.('2026-10-03')==='myfnt-backup-2026-10-03.db'&&b.excludedStores?.includes?.('sync_queue')&&b.excludedStores?.includes?.('users');
   tests.push(result('نسخة .db تستبعد Queue والجلسات/الحسابات الحساسة',ok,b?.filename?.('2026-10-03')||'backup module missing'));
  }catch(e){tests.push(result('نسخة .db تستبعد Queue والجلسات/الحسابات الحساسة',false,e.message));}
  try{
   const registry=window.MyfntEventRegistry,policy=window.MyfntCommunicationPolicy,regCodes=registry?.communicationEvents?.().map(x=>x.code).sort()||[],policyCodes=(policy?.events||[]).map(x=>x.code).sort(),smartRequired=['booking.amount_missing','booking.overpaid','booking.unpaid_after_event','booking.temporary_expired'];
   const aligned=regCodes.length>0&&JSON.stringify(regCodes)===JSON.stringify(policyCodes),smartOk=smartRequired.every(code=>!!registry?.definition?.(code));
   tests.push(result('Event Registry موحد مع Communication Policy ومراقبات Smart',aligned&&smartOk,`communication=${regCodes.length}; smart=${smartOk}`));
  }catch(e){tests.push(result('Event Registry موحد مع Communication Policy ومراقبات Smart',false,e.message));}
  try{
   const hooks=window.MyfntBootstrap?.testHooks,fixture={replacePending:true,reconciliation:{conflict:1,'local-newer':0,'identity-conflict':0},tables:{'working:bookings':{done:true},'archive:bookings':{done:true}}};
   const blocked=hooks?.hasBlockingReconciliation?.(fixture)===true,canPrune=hooks?.canFinalizeReplacement?.(fixture)===true;
   tests.push(result('Bootstrap لا يمسح Local data عند Conflict',blocked&&!canPrune,`blocked=${blocked}; canPrune=${canPrune}`));
  }catch(e){tests.push(result('Bootstrap لا يمسح Local data عند Conflict',false,e.message));}
  try{
   const authority=window.MyfntRepositories?.authority?.();
   tests.push(result('IndexedDB هو السلطة القانونية وLocalStorage توافق فقط',authority?.version>=2&&authority?.domain==='indexeddb'&&authority?.legacySyncReads==='compatibility-only',JSON.stringify(authority||{})));
  }catch(e){tests.push(result('IndexedDB هو السلطة القانونية وLocalStorage توافق فقط',false,e.message));}
  return {version:'2.14.18',generatedAt:new Date().toISOString(),healthy:tests.every(x=>x.ok),passed:tests.filter(x=>x.ok).length,total:tests.length,tests};
 }
 window.MyfntRegressionTests=Object.freeze({run});

// 2.14.11: preview phone contract uses the centralized MyfntPhone service.
try{
  const sample=window.MyfntPhone?.display?.(window.MyfntPhone?.digits?.('777123456')||'777123456');
  if(!sample) throw new Error('preview phone formatting unavailable');
}catch(err){ console.error('[Regression] preview phone contract',err); }
})();
