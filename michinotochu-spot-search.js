/* B_Navi local spot search index — sourced from 道の途中。PWA.
 * No geocoder calls, location transmission or approximate-coordinate invention.
 * Only candidate records with finite Japan coordinates are returned.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviMichinoSpotSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const GROUPS=Object.freeze({
  all:'すべて',road_station:'道の駅',standard:'定番スポット',
  detour:'寄り道スポット',rider_cafe:'ライダーズカフェ'
 });
 const clean=s=>String(s??'').normalize('NFKC').toLowerCase()
   .replace(/[\s\u3000・･、，,.'’"“”「」『』（）()\[\]［］\-‐‑‒–—―ー－]/g,'');
 const split=s=>String(s??'').normalize('NFKC').trim().split(/[\s\u3000,，、]+/).map(clean).filter(Boolean).slice(0,8);
 const pointOk=r=>{
  const lat=Number(r?.lat),lon=Number(r?.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=20&&lat<=46&&lon>=122&&lon<=154;
 };
 function rank(index,query,{group='all',limit=24}={}){
  const spots=Array.isArray(index)?index:index?.spots;
  if(!Array.isArray(spots))return [];
  const terms=split(query);
  if(!terms.length||terms.some(x=>x.length>100))return [];
  const filter=Object.hasOwn(GROUPS,group)?GROUPS[group]:GROUPS.all;
  const found=[],seen=new Set();
  for(const row of spots){
   if(!pointOk(row)||!String(row.name??'').trim())continue;
   if(group!=='all'&&row.group!==filter)continue;
   const name=clean(row.name),pref=clean(row.prefecture),municipality=clean(row.municipality);
   const cat=clean(row.category),type=clean(row.group),address=clean(row.address);
   let score=0,matched=true;
   for(const term of terms){
    if(term===name)score+=140;
    else if(name.startsWith(term))score+=100;
    else if(name.includes(term))score+=78;
    else if(term===municipality)score+=30;
    else if(municipality.includes(term))score+=26;
    else if(pref.includes(term))score+=19;
    else if(type.includes(term))score+=15;
    else if(cat.includes(term))score+=14;
    else if(address.includes(term))score+=12;
    else {matched=false;break}
   }
   if(!matched)continue;
   const loc=Number(row.lat).toFixed(5)+':'+Number(row.lon).toFixed(5);
   const key=name+':'+loc;
   if(seen.has(key))continue;
   seen.add(key);
   found.push({...row,lat:Number(row.lat),lon:Number(row.lon),
     address:row.address||[row.prefecture,row.municipality].filter(Boolean).join(' '),
     source:'道の途中。',score});
  }
  return found.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ja'))
    .slice(0,Math.max(1,Math.min(40,Number(limit)||24)));
 }
 function samePoint(a,b){
  return clean(a?.name)===clean(b?.name)&&
   Math.abs(Number(a?.lat)-Number(b?.lat))<.00045&&
   Math.abs(Number(a?.lon)-Number(b?.lon))<.00045;
 }
 function distinctExternal(localRows,externalRows){
  return (Array.isArray(externalRows)?externalRows:[]).filter(row=>
   pointOk(row)&&!(localRows||[]).some(local=>samePoint(local,row)));
 }
 return Object.freeze({GROUPS,clean,split,pointOk,rank,samePoint,distinctExternal});
});
