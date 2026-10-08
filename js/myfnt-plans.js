/* Myfnt subscription plan registry. Limits live in assets/config/subscription-plans.json, not hard-coded in UI logic. */
'use strict';
(()=>{
 const URL='./assets/config/subscription-plans.json',CACHE='ozan.myfnt.plan-config.v2';
 let config=null,loading=null;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function valid(x){return x&&['myfnt-plans-v1','myfnt-plans-v2'].includes(x.schema)&&Array.isArray(x.plans)&&x.plans.some(p=>p.code==='ULTRA');}
 function cached(){try{const x=JSON.parse(localStorage.getItem(CACHE)||'null');return valid(x)?x:null;}catch{return null;}}
 async function load(){if(config)return config;if(loading)return loading;loading=(async()=>{let x=null;try{const r=await fetch(URL,{cache:'no-store'});if(r.ok)x=await r.json();}catch{}if(!valid(x))x=cached();if(!valid(x))throw Error('تعذر تحميل تعريف خطط الاشتراك');config=x;try{localStorage.setItem(CACHE,JSON.stringify(x));}catch{}document.dispatchEvent(new CustomEvent('myfnt:plans-ready',{detail:{defaultPlan:x.default_plan}}));return config;})().finally(()=>loading=null);return loading;}
 function current(){return config||cached();}
 function all(){return clone(current()?.plans||[]);}
 function get(code){return all().find(p=>p.code===String(code||'').toUpperCase())||null;}
 function defaultCode(){return current()?.default_plan||'ULTRA';}
 function companyCode(){const s=window.OzanScope?.read?.(),d=window.OzanAuth?.data,c=d?.companies?.find(x=>x.id===s?.companyId);return String(c?.plan||defaultCode()).toUpperCase();}
 const ALIASES=Object.freeze({extra_users_limit:'users_limit',sms_annual_limit:'sms_yearly_limit',google_drive_enabled:'google_drive_sync',cloud_sync_enabled:'cloud_sync',manual_backup_enabled:'manual_backup',backups_limit:'backup_retention_limit',excel_export_enabled:'bookings_excel_export',image_download_enabled:'booking_receipt_download'});
 function feature(name,code=companyCode()){const p=get(code);if(!p)return undefined;if(Object.prototype.hasOwnProperty.call(p,name))return p[name];const canonical=ALIASES[name];return canonical? p[canonical]:undefined;}
 function allowed(name,code=companyCode()){const value=feature(name,code);return value===true||value===-1||(typeof value==='number'&&value>0)||(typeof value==='string'&&!['none','disabled','false','0'].includes(value.toLowerCase()));}
 function limit(name,code=companyCode()){return feature(name,code);}
 window.MyfntPlans=Object.freeze({ready:load,current,all,get,defaultCode,companyCode,feature,allowed,limit,aliases:ALIASES,url:URL});
 load().catch(e=>console.warn('[Myfnt plans]',e.message));
})();
