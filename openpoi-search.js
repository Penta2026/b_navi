/* B_Navi OpenPOI adapter — no API key; no user location sent.
 * Source terms/attributions: https://openpoiapi.com/attribution.html
 * "suggest" uses AND matching and server-side name normalization; avoid
 * applying the legacy OSM candidate-rejection scoring to these results.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviOpenPoiSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const endpoint='https://api.openpoiapi.com/v1/';
 function makeURL(query,kind='suggest',limit=25){
   if(kind!=='suggest'&&kind!=='search')throw Error('Unsupported POI endpoint');
   const q=String(query||'').normalize('NFKC').trim().slice(0,120);
   if(!q||q.length<2)throw Error('施設名は2文字以上で入力してね');
   const params=new URLSearchParams({q,limit:String(Math.max(1,Math.min(50,Math.trunc(Number(limit)||25))))});
   return endpoint+kind+'?'+params.toString();
 }
 function fromResponse(payload,kind='suggest'){
   const raw=kind==='suggest'?payload?.suggestions:payload?.results;
   if(!Array.isArray(raw))return [];
   const rows=[],seen=new Set();
   for(const row of raw){
     if(!row||typeof row!=='object')continue;
     const name=String(row.name||'').trim().slice(0,200);
     if(!name)continue;
     const lat=row.lat===''?NaN:Number(row.lat),lon=row.lng===''?NaN:Number(row.lng);
     if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46||lon<122||lon>154)continue;
     const key=name.normalize('NFKC')+'|'+lat.toFixed(5)+'|'+lon.toFixed(5);
     if(seen.has(key))continue;seen.add(key);
     rows.push({name,address:String(row.address||[row.prefecture,row.city].filter(Boolean).join('')).slice(0,250),
       lat,lon,source:'OpenPOI API',category:String(row.category||'').slice(0,80),
       licenses:Array.isArray(row.licenses)?row.licenses.filter(x=>typeof x==='string').slice(0,20):[],
       attributions:Array.isArray(row.attributions)?row.attributions.filter(x=>typeof x==='string').slice(0,25):[]});
     if(rows.length>=50)break;
   }
   // The provider has already deduplicated and ranked suggestions.
   return rows;
 }
 return Object.freeze({makeURL,fromResponse});
});
