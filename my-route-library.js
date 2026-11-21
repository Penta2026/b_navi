/* B_Navi named calculated-route library. Different from GPS tracking and tuning-only presets.
 * Stores user-selected route geometry and calculation preferences on this device in IndexedDB.
 * Only calculated road segments have usable riding guidance; bridge/walk reference segments
 * remain separately labelled and NEVER become a rideable GPX by being saved here.
 */
(function(root){
'use strict';
const DB='bnavi-my-route-library-v1',STORE='routes',MAX=30,MAX_BYTES=12*1024*1024;
const encoder=new TextEncoder();
function cleanName(x){return Array.from(String(x??'').replace(/\s+/g,' ').trim()).slice(0,50).join('');}
function normalize(entry){
 if(!entry||typeof entry!=='object')throw Error('保存するルートがありません。');
 const name=cleanName(entry.name);if(!name)throw Error('マイルート名を入力してね。');
 const vehicle=Number(entry.vehicle);if(!Number.isInteger(vehicle)||vehicle<0||vehicle>2)throw Error('排気量区分が不正です。');
 const route=entry.route;
 if(!route||!Array.isArray(route.sections)||!route.sections.length||!route.sections.some(s=>Array.isArray(s.points)&&s.points.length>=2))throw Error('経路計算してから保存してね。');
 if(!['normal','imported','shimanami','kanmon50'].includes(route.type))throw Error('対応していない経路形式です。');
 const model={name,vehicle,tuning:entry.tuning||null,start:String(entry.start||'').slice(0,100),goal:String(entry.goal||'').slice(0,100),via:Array.isArray(entry.via)?entry.via.slice(0,50).map(x=>String(x).slice(0,100)):[],route};
 if(encoder.encode(JSON.stringify(model)).length>MAX_BYTES)throw Error('ルートが大きすぎます（12MBまで）。');
 return model;
}
function open(){return new Promise((resolve,reject)=>{
 if(!root.indexedDB){reject(Error('このブラウザでは端末内のルート保存を利用できません。'));return;}
 const req=root.indexedDB.open(DB,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('保存領域を開けません。'));
});}
async function tx(mode,operation){const db=await open();try{return await new Promise((resolve,reject)=>{
 const t=db.transaction(STORE,mode),s=t.objectStore(STORE),req=operation(s);
 let result;
 if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error||Error('保存領域エラー'));}
 t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error||Error('保存領域エラー'));t.onabort=()=>reject(t.error||Error('保存操作が中断されました。'));
});}finally{db.close();}}
const list=async()=>{const a=await tx('readonly',s=>s.getAll());return (a||[]).map(({id,name,vehicle,createdAt,updatedAt,route})=>({id,name,vehicle,createdAt,updatedAt,type:route?.type})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));};
const get=id=>tx('readonly',s=>s.get(String(id)));
const drop=id=>tx('readwrite',s=>s.delete(String(id)));
async function save(entry,existingId){
 const item=normalize(entry);
 const rows=await list();
 const prior=existingId?await get(existingId):null;
 if(existingId&&!prior)throw Error('上書き先が見つかりません。');
 if(!prior&&rows.length>=MAX)throw Error('マイルートは30件まで。不要なルートを削除してね。');
 const now=new Date().toISOString();
 const id=prior?.id||((root.crypto&&typeof root.crypto.randomUUID==='function')?root.crypto.randomUUID():'r-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
 const value={...item,id,createdAt:prior?.createdAt||now,updatedAt:now};
 await tx('readwrite',s=>s.put(value));
 return {id,name:value.name,replaced:!!prior};
}
root.BNaviMyRouteLibrary={DB,MAX,normalize,list,get,drop,save,cleanName};
if(typeof module!=='undefined'&&module.exports)module.exports=root.BNaviMyRouteLibrary;
})(typeof window==='undefined'?globalThis:window);
