/* B_Navi search relevance v1 — pure, testable utilities.
 * No hard-coded private destinations. OSM-based geocoders do not guarantee POI coverage.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviPlaceSearchCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=s=>String(s||'').normalize('NFKC').toLowerCase()
  .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱|㈲/g,'')
  .replace(/[\s\u3000,，、・.．()（）\[\]［］「」『』]/g,'');
 const regionPattern=/^(?:北海道|東京都|大阪府|京都府|.{2,4}県|.{2,9}市|.{1,9}区|.{1,10}町|.{1,10}村)$/;
 function parts(query){
   let tokens=String(query||'').normalize('NFKC').trim().split(/[\s\u3000,、，]+/).filter(Boolean);
   if(tokens.length===1){
     // Common no-space Japanese location prefix (e.g. 広島市東京タワー).
     const m=tokens[0].match(/^((?:北海道|東京都|大阪府|京都府|.{2,4}県)?(?:.{2,9}市|.{1,9}区))(.{2,})$/);
     if(m&&m[1]&&m[2]&&!regionPattern.test(m[2]))tokens=[m[1],m[2]];
   }
   if(tokens.length===1)return {name:tokens[0]||'',region:[],whole:tokens.join(' ')};
   const name=tokens[tokens.length-1]||'';
   const region=tokens.slice(0,-1).filter(Boolean);
   return {name,region,whole:tokens.join(' ')};
 }
 const names=x=>[x.name,...Object.values(x.namedetails||{}).filter(v=>typeof v==='string')].filter(Boolean);
 function nameScore(x,target){
   const t=clean(target);if(t.length<2)return 0;
   let best=0;
   for(const candidate of names(x)){
     const n=clean(candidate);
     if(n===t)best=Math.max(best,100);
     else if(n.length>=3&&n.includes(t))best=Math.max(best,82);
     else if(n.length>=3&&t.includes(n)&&n.length/t.length>0.6)best=Math.max(best,55);
   }
   return best;
 }
 function regionScore(x,regions){
   if(!regions.length)return 1;
   const address=clean([x.address,...Object.values(x.addressParts||{})].join(' '));
   if(!address)return 0;
   const probes=[];
   for(const r of regions){
     const normal=clean(r);if(!normal)continue;
     // For combined prefixes check city/ward and prefecture individually.
     const pieces=normal.match(/(?:東京都|大阪府|京都府|北海道|.{2,4}県|.{2,9}市|.{1,9}区)/g);
     if(pieces&&pieces.length>1)probes.push(...pieces);
     else probes.push(normal);
   }
   if(!probes.length)return 1;
   // A matching place name outside the requested city is NOT a valid result.
   const matched=probes.filter(r=>address.includes(r)).length;
   return matched===probes.length?1:0;
 }
 function rank(raw,query){
   const p=parts(query);
   const out=[];const seen=new Set();
   for(const x of raw){
     const lat=Number(x.lat),lon=Number(x.lon);
     if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
     const score=nameScore(x,p.name);
     if(score<55||!regionScore(x,p.region))continue;
     const key=Math.round(lat*10000)+','+Math.round(lon*10000);
     if(seen.has(key))continue;seen.add(key);
     out.push({...x,lat,lon,score});
   }
   return out.sort((a,b)=>b.score-a.score).slice(0,12);
 }
 function fromNominatim(a){return (Array.isArray(a)?a:[]).map(x=>({
  name:x.name||x.namedetails?.['name:ja']||x.namedetails?.name||String(x.display_name||'').split(',')[0],
  namedetails:x.namedetails||{},address:String(x.display_name||''),addressParts:x.address||{},
  lat:Number(x.lat),lon:Number(x.lon),source:'Nominatim'
 }));}
 function fromPhoton(g){return (Array.isArray(g?.features)?g.features:[]).map(x=>{
   const p=x.properties||{},c=x.geometry?.coordinates||[];
   return {name:p.name||p['name:ja']||'',namedetails:{'name:ja':p['name:ja']||''},
     address:[p.street,p.housenumber,p.district,p.city,p.county,p.state,p.country].filter(Boolean).join(', '),
     addressParts:p,lat:Number(c[1]),lon:Number(c[0]),source:'Photon'};
 });}
 return Object.freeze({clean,parts,nameScore,regionScore,rank,fromNominatim,fromPhoton});
});
