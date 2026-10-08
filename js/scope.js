/* Per-account local workspace. Local-only demo, not server authentication/security. */
'use strict';
window.OzanScope=(()=>{
 const SESSION='ozan.auth.session.v1',KEYS=new Set(['ozan.bookings.v1','ozan.settings.v2','ozan.packages.v1','ozan.receipts.v1','ozan.special-days.v1','ozan.notifications.read.v1','ozan.notifications.read-at.v1','ozan.sync-audit.v1','ozan.booking-history.v1','ozan.experience.v1','ozan.reminder-delivery.v1','ozan.advanced.usage.v1','ozan.finance.audit.v1','ozan.finance.journal.v1','ozan.finance.customers.v1','ozan.customers.directory.v1','ozan.daily-backup.last','ozan.backup-reminded-day']);
 const read=()=>{try{const s=JSON.parse(localStorage.getItem(SESSION)||'null');return s?.userId&&s.companyId&&s.expires>Date.now()?s:null}catch{return null}};
 const scopedKey=k=>{const s=read();return s&&KEYS.has(k)?`ozan.workspace.v1.${encodeURIComponent(s.userId)}.${encodeURIComponent(s.companyId)}.${k}`:k};
 const owner=()=>{const s=read();return s?{userId:s.userId,companyId:s.companyId}:null};
 const renewDemoSession=()=>{const s=read();if(!s?.demo||s.expires-Date.now()>86400000)return s;if(!crypto?.randomUUID)return s;const next={...s,token:crypto.randomUUID(),lastSeenAt:Date.now(),expires:Date.now()+7*86400000};try{localStorage.setItem(SESSION,JSON.stringify(next));return next}catch{return s}};
 return Object.freeze({read,scopedKey,owner,renewDemoSession,keys:KEYS});
})();
