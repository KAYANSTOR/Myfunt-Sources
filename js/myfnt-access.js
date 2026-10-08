/* Myfnt 2.3 offline UX guard. Server must authorize every production request. */
'use strict';
(()=>{
 const KEY='ozan.myfnt.access.v1',PERIOD=14*24*3600*1000;
 let data={lastOnlineAt:0,serverCheckedAt:0,serverStatus:'demo',maintenance:false,planStatus:'active',planCode:'ULTRA',planExpiresAt:null,blocked:false,features:{}},timer=0;
 const access=()=>{const owner=window.OzanScope?.read();return owner?'ozan.access.'+encodeURIComponent(owner.companyId)+'.'+encodeURIComponent(owner.userId):KEY;};
 function persist(){try{localStorage.setItem(access(),JSON.stringify(data));}catch(e){console.warn('[Myfnt access] persistence failed',e);}}
 function read(){try{const old=JSON.parse(localStorage.getItem(access())||'null');if(old&&typeof old==='object')data={...data,...old};}catch{}}
 const offlineExpired=()=>Boolean(window.MYFNT_API_BASE&&data.serverStatus==='verified'&&data.serverCheckedAt&&Date.now()-data.serverCheckedAt>=PERIOD);
 const isActive=()=>!data.blocked&&data.planStatus!=='expired'&&!offlineExpired();
 function banner(){const host=document.getElementById('myfntAccessBanner');if(!host)return;
   const msg=data.blocked?'هذا الحساب مقيّد. يُسمح بعرض البيانات وتنزيل نسخها، لكن لا يمكن تسجيل تعديلات جديدة حتى التواصل مع الإدارة.':data.planStatus==='expired'?'انتهت صلاحية الخطة. بياناتك باقية على الجهاز؛ يمكنك تنزيل نسخة والتواصل مع الإدارة للتجديد.':offlineExpired()?'مرّ 14 يومًا دون اتصال بالإنترنت. تم تقييد التعديلات مؤقتًا، مع بقاء العرض والتصدير متاحين. اتصل بالإنترنت لتحديث الحالة.':data.maintenance?'صيانة الخادم: التسجيل المحلي متاح، أما إرسال التغييرات فلن يبدأ قبل انتهاء الصيانة.':'';
   host.textContent=msg;host.classList.toggle('is-active',!!msg);document.querySelectorAll('[data-myfnt-access-note]').forEach(el=>el.textContent=msg);
 }
 function requireWrite(){banner();const msg=data.blocked?'الحساب مقيّد إداريًا':data.planStatus==='expired'?'انتهت صلاحية الاشتراك':offlineExpired()?'مرّ 14 يومًا بلا اتصال بالإنترنت؛ اتصل أولًا لتجديد التحقق المحلي':'';if(msg){window.ozWarn?.(msg+'؛ بياناتك لم تُحذف، ويمكنك تصدير نسخة احتياطية.');return true;}return false;}
 function updateOnline(){banner();} // navigator.onLine is NOT proof of successful server verification
 // Only poll once an actual backend URL is provided by trusted deployment config;
 // no pretending that navigator.onLine verifies user bans or subscription validity.
 async function checkServer(){const base=window.MYFNT_API_BASE;if(!base||!navigator.onLine)return;
   try{const r=await fetch(new URL('access/status',base),{method:'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});if(r.status===401||r.status===403){data.blocked=true;data.serverStatus='blocked';persist();banner();return;}
     if(!r.ok)throw Error('HTTP '+r.status);
     const x=await r.json();if(typeof x!=='object'||!x||!x.companyId||x.companyId!==window.OzanScope?.read()?.companyId)throw Error('استجابة غير مطابقة للشركة');
     data={...data,serverStatus:'verified',serverCheckedAt:Date.now(),lastOnlineAt:Date.now(),maintenance:x.maintenance===true,blocked:x.blocked===true,planStatus:['active','expired','free'].includes(x.planStatus)?x.planStatus:data.planStatus,planCode:String(x.planCode||data.planCode||'ULTRA').toUpperCase(),planExpiresAt:x.planExpiresAt||null,features:x.features&&typeof x.features==='object'?x.features:{}};
     window.MyfntOffline?.setMaintenance?.(data.maintenance);persist();banner();
   }catch(e){console.warn('[Myfnt access] server status unavailable',e.message);/* Never trust a failed check as a valid authorization. */}
 }
 function init(){read();window.MyfntPlans?.ready?.().then(()=>{if(data.serverStatus!=='verified'){data.planCode=window.MyfntPlans.companyCode?.()||data.planCode||'ULTRA';data.features=window.MyfntPlans.get?.(data.planCode)||data.features;persist();banner();}}).catch(()=>{});if(navigator.onLine)updateOnline();banner();checkServer();
   window.addEventListener('online',()=>{updateOnline();checkServer();});window.addEventListener('offline',banner);
   timer=window.setInterval(()=>{banner();if(!document.hidden)checkServer();},10*60*1000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateOnline();checkServer();}});
 }
 window.MyfntAccess={init,requireWrite,isActive,checkServer,getState:()=>({...data,offlineExpired:offlineExpired()}),setLocalMaintenance(active){data.maintenance=Boolean(active);persist();window.MyfntOffline?.setMaintenance?.(active);banner();}};
})();
