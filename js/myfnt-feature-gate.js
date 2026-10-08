/* Myfnt 2.14.21 — final central plan/feature gate. UI convenience only; Laravel must re-enforce every protected action. */
'use strict';
(()=>{
 const CATALOG_URL='./assets/config/feature-catalog.json';
 const usageKey=()=>{const s=window.OzanScope?.read?.()||{};return `ozan.myfnt.feature-usage.v2:${s.companyId||'guest'}:${s.userId||'guest'}`;};
 let catalog=null;
 const monthKey=()=>new Date().toISOString().slice(0,7);
 const yearKey=()=>new Date().toISOString().slice(0,4);
 const readUsage=()=>{try{return JSON.parse(localStorage.getItem(usageKey())||'{}')||{};}catch{return {};}};
 const writeUsage=x=>{try{localStorage.setItem(usageKey(),JSON.stringify(x));}catch{}};
 const plan=()=>window.MyfntPlans;
 const descriptor=code=>catalog?.features?.find(x=>x.code===code)||null;
 const value=code=>{const f=descriptor(code),key=f?.canonical_feature||f?.plan_key||code;return plan()?.feature?.(key);};
 const unlimited=v=>v===null||v===-1||v==='unlimited';
 const enabled=code=>{const v=value(code);if(unlimited(v))return true;return v===true||(typeof v==='number'&&v>0)||(typeof v==='string'&&!['none','disabled','false','0'].includes(v.toLowerCase()));};
 const limit=code=>{const v=value(code);return unlimited(v)?Infinity:Number(v);};
 const periodFor=code=>{const f=descriptor(code),p=String(f?.period_type||f?.default_period_type||'').toLowerCase();return p==='yearly'||code.includes('yearly')||code.includes('annual')?yearKey():monthKey();};
 const used=(code,period=periodFor(code))=>Number(readUsage()?.[period]?.[code]||0);
 const remaining=(code,period=periodFor(code))=>{const l=limit(code);return Number.isFinite(l)?Math.max(0,l-used(code,period)):Infinity;};
 const consume=(code,delta=1,period=periodFor(code))=>{const l=limit(code),u=readUsage(),now=Number(u?.[period]?.[code]||0);if(Number.isFinite(l)&&now+delta>l)return false;u[period]??={};u[period][code]=now+delta;writeUsage(u);document.dispatchEvent(new CustomEvent('myfnt:feature-usage',{detail:{code,used:u[period][code],limit:l,period}}));return true;};
 const check=(code,{consume:doConsume=false,delta=1,message='',period=periodFor(code)}={})=>{if(!enabled(code))return {ok:false,code:'FEATURE_NOT_AVAILABLE',message:message||'هذه الميزة غير متاحة في خطتك الحالية'};if(doConsume&&!consume(code,delta,period))return {ok:false,code:'PLAN_LIMIT_REACHED',message:message||'تم بلوغ حد الاستخدام المسموح لهذه الميزة'};return {ok:true,limit:limit(code),used:used(code,period),remaining:remaining(code,period)};};
 const checkCount=(code,current,{delta=1,message=''}={})=>{const l=limit(code),n=Math.max(0,Number(current||0)),d=Math.max(0,Number(delta||0));if(!enabled(code)&&l!==0)return {ok:false,code:'FEATURE_NOT_AVAILABLE',message:message||'هذه الميزة غير متاحة في خطتك الحالية'};if(Number.isFinite(l)&&n+d>l)return {ok:false,code:'PLAN_LIMIT_REACHED',limit:l,current:n,remaining:Math.max(0,l-n),message:message||`تم بلوغ حد الخطة (${l})`};return {ok:true,limit:l,current:n,remaining:Number.isFinite(l)?Math.max(0,l-n):Infinity};};
 const requireCount=(code,current,opts={})=>{const r=checkCount(code,current,opts);if(!r.ok){window.showToast?.(r.message,'warning');return false;}return true;};
 const requireFeature=(code,opts={})=>{const r=check(code,opts);if(!r.ok){window.showToast?.(r.message,'warning');return false;}return true;};
 async function load(){try{const r=await fetch(CATALOG_URL,{cache:'no-store'});if(r.ok)catalog=await r.json();}catch{}return catalog;}
 const guardClick=(selector,code,opts={})=>document.addEventListener('click',e=>{const node=e.target.closest(selector);if(!node)return;if(!requireFeature(code,opts)){e.preventDefault();e.stopImmediatePropagation();}},true);
 function install(){
  guardClick('#ozOpenSecureExport','encrypted_export');
  guardClick('#ozSecureExportForm [type="submit"]','encrypted_export');
  guardClick('#ozExportIcs,[data-oz-export="ics"]','calendar_ics_enabled');
  guardClick('[data-oz-export="xlsx"],[data-oz-template]','excel_export_enabled');
 }
 window.MyfntFeatureGate=Object.freeze({ready:load,enabled,limit,used,remaining,consume,check,checkCount,require:requireFeature,requireCount,periodFor,catalog:()=>catalog});
 load().finally(install);
})();
