/* Ordered-point GPX importer for B_Navi.
 * GPX <rtept>/<wpt> without a road track is an itinerary, not road geometry.
 * It must be routed using the active motorcycle profile before navigation.
 */
(function(root){
'use strict';
function namedChildren(node,tag){return Array.from(node.getElementsByTagNameNS('*',tag));}
function childText(node,tag){
 const direct=Array.from(node.children||[]).find(child=>child.localName===tag);
 return (direct?.textContent||'').trim();
}
function point(node){
 const lat=Number(node.getAttribute('lat')),lon=Number(node.getAttribute('lon'));
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<20||lat>46||lon<122||lon>154)
  throw Error('GPX内の地点座標が不正です（日本国内の緯度・経度を確認してください）。');
 return {coords:[lat,lon],name:childText(node,'name')};
}
function parse(doc){
 if(!doc||namedChildren(doc,'trkpt').length)return null;
 const routes=namedChildren(doc,'rte');
 let nodes=[];
 for(const route of routes){
  const items=Array.from(route.children||[]).filter(n=>n.localName==='rtept');
  if(items.length>=2){nodes=items;break;}
 }
 let kind='route';
 if(nodes.length<2){nodes=namedChildren(doc,'wpt');kind='waypoints';}
 if(nodes.length<2)return null;
 // <rtept> with BRouter extension offsets is a turn-cue list, not an itinerary.
 if(kind==='route'&&nodes.some(n=>namedChildren(n,'offset').length))return null;
 const title=routes.map(r=>childText(r,'name')).join(' ');
 const designated=/BNAV-ITINERARY-1/i.test(title)||/MichiNoTochu/i.test(doc.documentElement?.getAttribute('creator')||'');
 // A dense, unnamed <rtept> line may represent geometry instead of stops.
 if(kind==='route'&&!designated&&nodes.length>20)return null;
 if(nodes.length>52)throw Error('GPXの立寄地点が多すぎます（出発・到着を含め52地点まで）。');
 const points=nodes.map(point);
 return {kind,points,via:points.slice(1,-1),start:points[0],goal:points.at(-1)};
}
const api={parse};root.BNaviGpxItinerary=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
