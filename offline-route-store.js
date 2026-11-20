/* Saved GPX route/guidance for offline navigation. No geolocation data uploaded. */
'use strict';
window.BNaviOfflineRouteStore=(()=>{
 const DB='bnavi-offline-routes-v1',KEY='last-route';
 function database(){return new Promise((ok,fail)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('routes'))r.result.createObjectStore('routes')};r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
 async function put(data){const raw=JSON.stringify(data);if(new TextEncoder().encode(raw).length>12*1024*1024)throw Error('経路データが12MBを超えています');const db=await database();try{return await new Promise((ok,fail)=>{const tx=db.transaction('routes','readwrite');tx.objectStore('routes').put(data,KEY);tx.oncomplete=()=>ok();tx.onerror=()=>fail(tx.error)})}finally{db.close()}}
 async function get(){const db=await database();try{return await new Promise((ok,fail)=>{const req=db.transaction('routes','readonly').objectStore('routes').get(KEY);req.onsuccess=()=>ok(req.result||null);req.onerror=()=>fail(req.error)})}finally{db.close()}}
 return {save:async data=>{if(!data||!Array.isArray(data.sections)||!data.sections.length)throw Error('保存する経路がありません');await put({...data,format:'bnavi-offline-route-v1',savedAt:new Date().toISOString()})},load:async()=>{const d=await get();return d?.format==='bnavi-offline-route-v1'?d:null}};
})();
