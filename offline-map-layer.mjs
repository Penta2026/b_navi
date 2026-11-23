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
function renderAll(map,records){
 removeCartography(map);
 if(!records.length){currentKey='';window.__bikeLocalPmtilesActive=false;window.__bnaviOfflineCoverage=()=>false;window.__bnaviMapBridge?.sync?.();message('この端末には地図データがまだありません');return}
 for(const record of records){
  activeByRegion.set(record.region,record);
  map.addSource(sourceId(record.region),sourceOptions(record));
 }
 for(const layer of regionLayers(records,blueprints))map.addLayer(layer,anchor(map));
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
