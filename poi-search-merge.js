/* Merge independent place-search providers without discarding other branches of
 * a real business after the first provider returns one result.
 * Does not invent place records or silently infer the address of a business.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviPoiSearchMerge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/株式会社|有限会社|合同会社|\(株\)|㈱|㈲/g,'').replace(/[\s\u3000・･,，、.．()（）\[\]［］「」『』]/g,'');
 const valid=x=>Number.isFinite(Number(x?.lat))&&Number.isFinite(Number(x?.lon))&&Number(x.lat)>=20&&Number(x.lat)<=46&&Number(x.lon)>=122&&Number(x.lon)<=154;
 const location=x=>[x.address,...Object.values(x.addressParts||{})].filter(v=>typeof v==='string').join(' ');
 function parts(query){
   // Share the same Japanese facility/region parser as search dispatch, including
   // city-prefixed queries without whitespace. A mismatch used to discard valid hits.
   const shared=typeof globalThis!=='undefined'?globalThis.BNaviPlaceSearchCore?.parts:null;
   if(typeof shared==='function'){
     const p=shared(query);return {name:p.name,region:p.region};
   }
   const words=String(query||'').normalize('NFKC').trim().split(/[\s\u3000,、，]+/).filter(Boolean);
   return {name:words.at(-1)||'',region:words.slice(0,-1)};
 }
 function scoreName(candidate,requested){
   const name=clean(candidate),target=clean(requested);
   if(!name||!target)return 0;
   if(name===target)return 100;
   if(name.includes(target))return 83;
   if(target.includes(name)&&name.length>=3&&name.length/target.length>=.6)return 62;
   return 0;
 }
 const categoryTerms=new Set(['カフェ','喫茶店','レストラン','飲食店','コンビニ','コンビニエンスストア','スーパー','スーパーマーケット','ガソリンスタンド','給油所','駐車場','パーキング','病院','薬局','ドラッグストア','ホームセンター','郵便局','交番','警察署','ホテル','キャンプ場','トイレ']);
 function matchRegion(row,regions){
   if(!regions.length)return true;
   const address=clean(location(row));
   if(!address)return false;
   return regions.every(r=>{
     const token=clean(r);
     return token&&address.includes(token);
   });
 }
 function combine(query,groups,limit=24){
   const p=parts(query),category=categoryTerms.has(p.name);
   const out=[];
   for(const group of groups||[]){
     const kind=group?.kind||'geocoder';
     const rows=Array.isArray(group?.rows)?group.rows:[];
     for(const raw of rows){
       if(!valid(raw)||!String(raw.name||'').trim()||!matchRegion(raw,p.region))continue;
       const aliases=[raw.name,...Object.values(raw.namedetails||{}).filter(v=>typeof v==='string')];
       const nameScore=Math.max(...aliases.map(n=>scoreName(n,p.name)));
       const typeScore=(category && (kind==='suggest'||kind==='geocoder'&&Boolean(raw.osmKey)))?65:0;
       const score=Math.max(nameScore,kind==='suggest'&&category?typeScore:0,
        kind==='geocoder'&&category&&raw.categoryMatch?70:0);
       // The /search endpoint uses OR logic for multi-word queries; require
       // an actual name match instead of treating all provider hits as valid.
       if(score<55)continue;
       const row={...raw,lat:Number(raw.lat),lon:Number(raw.lon),score};
       const previous=out.find(x=>clean(x.name)===clean(row.name)&&
         Math.abs(x.lat-row.lat)<.00045&&Math.abs(x.lon-row.lon)<.00045);
       if(previous){
         if(row.score>previous.score||(!previous.address&&row.address)){
           Object.assign(previous,row);
         }
         continue;
       }
       out.push(row);
     }
   }
   // Preserve distinct branches/locations, rank exact names first, then
   // respect provider order. Never collapse companies by name alone.
   return out.sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(40,limit)));
 }
 return Object.freeze({clean,parts,matchRegion,scoreName,combine});
});
