/* Offline basemap adapter: MapLibre renders local PMTiles behind B_Navi's
 * existing touch, GPS and route SVG. BRouter routing is never modified. */
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const core=window.__bnaviMapCore;
const status=document.getElementById('offline-map-display-status');
if(!core)throw Error('B_Navi map engine has not initialized');
const background=document.createElement('div');
background.id='offline-map-background';
background.setAttribute('aria-hidden','true');
core.el.insertBefore(background,core.tiles);
const style={version:8,sources:{},layers:[{id:'plain-background',type:'background',paint:{'background-color':'#f7f5f0'}}]};
const vectorMap=new maplibregl.Map({
 container:background,style,interactive:false,
 // CSS overlays rotate clockwise by core.bearing; MapLibre camera bearing is the opposite sign.
 center:[core.lon,core.lat],zoom:Math.max(0,core.zoom-1),bearing:-core.bearing,
 attributionControl:false,pitchWithRotate:false,dragRotate:false,renderWorldCopies:false
});
window.__bikeMap=vectorMap;
let previous='',isOffline=false;
function sync(){
 const available=Boolean(window.__bikeLocalPmtilesActive&&window.__bnaviOfflineCoverage?.(core.lat,core.lon));
 core.offlineBaseLayerAvailable=available;
 if(isOffline!==available){isOffline=available;background.style.visibility=available?'visible':'hidden';core.schedule();}
 const key=[core.lat.toFixed(6),core.lon.toFixed(6),core.zoom,core.bearing.toFixed(2)].join(':');
 if(key!==previous){
  previous=key;
  vectorMap.jumpTo({center:[core.lon,core.lat],zoom:Math.max(0,core.zoom-1),bearing:-core.bearing});
 }
}
window.__bnaviMapBridge={sync,refresh:()=>window.dispatchEvent(new Event('bnavi:offline-maps-changed'))};
core.onMapFrame=sync;
vectorMap.on('error',e=>{if(status&&isOffline)status.textContent='保存地図の表示エラー：'+(e.error?.message||'不明なエラー')});
new ResizeObserver(()=>{vectorMap.resize();sync()}).observe(core.el);
sync();
try{await import('./offline-map-layer.mjs?v=20261126-fuel-store-v2')}catch(e){
 if(status)status.textContent='端末地図の読み込みができません：'+e.message;
 window.__bikeLocalPmtilesActive=false;window.__bnaviOfflineCoverage=()=>false;
 core.schedule();
}
