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
 const CATEGORY_GROUPS=[
   {words:['カフェ','喫茶店'],tags:[['amenity','cafe']]},
   {words:['レストラン','飲食店'],tags:[['amenity','restaurant'],['amenity','fast_food']]},
   {words:['コンビニ','コンビニエンスストア'],tags:[['shop','convenience']]},
   {words:['スーパー','スーパーマーケット'],tags:[['shop','supermarket']]},
   {words:['ガソリンスタンド','給油所'],tags:[['amenity','fuel']]},
   {words:['駐車場','パーキング'],tags:[['amenity','parking']]},
   {words:['病院'],tags:[['amenity','hospital'],['healthcare','hospital']]},
   {words:['薬局','ドラッグストア'],tags:[['amenity','pharmacy'],['shop','chemist']]},
   {words:['ホームセンター'],tags:[['shop','doityourself']]},
   {words:['郵便局'],tags:[['amenity','post_office']]},
   {words:['交番','警察署'],tags:[['amenity','police']]},
   {words:['トイレ','公衆トイレ'],tags:[['amenity','toilets']]},
   {words:['ホテル','宿泊施設'],tags:[['tourism','hotel'],['tourism','motel'],['tourism','guest_house']]},
   {words:['キャンプ場'],tags:[['tourism','camp_site']]},
 ];
 function category(query){
   const wanted=clean(parts(query).name).replace(/^(?:近くの|付近の|周辺の)/,'');
   return CATEGORY_GROUPS.find(c=>c.words.some(w=>clean(w)===wanted))||null;
 }
 function categoryMatches(x,c){
   return !!c&&c.tags.some(([key,value])=>String(x.osmKey||'').toLowerCase()===key&&String(x.osmValue||'').toLowerCase()===value);
 }
 function valid(x){const lat=Number(x.lat),lon=Number(x.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=20&&lat<=46&&lon>=122&&lon<=154;}
 function uniqueKey(x){return Math.round(Number(x.lat)*10000)+','+Math.round(Number(x.lon)*10000);}
 function rank(raw,query){
   const p=parts(query),c=category(query);
   const out=[],seen=new Set();
   for(const x of raw||[]){
     if(!valid(x)||!regionScore(x,p.region))continue;
     const score=Math.max(nameScore(x,p.name),categoryMatches(x,c)?72:0);
     if(score<55)continue;
     const key=uniqueKey(x);if(seen.has(key))continue;seen.add(key);
     out.push({...x,lat:Number(x.lat),lon:Number(x.lon),score});
   }
   return out.sort((a,b)=>b.score-a.score).slice(0,16);
 }
 // The geocoder has already ranked these candidates. Keep them clearly separate
 // from name/category matches, and never show a POI from a mismatched city.
 function related(raw,query,matched=[]){
   const p=parts(query),seen=new Set(matched.map(uniqueKey)),out=[];
   const target=clean(p.name);
   if(target.length<3)return [];
   const keys=new Set(['amenity','shop','tourism','leisure','office','craft','healthcare','historic']);
   for(const x of raw||[]){
     if(!valid(x)||!regionScore(x,p.region)||!String(x.name||'').trim())continue;
     if(!keys.has(String(x.osmKey||'').toLowerCase()))continue;
     // A nearby but unrelated shop must not become a fake search match.
     const name=clean(x.name);let overlap=false;
     for(let i=0;i+2<=target.length;i++)if(name.includes(target.slice(i,i+2))){overlap=true;break;}
     if(!overlap)continue;
     const key=uniqueKey(x);if(seen.has(key))continue;seen.add(key);
     // Never describe a provider-ranked suggestion as an exact name match.
     out.push({...x,lat:Number(x.lat),lon:Number(x.lon),score:0,related:true});
     if(out.length>=8)break;
   }
   return out;
 }
 function fromNominatim(a){return (Array.isArray(a)?a:[]).map(x=>({
  name:x.name||x.namedetails?.['name:ja']||x.namedetails?.name||String(x.display_name||'').split(',')[0],
  namedetails:x.namedetails||{},address:String(x.display_name||''),addressParts:x.address||{},
  lat:Number(x.lat),lon:Number(x.lon),osmKey:x.category||x.class||'',osmValue:x.type||'',source:'Nominatim'
 }));}
 function fromPhoton(g){return (Array.isArray(g?.features)?g.features:[]).map(x=>{
   const p=x.properties||{},c=x.geometry?.coordinates||[];
   return {name:p.name||p['name:ja']||'',namedetails:{'name:ja':p['name:ja']||''},
     address:[p.street,p.housenumber,p.district,p.city,p.county,p.state,p.country].filter(Boolean).join(', '),
     addressParts:p,lat:Number(c[1]),lon:Number(c[0]),osmKey:p.osm_key||'',osmValue:p.osm_value||'',source:'Photon'};
 });}

 return Object.freeze({clean,parts,nameScore,regionScore,category,categoryMatches,rank,related,fromNominatim,fromPhoton});
});
