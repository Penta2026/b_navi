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
 chugoku:{name:'中国',box:[33.2,130.35,36.1,134.8]},
 shikoku:{name:'四国',box:[32.5,131.8,34.75,134.95]},
 kyushu:{name:'九州・奄美',box:[27.0,128.0,34.6,132.35]},
 okinawa:{name:'沖縄',box:[24.0,122.0,28.05,131.3]},
 kansai:{name:'関西',box:[33.3,134.0,36.7,137.15]},
 chubu:{name:'中部',box:[34.3,136.15,38.85,140.2]},
 kanto:{name:'関東',box:[34.65,138.2,37.5,141.3]},
 tohoku:{name:'東北',box:[36.65,139.0,41.75,142.45]},
 hokkaido:{name:'北海道',box:[41.2,139.1,45.75,146.15]}
};
const status=$('offline-fuel-status');
const button=$('offline-fuel-download');
const cancel=$('offline-fuel-cancel');
const regionSelect=$('offline-fuel-region');
const progress=$('offline-fuel-progress');
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
// Large requests are split into several bounded, sequential Overpass queries.
// Save only after every part succeeds, so incomplete downloads never overwrite
// an existing regional file. Public Overpass instances can throttle requests.
function queryFor(box){
 return '[out:json][timeout:90];(nwr["amenity"="fuel"]('+box.join(',')+'););out center;';
}
function splitBox(box){
 const [south,west,north,east]=box;
 const rows=Math.max(1,Math.ceil((north-south)/2.7));
 const cols=Math.max(1,Math.ceil((east-west)/3.1));
 const parts=[];
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  parts.push([
   +(south+(north-south)*row/rows).toFixed(6),
   +(west+(east-west)*col/cols).toFixed(6),
   +(south+(north-south)*(row+1)/rows).toFixed(6),
   +(west+(east-west)*(col+1)/cols).toFixed(6)
  ]);
 }
 return parts;
}
function delay(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('中断しました','AbortError'));
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);
  const abort=()=>{clearTimeout(timer);reject(new DOMException('中断しました','AbortError'))};
  signal?.addEventListener('abort',abort,{once:true});
 });
}
async function fetchFuel(region,signal){
 const parts=splitBox(REGIONS[region].box),collected=[],seen=new Set();
 let osmTimestamp=null;
 for(let i=0;i<parts.length;i++){
  if(i>0)await delay(2100,signal);
  report(REGIONS[region].name+'のガソスタ取得中… '+(i+1)+'/'+parts.length+'区画（通信中）');
  if(progress)progress.value=i/parts.length;
  const response=await fetch(API,{method:'POST',body:new URLSearchParams({data:queryFor(parts[i])}),signal,cache:'no-store'});
  if(!response.ok)throw Error('施設サーバー HTTP '+response.status+(response.status===429?'（混雑中・しばらく時間を空けて再試行）':''));
  const data=await response.json();
  if(!Array.isArray(data?.elements))throw Error('施設サーバーの応答形式が不正です');
  for(const entry of data.elements){
   const key=entry.type+'/'+entry.id;
   if(!seen.has(key)){seen.add(key);collected.push(entry)}
  }
  osmTimestamp=data.osm3s?.timestamp_osm_base||osmTimestamp;
  if(progress)progress.value=(i+1)/parts.length;
 }
 return {stations:normalizeFuel(collected,region),osmTimestamp};
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
 // Zoom 11 shows a sparse regional overview; every station returns by zoom 14.
 const gap=core.zoom<=11?105:core.zoom===12?76:core.zoom===13?46:0;
 const size=core.zoom<=11?22:core.zoom===12?25:core.zoom===13?28:32;
 const margin=size/2+5;
 const angle=core.bearing*Math.PI/180,c=Math.cos(angle),sin=Math.sin(angle);
 const occupied=new Map(),nodes=document.createDocumentFragment();
 for(const feature of allFuelFeatures){
  const [x,y]=core.screenPos([feature.geometry.coordinates[1],feature.geometry.coordinates[0]]);
  const dx=x-width/2,dy=y-height/2;
  const rx=dx*c-dy*sin+width/2,ry=dx*sin+dy*c+height/2;
  if(rx<margin||ry<margin||rx>width-margin||ry>height-margin)continue;
  window.__bnaviOfflineFuelInView++;
  if(gap){
   const gx=Math.floor(rx/gap),gy=Math.floor(ry/gap);
   let crowded=false;
   for(let ix=gx-1;ix<=gx+1&&!crowded;ix++){
    for(let iy=gy-1;iy<=gy+1&&!crowded;iy++){
     for(const [px,py] of occupied.get(ix+','+iy)||[]){
      if((rx-px)**2+(ry-py)**2<gap*gap){crowded=true;break;}
     }
    }
   }
   if(crowded)continue;
   const key=gx+','+gy;
   if(!occupied.has(key))occupied.set(key,[]);
   occupied.get(key).push([rx,ry]);
  }
  const marker=document.createElementNS(SVG_NS,'image');
  marker.setAttribute('x',(x-size/2).toFixed(1));
  marker.setAttribute('y',(y-size/2).toFixed(1));
  marker.setAttribute('width',String(size));
  marker.setAttribute('height',String(size));
  marker.setAttribute('href',fuelIconData);
  marker.setAttribute('transform','rotate('+(-core.bearing).toFixed(2)+' '+x.toFixed(1)+' '+y.toFixed(1)+')');
  nodes.append(marker);
  window.__bnaviOfflineFuelRendered++;
 }
 group.append(nodes);
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
 button.disabled=true;regionSelect.disabled=true;if(cancel)cancel.disabled=false;
 if(progress)progress.value=0;
 report(REGIONS[region].name+'地方のガソスタをOSMから取得中…（通信が必要）');
 try{
  const data=await fetchFuel(region,controller.signal);
  await saveFuel(region,data);
  await refresh();
  report('✅ '+REGIONS[region].name+'地方 '+data.stations.length+'件のガソスタを端末に保存したよ。⛽をONにして表示できるよ。走行中は通信不要。');
 }catch(e){report((e.name==='AbortError'?'取得を中断したよ':'取得できなかったよ：'+e.message)+'。保存済みのガソスタデータはそのまま。')}
 finally{controller=null;button.disabled=false;regionSelect.disabled=false;if(cancel)cancel.disabled=true}
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
