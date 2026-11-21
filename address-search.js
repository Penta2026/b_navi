/* Online Japanese address lookup adapters. No private address database.
 * GSI location search may return neighborhood representative coordinates,
 * NOT parcel/building coordinates. User must verify the map before routing.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.BNaviAddressSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFKC').replace(/^〒\s*\d{3}-?\d{4}\s*/,'')
  .replace(/[\s\u3000,、，]/g,'').replace(/[‐‑‒–—―−ー－]/g,'-').replace(/[ヶケ]/g,'ケ');
 const core=s=>normalize(s).replace(/\d.*$/,'').replace(/[一二三四五六七八九十]+丁目.*$/,'').replace(/[-番地号].*$/,'');
 function looksLikeAddress(query){
  const q=normalize(query);
  if(q.length<4)return false;
  // Use a dedicated address path for parcel numbers and Japanese postal address forms,
  // but keep queries like "広島市 大田鋳造所" in the POI search path.
  return /(?:市|区|町|村|都|道|府|県).*(?:\d|丁目|番地|番|号)/.test(q) ||
   /(?:市|区|町|村).{1,24}(?:町|丁目)$/.test(q);
 }
 function score(candidate,query){
  const a=core(query),b=core(candidate);
  if(a.length<3||b.length<3)return 0;
  if(b.includes(a))return 100;
  if(a.includes(b)&&b.length>=Math.max(4,a.length*.65))return 80;
  // A title can omit the prefecture. Reject candidates not matching at least a ward/city core.
  const aa=a.replace(/^(?:東京都|北海道|大阪府|京都府|.{2,4}県)/,'');
  if(aa.length>=4&&b.includes(aa))return 93;
  const bb=b.replace(/^(?:東京都|北海道|大阪府|京都府|.{2,4}県)/,'');
  if(bb.length>=4&&aa.includes(bb))return 73;
  return 0;
 }
 function point(lat,lon){lat=Number(lat);lon=Number(lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=20&&lat<=46&&lon>=122&&lon<=154?{lat,lon}:null;}
 function rank(rows,query){
  const out=[],seen=new Set();
  for(const row of rows||[]){
   const xy=point(row.lat,row.lon),match=score(row.name||row.address,query);
   if(!xy||match<70)continue;
   const key=Math.round(xy.lat*100000)+','+Math.round(xy.lon*100000);
   if(seen.has(key))continue;seen.add(key);
   out.push({...row,...xy,score:match,precision:'area'});
  }
  return out.sort((a,b)=>b.score-a.score).slice(0,10);
 }
 function fromGSI(data){
  const features=Array.isArray(data)?data:Array.isArray(data?.features)?data.features:[];
  return features.map(f=>{
   const p=f.properties||{},c=f.geometry?.coordinates||[];
   const title=String(p.title||p.name||p.address||'').trim();
   const xy=point(c[1],c[0]);
   if(!title||!xy)return null;
   return {name:title,address:title,lat:xy.lat,lon:xy.lon,source:'地理院住所検索',precision:'area'};
  }).filter(Boolean);
 }
 function fromNominatim(data){
  return (Array.isArray(data)?data:[]).map(f=>{
   const xy=point(f.lat,f.lon);
   const name=String(f.display_name||f.name||'').trim();
   return xy&&name?{name,address:name,lat:xy.lat,lon:xy.lon,source:'OSM住所検索',precision:'area'}:null;
  }).filter(Boolean);
 }
 function makeGSIUrl(q){return 'https://msearch.gsi.go.jp/address-search/AddressSearch?q='+encodeURIComponent(normalize(q));}
 return Object.freeze({normalize,core,looksLikeAddress,score,rank,fromGSI,fromNominatim,makeGSIUrl});
});
