/* MYFNT sync adapter v2.14.0
 * Queue state machine is local and durable. Transport is replaceable.
 * Mock transport is intentionally NOT allowed to drain production-intent queue rows.
 */
'use strict';
(()=>{
 const local=()=>window.MyfntLocal;
 const api=()=>window.OzanApi;
 const cfg=()=>api()?.config||{};
 const isMock=()=>String(cfg().mode||'').toLowerCase()==='mock';
 const enabled=()=>Boolean(local()&&api()&&!isMock());
 const cleanMeta=value=>{
  if(!value||typeof value!=='object')return null;
  const out={};for(const key of ['status','ok','serverTime','requestId','version'])if(Object.hasOwn(value,key))out[key]=value[key];return out;
 };
 async function sendBatch(commands){
  if(!enabled())throw Object.assign(Error(isMock()?'النقل الحالي تجريبي؛ تم منع تفريغ طابور المزامنة بنجاح وهمي.':'موصل المزامنة غير جاهز.'),{code:'TRANSPORT_DISABLED',retryable:false});
  const items=(commands||[]).map(command=>({
   op_id:command.op_id||command.id,entity_type:command.entity_type,entity_id:command.entity_id,
   operation:command.operation,base_version:Number(command.base_version||0),payload:command.payload||{}
  }));
  const response=await api().request('/sync/push',{method:'POST',body:{commands:items}});
  if(!response?.ok){const status=Number(response?.status||0);throw Object.assign(Error(response?.message||`فشل Batch Sync (${status||'network'})`),{
   code:'API_ERROR',status,retryable:status===0||status===408||status===429||status>=500,retryAfterMs:Number(response?.retryAfterMs)||null,response});}
  const results=Array.isArray(response.results)?response.results:Array.isArray(response.items)?response.items:[];
  return {...response,results};
 }
 function assertIdentity(command,result){
  const returnedId=String(result?.entity_id||result?.canonical_id||result?.server_entity_id||'');
  if(!returnedId)throw Object.assign(Error(`الخادم لم يؤكد UUID للكيان ${command.entity_type}.`),{code:'IDENTITY_ACK_MISSING',status:409,conflict:true,retryable:false,response:result});
  if(returnedId.toLowerCase()!==String(command.entity_id||'').toLowerCase())throw Object.assign(Error(`الخادم أعاد UUID مختلفًا للكيان ${command.entity_type}.`),{code:'IDENTITY_MISMATCH',status:409,conflict:true,retryable:false,response:result});
 }
 async function settleResult(command,result){
  const status=String(result?.status||result?.result||'synced').toLowerCase();
  const conflict=status==='conflict'||Number(result?.http_status||result?.status_code)===409;
  if(!conflict&&['synced','ok','accepted','created','updated','deleted','success'].includes(status)){
   assertIdentity(command,result);const version=result?.server_version??result?.version??null;
   const done=await local().finishCommand(command.id,{serverVersion:version,response:cleanMeta(result)});
   if(command.entity_type==='bookings'&&done?.legacy_id){const b=window.MyfntRepositories?.bookings?.get?.(done.legacy_id);if(b){b.syncStatus='synced';if(version!=null)b.serverVersion=Number(version)||0;try{saveBookings?.();}catch{}}}
   document.dispatchEvent(new CustomEvent('myfnt:sync-command-synced',{detail:{id:command.id,entityType:command.entity_type,entityId:command.entity_id,legacyId:done?.legacy_id||null}}));
   return {id:command.id,status:'synced'};
  }
  const error=Object.assign(Error(result?.message||result?.error||'تعذر تطبيق تغيير على الخادم'),{
   code:conflict?'CONFLICT':'API_ITEM_ERROR',status:conflict?409:Number(result?.http_status||result?.status_code||422),conflict,
   retryable:conflict?false:result?.retryable!==false,retryAfterMs:Number(result?.retry_after_ms||0)||null,response:result
  });
  const remote=result?.entity??result?.payload??result?.remote_payload??null;
  const remoteVersion=result?.server_version??result?.version??null;
  const failed=await local().failCommand(command.id,error,{conflict,retryable:error.retryable,retryAfterMs:error.retryAfterMs,httpStatus:error.status,serverVersion:remoteVersion,remotePayload:remote});
  if(command.entity_type==='bookings'){const legacy=failed?.legacy_id;const b=legacy?window.MyfntRepositories?.bookings?.get?.(legacy):null;if(b){b.syncStatus=conflict?'conflict':'failed';try{saveBookings?.();}catch{}}}
  document.dispatchEvent(new CustomEvent(conflict?'myfnt:sync-conflict':'myfnt:sync-command-failed',{detail:{id:command.id,error:error.message}}));
  return {id:command.id,status:conflict?'conflict':'failed',error:error.message};
 }
 async function flush({limit=50}={}){
  if(!enabled())return {processed:0,disabled:true,reason:isMock()?'mock_transport':'transport_unavailable'};
  const commands=await (local().claimBatch?.({limit})||Promise.resolve([]));
  if(!commands?.length)return {processed:0,empty:true};
  let response;
  try{response=await sendBatch(commands);}catch(error){
   const settled=[];for(const command of commands){const failed=await local().failCommand(command.id,error,{conflict:false,retryable:error?.retryable!==false,retryAfterMs:error?.retryAfterMs,httpStatus:error?.status});settled.push({id:failed?.id||command.id,status:'failed'});}throw error;
  }
  const byId=new Map((response.results||[]).map(r=>[String(r?.op_id||r?.id||''),r]));const results=[];
  for(const command of commands){const key=String(command.op_id||command.id),result=byId.get(key);
   if(!result){const missing={status:'failed',message:'الخادم لم يُرجع نتيجة لهذه العملية.',retryable:true,http_status:502,entity_id:command.entity_id};results.push(await settleResult(command,missing));continue;}
   results.push(await settleResult(command,result));
  }
  return {processed:commands.length,results,requestId:response.request_id||null};
 }
 async function runOne(){const batch=await flush({limit:1});return {processed:Number(batch.processed||0)>0,...batch,last:batch.results?.[0]||null};}

 async function pull({limit=100}={}){
  if(!enabled())return {pulled:0,disabled:true,reason:isMock()?'mock_transport':'transport_unavailable'};
  const cursor=await local().pullCursor();const params=new URLSearchParams();if(cursor)params.set('cursor',cursor);params.set('limit',String(Math.max(1,Math.min(500,Number(limit)||100))));
  const response=await api().request('/sync/pull?'+params.toString(),{method:'GET'});
  if(!response?.ok){const status=Number(response?.status||0);throw Object.assign(Error(response?.message||`فشل سحب التغييرات (${status||'network'})`),{status,retryable:status===0||status===408||status===429||status>=500,response});}
  const changes=Array.isArray(response.changes)?response.changes:Array.isArray(response.items)?response.items:[];
  const nextCursor=response.next_cursor??response.cursor??cursor??null;
  const applied=await local().applyRemoteChanges(changes,{cursor:nextCursor});
  // Future Laravel contract: domain changes carry actor_id/actor_name. The client derives
  // recipient inbox activity locally; generated notifications themselves are not pushed back.
  for(const change of changes){try{const type=String(change?.entity_type||change?.table||''),op=String(change?.operation||'update'),payload=change?.payload||change?.entity||{},actorId=String(change?.actor_id||payload.actor_id||payload.created_by_id||payload.updated_by_id||''),actorSessionId=String(change?.actor_session_id||payload.actor_session_id||''),actorName=String(change?.actor_name||payload.actor_name||payload.created_by_name||payload.updated_by_name||'مستخدم');if(!['bookings','payments'].includes(type)||!actorId)continue;const entityId=String(change?.entity_id||change?.id||payload.id||''),bookingId=type==='bookings'?String(payload.legacy_id||payload.id||entityId):String(payload.booking_legacy_id||payload.bookingId||payload.booking_id||'');const created=['create','insert'].includes(op);const title=type==='bookings'?(created?`أنشأ ${actorName} حجزًا جديدًا`:`عدّل ${actorName} حجزًا`):(created?`سجّل ${actorName} حركة مالية`:`عدّل ${actorName} حركة مالية`);document.dispatchEvent(new CustomEvent('myfnt:remote-activity',{detail:{eventId:change?.event_id||change?.sequence||change?.seq||`${type}:${entityId}:${change?.server_version||change?.version||''}`,type:type==='bookings'?'booking.activity':'payment.activity',entityType:type,entityId,bookingId,actorId,actorSessionId,actorName,title,text:String(change?.activity_text||payload.activity_text||''),target:type==='bookings'?{kind:'booking',id:bookingId||entityId,bookingId:bookingId||entityId}:{kind:'payment',id:String(payload.legacy_id||entityId),bookingId},version:change?.server_version||change?.version||'',recipientUserIds:Array.isArray(change?.recipient_user_ids)?change.recipient_user_ids:null}}));}catch(err){console.warn('[remote activity hook]',err);}}
  document.dispatchEvent(new CustomEvent('myfnt:sync-pulled',{detail:{received:changes.length,...applied}}));
  return {pulled:changes.length,...applied};
 }
 async function syncCycle({pushLimit=50,pullLimit=250}={}){
  if(!enabled())return {disabled:true,reason:isMock()?'mock_transport':'transport_unavailable'};
  const push=await flush({limit:pushLimit});
  // Pull after push so server versions acknowledged by successful local commands are current.
  // If push stopped on a conflict, pull is still safe: applyRemoteChanges will stage collisions, not overwrite them.
  const pulled=await pull({limit:pullLimit});return {push,pull:pulled};
 }
 window.MyfntSync=Object.freeze({enabled,isMock,runOne,flush,pull,syncCycle,refresh:syncCycle,contract:()=>({push:'POST /api/v1/sync/push',pull:'GET /api/v1/sync/pull?cursor=&limit=',pushBatchMax:100,pullBatchMax:500,idempotency:'op_id',optimisticLock:'base_version',identity:'client UUID is canonical'}),status:()=>({enabled:enabled(),mode:cfg().mode||'unknown',baseUrl:cfg().baseUrl||null})});
})();
