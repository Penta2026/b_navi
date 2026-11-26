// BikeNavigator v6.3: render EVERY installed regional PMTiles together, with source bounds.
// Only reads downloaded Shortbread PMTiles from the user's own OPFS.
// Map tiles never come from online OSM servers. BRouter remains independent.
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';
import {PMTiles,FileSource} from 'https://esm.sh/pmtiles@4.5.0';
import {REGION_IDS,sourceId,sourceOptions,tileRequest,regionLayers} from './offline-region-mosaic.mjs';

const regions=REGION_IDS;
const label=document.getElementById('offline-map-display-status');
const archiveCache=new Map();
const activeByRegion=new Map();
let currentKey='',updating=false,rerun=false;
const sourcePrefix='bike-pmtiles-';
const prefix='bike-base-';
const blueprints=[];
const POI_PREF_KEY='bnavi.offlinePoiOptions.v2';
const POI_IDS=['fuel','toilet','convenience','station','port','food','viewpoint','tourism','historic','landmark'];
const poiPreferences=Object.fromEntries(POI_IDS.map(id=>[id,false]));
try{const saved=JSON.parse(localStorage.getItem(POI_PREF_KEY)||'{}');for(const id of POI_IDS)poiPreferences[id]=saved?.[id]===true;}catch{}
function applyPoiVisibility(map){
 for(const region of regions)for(const id of POI_IDS){
  const layer=prefix+region+'-poi-'+id+'-icon';
  if(map.getLayer(layer))map.setLayoutProperty(layer,'visibility',poiPreferences[id]?'visible':'none');
 }
}
function persistPoiVisibility(){
 try{localStorage.setItem(POI_PREF_KEY,JSON.stringify(poiPreferences))}catch{}
 if(window.__bikeMap)applyPoiVisibility(window.__bikeMap);
}
for(const input of document.querySelectorAll('input[data-offline-poi]')){
 const id=input.dataset.offlinePoi;
 if(!POI_IDS.includes(id))continue;
 input.checked=poiPreferences[id]===true;
 input.addEventListener('change',()=>{poiPreferences[id]=input.checked;persistPoiVisibility();});
}
document.getElementById('offline-poi-clear')?.addEventListener('click',()=>{
 for(const id of POI_IDS)poiPreferences[id]=false;
 for(const input of document.querySelectorAll('input[data-offline-poi]'))input.checked=false;
 persistPoiVisibility();
});

// Inspect the actually loaded offline vector tiles, not a guessed online POI list.
// The user can run this at a known fuel station to distinguish absent data from an
// icon/filter/visibility issue. QuerySourceFeatures only examines loaded tiles.
document.getElementById('offline-poi-check')?.addEventListener('click',()=>{
 const output=document.getElementById('offline-poi-check-result');
 if(!output)return;
 const map=window.__bikeMap;
 if(!map||!window.__bikeLocalPmtilesActive){output.textContent='端末のカラー地図が読み込まれていません。先に保存地図の状態を確認してね。';return;}
 const zoom=map.getZoom();
 const enabled=poiPreferences.fuel===true;
 if(!enabled){output.textContent='ガソリンスタンドがOFFだよ。先に⛽のチェックをONにしてね。';return;}
 if(zoom<14){output.textContent='現在の内部ズーム '+zoom.toFixed(1)+'。Shortbreadのガソスタ情報は原則14のタイルにあるため、まず地図をもっと拡大してから診断してね。';return;}
 let all=0,fuel=0,visible=0,loaded=false;
 try{
  for(const region of regions){
   const src=sourceId(region);
   if(!map.getSource(src))continue;
   loaded=loaded||map.isSourceLoaded(src);
   const found=map.querySourceFeatures(src,{sourceLayer:'pois'});
   all+=found.length;
   fuel+=found.filter(f=>f.properties?.amenity==='fuel').length;
  }
  visible=map.queryRenderedFeatures({layers:regions.map(region=>prefix+region+'-poi-fuel-icon').filter(id=>map.getLayer(id))}).length;
 }catch(err){output.textContent='施設データの診断中にエラー：'+err.message;return;}
 const base='地図ズーム '+zoom.toFixed(1)+'／読込済み施設 '+all+'件／ガソスタ '+fuel+'件／描画対象 '+visible+'件。';
 output.textContent=base+(fuel>0
  ?(visible>0?' ガソスタのデータと表示は検出できたよ。':' ガソスタのデータはあるけれど、アイコンが描画されていないよ。表示処理の問題として調査できるよ。')
  :(all>0?' この範囲の施設データにガソスタが見つからないよ。地図への収録状況を確認する必要があるね。':(loaded?' 施設データが検出できなかったよ。地図の収録レイヤーを確認する必要があるね。':' 地図タイルの読み込み中かも。少し地図を動かして、もう一度確認してね。')));
});
function message(s){if(label)label.textContent=s}

async function readArchive(region){
 try{
  const root=await navigator.storage.getDirectory();
  const app=await root.getDirectoryHandle('BikeNavigator');
  const maps=await app.getDirectoryHandle('maps');
  const dir=await maps.getDirectoryHandle(region);
  let name='map.pmtiles';
  try{
   const meta=JSON.parse(await(await(await dir.getFileHandle('active.json')).getFile()).text());
   if(meta.region!==region||!/^map-[a-z0-9_-]+\.pmtiles$/i.test(meta.file))throw Error('地図の管理情報が不正です');
   name=meta.file;
  }catch(err){if(err.name!=='NotFoundError')throw err}
  const file=await(await dir.getFileHandle(name)).getFile();
  return {name,file,region};
 }catch(err){if(err.name==='NotFoundError')return null;throw err}
}
async function installedArchives(){
 const list=[];
 for(const region of regions){
  try{
   const info=await readArchive(region);
   if(!info)continue;
   const key=[region,info.name,info.file.size,info.file.lastModified].join('/');
   let archive=archiveCache.get(key);
   if(!archive){
    archive=new PMTiles(new FileSource(new File([info.file],info.name)));
    archiveCache.set(key,archive);
   }
   const h=await archive.getHeader();
   if(h.tileType!==1)throw Error('ベクターデータではありません');
   list.push({region,info,archive,h,key});
  }catch(err){message(region+'の地図を読めません: '+err.message)}
 }
 return list;
}
maplibregl.addProtocol('bikelocalcolor',async(params)=>{
 const tile=tileRequest(params.url);
 if(!tile)return {data:new Uint8Array(0)};
 const entry=activeByRegion.get(tile.region);
 if(!entry)return {data:new Uint8Array(0)};
 const t=await entry.archive.getZxy(tile.z,tile.x,tile.y);
 return {data:t?.data?new Uint8Array(t.data):new Uint8Array(0)};
});

// Draw every layer BELOW BRouter route lines, not over them.
function anchor(map){
 for(const id of ['bikenav-fun-line','bikenav-balanced-line','bikenav-direct-line','bikenav-legacy50-line','bikenav-quiet-line']){
  if(map.getLayer(id))return id;
 }
 return undefined;
}
function add(_map,name,type,src,extra){
 blueprints.push({name,type,src,extra});
}
const K=['get','kind'];
const notRail=['!=',['get','rail'],true];
const major=['in',K,['literal',['motorway','trunk','primary','secondary','tertiary']]];
const medium=['in',K,['literal',['residential','unclassified','living_street','service','road']]];
const foot=['in',K,['literal',['footway','pedestrian','path','track','cycleway','steps','bridleway']]];
const name=['coalesce',['get','name'],''];
function addCartography(map){
 // Land first, then water, then buildings and transport; no remote tiles.
 add(map,'ocean','fill','ocean',{paint:{'fill-color':'#b3d9e7'}});
 add(map,'land','fill','land',{paint:{
  'fill-color':['match',K,
   'forest','#c9ddb9','wood','#c9ddb9','grass','#dcebc7','meadow','#dfedcc','orchard','#d6e6c4',
   'park','#d0e7bf','recreation_ground','#daebc5','garden','#d7e8c8','cemetery','#d6dfc9',
   'farmland','#ece9ce','farmyard','#eee7d8','residential','#f7f1e9',
   'industrial','#e8e4ea','commercial','#eee9e8','retail','#f3e8e5',
   'sand','#f2e8c9','beach','#f4e8ca','bare_rock','#e9e7e0',
   '#e9eddf'],
  'fill-opacity':0.9}});
 add(map,'sites','fill','sites',{paint:{
  'fill-color':['match',K,
    'park','#cfe9c4','garden','#d0eac4','nature_reserve','#c6dfba',
    'school','#f1e9ca','university','#f0e9c9','hospital','#f2d9df',
    'sports_centre','#d6e8c2','parking','#eeeeea','industrial','#e8e4ea',
    '#eeede8'],
  'fill-opacity':0.9}});
 add(map,'lakes-rivers','fill','water_polygons',{paint:{
  'fill-color':['match',K,'glacier','#e4f1f5','#a9d6e8']}});
 add(map,'waterways','line','water_lines',{minzoom:10,paint:{
  'line-color':'#a7d1e7','line-width':['interpolate',['linear'],['zoom'],10,0.6,14,1.5,17,3]}});
 add(map,'building','fill','buildings',{minzoom:14,paint:{
  'fill-color':'#ded9d1','fill-opacity':['interpolate',['linear'],['zoom'],14,0.45,17,0.8],
  'fill-outline-color':'#d4cdc4'}});
 add(map,'railway','line','streets',{minzoom:11,filter:['==',['get','rail'],true],paint:{
  'line-color':'#adaba8','line-width':['interpolate',['linear'],['zoom'],11,0.8,16,2.2],
  'line-dasharray':[2,1.7]}});

 // Shortbread "streets_low" supports generalised roads at smaller zooms.
 add(map,'roads-general','line','streets_low',{maxzoom:10,filter:notRail,paint:{
  'line-color':['match',K,'motorway','#db9699','trunk','#dfa67c','primary','#e9bd7c','#d8d2c8'],
  'line-width':['interpolate',['linear'],['zoom'],5,0.6,8,1.5,10,2.3],
  'line-opacity':0.9}});
 add(map,'minor-outline','line','streets',{minzoom:11,filter:['all',notRail,medium],paint:{
  'line-color':'#d9d3c9','line-width':['interpolate',['linear'],['zoom'],11,0.8,13,1.7,15,4,18,10]}});
 add(map,'minor-road','line','streets',{minzoom:11,filter:['all',notRail,medium],paint:{
  'line-color':'#ffffff','line-width':['interpolate',['linear'],['zoom'],11,0.5,13,1.1,15,2.9,18,8]}});
 add(map,'pathway','line','streets',{minzoom:14,filter:['all',notRail,foot],paint:{
  'line-color':'#b6b09f','line-width':['interpolate',['linear'],['zoom'],14,0.5,17,1.7],
  'line-dasharray':[1.8,1.6],'line-opacity':0.65}});
 add(map,'main-casing','line','streets',{minzoom:9,filter:['all',notRail,major],paint:{
  'line-color':['match',K,'motorway','#c7838e','trunk','#c89b80','primary','#d7b076','secondary','#d8b99a','#dbcec1'],
  'line-width':['interpolate',['linear'],['zoom'],9,1.4,11,2.3,13,4.4,15,8.4,18,15]}});
 add(map,'main-roads','line','streets',{minzoom:9,filter:['all',notRail,major],paint:{
  'line-color':['match',K,'motorway','#e7a2a7','trunk','#f1bb8e','primary','#f8d397','secondary','#f9e3ba','tertiary','#fff5dd','#ffffff'],
  'line-width':['interpolate',['linear'],['zoom'],9,0.9,11,1.5,13,3.1,15,6.3,18,11.5]}});


 // Local Shortbread points of interest; always hidden until enabled by the user.
 const matches=(field,values)=>['in',['get',field],['literal',values]];
 const entries=[
  ['fuel','pois',matches('amenity',['fuel']),11],
  ['toilet','pois',matches('amenity',['toilets']),14],
  ['convenience','pois',matches('shop',['convenience']),14],
  ['station','public_transport',matches('kind',['station','halt','tram_stop']),13],
  ['port','public_transport',matches('kind',['ferry_terminal']),13],
  ['food','pois',matches('amenity',['restaurant','cafe','fast_food','food_court']),15],
  ['viewpoint','pois',matches('tourism',['viewpoint']),13],
  ['tourism','pois',['any',matches('tourism',['attraction','museum','gallery','zoo','theme_park','aquarium','information']),matches('amenity',['arts_centre'])],13],
  ['historic','pois',matches('historic',['archaeological_site','battlefield','castle','fort','ruins','wayside_shrine']),13],
  ['landmark','pois',['any',matches('historic',['monument','memorial']),matches('tourism',['artwork']),matches('man_made',['lighthouse'])],13]
 ];
 for(const [id,source,filter,minzoom] of entries){
  add(map,'poi-'+id+'-icon','symbol',source,{minzoom,filter,layout:{
   visibility:'none','icon-image':'bnavi-poi-'+id,
   'icon-size':0.82,'icon-allow-overlap':false,'icon-ignore-placement':false,
   'icon-padding':6,'symbol-sort-key':0
  }});
 }
 // Labels: prefer local system glyph rendering (MapLibre GL JS 6) for offline maps.
 const textPaint=(color,sizeHalo=1.35)=>({'text-color':color,'text-halo-color':'#fffdfa','text-halo-width':sizeHalo,'text-halo-blur':0.5});
 const font=['sans-serif'];
 add(map,'water-labels','symbol','water_polygons_labels',{minzoom:11,layout:{
  'text-field':name,'text-font':font,'text-size':12,'text-max-width':8,
  'text-allow-overlap':false},paint:{'text-color':'#4f98ae','text-halo-color':'#eefaff','text-halo-width':1.1}});
 add(map,'river-labels','symbol','water_lines_labels',{minzoom:13,layout:{
  'symbol-placement':'line','text-field':name,'text-font':font,'text-size':11,'text-rotation-alignment':'map',
  'text-allow-overlap':false},paint:{'text-color':'#6a9fb4','text-halo-color':'#fff','text-halo-width':1}});
 add(map,'boundary-labels','symbol','boundary_labels',{minzoom:7,maxzoom:13,layout:{
  'text-field':name,'text-font':font,'text-size':12,'text-allow-overlap':false},paint:textPaint('#62716d')});
 add(map,'town-labels','symbol','place_labels',{minzoom:6,filter:['in',K,['literal',['capital','city','town','village','hamlet']]],layout:{
  'text-field':name,'text-font':font,
  'text-size':['interpolate',['linear'],['zoom'],6,11,10,14,14,17],
  'text-max-width':8,'text-allow-overlap':false,'text-padding':8,
  'text-variable-anchor':['center','top','bottom']},
  paint:textPaint('#46565b',1.65)});
 add(map,'neighborhood-labels','symbol','place_labels',{minzoom:13,filter:['in',K,['literal',['suburb','quarter','neighbourhood','isolated_dwelling']]],layout:{
  'text-field':name,'text-font':font,'text-size':12,'text-max-width':8,'text-allow-overlap':false,
  'text-padding':5},paint:textPaint('#65736d',1.25)});
 add(map,'street-labels','symbol','street_labels',{minzoom:13,filter:['in',K,['literal',['motorway','trunk','primary','secondary','tertiary','residential','unclassified']]],layout:{
  'symbol-placement':'line','text-field':name,'text-font':font,
  'text-size':['interpolate',['linear'],['zoom'],13,10,17,12],
  'symbol-spacing':450,'text-max-angle':25,'text-padding':4,'text-allow-overlap':false},paint:textPaint('#7e7770',1.3)});
}
// Build style templates once; install them by style-layer first, then by region.
// This prevents another region's land layer painting over existing road lines.
addCartography(null);
function removeCartography(map){
 for(const layer of (map.getStyle()?.layers||[]).slice().reverse()){
  if(layer.id.startsWith(prefix)&&map.getLayer(layer.id))map.removeLayer(layer.id);
 }
 for(const region of regions){
  const id=sourceId(region);
  if(map.getSource(id))map.removeSource(id);
 }
 activeByRegion.clear();
}

// Draw recognisable pictograms, never letters. The glyphs are rasterised locally
// into MapLibre sprite images; no CDN, font downloads, or external images required.
const POI_PICTOGRAMS={fuel:'⛽',toilet:'🚻',convenience:'🏪',station:'🚉',port:'⛴️',
 food:'🍽️',viewpoint:'🏞️',tourism:'🎟️',historic:'🏯',landmark:'⭐'};
function addPoiIconImages(map){
 for(const [id,pictogram] of Object.entries(POI_PICTOGRAMS)){
  const name='bnavi-poi-'+id;
  if(map.hasImage(name))continue;
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const ctx=canvas.getContext('2d');if(!ctx)continue;
  // A compact, high-contrast white-backed icon with subtle outline.
  ctx.beginPath();ctx.arc(32,32,28,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();
  ctx.lineWidth=2.5;ctx.strokeStyle='#607986';ctx.stroke();
  ctx.font='37px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(pictogram,32,33,52);
  map.addImage(name,ctx.getImageData(0,0,64,64),{pixelRatio:2});
 }
}
function renderAll(map,records){
 removeCartography(map);
 if(!records.length){currentKey='';window.__bikeLocalPmtilesActive=false;window.__bnaviOfflineCoverage=()=>false;window.__bnaviMapBridge?.sync?.();message('この端末には地図データがまだありません');return}
 for(const record of records){
  activeByRegion.set(record.region,record);
  map.addSource(sourceId(record.region),sourceOptions(record));
 }
 addPoiIconImages(map);
 for(const layer of regionLayers(records,blueprints))map.addLayer(layer,anchor(map));
 applyPoiVisibility(map);
 removeLegacyRoads(map);
 if(map.getLayer('plain-background'))
  map.setPaintProperty('plain-background','background-color','#f7f5f0');
 currentKey=records.map(r=>r.key).join('|');
 window.__bikeLocalPmtilesActive=true;
 window.__bnaviOfflineCoverage=(lat,lon)=>records.some(r=>lat>=r.h.minLat&&lat<=r.h.maxLat&&lon>=r.h.minLon&&lon<=r.h.maxLon);
 window.__bnaviMapBridge?.sync?.();
 message('端末のカラー地図：'+records.map(r=>r.region).join('・')+'（'+records.length+'地方）');
}
function removeLegacyRoads(map){
 // v5.5 legacy region downloader used separate GeoJSON. Never draw it over PMTiles.
 if(map.getLayer('device-osm-roads-line'))map.removeLayer('device-osm-roads-line');
 if(map.getSource('device-osm-roads'))map.removeSource('device-osm-roads');
}
async function update(){
 const map=window.__bikeMap;
 if(!map){setTimeout(update,150);return}
 if(!map.isStyleLoaded())return;
 if(updating){rerun=true;return}
 updating=true;
 try{
  const available=await installedArchives();
  const key=available.map(r=>r.key).join('|');
  const complete=available.every(r=>map.getSource(sourcePrefix+r.region));
  if(key!==currentKey||!complete)renderAll(map,available);
 }catch(err){message('複数地方の地図描画エラー：'+err.message)}
 finally{
  updating=false;
  if(rerun){rerun=false;queueMicrotask(update)}
 }
}
function init(){
 const map=window.__bikeMap;
 if(!map){setTimeout(init,150);return}
 map.on('load',update);
 map.on('style.load',update);
 update();
}
init();
window.addEventListener('pageshow',e=>{if(!e.persisted)return;archiveCache.clear();currentKey='';update()});

window.addEventListener('bnavi:offline-maps-changed',()=>{archiveCache.clear();currentKey='';update()});
