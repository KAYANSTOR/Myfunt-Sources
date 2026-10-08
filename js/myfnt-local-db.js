/* Myfnt 2.14.0 Step 22A.4: Canonical ID & Identity Contract + Bootstrap Reconciliation Gate + First Server Adoption + Local Data Adoption Guard + two-year working set + backend-gated sync queue.
 * Prepared for Laravel 13 + MySQL 8.4 LTS.
 * Fresh-start build: historical compatibility payloads are intentionally not retained.
 * Normalized rows never embed a second full legacy record or Base64 company logo preview.
 * One IndexedDB transaction persists normalized rows and their pending sync command.
 * No production server is connected in this build.
 */
'use strict';
(()=>{
 const NAME='myfnt-local-3.1',VERSION=9; // Recovery-safe schema: never downgrade IndexedDB; upgrade recreates any stores removed by experimental builds
 const TABLES=['companies','users','company_memberships','company_settings','plans','company_subscriptions',
 'booking_packages','booking_package_versions','booking_types','customers','bookings','booking_details',
 'payments','booking_audit','payment_audit','wallets','ledger_accounts','journal_entries','journal_lines',
 'notifications','sms_templates','sms_messages','alert_rules','company_backups','support_tickets',
 'support_messages','chat_threads','chat_messages','sync_conflicts','error_logs','archive_records','calendar_blocks','sms_approvals','notification_jobs'];
 const SYNCABLE=new Set(['company_settings','booking_packages','booking_types','customers','bookings',
  'booking_details','calendar_blocks','alert_rules','sms_approvals','booking_audit','payment_audit']);
 // Step 21C: device-local runtime records must never create remote outbox commands.
 // Alert rules remain company-scoped because they are shared configuration; generated notifications are device-scoped.
 const DEVICE_ONLY_TABLES=new Set(['notifications','notification_jobs','error_logs']);
 // Step 22A.2: records authored on the device before Laravel existed must be adopted
 // before server bootstrap may replace local data. Server-owned auth/catalog rows are
 // intentionally excluded; they are refreshed by authentication/bootstrap instead.
 const ADOPTION_TABLES=['company_settings','booking_packages','booking_package_versions','booking_types',
  'customers','bookings','booking_details','payments','booking_audit','payment_audit','wallets','ledger_accounts',
  'journal_entries','journal_lines','sms_templates','sms_messages','alert_rules','company_backups','support_tickets',
  'support_messages','chat_threads','chat_messages','archive_records','calendar_blocks','sms_approvals'];
 const API_FIELDS={
  company_settings:['language_tag','calendar_kind','preferred_notification_time','currency','sync_mode',
   'deposit_policy','allow_booking_overpayment','allow_receipt_over_remaining','required_fields','show_location_field','season_enabled','season_name',
   'season_start_mmdd','season_end_mmdd','reminder_days','timezone_name','communication_policy'],
  booking_packages:['name','icon','regular_price_minor','season_price_minor','default_deposit_minor',
   'currency','status','allow_double_booking','allow_discount'],
  booking_types:['code','name','active'],
  customers:['customer_no','name','phone_e164','address','notes'],
  bookings:['booking_no','customer_id','event_date','starts_at','ends_at','confirmation',
   'temporary_expires_at','status'],
  booking_details:['booking_id','customer_name_snapshot','customer_phone_snapshot','address_snapshot',
   'description','package_id','package_version','package_name_snapshot','package_price_minor_snapshot',
   'deposit_minor_snapshot','discount_minor','surcharge_minor','adjustment_reason',
   'agreed_total_minor','currency','legacy_snapshot_unverified'],
  payments:['booking_id','customer_id','receipt_no','movement_no','direction','amount_minor','currency','payment_method','external_reference',
   'memo','tag','posted_at','status','reversal_reason'],
  booking_audit:['booking_id','action','changed_fields','reason','happened_at','before_json','after_json','source'],
  payment_audit:['payment_id','actor_name_snapshot','action','reason','before_json','after_json','happened_at','source'],
  calendar_blocks:['block_date','kind','title'],
  alert_rules:['name','event_code','when_kind','interval_unit','interval_value','recipient_kind','channels','customer_template','staff_template','priority','repeat_rule','enabled'],
  sms_approvals:['booking_id','alert_rule_id','requested_by_member_id','scheduled_at','status','approved_at','idempotency_key']
 };
 const DATABASE_CONTRACT_VERSION=1;
 const GLOBAL_TABLES=new Set(['users','plans']);
 const TENANT_ROOT_TABLES=new Set(['companies']);
 const TENANT_SCOPED_TABLES=new Set(TABLES.filter(t=>!GLOBAL_TABLES.has(t)&&!TENANT_ROOT_TABLES.has(t)&&!DEVICE_ONLY_TABLES.has(t)));
 const assertTenantRow=(table,row)=>{
  if(!TENANT_SCOPED_TABLES.has(table))return true;
  if(!row?.company_id)throw identityError('سجل Tenant بدون company_id',{table,id:row?.id||null,code:'TENANT_SCOPE_MISSING'});
  return true;
 };
 const IDENTITY_CONTRACT_VERSION=1;
 const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const CANONICAL_ID_TABLES=new Set(TABLES.filter(t=>!DEVICE_ONLY_TABLES.has(t)));
 const isCanonicalUuid=value=>UUID_RE.test(String(value||'').trim());
 const canonicalUuid=value=>isCanonicalUuid(value)?String(value).trim().toLowerCase():null;
 const identityError=(message,detail={})=>Object.assign(Error(message),{code:'IDENTITY_CONTRACT_VIOLATION',identityContractVersion:IDENTITY_CONTRACT_VERSION,...detail});
 const uuidCache=new Map();let connection=null,pendingTimer=0,running=null,rerun=false,lastError='',writeTail=Promise.resolve();
 // Every normalized writer takes its snapshot AFTER preceding writes finish.
 const serialWrite=task=>{const result=writeTail.catch(()=>{}).then(task);writeTail=result.catch(()=>{});return result;};
 const scope=()=>window.OzanScope?.read?.()||null;
 const owner=()=>{const s=scope();if(!s?.companyId||!s?.userId)throw Error('سجّل الدخول إلى مساحة شركة محلية أولًا');return s;};
 const now=()=>new Date().toISOString();
 const date=x=>x&&Number.isFinite(Number(x))?new Date(Number(x)).toISOString():null;
 const num=x=>{const n=Number(x??0);if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(Math.round(n*100))||Math.abs(n*100-Math.round(n*100))>0.0000001)throw Error('مبلغ خارج الدقة المسموحة للمزامنة؛ راجع البيانات');return Math.round(n*100);};
 const cc=v=>['YER','SAR','USD'].includes(v)?v:'YER';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const syncQueueEnabled=()=>{
  try{
   if(window.MyfntSync?.enabled)return !!window.MyfntSync.enabled();
   const api=window.OzanApi,cfg=api?.config||{},mode=String(cfg.mode||'').trim().toLowerCase(),baseUrl=String(cfg.baseUrl||'').trim();
   return !!(api&&typeof api.request==='function'&&mode!=='mock'&&baseUrl);
  }catch{return false;}
 };
 const normalizedPhone=x=>String(x||'').replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[^0-9+]/g,'');
 const normalizeSearchText=parts=>String((parts||[]).filter(v=>v!=null).join(' ')).normalize('NFKC').toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim();
 async function uuidFor(table,legacy){
   // Step 22A.4: a canonical UUID is already the entity identity. Never hash it again.
   // This is essential after Hydration: server-origin rows may surface their UUID as the UI id.
   const existing=canonicalUuid(legacy);if(existing)return existing;
   const s=owner(),key=[s.companyId,table,String(legacy)].join('|');
   if(uuidCache.has(key))return uuidCache.get(key);
   const promise=(async()=>{
    if(!crypto?.subtle)throw Error('يحتاج إنشاء المعرّفات الثابتة إلى HTTPS أو localhost');
    const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('MYFNT-OFFLINE-ID-v2|'+key)));
    const bytes=d.slice(0,16);bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128; // deterministic UUIDv8; not a security token
    const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
   })();uuidCache.set(key,promise);return promise;
 }
 function open(){if(connection)return connection;if(typeof indexedDB==='undefined')return Promise.reject(Error('متصفحك لا يدعم IndexedDB'));
  connection=new Promise((resolve,reject)=>{
   const r=indexedDB.open(NAME,VERSION);
   r.onupgradeneeded=()=>{
    const db=r.result;
    if(!db.objectStoreNames.contains('outbox')){const s=db.createObjectStore('outbox',{keyPath:'id'});s.createIndex('workspace','workspace',{unique:false});}
    if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'workspace'});
    const ensureIndexes=(t,s)=>{
      const add=(name,keyPath,options={unique:false})=>{if(!s.indexNames.contains(name))s.createIndex(name,keyPath,options);};
      add('company_id','company_id');
      if(t==='customers'){
        add('company_phone',['company_id','phone_key']);
        add('company_name',['company_id','name_key']);
        add('company_customer_no',['company_id','customer_no']);
      }
      if(t==='bookings'){
        add('company_date',['company_id','event_date']);
        add('company_customer',['company_id','customer_id']);
        add('company_status',['company_id','status']);
        add('company_booking_no',['company_id','booking_no']);
        add('company_date_status',['company_id','event_date','status']);
        add('company_status_date',['company_id','status','event_date']);
        add('company_updated',['company_id','local_updated_at']);
      }
      if(t==='booking_details')add('booking_id','booking_id');
      if(t==='payments'){
        add('company_posted',['company_id','posted_at']);
        add('company_booking',['company_id','booking_id']);
        add('company_customer',['company_id','customer_id']);
        add('company_status',['company_id','status']);
        add('company_booking_status',['company_id','booking_id','status']);
        add('company_amount',['company_id','amount_minor']);
      }
      if(t==='notifications'){
        add('company_created',['company_id','created_at']);
        add('company_user',['company_id','user_id']);
      }
      if(t==='sms_messages'){
        add('company_status',['company_id','status']);
        add('company_scheduled',['company_id','scheduled_at']);
        add('company_created',['company_id','created_at']);
        add('idempotency_key','idempotency_key',{unique:false});
      }
    };
    for(const t of TABLES){
     if(db.objectStoreNames.contains(t)){
      ensureIndexes(t,r.transaction.objectStore(t));
      continue;
     }
     const s=db.createObjectStore(t,{keyPath:'id'});
     ensureIndexes(t,s);
    }
    if(!db.objectStoreNames.contains('sync_queue')){
      const s=db.createObjectStore('sync_queue',{keyPath:'id'});
      s.createIndex('workspace','workspace',{unique:false});
      s.createIndex('entity_key','entity_key',{unique:false});
      s.createIndex('status','status',{unique:false});
      s.createIndex('workspace_status',['workspace','status'],{unique:false});
      s.createIndex('workspace_updated',['workspace','updated_at'],{unique:false});
    }else{
      const s=r.transaction.objectStore('sync_queue');
      if(!s.indexNames.contains('workspace_status'))s.createIndex('workspace_status',['workspace','status'],{unique:false});
      if(!s.indexNames.contains('workspace_updated'))s.createIndex('workspace_updated',['workspace','updated_at'],{unique:false});
    }
    if(!db.objectStoreNames.contains('entity_tombstones')){
      const s=db.createObjectStore('entity_tombstones',{keyPath:'id'});
      s.createIndex('company_id','company_id',{unique:false});
      s.createIndex('entity_key','entity_key',{unique:true});
      s.createIndex('workspace','workspace',{unique:false});
    }
    if(!db.objectStoreNames.contains('local_meta')){
      const meta=db.createObjectStore('local_meta',{keyPath:'id'});
      meta.createIndex('workspace','workspace',{unique:false});
    }else{
      const meta=r.transaction.objectStore('local_meta');
      if(!meta.indexNames.contains('workspace'))meta.createIndex('workspace','workspace',{unique:false});
      // One-time lightweight migration: old ui/pull rows did not carry workspace.
      const cursor=meta.openCursor();
      cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;const row=c.value||{};if(!row.workspace){
        const id=String(row.id||'');
        if(id.startsWith('ui:')){const parts=id.slice(3).split(':');if(parts.length>=2)row.workspace=`${parts[0]}:${parts[1]}`;}
        else if(id.startsWith('pull_cursor:'))row.workspace=id.slice('pull_cursor:'.length);
        if(row.workspace)c.update(row);
      }c.continue();};
    }
   };
   let blocked=false;
   r.onsuccess=()=>{
    const db=r.result;
    if(blocked){db.close();return;}
    db.onversionchange=()=>{db.close();connection=null;};
    db.onclose=()=>{connection=null;};
    lastError='';resolve(db);
   };
   r.onerror=()=>{connection=null;reject(r.error);};
   r.onblocked=()=>{
    blocked=true;
    const err=Error('تحديث التخزين محجوب بواسطة نافذة أو نسخة أخرى من مايفنت. أغلق النسخ الأخرى ثم أعد المحاولة.');
    err.name='MyfntIndexedDBBlockedError';
    lastError=err.message;
    connection=null;
    reject(err);
   };
  });return connection;
 }
 const once=(request)=>new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 const getWorkspace=()=>{const s=owner();return `${s.companyId}:${s.userId}`;};
 async function rowsFromState(filter=null){
  const s=owner(),company_id=await uuidFor('companies',s.companyId),user_id=await uuidFor('users',s.userId);
  const st=typeof state!=='undefined'?state:null;if(!st)return [];
  const pkgById=new Map((st.packages||[]).map(p=>[p.id,p]));
  const rows=[];const add=(table,id,raw)=>rows.push({table,id,company_id,...raw});
  if(!filter || filter.entity==='company_settings'){
   const auth=window.OzanAuth?.data,account=auth?.users?.find(u=>u.id===s.userId && u.companyId===s.companyId)||{};
   const company=auth?.companies?.find(c=>c.id===s.companyId);
   const founder=auth?.users?.find(u=>u.id===company?.userId && u.companyId===s.companyId);
   const founder_user_id=founder?await uuidFor('users',founder.id):null;
   add('companies',company_id,{legacy_id:s.companyId,founder_user_id,name:st.settings.company?.name||'مايفنت',
    description:st.settings.company?.description||'',address:st.settings.company?.addresses||'الجمهورية اليمنية صنعاء',phone_1:st.settings.company?.phone||'',phone_2:st.settings.company?.phone2||'',sms_phone:st.settings.company?.sms||'',whatsapp_phone:st.settings.company?.whatsapp||'',logo_object_key:null,
    booking_receipt_terms:st.settings.company?.terms||'',receipt_notes:st.settings.company?.receiptNotes||'',source:'offline_demo'});
   if(!filter){
    const isFounder=Boolean(founder && founder.id===s.userId);
    const memberRole=isFounder?'owner':(['manager','accountant'].includes(account.localRole)?account.localRole:'manager');
    add('users',user_id,{legacy_id:s.userId,name:account.name||'مستخدم محلي',phone_e164:account.phone||null,
     source:'offline_demo',no_password_or_token_exported:true});
    if(founder && !isFounder){
     add('users',founder_user_id,{legacy_id:founder.id,name:founder.name||'مالك الشركة',phone_e164:founder.phone||null,
      source:'offline_demo',no_password_or_token_exported:true});
     add('company_memberships',await uuidFor('company_memberships',founder.id),{
      legacy_id:founder.id,user_id:founder_user_id,role:'owner',status:'active',permissions:{local_demo:true}});
    }
    add('company_memberships',await uuidFor('company_memberships',s.userId),{legacy_id:s.userId,user_id,role:memberRole,status:'active',
     permissions:{local_demo:true,explicit:Array.isArray(account.permissions)?account.permissions.filter(p=>typeof p==='string'):[]}});
   }
   add('company_settings',company_id,{language_tag:st.settings.preferences?.language||'ar',
    calendar_kind:st.settings.preferences?.calendar||'gregorian',
    preferred_notification_time:/^([01]\d|2[0-3]):[0-5]\d$/.test(st.settings.company?.notifyTime||'')?st.settings.company.notifyTime:'09:00',
    currency:cc(st.settings.preferences?.currency),sync_mode:st.settings.preferences?.syncMode||'manual',
    deposit_policy:st.settings.bookingUi?.requireExactDeposit?'minimum':'optional',
    allow_booking_overpayment:!!st.settings.bookingUi?.allowBookingOverpayment,allow_receipt_over_remaining:!!st.settings.bookingUi?.allowReceiptOverRemaining,
    required_fields:clone(st.settings.bookingUi?.requiredFields||{}),show_location_field:!!st.settings.bookingUi?.showAddress,
    season_enabled:!!st.settings.season?.enabled,season_name:st.settings.season?.name||'الموسم',
    season_start_mmdd:String(st.settings.season?.start||'2026-03-10').slice(5),
    season_end_mmdd:String(st.settings.season?.end||'2026-09-30').slice(5),
    reminder_days:clone(st.settings.reminders||[]),timezone_name:'Asia/Aden',communication_policy:clone(st.settings.communication||{})});
   if(!filter){
    try{await window.MyfntPlans?.ready?.();const planRows=window.MyfntPlans?.all?.()||[];for(const plan of planRows){
     add('plans',await uuidFor('plans',plan.code),{legacy_id:plan.code,code:plan.code,name_ar:plan.name_ar,name_en:plan.name_en,monthly_price:plan.monthly_price,annual_price:plan.annual_price,currency:plan.currency||'YER',limits:clone(plan),status:'active',source:'seed_config'});
    }
    const companyAuth=window.OzanAuth?.data?.companies?.find(c=>c.id===s.companyId),planCode=String(companyAuth?.plan||window.MyfntPlans?.defaultCode?.()||'ULTRA').toUpperCase();
    add('company_subscriptions',await uuidFor('company_subscriptions',s.companyId),{legacy_id:s.companyId,plan_code:planCode,status:'active',starts_at:companyAuth?.planStartedAt||companyAuth?.createdAt||null,expires_at:companyAuth?.planExpiresAt||null,source:'offline_demo'});
    }catch(e){console.warn('[Myfnt plans mirror]',e.message);}
   }
  }
  for(const p of st.packages||[]){
   if(filter && !(filter.entity==='booking_packages' && String(filter.id)===String(p.id)))continue;
   const mapped=await window.MyfntMappers?.package?.toRow?.(p,{uuidFor,company_id,currency:st.settings.preferences?.currency});
   if(mapped)rows.push(mapped);else add('booking_packages',await uuidFor('booking_packages',p.id),{legacy_id:p.id,name:p.name||'باقة',icon:p.icon||null,regular_price_minor:num(p.price),season_price_minor:num(p.seasonPrice),default_deposit_minor:num(p.deposit),currency:cc(st.settings.preferences?.currency),status:p.status==='hidden'?'hidden':'active',allow_double_booking:!!p.allowDoubleBooking,allow_discount:p.allowDiscount!==false,package_version:Number(p.version)||1,built_in_local:!!p.builtIn});
  }
  if(!filter){
   for(const [code,name] of [['busy','مشغول'],['reserved','محجوز'],['available','متاح'],['archived','مؤرشف']]){
    add('booking_types',await uuidFor('booking_types',code),{code,name,active:true,source:'offline_default'});
   }
   const currency=cc(st.settings.preferences?.currency);
   add('wallets',await uuidFor('wallets','default-'+currency),{name:'الصندوق الرئيسي',currency,kind:'cash',
    is_default:true,source:'offline_demo',balance_is_derived:true});
  }
  const receiptsById=new Map((st.receipts||[]).map(r=>[String(r.id),r]));
  const bookingsByLegacy=new Map((st.bookings||[]).map(b=>[String(b.id),b]));
  const targetBookingId=filter?.entity==='payments'?receiptsById.get(String(filter.id))?.bookingId:null;
  const targetBooking=filter?.entity==='bookings'?bookingsByLegacy.get(String(filter.id)):
    filter?.entity==='payments'?bookingsByLegacy.get(String(targetBookingId)):null;
  const targetReceipt=filter?.entity==='payments'?receiptsById.get(String(filter.id)):null;
  const targetCustomerId=targetBooking?.customerId||targetReceipt?.customerId||null;
  // Canonical directory: one UUID per stored customer ID, not per phone.
  const customerNotes=window.MyfntFinance?.notes?.()||{};
  for(const c of st.customers||[]){
    if(filter && !((filter.entity==='customers'&&String(filter.id)===String(c.id))||
      ((filter.entity==='bookings'||filter.entity==='payments')&&targetCustomerId===c.id)))continue;
    const mapped=await window.MyfntMappers?.customer?.toRow?.(c,{uuidFor,company_id,notes:customerNotes});
    if(mapped)rows.push(mapped);else add('customers',await uuidFor('customers',c.id),{legacy_id:c.id,customer_no:c.customerNo,name:c.name,phone_e164:normalizedPhone(c.phone)||null,phone_key:window.MyfntCustomers?.phoneKey(c.phone)||'',name_key:window.MyfntCustomers?.nameKey(c.name)||'',search_text:normalizeSearchText([c.customerNo,c.name,c.phone,c.address,customerNotes[c.id]]),address:c.address||'',notes:customerNotes[c.id]||''});
  }

  for(const b of st.bookings||[]){
    if(filter && !(filter.entity==='bookings'&&String(filter.id)===String(b.id)) &&
      !(filter.entity==='payments'&&String(targetBookingId)===String(b.id)))continue;
    const personKey=String(b.customerId||('legacy-booking:'+b.id));
    const bk=await uuidFor('bookings',b.id);
    const customer_id=await uuidFor('customers',personKey);
    const pkg=pkgById.get(b.packageId),ps=b.pricingSnapshot||{},package_id=b.packageId?await uuidFor('booking_packages',b.packageId):null;
    const adjustments=Array.isArray(b.adjustments)?b.adjustments:[];
    const discount=adjustments.filter(a=>a.kind==='discount').reduce((n,a)=>n+Number(a.value||0),0);
    const surcharge=adjustments.filter(a=>a.kind==='add').reduce((n,a)=>n+Number(a.value||0),0);
    const agreed=num(b.amount);
    // Old catalogue price may be unavailable. Do NOT invent history; mark unverified.
    const listRaw=ps.listPrice!=null?Number(ps.listPrice):Number(b.amount)-surcharge+discount;
    const listPrice=num(Math.max(0,listRaw));
    const status=b.status==='archived'?'archived':b.status==='cancelled'?'cancelled':b.status==='completed'?'completed':'active';
    const mapped=await window.MyfntMappers?.booking?.toRows?.(b,{uuidFor,company_id,packagesById:pkgById,currency:st.settings.preferences?.currency});
    if(mapped){rows.push(mapped.booking,mapped.detail);}else{
    add('bookings',bk,{legacy_id:b.id,booking_no:String(b.bookingNo||''),customer_id,event_date:b.date,
     starts_at:b.hasTime?b.timeFrom||null:null,ends_at:b.hasTime?b.timeTo||null:null,
     confirmation:b.status==='pending'?'temporary':'confirmed',
     temporary_expires_at:date(b.temporaryExpiresAt),status,amount_minor:agreed,paid_minor:num(Math.max(0,Number(b.paid||0))),currency:cc(b.currency),
     customer_name_snapshot:String(b.name||''),customer_phone_snapshot:normalizedPhone(b.phone)||null,package_name_snapshot:String(ps.packageName||b.type||pkg?.name||'مناسبة'),
     search_text:normalizeSearchText([b.bookingNo,b.id,b.name,b.phone,b.type,b.date,b.notes]),server_version:Number(b.serverVersion)||0,
     local_updated_at:date(b.updatedAt),local_created_at:date(b.createdAt),created_by_id:b.createdById||null,created_by_name:b.createdBy||null,updated_by_id:b.updatedById||b.createdById||null,updated_by_name:b.updatedBy||b.createdBy||null});
    add('booking_details',await uuidFor('booking_details',b.id),{booking_id:bk,legacy_id:b.id,
     customer_name_snapshot:b.name||'',customer_phone_snapshot:normalizedPhone(b.phone)||null,
     address_snapshot:b.address||'',description:b.notes||'',package_id,package_version:pkg?.version||null,
     package_name_snapshot:ps.packageName||b.type||pkg?.name||'مناسبة',
     package_price_minor_snapshot:listPrice,deposit_minor_snapshot:num(ps.depositRequired??b.depositRequired??0),
     discount_minor:num(discount),surcharge_minor:num(surcharge),adjustment_reason:adjustments.map(a=>a.reason).filter(Boolean).join('؛ '),
     agreed_total_minor:agreed,currency:cc(b.currency),legacy_snapshot_unverified:String(ps.source||'').includes('unverified')||!b.pricingSnapshot});
    }
  }
  for(const r of st.receipts||[]){
   if(filter && !(filter.entity==='payments'&&String(filter.id)===String(r.id)) &&
     !(filter.entity==='bookings'&&String(filter.id)===String(r.bookingId)))continue;
   const bk=bookingsByLegacy.get(String(r.bookingId||''));
   const mapped=await window.MyfntMappers?.payment?.toRow?.(r,{uuidFor,company_id,booking:bk,currency:st.settings.preferences?.currency});
   if(mapped)rows.push(mapped);else {const customerLegacy=String(r.customerId||bk?.customerId||'');add('payments',await uuidFor('payments',r.id),{legacy_id:r.id,booking_id:bk&&r.bookingId?await uuidFor('bookings',r.bookingId):null,booking_legacy_id:bk?String(r.bookingId||''):'',receipt_no:String(r.receiptNo||r.id),movement_no:String(r.movementNo||''),customer_id:customerLegacy?await uuidFor('customers',customerLegacy):null,customer_legacy_id:customerLegacy,direction:r.direction==='out'?'out':'in',amount_minor:num(r.amount),currency:cc(bk?.currency||r.currency||st.settings.preferences?.currency),payment_method:r.method||'cash',external_reference:r.reference||null,memo:r.note||'',tag:r.tag||null,posted_at:r.date?`${r.date}T12:00:00.000Z`:date(r.createdAt),status:r.status==='voided'?'reversed':'posted',reversal_reason:r.voidReason||null,booking_no_snapshot:String(bk?.bookingNo||''),customer_name_snapshot:String(bk?.name||r.customerName||''),customer_phone_snapshot:normalizedPhone(bk?.phone||r.customerPhone)||null,search_text:normalizeSearchText([r.id,r.receiptNo,r.movementNo,r.reference,r.tag,r.note,bk?.bookingNo,bk?.name,bk?.phone,r.customerName,r.customerPhone]),edited_by_name_snapshot:r.editedByName||r.createdBy||null,created_by_id:r.createdById||null,created_by_name:r.createdBy||null,edited_by_id:r.editedById||r.createdById||null});}
  }
  const history=typeof ozHistory!=='undefined'&&ozHistory?ozHistory:{};
  for(const [bookingId,events] of Object.entries(history)){
   if(filter && !(filter.entity==='bookings'&&String(filter.id)===String(bookingId)) &&
     !(filter.entity==='payments'&&String(targetBookingId)===String(bookingId)))continue;
   if(!bookingsByLegacy.has(String(bookingId))||!Array.isArray(events))continue;
   const booking_id=await uuidFor('bookings',bookingId);
   for(const h of events){
    if(!h.id)continue;
    add('booking_audit',await uuidFor('booking_audit',h.id),{legacy_id:h.id,booking_id,
     action:h.kind||'change',changed_fields:clone(h.changedFields||[]),reason:h.label||'',
     happened_at:date(h.at),before_json:h.before||null,after_json:h.after||null,source:'offline_demo'});
   }
  }
  for(const rule of (st.settings.alertTemplates||[])){
   if(!rule||typeof rule!=='object')continue;
   const legacyId=String(rule.id||rule.code||rule.name||'default');
   if(filter && !(filter.entity==='alert_rules'&&String(filter.id)===legacyId))continue;
   add('alert_rules',await uuidFor('alert_rules',legacyId),{legacy_id:legacyId,name:rule.name||legacyId,
     event_code:rule.trigger||rule.event||'booking_reminder',when_kind:rule.direction==='after'?'after':'before',
     interval_unit:({days:'day',hours:'hour',minutes:'minute'})[rule.unit]||'day',
     interval_value:Math.max(0,Math.round(Number(rule.value)||0)),
     recipient_kind:rule.recipient==='client'?'customer':rule.recipient==='both'?'both':'staff',
     channels:clone(rule.channels||['inApp']),customer_template:String(rule.clientMessage||''),staff_template:String(rule.staffMessage||''),
     priority:['low','normal','high','critical'].includes(rule.priority)?rule.priority:'normal',
     repeat_rule:null,enabled:rule.enabled!==false,sync_scope:'company'});
  }
  for(const [notificationId,entry] of Object.entries(filter?{}:(st.notificationReadAt||{}))){
   const n=entry?.snapshot;if(!n)continue;
   add('notifications',await uuidFor('notifications',notificationId),{legacy_id:notificationId,
     title:n.title||n.label||'تنبيه',body:n.message||'',kind:'system',
     read_at:date(entry.at),local_only:true,sync_scope:'device'});
  }
  for(const s of (st.specialDays||[])){
   if(!s?.id&&!s?.date)continue;
   const id=String(s.id||s.date);
   if(filter && !(filter.entity==='calendar_blocks'&&String(filter.id)===id))continue;
   add('calendar_blocks',await uuidFor('calendar_blocks',id),{legacy_id:id,
     block_date:s.date||null,kind:s.kind||'busy',title:s.label||s.name||'',
     pattern_json:(s.weekdays||s.from||s.to)?{weekdays:Array.isArray(s.weekdays)?s.weekdays:undefined,from:s.from||undefined,to:s.to||undefined}:null});
  }
  for(const a of window.MyfntFinance?.audit?.()||[]){
   if(filter && !(filter.entity==='payments'&&String(filter.id)===String(a.entityId)) &&
      !(filter.entity==='bookings'&&String(filter.id)===String(a.bookingId)))continue;
   if(!st.receipts?.some(r=>r.id===a.entityId))continue;
   add('payment_audit',await uuidFor('payment_audit',a.id),{legacy_id:a.id,
     payment_id:await uuidFor('payments',a.entityId),actor_name_snapshot:a.actorName||'مستخدم محلي',
     action:({'edit':'correct','void':'reverse','opening-migration':'legacy_import','historical':'legacy_import','create':'create'}[a.type]||'legacy_import'),reason:a.reason||'ترحيل محلي',before_json:a.before||null,after_json:a.after||null,
     happened_at:date(a.at),source:'offline_demo'});
  }
  return rows;
 }
 // A pending local CREATE must collapse with subsequent edits; a local void
 // before its first remote commit cancels that CREATE (audit stays local).
 // Do not compact in-flight/sending operations: the server may have received them.
 function compactPaymentOperation(pendingCreate,operation){
   if(!pendingCreate)return operation;
   if(operation==='correct')return 'create';
   if(operation==='reverse')return null;
   return operation;
 }
 function changeKey(row){return [row.company_id,row.table,row.id].join('|');}
 function relevantRow(row){const {table,id,company_id,fingerprint,server_version,server_adopted,server_origin,adoption_id,adopted_at,bootstrap_source,bootstrap_received_at,bootstrap_id_seen,bootstrap_revision_seen,server_company_id,...rest}=row;return rest;}
 function apiPayload(row){const mapped=window.MyfntMappers?.toApi?.(row.table,row,API_FIELDS[row.table]||[]);if(mapped)return mapped;const out={};for(const key of API_FIELDS[row.table]||[]){if(Object.hasOwn(row,key))out[key]=row[key];}return out;}
 function withFingerprint(row){const v=relevantRow(row);if(row.table==='booking_packages')delete v.package_version;return {...row,fingerprint:JSON.stringify(v)};}
 async function saveBatch(rows,{enqueue=true,paymentOperation=null,paymentReason='',paymentOperations=null}={}){
  if(!rows.length)return 0;
  // Step 21M: do not duplicate domain writes into sync_queue until a real Laravel/API transport is configured.
  // The current mock adapter is intentionally not a server. Existing historical queue rows are preserved for inspection.
  const queueEnabled=Boolean(enqueue&&syncQueueEnabled());
  const db=await open(),stores=[...new Set([...rows.map(r=>r.table),...(queueEnabled?['sync_queue']:[]),...(rows.some(r=>r.table==='booking_packages')?['booking_package_versions']:[])])];
  let changed=0;
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(stores,'readwrite'),q=queueEnabled?tx.objectStore('sync_queue'):null;
   for(const row0 of rows){
    assertTenantRow(row0.table,row0);
    const row=withFingerprint(row0),store=tx.objectStore(row.table),req=store.get(row.id);
    req.onsuccess=()=>{
      const rowPaymentOperation=row.table==='payments'?(paymentOperations?.get?.(row.id)||paymentOperation):null;
      const same=req.result?.fingerprint===row.fingerprint;
      if(same && !(row.table==='payments'&&rowPaymentOperation))return;
      if(!same)changed++;
      // A local rewrite must never erase server/adoption evidence learned from push/pull/first adoption.
      if(req.result?.server_version!=null && row.server_version==null)row.server_version=Number(req.result.server_version)||0;
      if(req.result?.server_adopted===true && row.server_adopted!==true){row.server_adopted=true;row.adoption_id=req.result.adoption_id||null;row.adopted_at=req.result.adopted_at||null;}
      if(req.result?.server_origin===true && row.server_origin!==true)row.server_origin=true;
      if(req.result?.bootstrap_source && !row.bootstrap_source){row.bootstrap_source=req.result.bootstrap_source;row.bootstrap_received_at=req.result.bootstrap_received_at||null;}
      if(row.table==='booking_packages'&&!same){
        row.package_version=req.result?Number(req.result.package_version||1)+1:1;
        const versionRow={id:`${row.id}:${row.package_version}`,company_id:row.company_id,
         package_id:row.id,version:row.package_version,snapshot:relevantRow(row),
         effective_from:now(),source:'offline_demo'};
        tx.objectStore('booking_package_versions').put(versionRow);
      }
      if(!same)store.put(row);
      if(!queueEnabled||DEVICE_ONLY_TABLES.has(row.table)||row.sync_scope==='device'||(!SYNCABLE.has(row.table)&&!(row.table==='payments'&&rowPaymentOperation)))return;
      const key=changeKey(row),lookup=q.index('entity_key').getAll(key);
      lookup.onsuccess=()=>{
       const existing=lookup.result||[],old=existing.filter(x=>x.status==='pending'||x.status==='failed');
       const openConflict=existing.find(x=>x.status==='conflict');
       const pendingCreate=row.table==='payments'&&old.some(x=>x.operation==='create');
       for(const command of old){command.status='superseded';command.updated_at=now();q.put(command);}
       // Superseding a queued op creates a fresh idempotency key; the server may already have accepted the old one.
       // Any version mismatch must become a visible conflict, never a silent overwrite.
       const id=crypto.randomUUID();
       let op=row.table==='sms_approvals'?'approve':row.table==='payments'?
        ({edit:'correct',correct:'correct',void:'reverse',reverse:'reverse',create:'create'}[rowPaymentOperation]||'create'):
        (row.table==='bookings'&&row.status==='archived'?'archive':'upsert');
       // A payment created and then edited before its first remote push is
       // still a CREATE with final values. A locally-created and voided
       // payment never existed remotely, so do not enqueue an impossible
       // REVERSE against a nonexistent server payment. Audit remains local.
       op=compactPaymentOperation(pendingCreate,op);
       if(op===null)return;
       let payload=apiPayload(row);
       if(op==='correct')payload={payment_id:row.id,corrected_amount_minor:row.amount_minor,
        corrected_at:row.posted_at,direction:row.direction,payment_method:row.payment_method,external_reference:row.external_reference,tag:row.tag,memo:row.memo,reason:paymentReason};
       if(op==='reverse')payload={payment_id:row.id,reason:paymentReason};
       if(openConflict){openConflict.latest_local_payload=payload;openConflict.latest_local_operation=op;openConflict.local_changed_at=now();openConflict.updated_at=openConflict.local_changed_at;q.put(openConflict);return;}
       q.put({id,op_id:id,workspace:getWorkspace(),company_id:row.company_id,
        entity_key:key,entity_type:row.table,entity_id:row.id,operation:op,payload,
        base_version:Number(req.result?.server_version)||0,created_at:now(),updated_at:now(),status:'pending',attempts:0,next_attempt_at:null,last_error:null});
      };
     };
   }
   tx.oncomplete=()=>{if(changed>0)window.MyfntTabGuard?.announce?.('indexeddb-domain-write');resolve(changed);};tx.onabort=()=>reject(tx.error||Error('فشلت معاملة التخزين المحلي'));
   tx.onerror=()=>{};
  });
 }
 async function recordOne(entity,legacyId,operation='upsert'){
  const names={packages:'booking_packages',package:'booking_packages',booking:'bookings',payment:'payments',customer:'customers',settings:'company_settings',specialDay:'calendar_blocks',calendarBlock:'calendar_blocks',alertRule:'alert_rules'};
  const type=names[entity]||entity;
  if(!['bookings','payments','booking_packages','customers','company_settings','calendar_blocks','alert_rules'].includes(type)){const err=Error('نوع البيانات غير مدعوم في بوابة الحفظ المحددة: '+String(type));err.name='MyfntAuthorityViolation';err.code='UNSUPPORTED_ENTITY_WRITE';throw err;}
  return serialWrite(async()=>{
   if(window.MyfntTabGuard?.isStale?.())throw Error('تغيّرت البيانات في تبويب آخر؛ أعِد التحميل قبل الترحيل.');
   const rows=await rowsFromState({entity:type,id:String(legacyId)});
   if(!rows.length)return {total:0,changed:0};
   const paymentAudit=type==='payments'?(window.MyfntFinance?.audit?.()||[])
     .filter(a=>String(a.entityId)===String(legacyId)).sort((a,b)=>Number(b.at)-Number(a.at))[0]:null;
   const changed=await saveBatch(rows,{paymentOperation:type==='payments'?operation:null,paymentReason:paymentAudit?.reason||''});
   return {total:rows.length,changed};
  });
 }
 async function commitBookingAggregate(legacyBookingId,{paymentLegacyId=null,paymentOperation='create',paymentReason=''}={}){
  return serialWrite(async()=>{
   if(window.MyfntTabGuard?.isStale?.())throw Error('تغيّرت البيانات في تبويب آخر؛ أعِد التحميل قبل الحفظ.');
   const rows=await rowsFromState({entity:'bookings',id:String(legacyBookingId)});
   if(!rows.length)throw Error('لم يتم العثور على الحجز داخل الحالة المحلية قبل التثبيت.');
   let paymentOperations=null;
   if(paymentLegacyId){
    const paymentId=await uuidFor('payments',paymentLegacyId);
    paymentOperations=new Map([[paymentId,paymentOperation]]);
   }
   const changed=await saveBatch(rows,{paymentOperations,paymentReason});
   return {total:rows.length,changed};
  });
 }
 const BULK_STATE_WRITE_REASONS=new Set(['migration','restore','import','repair','seed','finance-recovery','manual-repair']);
 async function mirrorAll({enqueue=true,reason=''}={}){
   const bulkReason=String(reason||'').trim();
   if(!BULK_STATE_WRITE_REASONS.has(bulkReason)){
    const err=Error('تم منع كتابة state كاملة إلى IndexedDB بدون سبب ترحيل صريح؛ استخدم recordOne/commitBookingAggregate أو Hydration.');
    err.name='MyfntAuthorityViolation';
    err.code='BULK_STATE_WRITE_BLOCKED';
    throw err;
   }
   if(pendingTimer){clearTimeout(pendingTimer);pendingTimer=0;}
   if(window.MyfntFinance?.isRecoveryBlocked?.()||window.MyfntCustomers?.ready?.()===false)throw Error('دليل العملاء أو السجل المالي غير جاهز؛ أُوقف الترحيل حفاظًا على البيانات');
   if(running){rerun=true;return running;}
   running=serialWrite(async()=>{
    if(window.MyfntTabGuard?.isStale?.())throw Error('تغيّرت بيانات هذا الحساب في تبويب آخر؛ أعِد التحميل.');
    const rows=await rowsFromState();let changed=0;
    for(let i=0;i<rows.length;i+=25){
      changed+=await saveBatch(rows.slice(i,i+25),{enqueue});
      // Yield to pointer/scroll input between IndexedDB batches on slower phones.
      if(i+25<rows.length)await new Promise(resolve=>setTimeout(resolve,0));
    }
    lastError='';return {total:rows.length,changed};
   });
   try{return await running;}catch(e){lastError=e.message;console.error('[MYFNT normalized local mirror]',e);throw e;}
   finally{running=null;rerun=false;}
 }
 function scheduleMirror(){
    // Step 22A.5: state is a UI compatibility cache, never an automatic durable authority.
    // Normal entity writes must use recordOne()/commitBookingAggregate().
    // Bulk state -> IndexedDB is allowed only via mirrorAll({reason:<explicit migration reason>}).
    if(pendingTimer){clearTimeout(pendingTimer);pendingTimer=0;}
    return false;
 }
 const SYNC_ACTIVE=new Set(['pending','sending','failed','conflict']);
 const SYNC_TERMINAL=new Set(['synced','superseded']);
 async function queueByStatuses(db,workspace,statuses){
   const tx=db.transaction('sync_queue','readonly'),index=tx.objectStore('sync_queue').index('workspace_status');
   const groups=await Promise.all(statuses.map(status=>once(index.getAll(IDBKeyRange.only([workspace,status])))));
   return groups.flat();
 }
 const retryDelay=attempts=>Math.min(15*60*1000,Math.max(5000,5000*(2**Math.max(0,Number(attempts||0)-1))));
 const queueDefaults=row=>({attempts:0,status:'pending',retryable:true,next_attempt_at:null,last_error:null,last_status:null,
   started_at:null,lease_until:null,synced_at:null,updated_at:row.created_at||now(),...row});
 async function queue({includeTerminal=false}={}){
   const db=await open(),workspace=getWorkspace();
   const rows=includeTerminal
    ? await once(db.transaction('sync_queue','readonly').objectStore('sync_queue').index('workspace').getAll(workspace))
    : await queueByStatuses(db,workspace,[...SYNC_ACTIVE]);
   return rows.map(queueDefaults).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
 }
 async function recoverStaleSending(){
   const db=await open(),workspace=getWorkspace(),at=Date.now();
   return new Promise((resolve,reject)=>{
    const tx=db.transaction('sync_queue','readwrite'),store=tx.objectStore('sync_queue'),req=store.index('workspace_status').getAll(IDBKeyRange.only([workspace,'sending']));let recovered=0;
    req.onsuccess=()=>{for(const raw of req.result||[]){const row=queueDefaults(raw);if(row.status!=='sending')continue;
      const lease=Date.parse(row.lease_until||'');if(Number.isFinite(lease)&&lease>at)continue;
      row.status='failed';row.last_status='sending';row.last_error=row.last_error||'انتهت مهلة محاولة مزامنة سابقة قبل استلام تأكيد الخادم.';
      row.next_attempt_at=new Date(at+retryDelay(row.attempts||1)).toISOString();row.lease_until=null;row.updated_at=now();store.put(row);recovered++;}}
    tx.oncomplete=()=>resolve(recovered);tx.onabort=()=>reject(tx.error||Error('تعذر استعادة عمليات المزامنة المتوقفة'));tx.onerror=()=>{};
   });
 }
 async function claimBatch({limit=50,leaseMs=45000,maxAttempts=8}={}){
   await recoverStaleSending();const db=await open(),workspace=getWorkspace(),at=Date.now(),safeLimit=Math.max(1,Math.min(100,Number(limit)||50));
   return new Promise((resolve,reject)=>{
    const tx=db.transaction('sync_queue','readwrite'),store=tx.objectStore('sync_queue'),idx=store.index('workspace_status');let claimed=[];
    const rows=[];let pending=2;
    const select=()=>{if(--pending)return;const candidates=rows.map(queueDefaults).filter(row=>{
      if(row.retryable===false)return false;if(Number(row.attempts||0)>=maxAttempts)return false;
      const due=Date.parse(row.next_attempt_at||'');return !Number.isFinite(due)||due<=at;
     }).sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))).slice(0,safeLimit);
     claimed=candidates.map(row=>{const next={...row};next.last_status=next.status;next.status='sending';next.attempts=Number(next.attempts||0)+1;
      next.started_at=now();next.lease_until=new Date(at+leaseMs).toISOString();next.next_attempt_at=null;next.updated_at=next.started_at;store.put(next);return next;});};
    for(const status of ['pending','failed']){const req=idx.getAll(IDBKeyRange.only([workspace,status]));req.onsuccess=()=>{rows.push(...(req.result||[]));select();};}
    tx.oncomplete=()=>resolve(claimed);tx.onabort=()=>reject(tx.error||Error('تعذر حجز دفعة المزامنة التالية'));tx.onerror=()=>{};
   });
 }
 async function claimNext(options={}){const rows=await claimBatch({...options,limit:1});return rows[0]||null;}
 async function finishCommand(id,{serverVersion=null,response=null}={}){
   const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['sync_queue','entity_tombstones',...TABLES.filter(t=>t!=='sync_conflicts')],'readwrite'),q=tx.objectStore('sync_queue'),r=q.get(id);let done=null;
    r.onsuccess=()=>{const row=r.result;if(!row){tx.abort();return;}row.status='synced';row.last_status='sending';row.synced_at=now();row.updated_at=row.synced_at;row.lease_until=null;row.next_attempt_at=null;row.last_error=null;
      if(response!==null)row.response_meta=response;done={...row};
      // Step 21N: a successfully acknowledged command is no longer work. Keep the
      // entity server_version/tombstone state, but remove the transient queue row immediately.
      q.delete(id);
      if(serverVersion!==null && tx.objectStoreNames.contains(row.entity_type)){
       const store=tx.objectStore(row.entity_type),er=store.get(row.entity_id);er.onsuccess=()=>{if(er.result){er.result.server_version=Number(serverVersion)||0;row.legacy_id=er.result.legacy_id||null;done=row;store.put(er.result);}};
      }
      const tombs=tx.objectStore('entity_tombstones'),tr=tombs.get(row.entity_key);tr.onsuccess=()=>{if(tr.result&&['delete','archive'].includes(row.operation)){tr.result.remote_required=false;tr.result.synced_at=row.synced_at;tombs.put(tr.result);}};
    };
    tx.oncomplete=()=>resolve(done);tx.onabort=()=>reject(tx.error||Error('تعذر إنهاء عملية المزامنة'));tx.onerror=()=>{};
   });
 }
 async function failCommand(id,error,{conflict=false,retryable=true,retryAfterMs=null,httpStatus=null,serverVersion=null,remotePayload=null}={}){
   const db=await open(),at=Date.now();return new Promise((resolve,reject)=>{
    const stores=['sync_queue','sync_conflicts',...TABLES.filter(t=>t!=='sync_conflicts')];const tx=db.transaction([...new Set(stores)],'readwrite'),q=tx.objectStore('sync_queue'),r=q.get(id);let failed=null;
    r.onsuccess=()=>{const row=r.result;if(!row){tx.abort();return;}row.last_status=row.status;row.status=conflict?'conflict':'failed';row.last_error=String(error?.message||error||'تعذر إرسال التغيير');row.last_http_status=httpStatus==null?null:Number(httpStatus);row.updated_at=now();row.lease_until=null;
      row.retryable=!conflict&&Boolean(retryable);row.next_attempt_at=row.retryable?new Date(at+(retryAfterMs==null?retryDelay(row.attempts):Math.max(0,Number(retryAfterMs)))).toISOString():null;q.put(row);failed=row;
      const entityStore=tx.objectStoreNames.contains(row.entity_type)?tx.objectStore(row.entity_type):null;
      const attachLegacy=localRow=>{if(localRow?.legacy_id){row.legacy_id=localRow.legacy_id;failed=row;}return localRow;};
      if(entityStore&&!conflict){const er=entityStore.get(row.entity_id);er.onsuccess=()=>attachLegacy(er.result||null);}
      if(conflict){const cs=tx.objectStore('sync_conflicts'),cid=`${row.id}:conflict`,store=entityStore;
       const putConflict=localRow=>{localRow=attachLegacy(localRow);return cs.put({id:cid,company_id:row.company_id,entity_type:row.entity_type,entity_id:row.entity_id,operation:row.operation,
        local_command_id:row.id,base_version:Number(row.base_version)||0,local_payload:clone(row.payload||{}),latest_local_payload:clone(row.latest_local_payload||row.payload||{}),
        remote_version:serverVersion==null?null:Number(serverVersion)||0,remote_payload:remotePayload==null?null:clone(remotePayload),local_snapshot:localRow?clone(localRow):null,
        error:row.last_error,http_status:row.last_http_status,created_at:row.updated_at,updated_at:row.updated_at,status:'open',source:'push_409'});};
       if(store){const er=store.get(row.entity_id);er.onsuccess=()=>putConflict(er.result||null);}else putConflict(null);}
    };
    tx.oncomplete=()=>resolve(failed);tx.onabort=()=>reject(tx.error||Error('تعذر تحديث حالة فشل المزامنة'));tx.onerror=()=>{};
   });
 }

 async function conflicts({status='open'}={}){
  const db=await open(),company_id=await uuidFor('companies',owner().companyId);
  const rows=await once(db.transaction('sync_conflicts','readonly').objectStore('sync_conflicts').index('company_id').getAll(company_id));
  return rows.filter(row=>!status||row.status===status).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
 }
 function remoteRow(type,id,company_id,payload,serverVersion){
  const canonical=canonicalUuid(id);if(CANONICAL_ID_TABLES.has(type)&&!canonical)throw identityError(`تحديث الخادم لـ ${type} لا يحمل UUID قانونيًا.`,{table:type,entity_id:String(id||'')});
  const body=clone(payload||{});if(body.id&&canonicalUuid(body.id)!==canonical)throw identityError(`payload.id لا يطابق entity_id في ${type}.`,{table:type,entity_id:canonical,payload_id:String(body.id)});
  delete body.id;delete body.entity_id;const base={id:canonical||String(id),table:type,company_id,...body,server_version:Number(serverVersion)||0};
  return withFingerprint(base);
 }
 async function applyRemoteChanges(changes,{cursor=null}={}){
  if(!Array.isArray(changes)||!changes.length){
   if(cursor!==null){const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('local_meta','readwrite');tx.objectStore('local_meta').put({id:`pull_cursor:${getWorkspace()}`,workspace:getWorkspace(),value:String(cursor),updated_at:now()});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});}
   return {applied:0,conflicts:0,ignored:0,cursor};
  }
  const db=await open(),workspace=getWorkspace(),expectedCompany=await uuidFor('companies',owner().companyId);
  let applied=0,conflictCount=0,ignored=0;
  for(const change of changes){
   const type=String(change?.entity_type||change?.table||''),rawId=String(change?.entity_id||change?.id||''),id=canonicalUuid(rawId);
   if(!TABLES.includes(type)||type==='sync_conflicts'||!rawId){ignored++;continue;}
   if(CANONICAL_ID_TABLES.has(type)&&!id)throw identityError(`Sync Pull أرسل معرفًا غير UUID في ${type}.`,{table:type,entity_id:rawId});
   const company_id=String(change?.company_id||expectedCompany);if(company_id!==expectedCompany){ignored++;continue;}
   const entityKey=[company_id,type,id].join('|'),remoteVersion=Number(change?.server_version??change?.version??0)||0;
   await new Promise((resolve,reject)=>{
    const stores=[type,'sync_queue','sync_conflicts','entity_tombstones'],tx=db.transaction(stores,'readwrite'),store=tx.objectStore(type),q=tx.objectStore('sync_queue'),cs=tx.objectStore('sync_conflicts'),tombs=tx.objectStore('entity_tombstones');
    const qr=q.index('entity_key').getAll(entityKey),tr=tombs.get(entityKey),lr=store.get(id);let commands=null,tomb=null,local=null;
    const decide=()=>{if(commands===null||tomb===null||local===null)return;
     const active=(commands||[]).filter(x=>SYNC_ACTIVE.has(queueDefaults(x).status));const localDirty=active.length>0||Boolean(tomb?.remote_required);
     const deleted=Boolean(change?.deleted)||['delete','archive'].includes(String(change?.operation||''));
     if(localDirty){
      const cid=`pull:${entityKey}:${remoteVersion||'unknown'}`;cs.put({id:cid,company_id,entity_type:type,entity_id:id,operation:change?.operation||'pull_update',
       local_command_id:active[0]?.id||null,base_version:Number(local?.server_version||active[0]?.base_version||tomb?.base_version||0),
       local_payload:clone(active[0]?.latest_local_payload||active[0]?.payload||(tomb?{id}:{})),latest_local_operation:active[0]?.latest_local_operation||active[0]?.operation||tomb?.operation||'upsert',
       local_snapshot:local?clone(local):(tomb?.snapshot?clone(tomb.snapshot):null),remote_version:remoteVersion,remote_payload:clone(change?.payload||change?.entity||{}),remote_deleted:deleted,
       error:'وصل تحديث من الخادم بينما توجد تعديلات محلية غير محسومة.',created_at:now(),updated_at:now(),status:'open',source:'pull_collision'});conflictCount++;return;
     }
     if(deleted){store.delete(id);tombs.put({id:entityKey,workspace,company_id,entity_key:entityKey,entity_type:type,entity_id:id,legacy_id:local?.legacy_id||null,
       operation:change?.operation==='archive'?'archive':'delete',reason:'remote_pull',deleted_at:now(),base_version:remoteVersion,snapshot:local?clone(local):null,remote_required:false,synced_at:now()});applied++;return;}
     const payload=change?.payload||change?.entity||{};const next=remoteRow(type,id,company_id,payload,remoteVersion);
     // Ignore stale/equal remote versions; an older pull must never roll back a newer normalized row.
     if(local&&Number(local.server_version||0)>=remoteVersion&&remoteVersion>0){ignored++;return;}
     store.put(next);if(tomb&&!tomb.remote_required)tombs.delete(entityKey);applied++;
    };
    qr.onsuccess=()=>{commands=qr.result||[];decide();};tr.onsuccess=()=>{tomb=tr.result||false;decide();};lr.onsuccess=()=>{local=lr.result||false;decide();};
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تطبيق تحديث الخادم محليًا'));tx.onerror=()=>{};
   });
  }
  if(cursor!==null){await new Promise((resolve,reject)=>{const tx=db.transaction('local_meta','readwrite');tx.objectStore('local_meta').put({id:`pull_cursor:${workspace}`,workspace,value:String(cursor),updated_at:now()});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});}
  if(applied){window.MyfntTabGuard?.announce?.('indexeddb-remote-apply');document.dispatchEvent(new CustomEvent('myfnt:remote-applied',{detail:{applied,cursor}}));}
  if(conflictCount)document.dispatchEvent(new CustomEvent('myfnt:sync-conflict',{detail:{source:'pull',count:conflictCount}}));
  return {applied,conflicts:conflictCount,ignored,cursor};
 }

 async function hydrationSnapshot({forceFull=false}={}){
  const db=await open(),company_id=await uuidFor('companies',owner().companyId),workspace=getWorkspace();
  const baseNames=['companies','company_settings','booking_packages','calendar_blocks','alert_rules'];
  const countOne=name=>once(db.transaction(name,'readonly').objectStore(name).index('company_id').count(company_id));
  const [bookingCount,customerCount,paymentCount]=await Promise.all(['bookings','customers','payments'].map(countOne));
  if(forceFull){
   const names=[...baseNames,'customers','bookings','booking_details','payments'];
   return new Promise((resolve,reject)=>{const tx=db.transaction([...names,'local_meta'],'readonly'),tables={},ui_meta=[];
    for(const name of names){const req=tx.objectStore(name).index('company_id').getAll(company_id);req.onsuccess=()=>{tables[name]=req.result||[];};}
    const metaReq=tx.objectStore('local_meta').index('workspace').getAll(workspace);metaReq.onsuccess=()=>{const prefix=`ui:${workspace}:`;ui_meta.push(...(metaReq.result||[]).filter(row=>String(row?.id||'').startsWith(prefix)).map(row=>({...row,key:String(row.id).slice(prefix.length)})));};
    tx.oncomplete=()=>resolve({company_id,workspace,tables,ui_meta,lazy:{enabled:false,forcedFull:true,counts:{bookings:bookingCount,customers:customerCount,payments:paymentCount}}});tx.onabort=()=>reject(tx.error||Error('تعذر قراءة بيانات التحديث المحلي'));tx.onerror=()=>{};});
  }
  const tables={};
  // Step 21N: configuration stays eager, while domain memory is deliberately bounded
  // to the complete current calendar year + the complete following calendar year.
  await new Promise((resolve,reject)=>{const tx=db.transaction(baseNames,'readonly');for(const name of baseNames){const req=tx.objectStore(name).index('company_id').getAll(company_id);req.onsuccess=()=>{tables[name]=req.result||[];};}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر قراءة إعدادات مساحة العمل'));tx.onerror=()=>{};});
  let currentYear;
  try{currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Aden',year:'numeric'}).format(new Date()));}catch{currentYear=new Date().getFullYear();}
  if(!Number.isInteger(currentYear)||currentYear<2000)currentYear=new Date().getFullYear();
  const fromIso=`${currentYear}-01-01`,toIso=`${currentYear+1}-12-31`;
  const bookings=[];
  await new Promise((resolve,reject)=>{const tx=db.transaction('bookings','readonly'),idx=tx.objectStore('bookings').index('company_date'),range=IDBKeyRange.bound([company_id,fromIso],[company_id,toIso]),req=idx.openCursor(range,'next');req.onsuccess=()=>{const c=req.result;if(!c)return;bookings.push(c.value);c.continue();};req.onerror=()=>reject(req.error);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تحميل حجوزات نافذة السنتين'));tx.onerror=()=>{};});
  tables.bookings=bookings;
  const bookingIds=new Set(bookings.map(x=>String(x.id)).filter(Boolean));
  tables.booking_details=[];tables.payments=[];tables.customers=[];

  // Details are fetched by booking id. Payments are the UNION of:
  // (1) every payment linked to a booking in the two-year working set, regardless of payment date;
  // (2) every standalone/other payment posted during those same two calendar years.
  // This preserves the complete financial story of the working set without scanning all company payments.
  const paymentMap=new Map();
  if(bookingIds.size){
   await new Promise((resolve,reject)=>{const tx=db.transaction(['booking_details','payments'],'readonly'),details=tx.objectStore('booking_details').index('booking_id'),payments=tx.objectStore('payments').index('company_booking');
    for(const id of bookingIds){
     const dr=details.get(id);dr.onsuccess=()=>{if(dr.result)tables.booking_details.push(dr.result);};
     const pr=payments.getAll(IDBKeyRange.only([company_id,id]));pr.onsuccess=()=>{for(const row of pr.result||[])paymentMap.set(String(row.id),row);};
    }
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تجهيز تفاصيل وسندات حجوزات نافذة السنتين'));tx.onerror=()=>{};});
  }
  await new Promise((resolve,reject)=>{const tx=db.transaction('payments','readonly'),idx=tx.objectStore('payments').index('company_posted'),lower=fromIso,upper=`${toIso}\uffff`,req=idx.openCursor(IDBKeyRange.bound([company_id,lower],[company_id,upper]),'next');
   req.onsuccess=()=>{const c=req.result;if(!c)return;paymentMap.set(String(c.value.id),c.value);c.continue();};req.onerror=()=>reject(req.error);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تحميل الحركات المالية لنافذة السنتين'));tx.onerror=()=>{};});
  tables.payments=[...paymentMap.values()];

  const customerIds=new Set(bookings.map(x=>String(x.customer_id||'')).filter(Boolean));
  for(const row of tables.payments)if(row?.customer_id)customerIds.add(String(row.customer_id));
  if(customerIds.size){await new Promise((resolve,reject)=>{const tx=db.transaction('customers','readonly'),customers=tx.objectStore('customers');for(const id of customerIds){const r=customers.get(id);r.onsuccess=()=>{if(r.result)tables.customers.push(r.result);};}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تحميل عملاء نافذة السنتين'));tx.onerror=()=>{};});}

  let ui_meta=[];await new Promise((resolve,reject)=>{const tx=db.transaction('local_meta','readonly'),req=tx.objectStore('local_meta').index('workspace').getAll(workspace);req.onsuccess=()=>{const prefix=`ui:${workspace}:`;ui_meta=(req.result||[]).filter(row=>String(row?.id||'').startsWith(prefix)).map(row=>({...row,key:String(row.id).slice(prefix.length)}));};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});
  return {company_id,workspace,tables,ui_meta,lazy:{enabled:true,policy:'current-and-next-calendar-year',counts:{bookings:bookingCount,customers:customerCount,payments:paymentCount},working:{bookings:tables.bookings.length,customers:tables.customers.length,payments:tables.payments.length},range:{from:fromIso,to:toIso,years:[currentYear,currentYear+1]}}};
 }
 async function setUiMeta(key,value){
  const db=await open(),workspace=getWorkspace(),id=`ui:${workspace}:${String(key||'')}`;
  await new Promise((resolve,reject)=>{const tx=db.transaction('local_meta','readwrite'),store=tx.objectStore('local_meta'),req=store.get(id);req.onsuccess=()=>{const next=clone(value),prev=req.result;if(prev&&JSON.stringify(prev.value)===JSON.stringify(next))return;store.put({id,workspace,value:next,updated_at:now()});};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر حفظ بيانات الواجهة المحلية'));tx.onerror=()=>{};});
  return true;
 }
 async function getUiMeta(key){
  const db=await open(),workspace=getWorkspace(),id=`ui:${workspace}:${String(key||'')}`;
  const row=await once(db.transaction('local_meta','readonly').objectStore('local_meta').get(id));return row?.value??null;
 }
 async function applyWorkspaceCurrency(code){
  code=cc(code);const db=await open(),company_id=await uuidFor('companies',owner().companyId);
  const stores=['company_settings','booking_packages','booking_details','payments','wallets'];
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction(stores,'readwrite');
   const settings=tx.objectStore('company_settings'),sr=settings.get(company_id);
   sr.onsuccess=()=>{const row=sr.result||{id:company_id,company_id};if(row.currency===code&&sr.result)return;row.currency=code;row.updated_at=now();settings.put(withFingerprint(row));};
   for(const name of stores.slice(1)){
    const store=tx.objectStore(name),req=store.index('company_id').getAll(company_id);
    req.onsuccess=()=>{for(const row of req.result||[]){if(row.currency===code)continue;row.currency=code;row.updated_at=now();store.put(withFingerprint(row));}};
   }
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر توحيد العملة في قاعدة البيانات المحلية'));tx.onerror=()=>{};
  }));
  return code;
 }
 async function pullCursor(){const db=await open(),row=await once(db.transaction('local_meta','readonly').objectStore('local_meta').get(`pull_cursor:${getWorkspace()}`));return row?.value||null;}
 async function resolveConflict(conflictId,strategy){
  if(!['keep_local','accept_remote'].includes(strategy))throw Error('طريقة حل التعارض غير معروفة');
  if(strategy==='keep_local'&&!syncQueueEnabled())throw Error('لا يمكن إعادة إرسال النسخة المحلية قبل ربط Laravel/API حقيقي. لم يتم إنشاء Sync Queue جديدة.');
  const db=await open(),workspace=getWorkspace();return serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction(['sync_conflicts','sync_queue','entity_tombstones',...TABLES.filter(t=>t!=='sync_conflicts')],'readwrite'),cs=tx.objectStore('sync_conflicts'),cr=cs.get(conflictId);let result=null;
   cr.onsuccess=()=>{const c=cr.result;if(!c||c.status!=='open'){tx.abort();return;}const type=c.entity_type;if(!tx.objectStoreNames.contains(type)){tx.abort();return;}const store=tx.objectStore(type),q=tx.objectStore('sync_queue'),key=[c.company_id,type,c.entity_id].join('|');
    const close=status=>{c.status=status;c.resolved_at=now();c.updated_at=c.resolved_at;cs.put(c);};
    if(strategy==='accept_remote'){
     const cmdReq=c.local_command_id?q.get(c.local_command_id):null;if(cmdReq)cmdReq.onsuccess=()=>{if(cmdReq.result){cmdReq.result.status='superseded';cmdReq.result.updated_at=now();q.put(cmdReq.result);}};
     if(c.remote_deleted){store.delete(c.entity_id);tx.objectStore('entity_tombstones').put({id:key,workspace,company_id:c.company_id,entity_key:key,entity_type:type,entity_id:c.entity_id,legacy_id:c.local_snapshot?.legacy_id||null,
       operation:c.operation==='archive'?'archive':'delete',reason:'conflict_accept_remote',deleted_at:now(),base_version:Number(c.remote_version||0),snapshot:c.local_snapshot?clone(c.local_snapshot):null,remote_required:false,synced_at:now()});}
     else if(c.remote_payload){store.put(remoteRow(type,c.entity_id,c.company_id,c.remote_payload,c.remote_version));const tr=tx.objectStore('entity_tombstones').get(key);tr.onsuccess=()=>{if(tr.result)tx.objectStore('entity_tombstones').delete(key);};}
     close('resolved_remote');result={strategy,status:'resolved_remote'};return;
    }
    const er=store.get(c.entity_id);er.onsuccess=()=>{const localRow=er.result||c.local_snapshot;if(!localRow){tx.abort();return;}const payload=Object.keys(c.latest_local_payload||{}).length?c.latest_local_payload:apiPayload(localRow),op=c.latest_local_operation||c.operation||'upsert';
     if(c.local_command_id){const old=q.get(c.local_command_id);old.onsuccess=()=>{if(old.result){old.result.status='superseded';old.result.updated_at=now();q.put(old.result);}};}
     const id=crypto.randomUUID();q.put({id,op_id:id,workspace,company_id:c.company_id,entity_key:key,entity_type:type,entity_id:c.entity_id,operation:op,payload:clone(payload),
      base_version:Number(c.remote_version||0),created_at:now(),updated_at:now(),status:'pending',attempts:0,next_attempt_at:null,last_error:null,retryable:true});
     if(c.remote_version!=null){localRow.server_version=Number(c.remote_version)||0;store.put(withFingerprint(localRow));}close('resolved_local');result={strategy,status:'resolved_local',command_id:id};
    };
   };
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('تعذر حل تعارض المزامنة'));tx.onerror=()=>{};
  }));
 }

 function stableValue(v){
  if(Array.isArray(v))return v.map(stableValue);
  if(v&&typeof v==='object'){const out={};for(const k of Object.keys(v).sort())out[k]=stableValue(v[k]);return out;}
  return v;
 }
 const RECONCILE_FIELDS={...API_FIELDS,companies:['name','description','address','phone_1','phone_2','sms_phone','whatsapp_phone','logo_object_key','booking_receipt_terms','receipt_notes']};
 function reconcileComparable(table,row){
  const fields=RECONCILE_FIELDS[table];if(fields)return Object.fromEntries(fields.map(k=>[k,stableValue(row?.[k]??null)]));
  const omit=new Set(['fingerprint','table','company_id','server_company_id','workspace','syncStatus','sync_status','pending_sync','outbox_id',
   'bootstrap_source','bootstrap_received_at','bootstrap_id_seen','bootstrap_revision_seen','server_adopted','server_origin','server_version','adoption_id','adopted_at',
   'local_updated_at','server_updated_at','search_text','name_key','phone_key','updated_at','created_at','legacy_id','source']);
  const out={};for(const [k,v] of Object.entries(row||{})){if(!omit.has(k))out[k]=stableValue(v);}return out;
 }
 function reconcileSignature(table,row){try{return JSON.stringify(stableValue(reconcileComparable(table,row)));}catch{return '';}}
 function remoteDeleted(raw){return Boolean(raw&&(raw._deleted===true||raw.deleted===true||raw.tombstone===true||String(raw.operation||'').toLowerCase()==='delete'));}
 function normalizeBootstrapRow(table,raw,{company_id,serverCompanyId=null,source='bootstrap',bootstrapId=null,revision=null}={}){
  const rawId=String(raw?.id||''),entityId=String(raw?.entity_id||'');
  if(rawId&&entityId&&canonicalUuid(rawId)!==canonicalUuid(entityId))throw identityError(`الخادم أرسل معرفين مختلفين لنفس سجل ${table}.`,{table,raw_id:rawId,entity_id:entityId});
  const id=canonicalUuid(rawId||entityId);if(!id){if(!rawId&&!entityId)return null;throw identityError(`معرف الخادم في ${table} ليس UUID قانونيًا.`,{table,entity_id:rawId||entityId});}
  const row=clone(raw);row.id=id;row.table=table;row.company_id=company_id;
  if(row.legacy_id!=null)row.legacy_id=String(row.legacy_id);
  if(serverCompanyId)row.server_company_id=String(serverCompanyId);row.bootstrap_source=source;row.bootstrap_received_at=now();
  if(bootstrapId!=null)row.bootstrap_id_seen=String(bootstrapId);if(revision!=null)row.bootstrap_revision_seen=String(revision);
  delete row.syncStatus;delete row.sync_status;delete row.pending_sync;delete row.outbox_id;delete row._deleted;delete row.deleted;delete row.tombstone;delete row.operation;
  if(row.server_version!=null)row.server_version=Number(row.server_version)||0;return withFingerprint(row);
 }
 async function ingestReconciledBootstrapBatch(table,rows,{serverCompanyId=null,source='bootstrap',bootstrapId=null,revision=null}={}){
  table=String(table||'');if(!TABLES.includes(table)||table==='sync_conflicts')throw Error('جدول Bootstrap غير مسموح: '+table);
  if(!Array.isArray(rows)||!rows.length)return {table,received:0,written:0,deleted:0,counts:{same:0,'server-newer':0,'local-newer':0,conflict:0,'identity-conflict':0,deleted:0},blocked:false,issues:[]};
  // Fail before opening the write transaction if the server violates canonical identity.
  for(const raw of rows){if(!raw||typeof raw!=='object')continue;const a=String(raw.id||''),b=String(raw.entity_id||'');if(a&&b&&canonicalUuid(a)!==canonicalUuid(b))throw identityError(`Bootstrap أرسل id و entity_id مختلفين في ${table}.`,{table,raw_id:a,entity_id:b});const v=a||b;if(v&&!canonicalUuid(v))throw identityError(`Bootstrap أرسل معرفًا غير UUID في ${table}.`,{table,entity_id:v});}
  const company_id=await uuidFor('companies',owner().companyId),workspace=getWorkspace(),db=await open();
  return serialWrite(()=>new Promise((resolve,reject)=>{
   const stores=[table,'sync_queue','entity_tombstones'],tx=db.transaction(stores,'readwrite'),store=tx.objectStore(table),q=tx.objectStore('sync_queue'),tombs=tx.objectStore('entity_tombstones');
   const data=[];let remaining=0,finished=false;
   const counts={same:0,'server-newer':0,'local-newer':0,conflict:0,'identity-conflict':0,deleted:0},issues=[];let written=0,deleted=0,identityReady=false;const legacyOwners=new Map();
   const finishReads=()=>{if(finished||remaining!==0||!identityReady)return;finished=true;
    for(const item of data){const {raw,id,local,commands,tomb}=item,remoteVersion=Number(raw?.server_version??raw?.version??0)||0,localVersion=Number(local?.server_version||0),isDeleted=remoteDeleted(raw);
     const active=(commands||[]).filter(x=>['pending','sending','failed','conflict'].includes(String(x?.status||''))),unsynced=active.length>0||Boolean(tomb?.remote_required===true&&!tomb?.adoption_settled);
     const incomingLegacy=raw?.legacy_id==null?'':String(raw.legacy_id),legacyOwner=incomingLegacy?legacyOwners.get(incomingLegacy):null;
     let cls='';
     if((legacyOwner&&legacyOwner!==id)||(local&&incomingLegacy&&local.legacy_id!=null&&String(local.legacy_id)!==incomingLegacy))cls='identity-conflict';
     if(!cls&&!local){cls=isDeleted?'deleted':'server-newer';}
     else if(!cls&&unsynced){if(isDeleted||remoteVersion>localVersion)cls='conflict';else cls='local-newer';}
     else if(!cls&&isDeleted){cls='deleted';}
     else if(!cls){
      const same=reconcileSignature(table,local)===reconcileSignature(table,raw);
      if(same)cls='same';
      else if(remoteVersion>localVersion)cls='server-newer';
      else if(localVersion>remoteVersion)cls='local-newer';
      else cls='conflict';
     }
     counts[cls]++;
     if(cls==='local-newer'||cls==='conflict'||cls==='identity-conflict')issues.push({table,entity_id:id,legacy_id:incomingLegacy||null,existing_identity:legacyOwner||null,classification:cls,local_version:localVersion,server_version:remoteVersion,active_commands:active.length,local_fingerprint:String(local?.fingerprint||''),server_signature:reconcileSignature(table,raw)});
     item.classification=cls;
    }
    if(issues.length)return; // transaction completes read-only; caller receives a blocking report.
    for(const item of data){const cls=item.classification;if(cls==='deleted'){if(item.local){store.delete(item.id);deleted++;}const tr=tombs.get([company_id,table,item.id].join('|'));tr.onsuccess=()=>{if(tr.result)tombs.delete(tr.result.id);};continue;}
     if(cls==='same'||cls==='server-newer'){const row=normalizeBootstrapRow(table,item.raw,{company_id,serverCompanyId,source,bootstrapId,revision});if(row){store.put(row);written++;}}
    }
   };
   for(const raw of rows){if(!raw||typeof raw!=='object')continue;const rawId=String(raw.id||raw.entity_id||''),id=canonicalUuid(rawId);if(!rawId)continue;if(!id){tx.abort();throw identityError(`Bootstrap أرسل معرفًا غير قانوني في ${table}.`,{table,entity_id:rawId});}const entityKey=[company_id,table,id].join('|'),item={raw,id,local:null,commands:[],tomb:null};data.push(item);remaining+=3;
    const lr=store.get(id);lr.onsuccess=()=>{item.local=lr.result||null;remaining--;finishReads();};lr.onerror=()=>{remaining--;finishReads();};
    const qr=q.index('entity_key').getAll(entityKey);qr.onsuccess=()=>{item.commands=qr.result||[];remaining--;finishReads();};qr.onerror=()=>{remaining--;finishReads();};
    const tr=tombs.get(entityKey);tr.onsuccess=()=>{item.tomb=tr.result||null;remaining--;finishReads();};tr.onerror=()=>{remaining--;finishReads();};
   }
   const identityCursor=store.index('company_id').openCursor(IDBKeyRange.only(company_id));
   identityCursor.onsuccess=()=>{const c=identityCursor.result;if(!c){identityReady=true;finishReads();return;}const r=c.value||{};if(r.legacy_id!=null){const k=String(r.legacy_id);if(k&&!legacyOwners.has(k))legacyOwners.set(k,String(r.id||c.primaryKey||''));}c.continue();};
   identityCursor.onerror=()=>{tx.abort();};
   if(!data.length){identityReady=true;finished=true;}
   tx.oncomplete=()=>resolve({table,received:rows.length,written,deleted,counts,blocked:issues.length>0,issues});
   tx.onabort=()=>reject(tx.error||Error('تعذر تنفيذ بوابة Reconciliation للجدول '+table));tx.onerror=()=>{};
  }));
 }
 async function finalizeBootstrapReplacement({tables=[],bootstrapId=null}={}){
  const verified=await assertBootstrapReplaceSafe();if(!bootstrapId)throw Error('bootstrapId مطلوب لإنهاء الاستبدال الآمن.');
  const db=await open(),company_id=verified.company_id||await uuidFor('companies',owner().companyId),allowed=[...new Set((tables||[]).map(String).filter(t=>TABLES.includes(t)&&!DEVICE_ONLY_TABLES.has(t)))];
  let deleted=0;const byTable={};
  if(!allowed.length)return {deleted,byTable};
  await serialWrite(()=>new Promise((resolve,reject)=>{const tx=db.transaction(allowed,'readwrite');for(const name of allowed){const store=tx.objectStore(name),req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));byTable[name]=0;
    req.onsuccess=()=>{const c=req.result;if(!c)return;const row=c.value||{};if(String(row.bootstrap_id_seen||'')!==String(bootstrapId)){c.delete();deleted++;byTable[name]++;}c.continue();};}
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر إنهاء استبدال Bootstrap'));tx.onerror=()=>{};}));
  return {deleted,byTable,bootstrapId:String(bootstrapId),checkedAt:now()};
 }
 async function ingestBootstrapBatch(table,rows,{serverCompanyId=null,source="bootstrap"}={}){
  table=String(table||"");if(!TABLES.includes(table)||table==="sync_conflicts")throw Error("جدول Bootstrap غير مسموح: "+table);
  if(!Array.isArray(rows)||!rows.length)return {table,received:0,written:0};
  const expectedCompany=await uuidFor('companies',owner().companyId),db=await open();let written=0;
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction(table,'readwrite'),store=tx.objectStore(table);
   for(const raw of rows){
    if(!raw||typeof raw!=="object")continue;const row=normalizeBootstrapRow(table,raw,{company_id:expectedCompany,serverCompanyId,source});if(!row)continue;
    store.put(row);written++;
   }
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر إدخال دفعة Bootstrap إلى '+table));tx.onerror=()=>{};
  }));
  return {table,received:rows.length,written};
 }
 function serverEvidence(row){return Boolean(
   String(row?.bootstrap_source||'').startsWith('bootstrap:') ||
   Number(row?.server_version||0)>0 || row?.server_adopted===true || row?.server_origin===true
  );}
 function adoptionPayload(row){
  const omit=new Set(['fingerprint','table','company_id','workspace','syncStatus','sync_status','pending_sync','outbox_id',
   'bootstrap_source','bootstrap_received_at','server_adopted','server_origin','server_version','adoption_id','adopted_at']);
  const out={};for(const [k,v] of Object.entries(row||{})){if(!omit.has(k))out[k]=clone(v);}return out;
 }
 async function localAdoptionSummary(){
  const db=await open(),company_id=await uuidFor('companies',owner().companyId),tables={};let total=0;
  for(const table of ADOPTION_TABLES){
   if(!db.objectStoreNames.contains(table))continue;
   const count=await new Promise((resolve,reject)=>{
    const tx=db.transaction(table,'readonly'),store=tx.objectStore(table);let n=0;
    if(!store.indexNames.contains('company_id')){resolve(0);return;}
    const req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));
    req.onsuccess=()=>{const c=req.result;if(!c){resolve(n);return;}if(!serverEvidence(c.value||{}))n++;c.continue();};
    req.onerror=()=>reject(req.error||Error('تعذر فحص '+table));tx.onabort=()=>reject(tx.error||Error('تعذر فحص '+table));tx.onerror=()=>{};
   });
   if(count){tables[table]=count;total+=count;}
  }
  return {company_id,workspace:getWorkspace(),tables,total,checked_at:now()};
 }
 async function localAdoptionBatch(table,{afterId='',limit=100}={}){
  table=String(table||'');if(!ADOPTION_TABLES.includes(table))throw Error('جدول Adoption غير مسموح: '+table);
  const db=await open(),company_id=await uuidFor('companies',owner().companyId),rows=[];let lastId=String(afterId||''),scannedTo=lastId,done=true;
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(table,'readonly'),store=tx.objectStore(table);if(!store.indexNames.contains('company_id')){resolve();return;}
   const req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));
   req.onsuccess=()=>{const c=req.result;if(!c){done=true;resolve();return;}const id=String(c.primaryKey||c.value?.id||'');scannedTo=id;
    if(lastId&&id<=lastId){c.continue();return;}const row=c.value||{};
    if(!serverEvidence(row))rows.push({entity_id:id,legacy_id:row.legacy_id==null?null:String(row.legacy_id),local_fingerprint:String(row.fingerprint||''),local_updated_at:row.local_updated_at||row.updated_at||row.created_at||null,payload:adoptionPayload(row)});
    if(rows.length>=Math.max(1,Math.min(250,Number(limit)||100))){done=false;resolve();return;}c.continue();};
   req.onerror=()=>reject(req.error||Error('تعذر قراءة دفعة Adoption من '+table));tx.onabort=()=>reject(tx.error||Error('تعذر قراءة دفعة Adoption من '+table));tx.onerror=()=>{};
  });
  return {table,rows,next_after_id:done?null:scannedTo,done};
 }
 async function markAdoptionResults(table,results,{adoptionId=null}={}){
  table=String(table||'');if(!ADOPTION_TABLES.includes(table))throw Error('جدول Adoption غير مسموح: '+table);
  if(!Array.isArray(results)||!results.length)return {accepted:0,conflicts:0,rejected:0,stale:0};
  const db=await open();let accepted=0,conflicts=0,rejected=0,stale=0;
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction(table,'readwrite'),store=tx.objectStore(table);
   for(const result of results){const id=String(result?.entity_id||result?.id||'');if(!id)continue;const status=String(result?.status||'').toLowerCase();
    if(status==='conflict'){conflicts++;continue;}if(!['adopted','already_exists','accepted'].includes(status)){rejected++;continue;}
    const req=store.get(id);req.onsuccess=()=>{const row=req.result;if(!row){stale++;return;}const expected=String(result?.local_fingerprint||'');
      if(expected&&String(row.fingerprint||'')!==expected){stale++;return;}
      row.server_adopted=true;row.server_origin=false;row.adoption_id=adoptionId==null?null:String(adoptionId);row.adopted_at=now();
      if(result?.server_version!=null)row.server_version=Number(result.server_version)||0;
      store.put(withFingerprint(row));accepted++;};
   }
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تثبيت إقرار Adoption للجدول '+table));tx.onerror=()=>{};
  }));
  return {accepted,conflicts,rejected,stale};
 }
 async function settleLocalOnlyTombstones({adoptionId=null}={}){
  const db=await open(),workspace=getWorkspace();if(!db.objectStoreNames.contains('entity_tombstones'))return 0;let settled=0;
  await serialWrite(()=>new Promise((resolve,reject)=>{const tx=db.transaction('entity_tombstones','readwrite'),store=tx.objectStore('entity_tombstones'),req=store.index('workspace').openCursor(IDBKeyRange.only(workspace));
   req.onsuccess=()=>{const c=req.result;if(!c)return;const row=c.value||{};if(row.remote_required===false&&Number(row.base_version||0)===0){row.adoption_settled=true;row.adoption_id=adoptionId==null?null:String(adoptionId);row.adoption_settled_at=now();store.put(row);settled++;}c.continue();};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('تعذر تسوية علامات الحذف المحلية'));tx.onerror=()=>{};}));return settled;
 }
 async function localAdoptionGuard(){
  const db=await open(),company_id=await uuidFor('companies',owner().companyId),workspace=getWorkspace();
  // Step 22A.1: replaceLocal must never infer safety from an empty sync_queue.
  // Before Laravel existed, legitimate local rows were intentionally written without queue commands.
  // A row is considered server-adopted only when we have positive evidence from bootstrap/push/pull.
  const protectedTables=ADOPTION_TABLES;
  const localTables={},samples={};let localRowsDetected=0;
  for(const table of protectedTables){
    if(!db.objectStoreNames.contains(table))continue;
    const found=await new Promise((resolve,reject)=>{
      const tx=db.transaction(table,'readonly'),store=tx.objectStore(table);
      if(!store.indexNames.contains('company_id')){resolve(null);return;}
      const req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));
      req.onsuccess=()=>{const c=req.result;if(!c){resolve(null);return;}const row=c.value||{};if(!serverEvidence(row)){resolve({id:String(row.id||''),legacy_id:row.legacy_id==null?null:String(row.legacy_id),source:String(row.source||''),server_version:Number(row.server_version||0)});return;}c.continue();};
      req.onerror=()=>reject(req.error||Error('تعذر فحص '+table));
      tx.onabort=()=>reject(tx.error||Error('تعذر فحص '+table));tx.onerror=()=>{};
    });
    if(found){localTables[table]=true;samples[table]=found;localRowsDetected++;}
  }
  const queueRows=await queue().catch(()=>[]),unsafeQueue=(queueRows||[]).filter(x=>['pending','sending','failed','conflict'].includes(String(x?.status||'')));
  const tombRows=db.objectStoreNames.contains('entity_tombstones')?await once(db.transaction('entity_tombstones','readonly').objectStore('entity_tombstones').index('workspace').getAll(workspace)).catch(()=>[]):[];
  const localTombstones=(tombRows||[]).filter(x=>x?.remote_required===true&&!x?.adoption_settled);
  const unsafe=localRowsDetected>0||unsafeQueue.length>0||localTombstones.length>0;
  return {
    safeToReplace:!unsafe,workspace,company_id,
    reasons:{localRows:localRowsDetected>0,activeQueue:unsafeQueue.length>0,localTombstones:localTombstones.length>0},
    localTables:Object.keys(localTables),samples,activeQueueCount:unsafeQueue.length,localTombstoneCount:localTombstones.length,
    checkedAt:now(),policy:'step22a1-positive-server-evidence-only'
  };
 }
 async function assertBootstrapReplaceSafe(){
  const report=await localAdoptionGuard();
  if(report.safeToReplace)return report;
  const e=Object.assign(Error('تم إيقاف استبدال البيانات لحماية بيانات هذا الجهاز. توجد بيانات محلية لم تُعتمد على الخادم بعد.'),{code:'LOCAL_ADOPTION_REQUIRED',adoption:report});
  throw e;
 }
 async function clearBootstrapCompanyData({keepConfiguration=false,guardReport=null}={}){
  const verified=guardReport?.safeToReplace===true?guardReport:await assertBootstrapReplaceSafe();
  if(!verified?.safeToReplace)throw Object.assign(Error('رفض تنظيف البيانات المحلية بدون فحص اعتماد ناجح.'),{code:'LOCAL_ADOPTION_REQUIRED',adoption:verified||null});
  const db=await open(),company_id=await uuidFor('companies',owner().companyId);
  const keep=new Set(keepConfiguration?['companies','company_settings','booking_packages','booking_package_versions','plans','company_subscriptions']:[]);
  const stores=TABLES.filter(t=>!DEVICE_ONLY_TABLES.has(t)&&!keep.has(t));
  await serialWrite(()=>new Promise((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');for(const name of stores){const st=tx.objectStore(name),idx=st.index('company_id'),req=idx.openCursor(IDBKeyRange.only(company_id));req.onsuccess=()=>{const c=req.result;if(!c)return;c.delete();c.continue();};}tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تنظيف بيانات الشركة قبل Bootstrap'));tx.onerror=()=>{};}));
  return true;
 }
 async function identityAudit(){
  const db=await open(),company_id=await uuidFor('companies',owner().companyId),issues=[],tables={};
  const inspect=[...new Set([...ADOPTION_TABLES,'companies','users','company_memberships','company_settings'])].filter(t=>db.objectStoreNames.contains(t));
  const rowsByTable={};
  for(const table of inspect){const store=db.transaction(table,'readonly').objectStore(table);let rows=[];
   if(store.indexNames.contains('company_id'))rows=await once(store.index('company_id').getAll(company_id)).catch(()=>[]);
   else if(table==='companies'){const one=await once(store.get(company_id)).catch(()=>null);rows=one?[one]:[];}
   rowsByTable[table]=rows;const legacyOwners=new Map();let invalid=0,duplicateLegacy=0;
   for(const row of rows){const id=String(row?.id||'');if(CANONICAL_ID_TABLES.has(table)&&!isCanonicalUuid(id)){invalid++;issues.push({type:'invalid-id',table,id});}
    if(row?.legacy_id!=null){const key=String(row.legacy_id),previous=legacyOwners.get(key);if(previous&&previous!==id){duplicateLegacy++;issues.push({type:'duplicate-legacy-identity',table,legacy_id:key,ids:[previous,id]});}else if(key)legacyOwners.set(key,id);}}
   tables[table]={rows:rows.length,invalid_id:invalid,duplicate_legacy_identity:duplicateLegacy};
  }
  const ids=table=>new Set((rowsByTable[table]||[]).map(r=>String(r.id||'')));
  const bookingIds=ids('bookings'),customerIds=ids('customers'),packageIds=ids('booking_packages'),paymentIds=ids('payments');
  for(const row of rowsByTable.booking_details||[]){if(row.booking_id&&!bookingIds.has(String(row.booking_id)))issues.push({type:'orphan-reference',table:'booking_details',id:row.id,field:'booking_id',target:String(row.booking_id)});if(row.package_id&&!packageIds.has(String(row.package_id)))issues.push({type:'orphan-reference',table:'booking_details',id:row.id,field:'package_id',target:String(row.package_id)});}
  for(const row of rowsByTable.bookings||[]){if(row.customer_id&&!customerIds.has(String(row.customer_id)))issues.push({type:'orphan-reference',table:'bookings',id:row.id,field:'customer_id',target:String(row.customer_id)});}
  for(const row of rowsByTable.payments||[]){if(row.booking_id&&!bookingIds.has(String(row.booking_id)))issues.push({type:'orphan-reference',table:'payments',id:row.id,field:'booking_id',target:String(row.booking_id)});if(row.customer_id&&!customerIds.has(String(row.customer_id)))issues.push({type:'orphan-reference',table:'payments',id:row.id,field:'customer_id',target:String(row.customer_id)});}
  for(const row of rowsByTable.payment_audit||[]){if(row.payment_id&&!paymentIds.has(String(row.payment_id)))issues.push({type:'orphan-reference',table:'payment_audit',id:row.id,field:'payment_id',target:String(row.payment_id)});}
  return {contract_version:IDENTITY_CONTRACT_VERSION,company_id,tables,issues,healthy:issues.length===0,checked_at:now()};
 }
 async function stats(){const db=await open(),s=owner();const company_id=await uuidFor('companies',s.companyId);
  const names=['companies','company_memberships','booking_packages','customers','bookings','booking_details','payments','payment_audit','alert_rules','sms_approvals','entity_tombstones','sync_conflicts'];
  const out=await new Promise((resolve,reject)=>{
   const tx=db.transaction(names,'readonly'),counts={};
   for(const table of names){
    const req=tx.objectStore(table).index('company_id').count(company_id);
    req.onsuccess=()=>{counts[table]=req.result;};
   }
   tx.oncomplete=()=>resolve(counts);
   tx.onabort=()=>reject(tx.error||Error('تعذر قراءة إحصائيات التخزين'));
  });
  out.sync_queue=(await queue()).length;return out;
 }

 async function authorityAudit(){
  const durable=await stats(),cache={
   bookings:Array.isArray(state?.bookings)?state.bookings.length:0,
   customers:Array.isArray(state?.customers)?state.customers.length:0,
   payments:Array.isArray(state?.receipts)?state.receipts.length:0,
   booking_packages:Array.isArray(state?.packages)?state.packages.length:0
  };
  const differences=[],violations=[];
  for(const [table,count] of Object.entries(cache)){
   const cacheCount=Number(count),durableCount=Number(durable?.[table]||0);
   if(cacheCount!==durableCount)differences.push({table,cache:cacheCount,durable:durableCount,kind:cacheCount<durableCount?'cache-subset':'cache-ahead'});
   // Lazy Hydration intentionally keeps only a working subset in RAM. The unsafe state is
   // the reverse: RAM contains rows that do not exist in the canonical durable store.
   if(cacheCount>durableCount)violations.push({table,cache:cacheCount,durable:durableCount,kind:'cache-ahead'});
  }
  return {healthy:violations.length===0,authority:'indexeddb',cacheRole:'ui-compatibility-subset',lazy:Boolean(window.MyfntDomainRuntime?.lazy),cache,durable,differences,violations,bulkStateWrites:'explicit-reason-only'};
 }
 async function exportRows(){const db=await open(),company_id=await uuidFor('companies',owner().companyId);
   // One consistent read transaction; include tombstones so a diagnostic export preserves delete intent.
   const exportStores=[...TABLES,'entity_tombstones'];
   const tables=await new Promise((resolve,reject)=>{
    const tx=db.transaction(exportStores,'readonly'),result={};
    for(const name of exportStores){
     const req=tx.objectStore(name).index('company_id').getAll(company_id);
     req.onsuccess=()=>{
      if(req.result?.length)result[name]=req.result.map(({fingerprint,...row})=>row);
     };
    }
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(tx.error||Error('تعذر تصدير بيانات الجداول المحلية'));
   });
   return {schema:'myfnt-local-relational-v2.7',company_id,owner_workspace:getWorkspace(),
     exported_at:now(),WARNING:'ملف حساس يحتوي بيانات عملاء؛ ليس ترخيصًا للرفع أو للاستعادة عبر شركة أخرى.',tables};
 }
 async function restoreBackupTables(input){
  const tables=input&&typeof input==='object'?input:{};const db=await open(),company_id=await uuidFor('companies',owner().companyId);
  const blocked=new Set(['users','company_memberships','plans','company_subscriptions','notifications','notification_jobs','error_logs','sync_conflicts','company_backups']);
  const names=Object.keys(tables).filter(name=>TABLES.includes(name)&&!blocked.has(name)&&db.objectStoreNames.contains(name)&&Array.isArray(tables[name]));
  if(!names.length)return {tables:0,rows:0};
  let rows=0;
  // Validate ownership before opening a write transaction. A backup can never import another company's rows.
  for(const name of names)for(const row of tables[name]){if(!row||String(row.company_id||'')!==String(company_id))throw Error(`جدول ${name} يحتوي سجلًا لا يخص الشركة الحالية`);}
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction(names,'readwrite');let remaining=names.length;
   const doneOne=()=>{remaining--;if(remaining===0){} };
   for(const name of names){const store=tx.objectStore(name),source=tables[name].map(clone),idx=store.index('company_id'),cursor=idx.openCursor(IDBKeyRange.only(company_id));
    cursor.onsuccess=()=>{const c=cursor.result;if(c){c.delete();c.continue();return;}for(const row of source){store.put(row);rows++;}doneOne();};
    cursor.onerror=()=>tx.abort();
   }
   tx.oncomplete=()=>resolve(true);tx.onabort=()=>reject(tx.error||Error('تعذر استعادة الجداول الدائمة من النسخة'));tx.onerror=()=>{};
  }));
  window.MyfntTabGuard?.announce?.('backup-durable-restore');
  return {tables:names.length,rows};
 }
 async function resetOperationalData(){
  const db=await open(),workspace=getWorkspace(),company_id=await uuidFor('companies',owner().companyId);
  // Reset only booking/finance operational data. Company/account/configuration/packages stay intact.
  // Related child/audit/runtime rows are removed in the same serialized operation so Hydration
  // cannot resurrect deleted bookings, customers or payments on the next launch.
  const companyStores=['customers','bookings','booking_details','payments','booking_audit','payment_audit','notifications','notification_jobs','sms_approvals'];
  const scopedStores=['sync_queue','entity_tombstones','sync_conflicts'];
  const targetEntities=new Set(['customers','bookings','booking_details','payments','booking_audit','payment_audit','notifications','notification_jobs','sms_approvals']);
  return serialWrite(()=>new Promise((resolve,reject)=>{
   const stores=[...companyStores,...scopedStores,'snapshots'].filter(name=>db.objectStoreNames.contains(name));
   const tx=db.transaction(stores,'readwrite');let deleted=0;
   const deleteCompanyRows=name=>{
    const store=tx.objectStore(name);if(!store.indexNames.contains('company_id'))return;
    const req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));
    req.onsuccess=()=>{const c=req.result;if(!c)return;c.delete();deleted++;c.continue();};req.onerror=()=>tx.abort();
   };
   for(const name of companyStores)if(stores.includes(name))deleteCompanyRows(name);
   for(const name of scopedStores){if(!stores.includes(name))continue;const store=tx.objectStore(name);
    const indexName=store.indexNames.contains('workspace')?'workspace':(store.indexNames.contains('company_id')?'company_id':'');if(!indexName)continue;
    const key=indexName==='workspace'?workspace:company_id,req=store.index(indexName).openCursor(IDBKeyRange.only(key));
    req.onsuccess=()=>{const c=req.result;if(!c)return;const row=c.value||{},type=String(row.entity_type||row.entityType||'');
      if(targetEntities.has(type)){c.delete();deleted++;}c.continue();};req.onerror=()=>tx.abort();
   }
   if(stores.includes('snapshots')){tx.objectStore('snapshots').delete(workspace);deleted++;}
   tx.oncomplete=()=>{window.MyfntTabGuard?.announce?.('indexeddb-operational-reset');resolve({deleted,workspace,company_id});};
   tx.onabort=()=>reject(tx.error||Error('تعذر حذف البيانات التشغيلية من IndexedDB'));tx.onerror=()=>{};
  }));
 }
 async function tombstone(entity,legacyId,{operation='delete',reason='',keepLive=false}={}){
  const aliases={package:'booking_packages',packages:'booking_packages',booking:'bookings',customer:'customers',specialDay:'calendar_blocks',calendarBlock:'calendar_blocks',alertRule:'alert_rules'};
  const type=aliases[entity]||entity;
  if(!SYNCABLE.has(type)&&type!=='bookings')throw Error('هذا النوع لا يدعم الحذف المتزامن');
  const id=await uuidFor(type,legacyId),db=await open(),workspace=getWorkspace(),queueEnabled=syncQueueEnabled();
  return serialWrite(()=>new Promise((resolve,reject)=>{
   const stores=[type,'entity_tombstones',...(queueEnabled?['sync_queue']:[])];
   const tx=db.transaction(stores,'readwrite');
   const store=tx.objectStore(type),tombs=tx.objectStore('entity_tombstones'),q=queueEnabled?tx.objectStore('sync_queue'):null;
   const req=store.get(id);
   req.onsuccess=()=>{
    const old=req.result||null,company_id=old?.company_id;
    if(!company_id){tx.abort();return;}
    const at=now(),entity_key=[company_id,type,id].join('|');
    const finishWithoutQueue=()=>{
     tombs.put({id:entity_key,workspace,company_id,entity_key,entity_type:type,entity_id:id,legacy_id:String(legacyId),
      operation,reason:String(reason||''),deleted_at:at,base_version:Number(old.server_version)||0,
      snapshot:clone(old),remote_required:false});
     if(!keepLive)store.delete(id);
    };
    if(!queueEnabled){finishWithoutQueue();return;}
    const lookup=q.index('entity_key').getAll(entity_key);
    lookup.onsuccess=()=>{
     const existing=lookup.result||[],pending=existing.filter(x=>x.status==='pending'||x.status==='failed'),openConflict=existing.find(x=>x.status==='conflict');
     const pendingCreate=pending.some(x=>x.operation==='create'||(x.operation==='upsert'&&Number(x.base_version||0)===0));
     for(const command of pending){command.status='superseded';command.updated_at=at;q.put(command);}
     const tomb={id:entity_key,workspace,company_id,entity_key,entity_type:type,entity_id:id,legacy_id:String(legacyId),
      operation,reason:String(reason||''),deleted_at:at,base_version:Number(old.server_version)||0,
      snapshot:clone(old),remote_required:!(pendingCreate&&Number(old.server_version||0)===0)};
     tombs.put(tomb);
     if(!keepLive)store.delete(id);
     if(tomb.remote_required){
      if(openConflict){openConflict.latest_local_operation=operation;openConflict.latest_local_payload={id};openConflict.local_changed_at=at;openConflict.updated_at=at;q.put(openConflict);return;}
      const opId=crypto.randomUUID();
      q.put({id:opId,op_id:opId,workspace,company_id,entity_key,entity_type:type,entity_id:id,
       operation,payload:{id},base_version:tomb.base_version,created_at:at,updated_at:at,status:'pending',attempts:0,next_attempt_at:null,last_error:null});
     }
    };
   };
   tx.oncomplete=()=>{window.MyfntTabGuard?.announce?.('indexeddb-delete');resolve(true);};
   tx.onerror=()=>{};tx.onabort=()=>reject(tx.error||Error('تعذر إنشاء علامة الحذف المحلية'));
  }));
 }
 async function tombstones(){
  const db=await open(),workspace=getWorkspace();
  return once(db.transaction('entity_tombstones','readonly').objectStore('entity_tombstones').index('workspace').getAll(workspace));
 }
 async function archiveBooking(legacyId,reason){
  const id=await uuidFor('bookings',legacyId),db=await open(),queueEnabled=syncQueueEnabled();
  return new Promise((resolve,reject)=>{
   const stores=['bookings','booking_audit','archive_records','entity_tombstones',...(queueEnabled?['sync_queue']:[])];
   const tx=db.transaction(stores,'readwrite');
   const bookings=tx.objectStore('bookings'),q=queueEnabled?tx.objectStore('sync_queue'):null;
   const r=bookings.get(id);
   r.onsuccess=()=>{
     const old=r.result;if(!old){tx.abort();return;}
     const at=now(),updated=withFingerprint({...old,status:'archived',archived_at:at,archive_reason:reason});bookings.put(updated);
     const auditId=crypto.randomUUID();
     tx.objectStore('booking_audit').put({id:auditId,company_id:old.company_id,booking_id:id,
      action:'archive',reason,happened_at:at,source:'offline_demo',before_json:{status:old.status},
      after_json:{status:'archived'},fingerprint:JSON.stringify({id:auditId,action:'archive',at})});
     tx.objectStore('archive_records').put({id:crypto.randomUUID(),company_id:old.company_id,entity_type:'bookings',entity_id:id,reason,snapshot:old,archived_at:at});
     const key=changeKey(updated);
     tx.objectStore('entity_tombstones').put({id:key,workspace:getWorkspace(),company_id:old.company_id,entity_key:key,entity_type:'bookings',entity_id:id,legacy_id:String(legacyId),operation:'archive',reason:String(reason||''),deleted_at:at,base_version:Number(old.server_version)||0,snapshot:clone(old),remote_required:queueEnabled});
     if(!queueEnabled)return;
     const lookup=q.index('entity_key').getAll(key);
     lookup.onsuccess=()=>{
      const existing=lookup.result||[],pending=existing.filter(command=>command.status==='pending'||command.status==='failed'),openConflict=existing.find(command=>command.status==='conflict');
      const pendingCreate=pending.some(command=>command.operation==='create'||(command.operation==='upsert'&&Number(command.base_version||0)===0));
      for(const command of pending){command.status='superseded';command.updated_at=at;q.put(command);}
      const remoteRequired=!(pendingCreate&&Number(old.server_version||0)===0);
      const tombStore=tx.objectStore('entity_tombstones'),tombReq=tombStore.get(key);
      tombReq.onsuccess=()=>{if(tombReq.result){tombReq.result.remote_required=remoteRequired;tombStore.put(tombReq.result);}};
      if(!remoteRequired)return;
      if(openConflict){openConflict.latest_local_operation='archive';openConflict.latest_local_payload=apiPayload(updated);openConflict.local_changed_at=at;openConflict.updated_at=at;q.put(openConflict);return;}
      const op=crypto.randomUUID();q.put({id:op,op_id:op,workspace:getWorkspace(),company_id:old.company_id,entity_key:key,entity_type:'bookings',entity_id:id,operation:'archive',payload:apiPayload(updated),base_version:Number(old.server_version)||0,status:'pending',created_at:at,updated_at:at,attempts:0,next_attempt_at:null,last_error:null});
     };
   };
   tx.oncomplete=()=>{window.MyfntTabGuard?.announce?.('indexeddb-archive');resolve(true);};
   tx.onerror=()=>{};tx.onabort=()=>reject(tx.error||Error('لا توجد نسخة محفوظة من هذا الحجز في الجداول المحلية'));
  });
 }
 async function retryFailedCommands(){
  const db=await open(),workspace=getWorkspace();let changed=0;
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const tx=db.transaction('sync_queue','readwrite'),store=tx.objectStore('sync_queue'),req=store.index('workspace_status').getAll(IDBKeyRange.only([workspace,'failed']));
   req.onsuccess=()=>{for(const row of req.result||[]){if(row.status!=='failed'||row.retryable===false)continue;row.status='pending';row.next_attempt_at=null;row.lease_until=null;row.last_error=null;row.updated_at=now();store.put(row);changed++;}};
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('تعذر إعادة تجهيز عمليات المزامنة'));
  }));return changed;
 }
 async function compactLocal({terminalKeep=0,notificationDays=30,jobDays=7,errorDays=14}={}){
  const db=await open(),workspace=getWorkspace(),company_id=await uuidFor('companies',owner().companyId),keep=Math.max(0,Number(terminalKeep)||0),at=Date.now();
  const report={syncQueue:0,notifications:0,notificationJobs:0,errorLogs:0};
  const cutoff=days=>at-Math.max(0,Number(days)||0)*86400000;
  const stamp=row=>{for(const key of ['resolved_at','completed_at','sent_at','read_at','updated_at','created_at','happened_at']){const n=Date.parse(row?.[key]||'');if(Number.isFinite(n))return n;}return 0;};
  await serialWrite(()=>new Promise((resolve,reject)=>{
   const stores=['sync_queue','notifications','notification_jobs','error_logs'].filter(name=>db.objectStoreNames.contains(name));
   const tx=db.transaction(stores,'readwrite');
   const q=tx.objectStore('sync_queue'),idx=q.index('workspace_updated'),range=IDBKeyRange.bound([workspace,''],[workspace,'\uffff']);let seenTerminal=0;
   const qr=idx.openCursor(range,'prev');qr.onsuccess=()=>{const c=qr.result;if(!c)return;const row=c.value||{};if(SYNC_TERMINAL.has(row.status)){seenTerminal++;if(seenTerminal>keep){c.delete();report.syncQueue++;}}c.continue();};
   // Device-only stores are small and may not always carry company_id in historical builds,
   // so scan only these transient stores and delete rows by age/status. Domain/accounting tables are untouched.
   for(const [name,days,statuses] of [['notifications',notificationDays,null],['notification_jobs',jobDays,new Set(['done','sent','completed','cancelled','expired','failed'])],['error_logs',errorDays,null]]){
    const store=tx.objectStore(name),req=store.openCursor();req.onsuccess=()=>{const c=req.result;if(!c)return;const row=c.value||{},owned=!row.company_id||String(row.company_id)===String(company_id),t=stamp(row),old=t>0&&t<cutoff(days),terminal=!statuses||statuses.has(String(row.status||'').toLowerCase());if(owned&&old&&terminal){c.delete();if(name==='notifications')report.notifications++;else if(name==='notification_jobs')report.notificationJobs++;else report.errorLogs++;}c.continue();};
   }
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('تعذر تنظيف البيانات المؤقتة المحلية'));tx.onerror=()=>{};
  }));
  return {...report,terminalKeep:keep};
 }
 async function nextDisplaySequence(kind){
  const config={booking:['bookings','booking_no'],customer:['customers','customer_no'],receipt:['payments','receipt_no'],movement:['payments','movement_no']}[String(kind||'')];
  if(!config)throw Error('نوع التسلسل غير معروف');
  const [table,field]=config,db=await open(),workspace=getWorkspace(),company_id=await uuidFor('companies',owner().companyId),id=`seq:${workspace}:${kind}`;
  return serialWrite(()=>new Promise((resolve,reject)=>{const tx=db.transaction(['local_meta',table],'readwrite'),meta=tx.objectStore('local_meta'),store=tx.objectStore(table),mr=meta.get(id);let value=null;
    const commit=max=>{value=Math.max(1,Number(max||0)+1);meta.put({id,workspace,value,updated_at:now()});};
    mr.onsuccess=()=>{const current=Number(mr.result?.value||0);if(Number.isSafeInteger(current)&&current>0){commit(current);return;}let max=0;const req=store.index('company_id').openCursor(IDBKeyRange.only(company_id));req.onsuccess=()=>{const c=req.result;if(!c){commit(max);return;}const n=Number(String(c.value?.[field]||'').replace(/\D/g,''));if(Number.isSafeInteger(n)&&n>max)max=n;c.continue();};req.onerror=()=>{tx.abort();};};
    tx.oncomplete=()=>resolve(String(value));tx.onabort=()=>reject(tx.error||Error('تعذر حجز الرقم التسلسلي المحلي'));tx.onerror=()=>{};
  }));
 }
 async function saveSmsApproval({id,bookingId,ruleId,scheduledAt,recipient,actorId}){
  const s=owner(),company_id=await uuidFor('companies',s.companyId),approval_id=await uuidFor('sms_approvals',id);
  const booking_id=await uuidFor('bookings',bookingId),alert_rule_id=await uuidFor('alert_rules',ruleId);
  const requested_by_member_id=await uuidFor('company_memberships',actorId||s.userId);
  const row={id:approval_id,table:'sms_approvals',company_id,legacy_id:id,booking_id,alert_rule_id,
    requested_by_member_id,recipient_preview:String(recipient||'').replace(/.(?=.{3})/g,'*'),
    scheduled_at:scheduledAt,status:'approved_pending_gateway',approved_at:now(),
    idempotency_key:approval_id,local_only:false,sync_scope:'company'};
  // While Laravel/API is disconnected this remains a local approval record only; saveBatch will not create sync_queue.
  return saveBatch([row]);
 }
 async function saveSmsMessage(message){
  const s=owner(),company_id=await uuidFor('companies',s.companyId),row={...clone(message),company_id,table:'sms_messages',created_at:message.createdAt||message.created_at||now(),updated_at:message.updatedAt||message.updated_at||now(),scheduled_at:message.scheduledAt||message.scheduled_at||null,sent_at:message.sentAt||message.sent_at||null};
  const db=await open();await serialWrite(()=>new Promise((resolve,reject)=>{const tx=db.transaction('sms_messages','readwrite');tx.objectStore('sms_messages').put(row);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('تعذر حفظ طلب الرسالة'));}));return row;
 }
 async function listSmsMessages(){
  const s=owner(),company_id=await uuidFor('companies',s.companyId),db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('sms_messages','readonly'),store=tx.objectStore('sms_messages'),req=store.index('company_id').getAll(company_id);req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>String(b.createdAt||b.created_at||'').localeCompare(String(a.createdAt||a.created_at||''))));req.onerror=()=>reject(req.error);});
 }
 async function storageProfile(){
  const db=await open(),encoder=new TextEncoder(),stores=[...db.objectStoreNames],details=[];
  const jsonBytes=value=>{
   let blobBytes=0;const seen=new WeakSet();
   const walk=v=>{if(!v||typeof v!=='object')return;if(v instanceof Blob){blobBytes+=Number(v.size||0);return;}if(seen.has(v))return;seen.add(v);if(Array.isArray(v)){for(const x of v)walk(x);}else for(const x of Object.values(v))walk(x);};
   walk(value);let text='';try{text=JSON.stringify(value,(k,v)=>v instanceof Blob?{__blob:true,size:v.size,type:v.type}:v)||'';}catch{text='';}
   return encoder.encode(text).byteLength+blobBytes;
  };
  for(const name of stores){
   const result=await new Promise((resolve,reject)=>{let count=0,bytes=0;const tx=db.transaction(name,'readonly'),store=tx.objectStore(name),req=store.openCursor();
    req.onsuccess=()=>{const c=req.result;if(!c)return;count++;bytes+=jsonBytes(c.value);c.continue();};req.onerror=()=>reject(req.error||Error('تعذر تحليل '+name));tx.oncomplete=()=>resolve({name,count,bytes});tx.onabort=()=>reject(tx.error||Error('تعذر تحليل '+name));tx.onerror=()=>{};});
   details.push(result);
  }
  details.sort((a,b)=>b.bytes-a.bytes);
  return {dbName:NAME,dbVersion:VERSION,queueEnabled:syncQueueEnabled(),stores:details,totalBytes:details.reduce((n,x)=>n+x.bytes,0),totalRecords:details.reduce((n,x)=>n+x.count,0)};
 }
 async function storageHealth(){
  const [profile,identity,authority,queueRows]=await Promise.all([storageProfile(),identityAudit(),authorityAudit(),queue({includeTerminal:true})]);
  let estimate=null,persisted=null;
  try{estimate=await navigator.storage?.estimate?.()||null;}catch{}
  try{persisted=await navigator.storage?.persisted?.();}catch{}
  const quota=Number(estimate?.quota||0),usage=Number(estimate?.usage||0),ratio=quota>0?usage/quota:0;
  const activeQueue=(queueRows||[]).filter(x=>['pending','sending','failed','conflict'].includes(String(x.status||'')));
  const warnings=[];
  if(!identity.healthy)warnings.push('identity');
  if(!authority.healthy)warnings.push('authority');
  if(ratio>=0.85)warnings.push('quota');
  if(activeQueue.some(x=>x.status==='conflict'))warnings.push('sync-conflict');
  return {healthy:warnings.length===0,warnings,profile,identity,authority,queue:{total:(queueRows||[]).length,active:activeQueue.length,conflicts:activeQueue.filter(x=>x.status==='conflict').length,failed:activeQueue.filter(x=>x.status==='failed').length},browserStorage:{usage,quota,ratio:quota?Number((ratio*100).toFixed(2)):null,persisted}};
 }
 async function migrationReport(){const s=await stats();return {mirror:{total:0,changed:0,blocked:true,authority:'indexeddb'},tables:s,error:lastError};}
 window.MyfntLocal=Object.freeze({open,uuidFor,isCanonicalUuid,canonicalUuid,identityContract:()=>({version:IDENTITY_CONTRACT_VERSION,format:'uuid',clientGenerated:true,serverMustPreserve:true,legacyIdRole:'migration-reference-only'}),databaseContract:()=>({version:DATABASE_CONTRACT_VERSION,tenantScoped:[...TENANT_SCOPED_TABLES],global:[...GLOBAL_TABLES],tenantRoots:[...TENANT_ROOT_TABLES],rule:'tenant rows require company_id'}),identityAudit,mirrorAll,recordOne,commitBookingAggregate,scheduleMirror,queue,claimBatch,claimNext,finishCommand,failCommand,recoverStaleSending,stats,exportRows,restoreBackupTables,storageProfile,storageHealth,migrationReport,
  archiveBooking,resetOperationalData,tombstone,tombstones,conflicts,resolveConflict,applyRemoteChanges,ingestBootstrapBatch,ingestReconciledBootstrapBatch,finalizeBootstrapReplacement,localAdoptionSummary,localAdoptionBatch,markAdoptionResults,settleLocalOnlyTombstones,localAdoptionGuard,assertBootstrapReplaceSafe,clearBootstrapCompanyData,hydrationSnapshot,pullCursor,retryFailedCommands,compactLocal,nextDisplaySequence,saveSmsApproval,saveSmsMessage,listSmsMessages,setUiMeta,getUiMeta,applyWorkspaceCurrency,getLastError:()=>lastError,localDbName:NAME,localDbVersion:VERSION,
  // Pure helpers available to automated tests:
  authority:()=>({domain:'indexeddb',uiCache:'state',bulkStateWrites:'explicit-reason-only',bulkReasons:[...BULK_STATE_WRITE_REASONS]}),authorityAudit,
  toMinor:num,compactPaymentOperation,syncQueueEnabled,legacyPricing:(b)=>b.pricingSnapshot||null});
})();
