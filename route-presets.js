/* Named custom-route TUNING presets, not a repository of generated GPS routes.
 * Only local, user-supplied settings are stored. No network or silent syncing.
 * Existing bnavi.routeTuningByVehicle.v1 working settings remain independent.
 */
(function(root){
'use strict';
const KEY='bnavi.routePresetLibrary.v1';
const FORMAT='bnavi-route-presets';
const VERSION=1;
const MAX=50;
const MAX_NAME=40;
const tuner=root.BNaviRouteTuning||(typeof require!=='undefined'?require('./route-tuning.js'):null);
const validVehicle=v=>Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=2;
function nameOf(value){return Array.from(String(value??'').replace(/\s+/g,' ').trim()).slice(0,MAX_NAME).join('');}
function safeName(value){const n=nameOf(value);if(!n)throw Error('設定名を入力してね。');return n;}
function stamp(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString();}
function id(){return (typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')?crypto.randomUUID():'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);}
function sanitize(input){
 if(!input||typeof input!=='object'||!validVehicle(input.vehicle)||!nameOf(input.name))return null;
 const vehicle=Number(input.vehicle);
 return {id:typeof input.id==='string'&&input.id.length<=100&&input.id.length>=3?input.id:id(),name:nameOf(input.name),vehicle,tuning:tuner.normalize(input.tuning,vehicle),createdAt:stamp(input.createdAt),updatedAt:stamp(input.updatedAt)};
}
function read(raw){
 try{
  const doc=typeof raw==='string'?JSON.parse(raw):raw;
  if(!doc||doc.version!==VERSION||!Array.isArray(doc.items))return [];
  const entries=[],seen=new Set();
  for(const obj of doc.items.slice(0,MAX)){
   const e=sanitize(obj);if(!e)continue;
   const label=e.vehicle+':'+e.name.toLocaleLowerCase('ja-JP');
   if(seen.has(label))continue;
   seen.add(label);entries.push(e);
  }
  return entries;
 }catch{return []}
}
function pack(items){return JSON.stringify({version:VERSION,items:read({version:VERSION,items})});}
function forVehicle(items,vehicle){return items.filter(e=>e.vehicle===Number(vehicle)).slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.name.localeCompare(b.name,'ja'));}
function sameLabel(a,b){return a.toLocaleLowerCase('ja-JP')===b.toLocaleLowerCase('ja-JP');}
function upsert(items,name,vehicle,tuning,{overwrite=false,now,makeId}={}){
 if(!validVehicle(vehicle))throw Error('排気量区分が不正です。');
 const label=safeName(name),v=Number(vehicle),previous=items.find(x=>x.vehicle===v&&sameLabel(x.name,label));
 if(previous&&!overwrite)throw Error('同じ名前の設定があります。');
 if(!previous&&items.length>=MAX)throw Error('保存件数の上限（50件）です。不要な設定を削除してね。');
 const date=stamp(now||new Date().toISOString());
 const item={id:previous?.id||makeId?.()||id(),name:label,vehicle:v,tuning:tuner.normalize(tuning,v),createdAt:previous?.createdAt||date,updatedAt:date};
 const next=previous?items.map(x=>x.id===previous.id?item:x):[...items,item];
 return {items:next,item,replaced:!!previous};
}
function remove(items,selectedId){return items.filter(x=>x.id!==selectedId);}
function backup(items){return JSON.stringify({format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),items:read({version:VERSION,items})},null,2);}
function importBackup(existing,raw,{overwrite=false}={}){
 let file;try{file=JSON.parse(raw)}catch{throw Error('JSONファイルを読み取れませんでした。')}
 if(!file||file.format!==FORMAT||file.version!==VERSION||!Array.isArray(file.items))throw Error('B_Naviの設定バックアップではありません。');
 if(file.items.length>MAX)throw Error('バックアップの件数が上限を超えています。');
 let items=[...existing],added=0,replaced=0,skipped=0;
 for(const rawItem of file.items){
  const input=sanitize(rawItem);if(!input){skipped++;continue;}
  const previous=items.find(x=>x.vehicle===input.vehicle&&sameLabel(x.name,input.name));
  if(previous&&!overwrite){skipped++;continue;}
  if(!previous&&items.length>=MAX)throw Error('保存件数の上限（50件）を超えるため読み込めません。');
  if(previous){items=items.map(x=>x.id===previous.id?{...input,id:previous.id,createdAt:previous.createdAt}:x);replaced++;}
  else{items.push({...input,id:id()});added++;}
 }
 return {items,added,replaced,skipped};
}
const api={KEY,FORMAT,VERSION,MAX,MAX_NAME,nameOf,read,pack,forVehicle,upsert,remove,backup,importBackup};
root.BNaviRoutePresets=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
