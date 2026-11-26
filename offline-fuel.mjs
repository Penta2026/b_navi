// B_Navi: download OSM fuel stations once per region; use saved OPFS data while riding.
// Map data already stored under BikeNavigator/maps is never touched.
// OSM © OpenStreetMap contributors (ODbL). Changes to fuel listings require re-download.
const $=id=>document.getElementById(id);
const STORAGE_DIR='fuel-stations';
const FILE_NAME='stations.json';
const SOURCE='bnavi-offline-fuel';
const LAYER='bnavi-offline-fuel-icons';
const IMAGE='bnavi-offline-fuel-symbol';
const SVG_NS='http://www.w3.org/2000/svg';
let fuelSvgGroup=null,fuelIconData=null;
const API='https://overpass-api.de/api/interpreter';
const REGIONS={
 chugoku:{name:'中国',box:[33.35,130.40,36.05,134.70]},
 shikoku:{name:'四国',box:[32.65,132.00,34.65,134.85]},
 kyushu:{name:'九州',box:[30.7,128.05,34.55,132.20]},
 kansai:{name:'関西',box:[33.35,134.05,36.45,136.95]},
 chubu:{name:'中部',box:[34.35,136.25,38.65,140.10]},
 kanto:{name:'関東',box:[34.70,138.35,37.15,141.20]},
 tohoku:{name:'東北',box:[36.70,139.05,41.65,142.20]},
 hokkaido:{name:'北海道',box:[41.25,139.20,45.65,145.90]}
};
const status=$('offline-fuel-status');
const button=$('offline-fuel-download');
const cancel=$('offline-fuel-cancel');
const regionSelect=$('offline-map-region');
const report=msg=>{if(status)status.textContent=msg};
let controller=null;
async function fuelFolder(region,create=false){
 const root=await navigator.storage.getDirectory();
 const app=await root.getDirectoryHandle('BikeNavigator',{create});
 const fuel=await app.getDirectoryHandle(STORAGE_DIR,{create});
 return fuel.getDirectoryHandle(region,{create});
}
async function readFuel(region){
 try{
  const d=await fuelFolder(region);
  const raw=await(await d.getFileHandle(FILE_NAME)).getFile();
  const parsed=JSON.parse(await raw.text());
  if(parsed.region!==region||!Array.isArray(parsed.stations)||parsed.version!==1)throw Error('形式が不正です');
  return parsed;
 }catch(e){if(e.name==='NotFoundError')return null;throw e}
}
function normalizeFuel(elements,region){
 const [south,west,north,east]=REGIONS[region].box;
 const used=new Set(),stations=[];
 for(const e of elements){
  if(e?.tags?.amenity!=='fuel')continue;
  const lat=Number(e.lat??e.center?.lat),lon=Number(e.lon??e.center?.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<south||lat>north||lon<west||lon>east)continue;
  const id=String(e.type)+'/'+String(e.id);
  if(used.has(id))continue;used.add(id);
  const name=String(e.tags.name||e.tags.brand||e.tags.operator||'ガソリンスタンド').slice(0,100);
  stations.push({id,lat,lon,name});
 }
 if(stations.length===0)throw Error('ガソスタが0件でした。空のデータでは上書きしません');
 if(stations.length>40000)throw Error('取得件数が想定を超えました');
 return stations;
}
function queryFor(region){
 const b=REGIONS[region].box.join(',');
 return '[out:json][timeout:90];(node["amenity"="fuel"]('+b+');way["amenity"="fuel"]('+b+');relation["amenity"="fuel"]('+b+'););out center;';
}
async function fetchFuel(region,signal){
 // Explicit manual downloads only; do not hit Overpass during map browsing.
 const response=await fetch(API,{method:'POST',body:new URLSearchParams({data:queryFor(region)}),signal,cache:'no-store'});
 if(!response.ok)throw Error('OSM施設サーバー HTTP '+response.status+(response.status===429?'（混雑・制限中。時間を空けて再試行）':''));
 const data=await response.json();
 if(!Array.isArray(data?.elements))throw Error('施設サーバーの応答形式が不正です');
 return {stations:normalizeFuel(data.elements,region),osmTimestamp:data.osm3s?.timestamp_osm_base||null};
}
async function saveFuel(region,payload){
 const dir=await fuelFolder(region,true);
 const file=await dir.getFileHandle(FILE_NAME,{create:true});
 const writer=await file.createWritable();
 try{await writer.write(JSON.stringify({version:1,region,updatedAt:new Date().toISOString(),...payload}));await writer.close();}
 catch(e){try{await writer.abort()}catch{}throw e}
}
function fuelGeoJSON(records){
 const features=[],seen=new Set();
 for(const record of records)for(const station of record.stations){
  const key=station.id;
  if(seen.has(key))continue;
  seen.add(key);
  features.push({type:'Feature',geometry:{type:'Point',coordinates:[station.lon,station.lat]},properties:{name:station.name,id:key}});
 }
 return {type:'FeatureCollection',features};
}
function addFuelIcon(map){
 if(map.hasImage(IMAGE))return;
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.beginPath();ctx.arc(32,32,28,0,Math.PI*2);
 ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#607986';ctx.lineWidth=2.5;ctx.stroke();
 ctx.font='37px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⛽',32,33,52);
 fuelIconData=canvas.toDataURL('image/png');
 map.addImage(IMAGE,ctx.getImageData(0,0,64,64),{pixelRatio:2});
}
let lastCount=0;
let allFuelFeatures=[];
function foregroundFuelLayer(){
 if(fuelSvgGroup?.isConnected)return fuelSvgGroup;
 const svg=window.__bnaviMapCore?.svg;
 if(!svg)return null;
 fuelSvgGroup=document.createElementNS(SVG_NS,'g');
 fuelSvgGroup.setAttribute('id','bnavi-fuel-foreground');
 fuelSvgGroup.setAttribute('pointer-events','none');
 // The SVG is above both the MapLibre vector map and the OSM raster tiles.
 // Keep the fuel icons beneath the route, waypoint and GPS paths.
 svg.insertBefore(fuelSvgGroup,svg.firstChild);
 return fuelSvgGroup;
}
function updateVisibleFuel(){
 const core=window.__bnaviMapCore,group=foregroundFuelLayer();
 if(!core||!group)return;
 const width=core.el.clientWidth,height=core.el.clientHeight;
 if(width<1||height<1)return;
 let enabled=false;
 try{enabled=JSON.parse(localStorage.getItem('bnavi.offlinePoiOptions.v2')||'{}')?.fuel===true}catch{}
 group.replaceChildren();
 window.__bnaviOfflineFuelInView=0;
 window.__bnaviOfflineFuelRendered=0;
 if(!enabled||core.zoom<11||!fuelIconData)return;
 const c=Math.cos(core.bearing*Math.PI/180),sin=Math.sin(core.bearing*Math.PI/180),margin=22;
 const nodes=document.createDocumentFragment();
 for(const feature of allFuelFeatures){
  const [x,y]=core.screenPos([feature.geometry.coordinates[1],feature.geometry.coordinates[0]]);
  const dx=x-width/2,dy=y-height/2;
  const rotatedX=dx*c-dy*sin+width/2,rotatedY=dx*sin+dy*c+height/2;
  if(rotatedX<margin||rotatedY<margin||rotatedX>width-margin||rotatedY>height-margin)continue;
  window.__bnaviOfflineFuelInView++;
  const marker=document.createElementNS(SVG_NS,'image');
  marker.setAttribute('x',(x-16).toFixed(1));
  marker.setAttribute('y',(y-16).toFixed(1));
  marker.setAttribute('width','32');marker.setAttribute('height','32');
  marker.setAttribute('href',fuelIconData);
  // Cancel the parent SVG's map rotation for upright pictograms.
  marker.setAttribute('transform','rotate('+(-core.bearing).toFixed(2)+' '+x.toFixed(1)+' '+y.toFixed(1)+')');
  nodes.append(marker);
 }
 group.append(nodes);
 window.__bnaviOfflineFuelRendered=window.__bnaviOfflineFuelInView;
}
function scheduleVisibleFuel(){updateVisibleFuel()}
async function refresh(){
 const map=window.__bikeMap;
 if(!map||!map.isStyleLoaded())return;
 const records=[];
 for(const region of Object.keys(REGIONS)){
  try{const record=await readFuel(region);if(record)records.push(record)}
  catch(e){report('保存済みガソスタを読めません: '+e.message)}
 }
 const geo=fuelGeoJSON(records);lastCount=geo.features.length;
 allFuelFeatures=geo.features;
 window.__bnaviOfflineFuelCount=lastCount;
 addFuelIcon(map);
 // The dedicated foreground SVG prevents raster/vector basemaps covering icons.
 if(map.getLayer(LAYER))map.removeLayer(LAYER);
 if(map.getSource(SOURCE))map.removeSource(SOURCE);
 scheduleVisibleFuel();
 syncVisibility();
}
function syncVisibility(){scheduleVisibleFuel();}
function updateSavedStatus(){
 const region=regionSelect?.value;
 if(!REGIONS[region])return;
 readFuel(region).then(data=>report(data
  ?'保存済み：'+REGIONS[region].name+'地方 '+data.stations.length+'件（'+new Date(data.updatedAt).toLocaleDateString('ja-JP')+'取得）。地図で⛽をONにすると表示'
  :'この地方のガソスタ情報は未保存。通信できるときに保存してね。')).catch(e=>report('ガソスタ保存情報の確認エラー：'+e.message));
}
button?.addEventListener('click',async()=>{
 const region=regionSelect?.value;
 if(!REGIONS[region]||controller)return;
 controller=new AbortController();
 button.disabled=true;if(cancel)cancel.disabled=false;
 report(REGIONS[region].name+'地方のガソスタをOSMから取得中…（通信が必要）');
 try{
  const data=await fetchFuel(region,controller.signal);
  await saveFuel(region,data);
  await refresh();
  report('✅ '+REGIONS[region].name+'地方 '+data.stations.length+'件のガソスタを端末に保存したよ。⛽をONにして表示できるよ。走行中は通信不要。');
 }catch(e){report((e.name==='AbortError'?'取得を中断したよ':'取得できなかったよ：'+e.message)+'。保存済みのガソスタデータはそのまま。')}
 finally{controller=null;button.disabled=false;if(cancel)cancel.disabled=true}
});
cancel?.addEventListener('click',()=>controller?.abort());
regionSelect?.addEventListener('change',updateSavedStatus);
window.addEventListener('bnavi:offline-fuel-changed',()=>{refresh().catch(e=>report('施設地図の更新に失敗：'+e.message));});
document.querySelector('input[data-offline-poi="fuel"]')?.addEventListener('change',syncVisibility);
document.getElementById('offline-poi-clear')?.addEventListener('click',syncVisibility);
function boot(){
 const map=window.__bikeMap;
 if(!map){setTimeout(boot,150);return;}
 window.__bnaviFuelOverlaySync=updateVisibleFuel;
 map.on('moveend',scheduleVisibleFuel);
 map.on('resize',scheduleVisibleFuel);
 map.on('load',()=>refresh().catch(e=>report('施設データ表示エラー：'+e.message)));
 map.on('style.load',()=>refresh().catch(e=>report('施設データ表示エラー：'+e.message)));
 refresh().catch(e=>report('施設データ表示エラー：'+e.message));
 updateSavedStatus();
}
boot();
