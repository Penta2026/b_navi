/* B_Navi JR station fallback — reuses the user's older PWA station index.
 * Station coordinates are approximate POI markers, NOT guaranteed road entrances.
 * The index can be used without contacting any third-party search service.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviStationSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const normalized=s=>String(s??'').normalize('NFKC').trim().replace(/[\s\u3000・･]+/g,'');
 function parse(query){
  let q=normalized(query);
  const hasJR=/^JR/i.test(q);
  q=q.replace(/^JR(?:西日本|東日本|東海|九州|四国|北海道|貨物)?(?:の)?/i,'');
  const hasStation=/駅$/.test(q);
  if(hasStation)q=q.slice(0,-1);
  // Only simple station names are accepted; don't guess a station's prefecture.
  if(!q||q.length>24||/[\\/\d,、()（）]/.test(q)||/[\s\u3000]/.test(q))return null;
  return {name:q,explicit:hasJR||hasStation};
 }
 function isExplicit(query){return parse(query)?.explicit===true;}
 function rank(rows,query){
  const wanted=parse(query);if(!wanted)return [];
  const found=[],seen=new Set();
  for(const row of Array.isArray(rows)?rows:[]){
   const name=normalized(row?.name),lat=Number(row?.lat),lon=Number(row?.lng??row?.lon);
   if(name!==wanted.name||seen.has(name+'|'+lat+'|'+lon)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46||lon<122||lon>154)continue;
   seen.add(name+'|'+lat+'|'+lon);
   found.push({name:name+'駅',address:'',lat,lon,source:'JR駅',precision:'station',score:130});
   if(found.length===12)break;
  }
  return found;
 }
 return Object.freeze({parse,isExplicit,rank});
});
