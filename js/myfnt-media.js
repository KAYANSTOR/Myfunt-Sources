/* Myfnt 2.12.9 Step21L — binary media lives in IndexedDB, not LocalStorage/Cache Storage. */
'use strict';
(()=>{
 const DB='myfnt-media-v1',VER=1,STORE='media';
 let dbp=null;const urls=new Map();
 const scope=()=>window.OzanScope?.read?.()||null;
 const workspace=()=>{const s=scope();return s?`${s.userId}|${s.companyId}`:'';};
 const id=name=>`${workspace()}|${String(name||'')}`;
 function open(){if(dbp)return dbp;dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(STORE)){const st=db.createObjectStore(STORE,{keyPath:'id'});st.createIndex('workspace','workspace',{unique:false});}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return dbp;}
 async function put(name,blob){if(!(blob instanceof Blob)||!workspace())return null;const db=await open(),key=id(name);await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:key,workspace:workspace(),name:String(name),blob,type:blob.type||'application/octet-stream',size:blob.size,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});const old=urls.get(key);if(old)URL.revokeObjectURL(old);const url=URL.createObjectURL(blob);urls.set(key,url);document.dispatchEvent(new CustomEvent('myfnt:media-changed',{detail:{name,url,size:blob.size}}));return url;}
 async function get(name){if(!workspace())return null;const db=await open(),key=id(name),row=await new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});return row?.blob instanceof Blob?row.blob:null;}
 async function getUrl(name){const key=id(name);if(urls.has(key))return urls.get(key);const blob=await get(name);if(!blob)return '';const url=URL.createObjectURL(blob);urls.set(key,url);return url;}
 async function remove(name){if(!workspace())return;const db=await open(),key=id(name);await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});const u=urls.get(key);if(u)URL.revokeObjectURL(u);urls.delete(key);}
 async function dataUrlToBlob(value){if(!/^data:image\//i.test(String(value||'')))return null;try{return await (await fetch(value)).blob();}catch{return null;}}
 async function profile(){if(!workspace())return {dbName:DB,store:STORE,count:0,bytes:0};const db=await open(),ws=workspace();return new Promise((resolve,reject)=>{let count=0,bytes=0;const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE),req=store.index('workspace').openCursor(IDBKeyRange.only(ws));req.onsuccess=()=>{const c=req.result;if(!c)return;const row=c.value||{};count++;bytes+=Number(row.blob?.size||row.size||0);try{bytes+=new TextEncoder().encode(JSON.stringify({...row,blob:undefined})).byteLength;}catch{}c.continue();};req.onerror=()=>reject(req.error);tx.oncomplete=()=>resolve({dbName:DB,store:STORE,count,bytes});tx.onabort=()=>reject(tx.error);});}
 const defineAvatar=(user,url)=>{try{delete user.avatar;Object.defineProperty(user,'avatar',{value:url||'',writable:true,configurable:true,enumerable:false});}catch{user.avatar=url||'';}};
 async function restore(){const s=scope();if(!s)return;
  try{
   const st=typeof state!=='undefined'?state:null;if(st?.settings?.company){const c=st.settings.company,legacy=String(c.logo||'');if(legacy.startsWith('data:image/')){const blob=await dataUrlToBlob(legacy);if(blob)await put('company-logo',blob);}const url=await getUrl('company-logo');if(url)c.logo=url;else if(legacy.startsWith('data:image/'))c.logo='';if(legacy.startsWith('data:image/')){try{await window.MyfntRepositories?.settings?.mutateDurable?.(cfg=>{if(cfg?.company)cfg.company.logo=c.logo;},{profileEvent:false});}catch(error){console.warn('[media settings canonical migration]',error);}}if(typeof fillCompanyForm==='function')fillCompanyForm();}
   const u=window.OzanAuth?.data?.users?.find?.(x=>x.id===s.userId);if(u){const legacy=String(u.avatar||'');if(legacy.startsWith('data:image/')){const blob=await dataUrlToBlob(legacy);if(blob)await put('avatar:'+s.userId,blob);delete u.avatar;try{localStorage.setItem('ozan.auth.demo.v1',JSON.stringify(window.OzanAuth.data));}catch{}}const url=await getUrl('avatar:'+s.userId);if(url)defineAvatar(u,url);}
   document.dispatchEvent(new Event('myfnt:media-ready'));
  }catch(err){console.warn('[MyfntMedia restore]',err);}
 }
 window.addEventListener('beforeunload',()=>{for(const u of urls.values())URL.revokeObjectURL(u);urls.clear();});
 document.addEventListener('DOMContentLoaded',()=>setTimeout(restore,0));
 window.MyfntMedia=Object.freeze({put,get,getUrl,remove,restore,defineAvatar,profile,dbName:DB});
})();
