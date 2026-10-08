/* Myfnt 2.14.0 Step 22A.2/22A.3/22A.4 — First Server Adoption guarded by Bootstrap Reconciliation.
 * One-time bridge for records created before Laravel/API existed.
 * It never converts historical rows into ordinary sync_queue commands and never
 * marks a row adopted until the server explicitly acknowledges that exact row snapshot.
 */
'use strict';
(()=>{
 const STATE_KEY='first-server-adoption-v1';
 const CONTRACT_VERSION=1;
 const IDENTITY_CONTRACT_VERSION=1;
 const TABLE_ORDER=['company_settings','booking_packages','booking_package_versions','booking_types','customers','bookings','booking_details','payments','booking_audit','payment_audit','wallets','ledger_accounts','journal_entries','journal_lines','calendar_blocks','alert_rules','sms_templates','sms_messages','sms_approvals','archive_records','support_tickets','support_messages','chat_threads','chat_messages','company_backups'];
 const local=()=>window.MyfntLocal;
 const api=()=>window.OzanApi;
 const syncEnabled=()=>Boolean(window.MyfntSync?.enabled?.());
 const workspace=()=>{const s=window.OzanScope?.read?.();return s?.companyId&&s?.userId?`${s.companyId}:${s.userId}`:'';};
 const now=()=>new Date().toISOString();
 const fresh=()=>({version:CONTRACT_VERSION,workspace:workspace(),status:'idle',phase:'idle',adoptionId:null,total:0,processed:0,currentTable:null,tables:{},lastError:null,startedAt:null,completedAt:null,updatedAt:now()});
 let state=null,running=null;
 async function load(){if(state&&state.workspace===workspace())return state;const saved=await local()?.getUiMeta?.(STATE_KEY);state=saved&&saved.workspace===workspace()?{...fresh(),...saved,tables:saved.tables||{}}:fresh();return state;}
 async function save(patch={}){const st=await load();Object.assign(st,patch,{workspace:workspace(),updatedAt:now()});await local()?.setUiMeta?.(STATE_KEY,st);document.dispatchEvent(new CustomEvent('myfnt:adoption-progress',{detail:{...st}}));return st;}
 function requireTransport(){if(!syncEnabled())throw Object.assign(Error('اعتماد البيانات المحلية يحتاج Laravel/API حقيقي.'),{code:'ADOPTION_TRANSPORT_DISABLED'});}
 async function request(path,opts={}){requireTransport();const r=await api().request(path,opts);if(r?.ok)return r;const status=Number(r?.status||0);throw Object.assign(Error(r?.message||'تعذر تنفيذ اعتماد البيانات المحلية'),{status,code:status===404?'ADOPTION_API_UNAVAILABLE':'ADOPTION_API_ERROR',response:r,retryable:status===0||status===408||status===429||status>=500});}
 async function startSession(summary){
  const r=await request('/bootstrap/adoption/start',{method:'POST',body:{contract_version:CONTRACT_VERSION,identity_contract_version:IDENTITY_CONTRACT_VERSION,identity_policy:'client_uuid_is_canonical',workspace:workspace(),local_company_id:summary.company_id,counts:summary.tables,total:summary.total}});
  const id=String(r.adoption_id||r.id||'');if(!id)throw Object.assign(Error('الخادم لم يُرجع adoption_id صالحًا.'),{code:'ADOPTION_INVALID_RESPONSE'});
  return {id,acceptedTables:Array.isArray(r.accepted_tables)?new Set(r.accepted_tables.map(String)):null};
 }
 function validateResults(sent,received){
  const rows=Array.isArray(received)?received:[];const byId=new Map(rows.map(x=>[String(x?.entity_id||x?.id||''),x]));const out=[];
  for(const item of sent){const id=String(item.entity_id),r=byId.get(id);if(!r)throw Object.assign(Error(`الخادم لم يؤكد السجل ${id}. تم إيقاف الاعتماد دون تغيير حالته المحلية.`),{code:'ADOPTION_PARTIAL_ACK'});
   const returned=String(r.canonical_id||r.server_entity_id||r.entity_id||r.id||'');
   if(returned&&returned.toLowerCase()!==id.toLowerCase())throw Object.assign(Error(`الخادم حاول تغيير UUID للسجل ${id} إلى ${returned}. تم رفض الاعتماد لحماية الهوية.`),{code:'ADOPTION_IDENTITY_MISMATCH',entity_id:id,server_entity_id:returned});
   out.push({...r,entity_id:id,local_fingerprint:item.local_fingerprint});}
  return out;
 }
 async function sendBatch(adoptionId,table,batch){
  const first=batch.rows[0]?.entity_id||'',last=batch.rows.at(-1)?.entity_id||'';
  const idempotencyKey=`adopt:${adoptionId}:${table}:${first}:${last}`;
  const r=await request('/bootstrap/adoption/batch',{method:'POST',body:{contract_version:CONTRACT_VERSION,identity_contract_version:IDENTITY_CONTRACT_VERSION,identity_policy:'client_uuid_is_canonical',adoption_id:adoptionId,table,idempotency_key:idempotencyKey,rows:batch.rows}});
  return validateResults(batch.rows,Array.isArray(r.results)?r.results:Array.isArray(r.items)?r.items:[]);
 }
 async function completeSession(adoptionId,summary){return request('/bootstrap/adoption/complete',{method:'POST',body:{contract_version:CONTRACT_VERSION,identity_contract_version:IDENTITY_CONTRACT_VERSION,adoption_id:adoptionId,processed:summary.processed,tables:summary.tables}});}
 async function run({batchSize=100}={}){
  if(running)return running;
  running=(async()=>{try{
   requireTransport();const guard=await local().localAdoptionGuard();
   if(guard?.safeToReplace){const previous=await load();if(previous.adoptionId&&previous.status!=='complete'){await completeSession(previous.adoptionId,{processed:previous.processed,tables:previous.tables});return save({status:'complete',phase:'complete',currentTable:null,completedAt:now(),lastError:null});}return await save({status:'complete',phase:'complete',total:0,processed:0,completedAt:now(),lastError:null});}
   if(guard?.reasons?.activeQueue||guard?.reasons?.localTombstones)throw Object.assign(Error('توجد عمليات مزامنة أو حذف خادمي غير محسومة. يجب إنهاؤها قبل اعتماد البيانات القديمة.'),{code:'ADOPTION_BLOCKED_BY_SYNC',adoption:guard});
   const summary=await local().localAdoptionSummary();if(!summary.total){await local().settleLocalOnlyTombstones?.();const verified=await local().localAdoptionGuard();if(!verified.safeToReplace)throw Object.assign(Error('ما زالت هناك عمليات مزامنة غير محسومة تمنع الاستبدال.'),{code:'ADOPTION_BLOCKED_BY_SYNC',adoption:verified});return save({status:'complete',phase:'complete',total:0,processed:0,completedAt:now(),lastError:null});}
   let st=await load();const session=await startSession(summary);st={...fresh(),status:'running',phase:'adopting',adoptionId:session.id,total:summary.total,processed:0,startedAt:now(),tables:{}};state=st;await local().setUiMeta(STATE_KEY,st);await save();
   for(const table of TABLE_ORDER){const tableTotal=Number(summary.tables?.[table]||0);if(!tableTotal)continue;if(session.acceptedTables&&!session.acceptedTables.has(table))throw Object.assign(Error(`الخادم لا يدعم اعتماد جدول ${table} بعد.`),{code:'ADOPTION_TABLE_UNSUPPORTED',table});
    let afterId='',done=false,tableProcessed=0;st.tables[table]={total:tableTotal,processed:0,status:'running'};await save({currentTable:table,tables:st.tables});
    while(!done){const batch=await local().localAdoptionBatch(table,{afterId,limit:batchSize});if(!batch.rows.length){done=true;break;}
      const results=await sendBatch(session.id,table,batch);const conflicts=results.filter(x=>String(x.status||'').toLowerCase()==='conflict');const rejected=results.filter(x=>!['adopted','already_exists','accepted','conflict'].includes(String(x.status||'').toLowerCase()));
      if(conflicts.length||rejected.length)throw Object.assign(Error(`أوقف الخادم اعتماد ${table}: تعارض ${conflicts.length}، مرفوض ${rejected.length}. لم تُمسح البيانات المحلية.`),{code:'ADOPTION_SERVER_REVIEW_REQUIRED',table,conflicts,rejected});
      const marked=await local().markAdoptionResults(table,results,{adoptionId:session.id});if(marked.stale)throw Object.assign(Error(`تغيّرت ${marked.stale} سجلات محليًا أثناء اعتماد ${table}. أُوقف الاعتماد لحمايتها.`),{code:'ADOPTION_LOCAL_CHANGED',table,stale:marked.stale});
      tableProcessed+=marked.accepted;st.processed+=marked.accepted;st.tables[table]={total:tableTotal,processed:tableProcessed,status:'running'};await save({processed:st.processed,currentTable:table,tables:st.tables});
      afterId=batch.next_after_id||batch.rows.at(-1)?.entity_id||'';done=Boolean(batch.done);if(!done)await new Promise(r=>setTimeout(r,0));
    }
    st.tables[table]={total:tableTotal,processed:tableProcessed,status:'complete'};await save({tables:st.tables});
   }
   await local().settleLocalOnlyTombstones?.({adoptionId:session.id});await completeSession(session.id,{processed:st.processed,tables:st.tables});
   const verified=await local().localAdoptionGuard();if(!verified.safeToReplace)throw Object.assign(Error('انتهى الرفع لكن فحص الحماية ما زال يرى بيانات غير معتمدة. لن يتم السماح بالاستبدال.'),{code:'ADOPTION_VERIFY_FAILED',adoption:verified});
   const done=await save({status:'complete',phase:'complete',currentTable:null,completedAt:now(),lastError:null});document.dispatchEvent(new CustomEvent('myfnt:adoption-complete',{detail:{...done}}));return done;
  }catch(e){await save({status:e?.code==='ADOPTION_API_UNAVAILABLE'?'unsupported':'blocked',phase:'blocked',lastError:String(e?.message||e)}).catch(()=>{});document.dispatchEvent(new CustomEvent('myfnt:adoption-blocked',{detail:{code:e?.code||'ADOPTION_FAILED',message:String(e?.message||e),error:e}}));throw e;}finally{running=null;}})();
  return running;
 }
 async function ensureReady(){const st=await load(),guard=await local().localAdoptionGuard();if(!guard.safeToReplace||st.adoptionId&&st.status!=='complete')await run();const finalState=await load(),verified=await local().localAdoptionGuard();if(!verified.safeToReplace||finalState.adoptionId&&finalState.status!=='complete')throw Object.assign(Error('اعتماد البيانات المحلية لم يصل إلى حالة مكتملة مؤكدة؛ تم منع الاستبدال.'),{code:'ADOPTION_NOT_FINALIZED',adoption:verified,state:finalState});return {state:finalState,guard:verified};}
 window.MyfntAdoption=Object.freeze({run,ensureReady,state:load,summary:()=>local()?.localAdoptionSummary?.(),status:async()=>({...await load(),transportReady:syncEnabled()})});
})();
