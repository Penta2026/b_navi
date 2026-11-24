/* B_Navi PC PWA: local interactive map + original Android-derived Java BRouter API.
 * Map tiles are visual only; they never decide vehicle permissions or routing.
 * Bridge reference and Kanmon push-walk lines MUST NOT be exported as riding GPX.
 */
'use strict';
const $=id=>document.getElementById(id);
const ROUTE_POLICIES=['ビギナー：狭い道と曲がりを抑え、走りやすい道を優先。','一般：適度な道幅と連続性を重視し、登録済み信号を強めに回避。','探索：市街地は走りやすい裏道、郊外は緑や水辺の近さを推定評価。','ファストトラベル：高速・有料道路を優先（126cc以上のみ）。'];
const MODES=[['ビギナー','一般','探索'],['ビギナー','一般','探索'],['ビギナー','一般','探索','ファストトラベル（高速・有料優先）']];
// Incrementing this generation invalidates any route calculation still in flight.
let routePlanVersion=0;
const state={shimanamiPlanPoints:[],shimanamiWebBuilt:false,navActive:false,navPaused:false,finishing:false,rerouting:false,targetIndex:0,activeTargets:[],arrivalPolicy:null,offRoutePolicy:null,motionGate:null,lastRerouteError:-Infinity,followGps:true,heading:{heading:null,at:-Infinity},orientation:'north',pick:'start',via:[],routes:[],currentGpx:null,location:null,watchId:null,routeType:null,gpsPoints:[],lastInputHash:'',turnCues:[],demoTimer:null,demoIndex:0,saidCues:new Set(),cumKm:[],islandLegs:[],islandIndex:0,awaitingBridge:false,gpsAccuracy:Infinity,shimanamiBigMode:false,manualDetour:null,manualDetourLegIndex:null,biwakoBridgeActive:false};
// A single tap is for map inspection only: it must never move S, G, or waypoints.
// Coordinates are committed through the long-press action menu (or explicit search/favorite/edit).
const map=new BNaviMapCore.MapCore($('map-container'),$('tile-layer'),$('map-overlay'),$('path-layer'),$('point-layer'),$('gps-layer'),null);
// The regional PMTiles basemap is a presentation layer only; all navigation stays here.
window.__bnaviMapCore=map;
// Basemap is calm-only for both route planning and live guidance.
// Ignore previously saved 'standard' preferences, without erasing any user data.
document.body.dataset.mapStyle='simple';

// The existing search/favorites action dialog is also used for a map long-press.
map.onLongPress=point=>window.BNaviSelectMapPoint?.(point);

// Rotation follows Android vf1: GPS bearing above 2m/s, at most ~1.2s updates,
// hold the previous trustworthy direction at a standstill. Button shows NEXT action.
function updateOrientationButton(){const btn=$('orientation-toggle');btn.textContent=state.orientation==='north'?'進行方向':'北を上';btn.setAttribute('aria-pressed',String(state.orientation==='head'));btn.setAttribute('aria-label',state.orientation==='north'?'進行方向を上にする':'北を上にする');}
function setOrientationMode(mode){state.orientation=mode==='head'?'head':'north';updateOrientationButton();map.setBearing(BNaviHeading.mapBearing(state.orientation,state.heading.heading));}
function updateHeadingFromPosition(pos){state.heading=BNaviHeading.acceptFix(state.heading,pos,performance.now());map.setGpsHeading(state.heading.heading);if(state.orientation==='head'&&Number.isFinite(state.heading.heading))map.setBearing(BNaviHeading.mapBearing('head',state.heading.heading));}
function receiveUserRotation(){state.orientation='manual';updateOrientationButton();}
map.onManualRotate=receiveUserRotation;map.onUserPan=()=>{state.followGps=false;};
$('orientation-toggle').addEventListener('click',()=>{setOrientationMode(state.orientation==='head'?'north':'head');if(state.orientation==='head'&&!Number.isFinite(state.heading.heading))showGpsMessage('進行方位を待っています。走行中にGPSから取得したら上向きに回します。',3300);});
updateOrientationButton();

function setMessage(message,error=false){$('message').textContent=message;$('message').classList.toggle('error',error);}
function setPick(kind){state.pick=kind;for(const btn of document.querySelectorAll('.pick'))btn.classList.toggle('active',btn.dataset.pick===kind);$('map-hint').textContent='地図を長押しし、表示されたメニューから地点を登録（PCは右クリック）';}
const placeLabels={};
function rememberPlaceLabel(coord,name){if(coord&&name){placeLabels[coord]=String(name).slice(0,100);try{localStorage.setItem('bnavi.placeLabels.v1',JSON.stringify(placeLabels))}catch{}}updatePointSummaries();}
function pointLabel(coord){return placeLabels[coord]||'地図で指定した地点';}
function updatePointSummaries(){for(const [id,title,mark] of [['start','出発地','●'],['goal','目的地','◆']]){const el=$(id+'-summary');if(el)el.textContent=mark+' '+title+'：'+($(id).value.trim()?pointLabel($(id).value.trim()):'未設定');}}
try{Object.assign(placeLabels,JSON.parse(localStorage.getItem('bnavi.placeLabels.v1')||'{}'))}catch{}
function fmt(p){return `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`;}
function parsePoint(s){const arr=s.trim().split(',').map(x=>Number(x.trim()));if(arr.length!==2||!arr.every(Number.isFinite)||arr[0]<20||arr[0]>46||arr[1]<122||arr[1]>154)throw new Error('地点は「緯度,経度」で入力してね（日本国内の座標）。');return arr;}
function inputPoint(id){return $(id).value.trim()?parsePoint($(id).value):null;}
let customEnabled=false; // legacy 3 sliders: never shown as a new-route option
let routePreferences=BNaviRouteTuning.normalizePreferences(null);
let biwakoBridgeSelected=false;
const OLD_STYLE_MIGRATION=Object.freeze({
 scenic:{view:'scenic'},efficient:{ride:'efficient'},backroad:{backroad:true},cruise:{ride:'cruise'}
});
const VIEW_NAMES=Object.freeze({normal:'そのまま',scenic:'景観優先',distance:'距離優先'});
const RIDE_NAMES=Object.freeze({normal:'そのまま',cruise:'快走優先',efficient:'効率優先'});
function selectedBaseMode(){const value=Number($('mode').value);return Number.isInteger(value)?value:1;}
function routingMode(){return customEnabled?1:selectedBaseMode();}
function currentPreferences(){return BNaviRouteTuning.normalizePreferences(routePreferences);}
function preferencesActive(){return !customEnabled&&(selectedBaseMode()<=2||(Number($('vehicle').value)===2&&selectedBaseMode()===3));}
function updateCustomRouteUI(){
 const panel=$('custom-route-panel'),p=currentPreferences();
 if(panel)panel.hidden=!preferencesActive();
 for(const input of document.querySelectorAll('input[name="route-view"]'))input.checked=input.value===p.view;
 for(const input of document.querySelectorAll('input[name="route-ride"]'))input.checked=input.value===p.ride;
 $('route-backroad').checked=p.backroad;
 $('route-coast').checked=p.coast;
 $('route-biwako-bridge').checked=biwakoBridgeSelected;
 if(document.getElementById('route-preference-toggle'))updateRoutePreferenceCollapseUI();
}
function preferenceSummary(){
 const p=currentPreferences(),parts=[];
 if(p.view!=='normal')parts.push(VIEW_NAMES[p.view]);
 if(p.ride!=='normal')parts.push(RIDE_NAMES[p.ride]);
 if(p.backroad)parts.push('裏道優先');
 if(p.coast)parts.push('海沿い優先（試験・水辺近似）');
 if(biwakoBridgeSelected)parts.push('琵琶湖大橋を経由');
 return parts.length?parts.join(' ＋ '):'追加オプションなし';
}
function updatePolicy(){
 const el=$('route-policy');if(!el)return;
 const mode=selectedBaseMode();
 el.textContent=customEnabled?ROUTE_POLICIES[1]+' 保存済みの詳細設定を適用中。'
  :ROUTE_POLICIES[mode]+(mode>2
   ?' 高速・有料優先のまま好みをソフト評価：'+preferenceSummary()+'。海沿いは水辺の推定評価で、海の眺望や高速を降りる地点は保証できません。'
   :' 信号回避は全モード共通で強化。＋ '+preferenceSummary()+'。快走できる地域道なら距離約20％増も検討する試験方針（上限・時間短縮の保証なし）。公開BRouter向け。');
}
function updateModes(){
 const i=Number($('vehicle').value),sel=$('mode'),prev=sel.value;
 sel.replaceChildren();
 MODES[i].forEach((m,n)=>{const o=document.createElement('option');o.value=String(n);o.textContent=m;sel.append(o);});
 sel.value=prev!==''&&MODES[i][Number(prev)]!==undefined&&prev!=='custom'?prev:'1';
 if(customEnabled)sel.value='1';
 updateCustomRouteUI();updatePolicy();
}
function chooseCustom(enabled,openPanel=false){
 // Older named tuning presets remain importable for existing saved routes.
 customEnabled=Boolean(enabled);
 if(customEnabled)$('mode').value='1';
 if(openPanel)$('route-tuning-panel').open=true;
 updateTuningUI();updateCustomRouteUI();updatePolicy();persist();
}
function updateRoutePreferenceCollapseUI(){
 const body=$('route-preference-body'),toggle=$('route-preference-toggle'),status=$('route-preference-collapsed-summary');
 const collapsed=body.hidden;
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.textContent=collapsed?'▾ オプションを開く':'▴ オプションをしまう';
 status.hidden=!collapsed;
 if(collapsed)status.textContent='現在の設定：'+preferenceSummary();
}
function bindRoutePreferenceToggle(){
 const body=$('route-preference-body');
 try{body.hidden=localStorage.getItem('bnavi.routeOptionsCollapsed.v1')==='1'}catch{}
 updateRoutePreferenceCollapseUI();
 $('route-preference-toggle').addEventListener('click',()=>{
  body.hidden=!body.hidden;
  updateRoutePreferenceCollapseUI();
  try{localStorage.setItem('bnavi.routeOptionsCollapsed.v1',body.hidden?'1':'0')}catch{}
 });
}
function bindRoutePreferenceHelp(){
 const dialog=$('route-preference-help-dialog');
 const open=$('route-preference-help-open');
 const close=$('route-preference-help-close');
 open.addEventListener('click',()=>{
  if(!dialog.open)dialog.showModal();
 });
 close.addEventListener('click',()=>dialog.close());
 // On mobile, tapping the backdrop closes the help without changing any option.
 dialog.addEventListener('click',e=>{
  if(e.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();
 });
 // Escape is handled by the native modal dialog. Focus returns to the ⓘ button.
}
function bindCustomRouteUI(){
 for(const input of document.querySelectorAll('input[name="route-view"],input[name="route-ride"]')){
  input.addEventListener('change',()=>{
   if(!input.checked)return;
   const kind=input.name==='route-view'?'view':'ride';
   routePreferences=BNaviRouteTuning.normalizePreferences({...routePreferences,[kind]:input.value});
   invalidateDisplayedRoute('好みのオプション');updateCustomRouteUI();updatePolicy();persist();
  });
 }
 $('route-backroad').addEventListener('change',()=>{
  routePreferences=BNaviRouteTuning.normalizePreferences({...routePreferences,backroad:$('route-backroad').checked});
  invalidateDisplayedRoute('裏道優先');updateCustomRouteUI();updatePolicy();persist();
 });
 $('route-coast').addEventListener('change',()=>{
  routePreferences=BNaviRouteTuning.normalizePreferences({...routePreferences,coast:$('route-coast').checked});
  invalidateDisplayedRoute('海沿い優先');updateCustomRouteUI();updatePolicy();persist();
 });
 $('route-biwako-bridge').addEventListener('change',()=>{
  biwakoBridgeSelected=$('route-biwako-bridge').checked;
  invalidateDisplayedRoute('琵琶湖大橋経由');updateCustomRouteUI();updatePolicy();persist();
 });
 updateCustomRouteUI();
}

// Independent tuning settings for each capacity. Original general BRFs are
// transmitted byte-for-byte at 0/0/0 with no 126cc exemptions.
const TUNING_STORE='bnavi.routeTuningByVehicle.v1';
const tuningByVehicle={0:BNaviRouteTuning.normalize(null,0),1:BNaviRouteTuning.normalize(null,1),2:BNaviRouteTuning.normalize(null,2)};
function loadTuning(){try{const obj=JSON.parse(localStorage.getItem(TUNING_STORE)||'{}');for(const vehicle of [0,1,2])tuningByVehicle[vehicle]=BNaviRouteTuning.normalize(obj?.[vehicle],vehicle);}catch{}}
function storeTuning(){try{localStorage.setItem(TUNING_STORE,JSON.stringify(tuningByVehicle))}catch{}}
function tuningNow(){const vehicle=Number($('vehicle').value);return BNaviRouteTuning.normalize(tuningByVehicle[vehicle],vehicle);}
function tuningDescription(v,vehicle){
 if(BNaviRouteTuning.isDefault(v,vehicle))return '現在：一般ルート（変更なし）';
 const values=[v.explore,v.width,v.scenic].map(x=>(x>0?'+':'')+x);
 return 'カスタム '+values.join(' / ')+(vehicle===2&&v.allowMotorway?'・高速':'')+(vehicle===2&&v.allowToll?'・有料':'');
}
function updateTuningUI(){
 const vehicle=Number($('vehicle').value),v=tuningNow();
 for(const [key,id] of [['explore','tune-explore'],['width','tune-width'],['scenic','tune-scenic']]){
  $(id).value=String(v[key]);$(id+'-value').textContent=v[key]===0?'基準 0':(v[key]>0?'+':'')+v[key];
 }
 $('tune-big-options').hidden=vehicle!==2;
 $('tune-motorway').checked=v.allowMotorway;$('tune-toll').checked=v.allowToll;
 $('tuning-enabled').checked=customEnabled;
 $('tuning-tag').textContent=customEnabled?'ON：一般を調整':'OFF';
 $('route-tuning-panel').dataset.active=String(customEnabled);
 $('tuning-status').textContent=customEnabled?tuningDescription(v,vehicle):'カスタマイズOFF（調整値は保持）';
 $('tuning-reset').disabled=BNaviRouteTuning.isDefault(v,vehicle);
}
function bindTuning(){
 loadTuning();updateTuningUI();
 $('tuning-enabled').addEventListener('change',()=>chooseCustom($('tuning-enabled').checked));
 for(const [key,id] of [['explore','tune-explore'],['width','tune-width'],['scenic','tune-scenic']]){
   $(id).addEventListener('input',()=>{const vehicle=Number($('vehicle').value);tuningByVehicle[vehicle][key]=BNaviRouteTuning.normalize({[key]:Number($(id).value)},vehicle)[key];storeTuning();chooseCustom(true);});
 }
 for(const [key,id] of [['allowMotorway','tune-motorway'],['allowToll','tune-toll']]){
   $(id).addEventListener('change',()=>{const vehicle=Number($('vehicle').value);if(vehicle!==2)return;tuningByVehicle[vehicle][key]=$(id).checked;storeTuning();chooseCustom(true);});
 }
 $('tuning-reset').addEventListener('click',()=>{const vehicle=Number($('vehicle').value);tuningByVehicle[vehicle]=BNaviRouteTuning.normalize(null,vehicle);storeTuning();updateTuningUI();});
}
// Named presets are separate from the autosaved per-vehicle editing state.
// Loading a preset only changes UI/routing preferences: it does not silently
// replace a planned route, the active navigation, or a recorded GPX track.
let savedRoutePresets=[];
function persistPresets(next){localStorage.setItem(BNaviRoutePresets.KEY,BNaviRoutePresets.pack(next));savedRoutePresets=next;}
function presetStatus(message,error=false){const el=$('preset-status');el.textContent=message;el.classList.toggle('error',!!error);}
function presetSelected(){return savedRoutePresets.find(x=>x.id===$('preset-select').value&&x.vehicle===Number($('vehicle').value));}
function updatePresetUI(selectId){
 const select=$('preset-select'),oldId=selectId===undefined?select.value:selectId;
 const filtered=BNaviRoutePresets.forVehicle(savedRoutePresets,Number($('vehicle').value));
 select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=filtered.length?'設定を選んでね':'保存した設定はまだありません';select.append(placeholder);
 filtered.forEach(entry=>{const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option);});
 select.value=filtered.some(x=>x.id===oldId)?oldId:'';
 $('preset-count').textContent=filtered.length+'件';
 $('preset-load').disabled=!select.value;$('preset-delete').disabled=!select.value;
}
function bindPresetUI(){
 try{savedRoutePresets=BNaviRoutePresets.read(localStorage.getItem(BNaviRoutePresets.KEY))}catch{savedRoutePresets=[]}
 updatePresetUI();
 $('preset-select').addEventListener('change',()=>{
  const selected=presetSelected();
  $('preset-load').disabled=!selected;$('preset-delete').disabled=!selected;
  if(selected){$('preset-name').value=selected.name;presetStatus(selected.name+'：選択中。読み込みボタンで調整値を反映します。');}
 });
 $('preset-save').addEventListener('click',()=>{
  try{
   const name=$('preset-name').value,vehicle=Number($('vehicle').value);
   let result;
   try{result=BNaviRoutePresets.upsert(savedRoutePresets,name,vehicle,tuningNow());}
   catch(err){
    if(err.message==='同じ名前の設定があります。'){
     if(!window.confirm('「'+BNaviRoutePresets.nameOf(name)+'」を現在の調整値で上書きする？'))return;
     result=BNaviRoutePresets.upsert(savedRoutePresets,name,vehicle,tuningNow(),{overwrite:true});
    }else throw err;
   }
   persistPresets(result.items);updatePresetUI(result.item.id);
   $('route-preset-panel').open=true;
   presetStatus('「'+result.item.name+'」を'+(result.replaced?'上書き':'保存')+'したよ。この車種でいつでも呼び出せます。');
  }catch(err){presetStatus('保存できませんでした：'+err.message,true)}
 });
 $('preset-load').addEventListener('click',()=>{
  const selected=presetSelected();if(!selected)return;
  const vehicle=Number($('vehicle').value);
  tuningByVehicle[vehicle]=BNaviRouteTuning.normalize(selected.tuning,vehicle);storeTuning();chooseCustom(true,true);
  $('preset-name').value=selected.name;
  presetStatus('「'+selected.name+'」を読み込んだよ。「ルート検索」でこの設定を使えます。');
 });
 $('preset-delete').addEventListener('click',()=>{
  const selected=presetSelected();if(!selected)return;
  if(!window.confirm('「'+selected.name+'」を保存済み設定から削除する？（現在のスライダー値はそのまま）'))return;
  try{persistPresets(BNaviRoutePresets.remove(savedRoutePresets,selected.id));updatePresetUI('');$('preset-name').value='';presetStatus('「'+selected.name+'」を削除したよ。現在の調整値は変わっていません。');}
  catch(err){presetStatus('削除できませんでした：'+err.message,true)}
 });
 $('preset-export').addEventListener('click',()=>{
  try{
   if(!savedRoutePresets.length){presetStatus('書き出す保存済み設定がまだないよ。',true);return;}
   const data=BNaviRoutePresets.backup(savedRoutePresets),blob=new Blob([data],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='B_Navi_ルート設定_'+new Date().toISOString().slice(0,10)+'.json';
   document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   presetStatus('全車種の保存済み設定をJSONで書き出しました。');
  }catch(err){presetStatus('書き出せませんでした：'+err.message,true)}
 });
 $('preset-import').addEventListener('click',()=>$('preset-import-file').click());
 $('preset-import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>200*1024)throw Error('200KB以下のJSONファイルを選んでね。');
   const merged=BNaviRoutePresets.importBackup(savedRoutePresets,await file.text());
   persistPresets(merged.items);updatePresetUI('');
   presetStatus('バックアップ読み込み：追加'+merged.added+'件、同名などでスキップ'+merged.skipped+'件。現在の調整値は変えていません。');
  }catch(err){presetStatus('読み込めませんでした：'+err.message,true)}
  finally{event.target.value='';}
 });
}
function renderVia(){const el=$('via-list');el.replaceChildren();state.via.forEach((v,i)=>{const row=document.createElement('div');row.className='via-row';const info=document.createElement('div');info.className='via-info';const label=document.createElement('strong');label.textContent=(i+1)+'. '+pointLabel(v);info.append(label);const details=document.createElement('details');details.className='coordinate-details';const summary=document.createElement('summary');summary.textContent='座標を確認・編集';details.append(summary);const input=document.createElement('input');input.setAttribute('aria-label',`経由地${i+1}の座標`);input.value=v;input.placeholder='緯度,経度';input.addEventListener('input',()=>{state.via[i]=input.value;label.textContent=(i+1)+'. '+pointLabel(input.value);refreshMap();persist();});details.append(input);info.append(details);row.append(info);for(const [sym,title,action] of [['↑','上へ',()=>swapVia(i,i-1)],['↓','下へ',()=>swapVia(i,i+1)],['×','削除',()=>{state.via.splice(i,1);renderVia();refreshMap();persist();}]]){const b=document.createElement('button');b.textContent=sym;b.type='button';b.title=title;b.setAttribute('aria-label',`経由地${i+1}を${title}`);b.disabled=(sym==='↑'&&i===0)||(sym==='↓'&&i===state.via.length-1);b.addEventListener('click',action);row.append(b);}el.append(row);});$('via-count').textContent=String(state.via.length);updatePointSummaries();}
function swapVia(a,b){if(b<0||b>=state.via.length)return;[state.via[a],state.via[b]]=[state.via[b],state.via[a]];renderVia();refreshMap();persist();}
function getMarkers(){const markers=[];try{const p=inputPoint('start');if(p)markers.push({point:p,label:'出発',symbol:'S',color:'#15955f'});}catch{}state.via.forEach((str,i)=>{try{markers.push({point:parsePoint(str),label:'経由'+(i+1),symbol:String((i+1)%10),color:'#df9237'});}catch{}});try{const p=inputPoint('goal');if(p)markers.push({point:p,label:'目的地',symbol:'G',color:'#cc4f57'});}catch{}return markers;}
function refreshMap(){
 // Free ride hides ONLY the planned route geometry, never its data or markers.
 // Preserve S/G, via, GPX and the current route for normal navigation after a ride.
 const paths=document.body.classList.contains('free-ride-active')?[]:state.routes;
 map.setData(paths,getMarkers(),state.location);
}
function persist(){try{localStorage.setItem('bnavi.pc.v1',JSON.stringify({start:$('start').value,goal:$('goal').value,via:state.via,vehicle:$('vehicle').value,mode:$('mode').value,customEnabled,routePreferences:currentPreferences()}));}catch{}}
function restore(){try{
 const x=JSON.parse(localStorage.getItem('bnavi.pc.v1')||'null');if(!x)return;
 $('start').value=x.start||'';$('goal').value=x.goal||'';state.via=Array.isArray(x.via)?x.via.slice(0,50).map(String):[];
 $('vehicle').value=['0','1','2'].includes(x.vehicle)?x.vehicle:'1';
 // The old three-slider UI is retired. Keep its saved data intact but do
 // not silently enable a hidden legacy configuration when restoring this PWA.
 const v=Number($('vehicle').value);
 customEnabled=false;
 // Upgrade old single-style "custom" selection into independent preferences.
 routePreferences=BNaviRouteTuning.normalizePreferences(x.routePreferences ??
   (x.mode==='custom'&&OLD_STYLE_MIGRATION[x.customRouteStyle]) ?? null);
 biwakoBridgeSelected=false; // Do not restore a hidden, previously selected bridge option.
 updateModes();
 const savedMode=String(x.mode??'1');
 if(savedMode!=='custom'&&MODES[v][Number(savedMode)]!==undefined)$('mode').value=savedMode;
 else $('mode').value='1';
 updateCustomRouteUI();updatePolicy();
}catch{}}
function getRequestPoints(){if(!$('start').value.trim()||!$('goal').value.trim())throw new Error('出発地と目的地は、地図の長押しメニューや検索から登録してね。');const a=[parsePoint($('start').value)];for(const text of state.via)a.push(parsePoint(text));a.push(parsePoint($('goal').value));if(a.length>52)throw new Error('地点が多すぎます。');return a;}
function gpxTurnCues(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');return [...doc.getElementsByTagNameNS('*','rtept')].map(n=>{const d=n.getElementsByTagNameNS('*','desc')[0]?.textContent||'';const offsetNode=n.getElementsByTagNameNS('*','offset')[0];return {desc:d,offset:offsetNode?Number(offsetNode.textContent):NaN,lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon'))};}).filter(x=>Number.isFinite(x.offset)&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));}
function gpxPoints(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('GPXの解析に失敗しました');let nodes=[...doc.getElementsByTagNameNS('*','trkpt')];if(!nodes.length)nodes=[...doc.getElementsByTagNameNS('*','rtept')];const pts=nodes.map(x=>[Number(x.getAttribute('lat')),Number(x.getAttribute('lon'))]).filter(x=>x.every(Number.isFinite));if(pts.length<2)throw new Error('GPXに道路の軌跡点がありません。');return pts;}
function km(a,b){const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;const t=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(t)));}
function distance(pts){let sum=0;for(let i=1;i<pts.length;i++)sum+=km(pts[i-1],pts[i]);return sum;}
function sampled(pts,max=6500){if(pts.length<=max)return pts;const step=Math.ceil(pts.length/max);const a=pts.filter((_,i)=>i%step===0);if(a.at(-1)!==pts.at(-1))a.push(pts.at(-1));return a;}
function routeView(type,sections,mainGpx,msg,options={}){state.biwakoBridgeActive=false;state.manualDetour=null;state.islandLegs=[];state.islandIndex=0;state.awaitingBridge=false;state.routeType=type;state.currentGpx=mainGpx||null;state.routes=sections.filter(x=>x.points?.length>=2).map(x=>({...x,points:sampled(x.points)}));state.gpsPoints=['normal','imported'].includes(type)?sections[0]?.points||[]:[];state.turnCues=['normal','imported'].includes(type)&&mainGpx?gpxTurnCues(mainGpx):[];state.saidCues=new Set();state.cumKm=[];for(let i=0;i<state.gpsPoints.length;i++)state.cumKm[i]=(state.cumKm[i-1]||0)+(i?km(state.gpsPoints[i-1],state.gpsPoints[i]):0);$('demo-on').disabled=!['normal','imported'].includes(type);$('demo-off').disabled=true;$('save-gpx').disabled=!mainGpx;
 const road=sections.filter(x=>x.type!=='bridge'&&x.type!=='walk'),len=road.reduce((a,b)=>a+distance(b.points),0);const bad=sections.filter(x=>x.type==='bridge'||x.type==='walk').length;
 $('route-label').textContent=type==='normal'?'通常道路':type==='shimanami'?'しまなみ島内':type==='kanmon50'?'関門・人道':'ルート';
 $('metrics').innerHTML='';const metric=document.createElement('div');const bold=document.createElement('strong');bold.textContent=`${len.toFixed(1)} km`;metric.append(bold);const sub=document.createElement('div');sub.textContent=`道路区間 ${road.length} 本　/　参考区間 ${bad} 本`;metric.append(sub);$('metrics').append(metric);
 const list=$('route-segments');list.replaceChildren();sections.forEach((sec,i)=>{const row=document.createElement('div');row.className='segment';const text=document.createElement('div');text.textContent=sec.label||`区間${i+1}`;if(sec.type==='bridge'||sec.type==='walk'){const s=document.createElement('span');s.className='sub';s.textContent=sec.type==='walk'?'押し歩き（走行GPX対象外）':'橋の参考線（走行GPX対象外）';text.append(s);}const btn=document.createElement('button');btn.type='button';btn.textContent=sec.gpx?'GPX':'表示';btn.addEventListener('click',()=>{map.fit(sec.points);if(sec.gpx)downloadGpx(sec.gpx,`B_Navi_${i+1}_${sanitizeName(sec.label||'route')}.gpx`);});row.append(text,btn);list.append(row);});
 $('shimanami-desk-tools').hidden=type!=='shimanami';
 refreshMap();if(!options.keepView)fitResult();setMessage(msg);syncNavigationButtons();if(!options.keepView)window.BNaviCloseRouteSheet?.();if(type==='normal'||type==='imported')queueOfflineSave();}
function sanitizeName(text){return text.replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,36);}
function downloadGpx(xml,name){const blob=new Blob([xml],{type:'application/gpx+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function fitResult(){const points=state.routes.flatMap(x=>x.points);if(points.length)map.fit(sampled(points,4000));else fitMarkers();}
function fitMarkers(){const x=getMarkers().map(m=>m.point);if(x.length)map.fit(x);}
function clearResult(){state.biwakoBridgeActive=false;state.manualDetour=null;state.manualDetourLegIndex=null;state.shimanamiBigMode=false;$('shimanami-desk-tools').hidden=true;state.shimanamiPlanPoints=[];state.shimanamiWebBuilt=false;stopVoiceGuidance(false);stopDemo();state.islandLegs=[];state.islandIndex=0;state.awaitingBridge=false;state.turnCues=[];state.cumKm=[];$('demo-on').disabled=true;$('demo-off').disabled=true;state.routeType=null;state.currentGpx=null;state.routes=[];state.gpsPoints=[];$('save-gpx').disabled=true;$('route-label').textContent='未計算';$('metrics').textContent='計算すると距離や経路が表示されるよ。';$('route-segments').replaceChildren();refreshMap();syncNavigationButtons();}
function invalidateDisplayedRoute(label){
 // Displayed geometry is a snapshot of its calculated vehicle and profile.
 // Never silently reuse a 125cc moped bridge for a 126cc+ bike.
 if(!state.routeType&&!state.routes.length&&!$('calculate').disabled)return false;
 ++routePlanVersion;
 settleBigDecision(null);
 if(offlineSaveTimer!==null){clearTimeout(offlineSaveTimer);offlineSaveTimer=null;}
 if(state.navActive)stopVoiceGuidance(true);
 clearResult();
 $('calculate').disabled=false;
 setMessage(label+'を変更したので前の経路を解除したよ。出発地・経由地・目的地は残してあるので、ルート検索で再計算してね。');
 return true;
}
function freeRideInProgress(){
 return window.BNaviRideMode?.getMode?.()==='free'||
  document.body.classList.contains('free-ride-active');
}
async function swapEndpointsAndClearVias(){
 const oldStart=$('start').value,oldGoal=$('goal').value;
 if(!oldStart.trim()&&!oldGoal.trim()){setMessage('交換する出発地・目的地がまだないよ。');return false;}
 if(freeRideInProgress()){setMessage('フリー走行中は出発地と目的地を交換できません。走行を終了してから操作してね。',true);return false;}
 const button=$('swap-endpoints'),calculateButton=$('calculate');
 if(button.disabled)return false;
 button.disabled=true;calculateButton.disabled=true;
 const version=++routePlanVersion;
 settleBigDecision(null);
 if(offlineSaveTimer!==null){clearTimeout(offlineSaveTimer);offlineSaveTimer=null;}
 if(state.navActive)stopVoiceGuidance(true);
 clearResult();
 $('start').value=oldGoal;$('goal').value=oldStart;
 state.via=[];
 renderVia();updatePointSummaries();setPick('start');refreshMap();fitMarkers();persist();
 let clearError=null;
 try{
  // Invalidate the previous route auto-restore; named My Routes remain untouched.
  await BNaviOfflineRouteStore.clear();
  if(version===routePlanVersion)$('offline-status').textContent='前の一時保存ルートを解除したよ。マイルート集は残っています。';
 }catch(error){clearError=String(error?.message||error);if(version===routePlanVersion)$('offline-status').textContent='一時保存ルートを解除できませんでした：'+clearError;}
 finally{
  button.disabled=false;
  if(version===routePlanVersion){
   calculateButton.disabled=false;
   setMessage(clearError?
    '出発地と目的地を交換し、経由地をすべてクリアしたよ。ただし前回の一時保存ルートを削除できませんでした：'+clearError:
    '出発地と目的地を交換し、経由地をすべてクリアしたよ。新しい向きのルートは「ルート検索」で再計算してね。',Boolean(clearError));
  }
 }
 return true;
}
function hasRoutePlan(){
 return Boolean($('start').value.trim()||$('goal').value.trim()||state.via.length||
  state.routeType||state.routes.length||$('calculate').disabled);
}
function requestFullRouteClear(){
 if(freeRideInProgress()){
  setMessage('フリー走行中はルートをクリアできません。走行を終了してから操作してね。',true);
  return;
 }
 if(!hasRoutePlan()){setMessage('クリアするルートはまだないよ。');return;}
 const dialog=$('route-clear-confirm-dialog');
 $('route-clear-confirm-description').textContent=state.navActive?
  '音声案内とGPS追従を終了して、出発地・目的地・経由地と現在のルートをすべてクリアするよ。':
  '出発地・目的地・経由地と現在のルートをすべてクリアするよ。';
 if(!dialog.open)dialog.showModal();
}
async function clearFullRoutePlan(){
 // This is called ONLY after the user taps "クリアする" in our own modal.
 // Mobile installed PWAs may suppress window.confirm(): never depend on it.
 if(freeRideInProgress()){
  setMessage('フリー走行中はルートをクリアできません。走行を終了してから操作してね。',true);
  return;
 }
 if(!hasRoutePlan()){setMessage('クリアするルートはまだないよ。');return;}
 const version=++routePlanVersion;
 if(offlineSaveTimer!==null){clearTimeout(offlineSaveTimer);offlineSaveTimer=null;}
 if(state.navActive)stopVoiceGuidance(true);
 clearResult();
 $('start').value='';$('goal').value='';state.via=[];
 state.activeTargets=[];state.targetIndex=0;state.lastInputHash='';
 state.activeRouteTuning=null;state.customRouting=false;
 renderVia();updatePointSummaries();setPick('start');refreshMap();persist();
 $('calculate').disabled=false;
 setMessage('ルートをクリアしたよ。次の出発地と目的地を選んでね。');
 try{
  await BNaviOfflineRouteStore.clear();
  if(version===routePlanVersion)$('offline-status').textContent='一時保存ルートをクリアしました。マイルートの保存データは残っています。';
 }catch(e){
  if(version===routePlanVersion){
   const message='画面はクリアしたよ。ただし一時保存ルートを消せませんでした：'+String(e?.message||e);
   $('offline-status').textContent=message;setMessage(message,true);
  }
 }
}
function bindFullRouteClear(){
 const dialog=$('route-clear-confirm-dialog');
 $('clear-route-plan').addEventListener('click',requestFullRouteClear);
 $('route-clear-dialog-cancel').addEventListener('click',()=>dialog.close());
 $('route-clear-dialog-confirm').addEventListener('click',()=>{
  dialog.close();
  clearFullRoutePlan().catch(e=>setMessage('クリア処理に失敗しました：'+String(e?.message||e),true));
 });
}
const API_CONFIG_KEY='bnavi.routeApiBase.v1';
function hostedOnPages(){return location.hostname.endsWith('.github.io')}
function usePublicBrouter(){return hostedOnPages()&&!(localStorage.getItem(API_CONFIG_KEY)||'').trim()}
let biwakoDecisionResolver=null;
function settleBiwakoDecision(value){
 const fn=biwakoDecisionResolver;if(!fn)return;
 biwakoDecisionResolver=null;
 const dialog=$('biwako-bridge-confirm-dialog');
 if(dialog.open)dialog.close();
 fn(value);
}
function bindBiwakoDecisionDialog(){
 $('biwako-bridge-confirm-accept').addEventListener('click',()=>settleBiwakoDecision('bridge'));
 $('biwako-bridge-confirm-normal').addEventListener('click',()=>settleBiwakoDecision('normal'));
 $('biwako-bridge-confirm-close').addEventListener('click',()=>settleBiwakoDecision(null));
 $('biwako-bridge-confirm-dialog').addEventListener('close',()=>settleBiwakoDecision(null));
}
function askBiwakoDecision(){
 const d=$('biwako-bridge-confirm-dialog');
 if(d.open||biwakoDecisionResolver)return Promise.resolve(null);
 return new Promise(resolve=>{biwakoDecisionResolver=resolve;d.showModal();});
}
let bigDecisionResolver=null;
function settleBigDecision(value){
 const fn=bigDecisionResolver;if(!fn)return;
 bigDecisionResolver=null;
 const dialog=$('shimanami-big-confirm-dialog');
 if(dialog.open)dialog.close();
 fn(value);
}
function bindShimanamiBigDialog(){
 $('shimanami-big-confirm-accept').addEventListener('click',()=>settleBigDecision('cross'));
 $('shimanami-big-confirm-normal').addEventListener('click',()=>settleBigDecision('normal'));
 $('shimanami-big-confirm-close').addEventListener('click',()=>settleBigDecision(null));
 $('shimanami-big-confirm-dialog').addEventListener('close',()=>settleBigDecision(null));
}
function askBigDecision(){
 const d=$('shimanami-big-confirm-dialog');
 if(d.open||bigDecisionResolver)return Promise.resolve(null);
 return new Promise(resolve=>{bigDecisionResolver=resolve;d.showModal();});
}
async function queryBigShimanami(points,mode,tuning,version){
 if(typeof BNaviShimanamiBigRouter==='undefined'||typeof BNaviBridgeReferences==='undefined')
  throw Error('しまなみ126cc以上の道路検証モジュールがありません');
 return BNaviShimanamiBigRouter.compose(points,mode,tuning,{
  refs:BNaviBridgeReferences,
  query:(pair,m,custom)=>BNaviPublicBrouter.query(pair,2,m,fetch,
   progress=>{if(version===routePlanVersion)setMessage(progress.message);},custom),
  onProgress:step=>{if(version===routePlanVersion)setMessage('しまなみ '+step.index+'/'+step.total+'区間：'+(step.crossing?'島渡り（高速・有料）':'一般道')+'を計算中…');}
 });
}
async function calculateBigShimanami(points,version){
 const result=await queryBigShimanami(points,state.activeRoutingMode,state.activeRouteTuning,version);
 if(version!==routePlanVersion)return;
 routeView('normal',[{type:'road',points:result.track.points,color:'#06799b',width:5,label:'しまなみ島渡り（126cc以上・実道路計算）',gpx:result.gpx}],result.gpx,
  'しまなみ島渡り：島渡り'+result.crossingLegs+'区間・橋'+result.bridgeCount+'本。島を渡る区間のみ高速・有料を許可したよ。現地のIC・交通規制は標識を確認してね。');
 state.shimanamiBigMode=true;
 $('route-label').textContent='しまなみ島渡り';
}
function needsDedicatedApi(points){
 // Public BRouter has no B_Navi-specific island-bridge or tunnel-push API.
 const inShimanami=p=>p[0]>=34.0&&p[0]<=34.45&&p[1]>=132.88&&p[1]<=133.26;
 const inKanmon=p=>p[0]>=33.89&&p[0]<=34.04&&p[1]>=130.8&&p[1]<=131.10;
 const longTrip=(km(points[0],points.at(-1))>8);
 return Number($('vehicle').value)<=1&&longTrip&&
   ((points.every(inShimanami))||(points.every(inKanmon)));
}
async function calculatePublicRoute(points,version){
 if(needsDedicatedApi(points))throw Error('しまなみ・関門の原付専用案内は公開BRouterでは再現できません。専用B_Navi Javaサーバー接続が必要です。');
 if(typeof BNaviPublicBrouter==='undefined')throw Error('経路計算プログラムを読み込めません。アプリを再読み込みしてね。');
 setMessage('公開BRouter：経路計算の準備中…');
 const result=await BNaviPublicBrouter.query(points,$('vehicle').value,state.activeRoutingMode,fetch,progress=>{if(version===routePlanVersion)setMessage(progress.message);},state.activeRouteTuning);
  if(version!==routePlanVersion)return;
 // Verify that the remote route actually passes every requested intermediate stop.
 // A matching start/end alone is not sufficient for an ordered itinerary.
 if(points.length>2){
  const missed=points.slice(1,-1).map((p,i)=>({n:i+1,d:BNaviRideLogic.distanceToPolyline(p,result.track.points)})).filter(v=>v.d>300);
  if(missed.length)throw Error('経由地'+missed.map(x=>x.n).join('、')+'を通る道路経路が取得できません（300m以上離れています）。場所とルートを確認してね。');
 }
 if(biwakoBridgeSelected)BNaviBiwakoBridge.verify(result.track.points);
 routeView('normal',[{type:'road',points:result.track.points,color:'#06799b',width:5,label:biwakoBridgeSelected?'琵琶湖大橋を通る道路ルート':'BRouterで計算した道路ルート',gpx:result.gpx}],result.gpx,
   'BRouter経路を計算しました：'+result.profile+'（通信・計算 '+(result.elapsedMs/1000).toFixed(1)+'秒）。GPXと案内指示を端末に保存。道路規制・適法性は未検証。'+(biwakoBridgeSelected?'琵琶湖大橋（有料）を経由指定し、湖の両岸へ道路がつながることを確認。':'')+(state.activeRouteTuning?.preferences?.coast?'海沿い優先は水辺の推定値による試験評価で、海岸線・眺望は未検証。':'')+(!result.track.cues.length?'今回は音声用右左折指示が返りませんでした。':''));
 state.biwakoBridgeActive=biwakoBridgeSelected;
}

function apiRoot(){
 const configured=(localStorage.getItem(API_CONFIG_KEY)||'').trim();
 if(configured){const url=new URL(configured);if(url.protocol!=='https:'&&!(url.hostname==='localhost'&&url.protocol==='http:'))throw Error('経路サーバーはHTTPSのURLを指定してください');return url.href.endsWith('/')?url.href:url.href+'/'}
 if(hostedOnPages())throw Error('オンライン経路サーバーが未設定です。「オンライン経路計算の接続設定」からHTTPS APIを指定してね。');
 return new URL('./',location.href).href;
}
function apiUrl(path){return new URL('api/'+path,apiRoot()).href}
function updateApiSettings(){const u=localStorage.getItem(API_CONFIG_KEY)||'';$('route-api-base').value=u;$('route-api-status').textContent=u?'接続先：'+u:(hostedOnPages()?'通常経路は公開BRouterを使用。しまなみ7島内では島内道路を分割計算し、6橋の原付通路参考線とつなぎます。橋の通行可否は現地標識を優先。関門専用処理には別のAPIが必要です。':'この端末のローカルJavaサーバーを利用します。')}
$('route-api-save').addEventListener('click',()=>{try{const raw=$('route-api-base').value.trim();if(!raw)throw Error('URLを入力してください');const url=new URL(raw);if(url.protocol!=='https:'&&!(url.hostname==='localhost'&&url.protocol==='http:'))throw Error('HTTPSのURLを指定してください');localStorage.setItem(API_CONFIG_KEY,url.href);updateApiSettings();refreshServer()}catch(e){$('route-api-status').textContent='設定エラー：'+e.message}});
$('route-api-clear').addEventListener('click',()=>{localStorage.removeItem(API_CONFIG_KEY);updateApiSettings();refreshServer()});
updateApiSettings();
async function postApi(path,points){const form=new URLSearchParams({vehicle:$('vehicle').value,mode:String(state.activeRoutingMode??routingMode()),points:points.map(fmt).join('|')});const response=await fetch(apiUrl(path),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});const text=await response.text();if(!response.ok)throw new Error(text.slice(0,300));return {response,text};}
async function calculate(){const version=++routePlanVersion;const btn=$('calculate');btn.disabled=true;clearResult();biwakoBridgeSelected=false;updateCustomRouteUI();updatePolicy();try{
 const userPoints=getRequestPoints();
 state.activeRoutingVehicle=Number($('vehicle').value);state.activeRoutingMode=routingMode();
  // Search-time geographic screening; actual bridge crossing is verified after routing.
  if(!biwakoBridgeSelected&&usePublicBrouter()&&
     typeof BNaviBiwakoBridge!=='undefined'&&typeof BNaviBiwakoBridge.potential==='function'&&
     BNaviBiwakoBridge.potential(userPoints)&&
     !(typeof BNaviShimanamiBigRouter!=='undefined'&&BNaviShimanamiBigRouter.potential(userPoints,2))&&
     !(typeof BNaviShimanamiWebRouter!=='undefined'&&BNaviShimanamiWebRouter.needsSpecialJourney(userPoints,state.activeRoutingVehicle))){
   const answer=await askBiwakoDecision();
   if(version!==routePlanVersion)return;
   if(answer===null){setMessage('琵琶湖大橋の選択を閉じたので、探索を中止したよ。');return;}
   biwakoBridgeSelected=answer==='bridge';
   updateCustomRouteUI();updatePolicy();
  }
 if(biwakoBridgeSelected&&(!usePublicBrouter()||typeof BNaviBiwakoBridge==='undefined'))
  throw Error('琵琶湖大橋の経由指定は公開BRouter専用です。PWAの更新・経路API設定を確認してね');
 if(biwakoBridgeSelected&&(
   (typeof BNaviShimanamiBigRouter!=='undefined'&&BNaviShimanamiBigRouter.potential(userPoints,2))||
   (typeof BNaviShimanamiWebRouter!=='undefined'&&BNaviShimanamiWebRouter.needsSpecialJourney(userPoints,state.activeRoutingVehicle))))
  throw Error('しまなみ専用の橋渡りと同時には選べません。琵琶湖大橋の指定をOFFにしてね');
 const points=biwakoBridgeSelected?BNaviBiwakoBridge.plan(userPoints).points:userPoints;
 const wantsOptions=preferencesActive();
 const p=currentPreferences();
 const isFast=state.activeRoutingMode===3;
 const nonDefaultOptions=p.view!=='normal'||p.ride!=='normal'||p.backroad||p.coast;
 if(!usePublicBrouter()&&nonDefaultOptions&&!customEnabled)throw Error('追加オプションは公開BRouterでのみ利用できます。専用Java API接続を解除してね。');
 const useExtraPreferences=wantsOptions&&usePublicBrouter()&&(!isFast||nonDefaultOptions);
 state.customRouting=customEnabled||useExtraPreferences;
 state.activeRouteTuning=useExtraPreferences
   ?BNaviRouteTuning.normalize({preferences:p},state.activeRoutingVehicle)
   :(customEnabled?tuningNow():null);
 if(biwakoBridgeSelected&&state.activeRoutingMode!==3)
  state.activeRouteTuning=BNaviRouteTuning.normalize({...state.activeRouteTuning,biwakoBridgeToll:true},state.activeRoutingVehicle);
 persist();
 // Never silently enable toll roads: only explicit user confirmation permits island legs.
 if(usePublicBrouter()&&state.activeRoutingVehicle===2&&
    typeof BNaviShimanamiBigRouter!=='undefined'&&BNaviShimanamiBigRouter.potential(points,2)){
  const choice=await askBigDecision();
  if(version!==routePlanVersion)return;
  if(choice===null){setMessage('しまなみ島渡りの確認を閉じたので、探索を中止したよ。');return;}
  if(choice==='cross'){await calculateBigShimanami(points,version);return;}
 }
 if(!usePublicBrouter()&&customEnabled&&!BNaviRouteTuning.isDefault(state.activeRouteTuning,state.activeRoutingVehicle))throw Error('保存済みの詳細ルート調整は、現在の経路サーバーに対応していません。');setMessage('BRouter計算中。道路データを照合しています…');
 if(usePublicBrouter()){
   if(Number($('vehicle').value)<=1&&(typeof BNaviShimanamiWebRouter==='undefined'||typeof BNaviShimanamiWebRouter.journeyRegion!=='function'))throw Error('しまなみ判定モジュールが読み込まれていません。アプリを再読み込みしてね。');
   if(typeof BNaviShimanamiWebRouter!=='undefined'&&BNaviShimanamiWebRouter.needsSpecialJourney(points,$('vehicle').value))await calculateShimanamiWeb(points,version);
   else await calculatePublicRoute(points,version);
   return;
 }
  // Each waypoint is mandatory and stays in the requested order. A Shimanami
  // crossing is handled one pair at a time, including reverse crossings.
  if(Number($('vehicle').value)<=1 && points.length>2 && points.every(p=>p[0]>34.0&&p[0]<34.45&&p[1]>132.9&&p[1]<133.25)){
   await calculateWaypointJourney(points,version);
  }else{
   try{const {response,text}=await postApi('route',points);if(version!==routePlanVersion)return;const mime=response.headers.get('content-type')||'';
    if(mime.includes('application/json')){const data=JSON.parse(text);if(data.type!=='kanmon_50cc_push_walk')throw new Error('未対応のルート形式です。');const sections=data.segments.filter(s=>Array.isArray(s.points)&&s.points.length>=2).map((s,i)=>({type:s.type==='human_push_walk_reference'?'walk':'road',points:s.points,color:s.type==='human_push_walk_reference'?'#e64a64':'#06799b',width:4,dash:s.type==='human_push_walk_reference'?'8 7':null,label:s.type==='human_push_walk_reference'?'関門人道（エンジン停止・押し歩き）':i===0?'人道入口までの道路':'人道出口からの道路'}));routeView('kanmon50',sections,null,'50cc：人道入口・出口までを道路計算。人道区間は押し歩きのみ。走行GPXに連結しません。');}
    else{const road=gpxPoints(text);routeView('normal',[{type:'road',points:road,color:'#06799b',width:5,label:'BRouter道路経路',gpx:text}],text,response.headers.get('X-BNavi-Route')==='kanmon-r2-verified'?'125cc：関門国道2号のトンネル経由を計算したよ。':`選択した探索条件：${$('mode').selectedOptions[0]?.textContent}（${ROUTE_POLICIES[Number($('mode').value)]}）。異なる条件でも道路網と区間によっては同じ経路になる場合があります。`);}
   }catch(error){if(version!==routePlanVersion)return;const reason=String(error.message||error);if(Number($('vehicle').value)<=1&&state.via.length===0&&reason.includes('しまなみ')){await calculateShimanami(points,version);}else throw error;}
  }
 }catch(e){
  if(version===routePlanVersion){
   const reason=String(e?.message||e);
   const help=/no track found|HTTP 400/i.test(reason)
    ?' 指定地点と道路の接続、または通れる道路条件を確認できませんでした。目的地を道路上で選び直すか、追加オプションを変えて再検索してね。':'';
   setMessage('計算できなかったよ：'+reason+help,true);
  }
 }finally{if(version===routePlanVersion)btn.disabled=false;}}
function decodeBase64Utf8(x){const bytes=Uint8Array.from(atob(x),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
// Keep cycling bridge references separate from routed GPX. Clipping removes
// duplicated reference approaches; small gaps to the routed leg are drawn as
// clearly identified NON-NAVIGABLE map guide connectors only.
function bridgeGapPreview(refPoints,fromLeg,toLeg){
 if(!Array.isArray(refPoints)||refPoints.length<2||!fromLeg?.length||!toLeg?.length)return {points:refPoints||[],connectors:[]};
 const from=fromLeg.at(-1),to=toLeg[0];
 const nearest=target=>{let index=0,best=Infinity;for(let j=0;j<refPoints.length;j++){
  const d=km(target,refPoints[j]);if(d<best){best=d;index=j;}
 }return {index,distance:best};};
 const a=nearest(from),b=nearest(to);
 if(a.distance>.35||b.distance>.35||a.index===b.index)return {points:refPoints,connectors:[]};
 const lo=Math.min(a.index,b.index),hi=Math.max(a.index,b.index);
 const clipped=refPoints.slice(lo,hi+1);
 // Only show very short endpoint alignment discrepancies, never assert that the
 // straight line represents a real or legal road. Do NOT add this to GPX/GPS.
 const connectors=[];
 const add=(road,ref,distance,side)=>{
  const meters=Math.round(distance*1000);
  if(meters>12&&meters<=100)connectors.push({points:[road,ref],meters,side});
 };
 add(from,refPoints[a.index],a.distance,'entry');
 add(to,refPoints[b.index],b.distance,'exit');
 return {points:clipped.length>=2?clipped:refPoints,connectors};
}
// All six bridges: retain Android approach shape for both directions.
// For bridges 2-6, use the original cycling reference ONLY for the missing
// bridge-deck span. No invented direct road connectors and no GPX changes.
function androidBridgePreview(ref,fromLeg,toLeg){
 if(!Number.isInteger(ref?.bridgeIndex)||typeof BNaviAndroidApproaches==='undefined'||typeof BNaviShimanamiGeometry==='undefined')return null;
 try{
  const check=BNaviAndroidApproaches.audit(BNaviShimanamiGeometry,[{bridgeIndex:ref.bridgeIndex,forward:ref.forward}]);
  if(check.issues.length)return null;
  const entrance=check.overlays.find(p=>p.role==='entrance_to_deck');
  const exit=check.overlays.find(p=>p.role==='deck_to_exit');
  if(!entrance||!exit)return null;
  const deck=check.overlays.find(p=>p.type==='moped_deck_reference');
  let middle=deck?.points;
  if(!middle){
   const track=ref.points;
   if(!Array.isArray(track)||track.length<3)return null;
   // Some Android reference GPX files revisit an earlier bridge point.
   // Pick the nearest *ordered* pair, not two independent nearest indices.
   const entry=entrance.points.at(-1),out=exit.points[0];
   let best=null;
   for(let i=0;i<track.length-1;i++){
    const d1=km(entry,track[i])*1000;
    if(d1>35)continue;
    for(let j=i+1;j<track.length;j++){
     const d2=km(out,track[j])*1000;
     if(d2>35)continue;
     const score=d1+d2;
     if(!best||score<best.score)best={i,j,score};
    }
   }
   if(!best)return null;
   middle=track.slice(best.i,best.j+1);
  }
  const merged=[];
  for(const piece of [entrance.points,middle,exit.points]){
   if(!piece?.length)return null;
   if(merged.length&&km(merged.at(-1),piece[0])*1000>35)return null;
   merged.push(...(merged.length?piece.slice(1):piece));
  }
  const visible=bridgeGapPreview(merged,fromLeg,toLeg);
  if(km(fromLeg.at(-1),visible.points[0])*1000>25||km(toLeg[0],visible.points.at(-1))*1000>25)return null;
  return {...visible,source:deck?'android_moped_shared_reference':'android_approaches_cycling_deck_reference'};
 }catch(e){console.warn('Android橋参考形状の検証失敗',ref?.bridgeIndex,e);return null;}
}
// Compatibility with existing regression checks.
function androidInnoshimaPreview(ref,fromLeg,toLeg){
 return ref?.bridgeIndex===1?androidBridgePreview(ref,fromLeg,toLeg):null;
}
async function buildShimanamiPair(points,prefix=''){
 const {text}=await postApi('shimanami/island-legs',points);
 const data=JSON.parse(text);if(!data.islandLegsReady)throw new Error('島内道路をすべて計算できませんでした。');
 const sections=[],gpxs=data.islandLegs.map(leg=>decodeBase64Utf8(leg.gpxBase64));let previews=null;
 try{const resp=await postApi('shimanami/preview',points);previews=JSON.parse(resp.text);}catch(e){console.warn('しまなみ橋参考線の読み込み失敗:',e);}
 const bridgeRefs=(previews?.segments||[]).filter(s=>s.type==='cycling_bridge_reference'&&s.points?.length>=2);
 const islandPaths=gpxs.map(gpxPoints),guidance=[];
 for(let i=0;i<data.islandLegs.length;i++){
  const leg=data.islandLegs[i],xml=gpxs[i];sections.push({type:'road',points:islandPaths[i],color:'#06799b',width:5,label:`${prefix}${leg.island}の島内道路`,gpx:xml});
  guidance.push({name:leg.island,points:islandPaths[i],turnCues:gpxTurnCues(xml),bridgeAfter:i<data.bridgeHandoffs.length});
  if(i<data.bridgeHandoffs.length){const bridge=data.bridgeHandoffs[i],ref=bridgeRefs[i];if(ref){const android=androidBridgePreview(ref,islandPaths[i],islandPaths[i+1]);const visible=android||bridgeGapPreview(ref.points,islandPaths[i],islandPaths[i+1]);sections.push({type:'bridge',points:visible.points,color:android?'#b57a20':'#9460b8',dash:android?'7 4':'9 7',width:android?5:4,label:`${prefix}${bridge.bridge}（参考線・走行GPX対象外）`});for(const c of visible.connectors)sections.push({type:'bridge',points:c.points,color:'#e59a26',dash:'3 7',width:3,label:`${prefix}${bridge.bridge}：${c.meters}m 未確認接続補助線`});}}
 }
 return {sections,guidance,bridges:data.bridgeHandoffs.length};
}
async function calculateShimanami(points,version){setMessage('しまなみ島内道路と橋参考線を計算中…');const result=await buildShimanamiPair(points);if(version!==routePlanVersion)return;routeView('shimanami',result.sections,null,`しまなみ：島内${result.guidance.length}区間・橋${result.bridges}本。橋は参考表示のみ。GPXは島内道路ごとに保存できます。`);state.islandLegs=result.guidance;state.shimanamiPlanPoints=points.map(x=>x.slice());loadIslandGuidance(0);queueOfflineSave();}
async function calculateWaypointJourney(points,version){
 const sections=[],guidance=[];let bridgeCount=0;
 for(let i=0;i<points.length-1;i++){
  if(version!==routePlanVersion)return;
  setMessage(`経由地を順番に計算中：${i+1}/${points.length-1}区間…`);
  const pair=[points[i],points[i+1]];
  try{
   const {response,text}=await postApi('route',pair);
   if(version!==routePlanVersion)return;
   if((response.headers.get('content-type')||'').includes('json'))throw new Error('この区間は通常の走行GPXを生成できません');
   const road=gpxPoints(text);sections.push({type:'road',points:road,color:'#06799b',width:5,label:`${i+1}区間目：道路`,gpx:text});guidance.push({name:`${i+1}区間目`,points:road,turnCues:gpxTurnCues(text),bridgeAfter:false});
  }catch(error){
   if(!String(error.message||error).includes('しまなみ'))throw new Error(`${i+1}区間目：${error.message||error}`);
   const result=await buildShimanamiPair(pair,`${i+1}区間目・`);if(version!==routePlanVersion)return;sections.push(...result.sections);guidance.push(...result.guidance);bridgeCount+=result.bridges;
  }
 }
 if(version!==routePlanVersion)return;
 if(!sections.length)throw new Error('経由地ルートを作成できませんでした');
 routeView('shimanami',sections,null,`経由地${points.length-2}件を指定順に計算。道路${guidance.length}区間、橋${bridgeCount}回。島内GPXは区間別保存。橋参考線はGPX・音声案内へ含めません。`);
 state.islandLegs=guidance;state.shimanamiPlanPoints=points.map(x=>x.slice());loadIslandGuidance(0);if(typeof queueOfflineSave==='function')queueOfflineSave();
}

// GitHub Pages: plan the island roads with the older public BRouter protocol.
// Bridge shapes are Android-validated display references only. Never export
// or pass a cycling reference to the GPS turn-by-turn navigator.
async function calculateShimanamiWeb(points,version){
 if(typeof BNaviShimanamiWebRouter==='undefined'||typeof BNaviBridgeReferences==='undefined')throw Error('しまなみ橋参考資料が読み込まれていません。通信を確認してください。');
 const includesOnomichiMainland=points.some(p=>BNaviShimanamiWebRouter.journeyRegion?.(p)===-1||BNaviShimanamiWebRouter.isOnomichiMainland(p));
 setMessage(includesOnomichiMainland?
  'しまなみ：尾道大橋（国道317号）の一般道と島内道路・橋の接続を検証中…':
  'しまなみ：島内道路と橋の接続を検証中…');
 const result=await BNaviShimanamiWebRouter.compose(points,$('vehicle').value,state.activeRoutingMode,{
  geometry:BNaviShimanamiGeometry,refs:BNaviBridgeReferences,
  query:(pair,v,m)=>BNaviPublicBrouter.query(pair,v,m,fetch,null,state.activeRouteTuning),
  bridgePreview:androidBridgePreview,
  onProgress:step=>{if(version===routePlanVersion)setMessage(`しまなみ：道路 ${step.index}/${step.total} 区間を計算中。橋 ${step.bridgeTotal} 本の接続も検証します。`)}
 });
 if(version!==routePlanVersion)return;
 routeView('shimanami',result.sections,null,`しまなみ：道路${result.roadSegments}区間・橋${result.bridges}本。${includesOnomichiMainland?'尾道駅付近と向島の接続は尾道大橋（一般道）を使用。渡船は含みません。':''}経由地${points.length-2}件は指定順。橋は原付通路の参考線で走行GPXと音声案内には入れません。現地標識に従ってね。${result.warnings?.length?' 注意：'+result.warnings.join('／'):''}`);
 state.shimanamiWebBuilt=true;state.shimanamiPlanPoints=points.map(p=>p.slice());
 state.islandLegs=result.guidance;loadIslandGuidance(0);queueOfflineSave();
 $('shimanami-desk-tools').hidden=false;
}
function verifyShimanamiDesk(){
 const box=$('shimanami-desk-report');
 if(state.routeType!=='shimanami'||!state.shimanamiWebBuilt||!state.shimanamiPlanPoints?.length){box.textContent='公開BRouter方式でしまなみルートを計算してね。';return;}
 const report=BNaviShimanamiWebRouter.deskCheck({sections:state.routes,guidance:state.islandLegs,bridges:state.routes.filter(s=>s.type==='bridge'&&s.bridgeIndex).length},state.shimanamiPlanPoints);
 const title=report.ok?`参考線の接続確認OK：道路 ${report.islandRoads} 区間／橋 ${report.bridges} 本／登録地点 ${report.checkpoints} 件`:'机上検証エラー：'+report.errors.join('・');
 box.textContent=title+'\n'+report.steps.join('\n');
}
function setExample(which){clearResult();state.via=[];if(which==='hiroshima'){$('vehicle').value='1';updateModes();$('mode').value='1';updatePolicy();$('start').value='34.397340,132.459390';$('goal').value='34.406310,132.476000';}
 if(which==='shimanami'){$('vehicle').value='1';updateModes();$('mode').value='1';updatePolicy();$('start').value='34.389000,133.200000';$('goal').value='34.064000,132.995000';}
 if(which==='kanmon'){$('vehicle').value='0';updateModes();$('mode').value='1';updatePolicy();$('start').value='33.975115,130.947556';$('goal').value='33.951385,130.968889';}
 renderVia();refreshMap();fitMarkers();persist();setPick('start');setMessage('ルート例の地点を設定したよ。「ルート検索」で経路を計算できるよ。');}
async function refreshServer(){if(usePublicBrouter()){$('server-status').textContent='● 公開BRouter試験モード';$('server-status').classList.remove('bad');return;}try{const r=await fetch(apiUrl('status'),{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();$('server-status').textContent=d.routeReady?`● BRouter準備OK / RD5 ${d.segments}件`:'● 道路データがありません';$('server-status').classList.toggle('bad',!d.routeReady);}catch(e){$('server-status').textContent='● サーバーに接続できません';$('server-status').classList.add('bad');setMessage(hostedOnPages()?'オンライン経路サーバーは未接続です。GPXの読み込みとオフライン案内は使えます。':'BRouterサーバーへ接続できません。',true);}}
// Settings are persisted per device; no GPS or destination data are stored here.
const VOICE=window.BNaviVoiceSettings;
let voiceOptions=VOICE.load(localStorage);
function updateVoiceSettingsUI(){
 $('voice-on').checked=voiceOptions.enabled;
 for(const key of ['rate','volume','pitch'])$('voice-'+key).value=String(voiceOptions[key]);
 $('voice-rate-value').textContent=voiceOptions.rate.toFixed(2)+'倍';
 $('voice-volume-value').textContent=Math.round(voiceOptions.volume*100)+'%';
 $('voice-pitch-value').textContent=voiceOptions.pitch===1?'標準':voiceOptions.pitch.toFixed(2)+'倍';
 $('voice-select').value=voiceOptions.voice;
 if($('voice-select').selectedIndex<0)$('voice-select').value='auto';
}
function setVoiceOptions(p){voiceOptions=VOICE.save(localStorage,{...voiceOptions,...p});updateVoiceSettingsUI();$('voice-setting-message').textContent='設定を保存しました。';}
function refreshVoices(){
 const el=$('voice-select'),previous=voiceOptions.voice;
 el.replaceChildren(new Option('自動で選ぶ','auto'));
 const choices=window.speechSynthesis?.getVoices?.()||[];
 for(const v of choices.filter(v=>/^ja(?:-|_)/i.test(v.lang||''))){el.add(new Option(v.name||v.voiceURI,v.voiceURI));}
 el.value=previous;if(el.selectedIndex<0)el.value='auto';
}
function openSettings(){refreshVoices();updateVoiceSettingsUI();$('settings-dialog').showModal();}
$('settings-btn').addEventListener('click',openSettings);
$('nav-voice-settings').addEventListener('click',openSettings);
$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
$('settings-dialog').addEventListener('click',e=>{if(e.target===$('settings-dialog'))$('settings-dialog').close();});
for(const key of ['rate','volume','pitch'])$('voice-'+key).addEventListener('input',e=>setVoiceOptions({[key]:Number(e.target.value)}));
$('voice-on').addEventListener('change',e=>setVoiceOptions({enabled:e.target.checked}));
$('voice-select').addEventListener('change',e=>setVoiceOptions({voice:e.target.value}));
$('voice-preview').addEventListener('click',()=>{const ok=speak('音声の速さを確認します。およそ百メートル先、右方向です。',true);$('voice-setting-message').textContent=ok?'テスト音声を再生中です。':'音声を再生できませんでした。';});
$('voice-reset').addEventListener('click',()=>{voiceOptions=VOICE.save(localStorage,VOICE.DEFAULTS);refreshVoices();updateVoiceSettingsUI();$('voice-setting-message').textContent='標準の設定に戻しました。';});
window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{if($('settings-dialog').open)refreshVoices();});
refreshVoices();updateVoiceSettingsUI();
function speak(text,forced=false){
 // Radar shows position/distance silently. The user voice setting is preserved;
 // leaving radar restores ordinary guidance, without restarting GPS.
 if(!forced&&window.BNaviRideMode?.isRadarVisible?.())return false;
 if(!forced&&!voiceOptions.enabled)return false;
 if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance){$('nav-status').textContent='音声を再生できません。';return false;}
 try{const synth=window.speechSynthesis;synth.cancel();const u=new SpeechSynthesisUtterance(text);
  VOICE.apply(u,voiceOptions,synth.getVoices?.()||[]);
  u.onerror=e=>{$('nav-status').textContent='音声の再生に失敗：'+(e.error||'音声が使えません')+'。';};
  synth.speak(u);return true;
 }catch(e){$('nav-status').textContent='音声を開始できません：'+e.message;return false;}
}
function canVoiceNavigate(){return (['normal','imported'].includes(state.routeType)&&state.gpsPoints.length>1)||(state.routeType==='shimanami'&&state.routes.some(s=>s.type==='road'));}
// Show a deliberately small navigation-only panel, rather than the route editor.
// GPS progress remains in the original #nav-status for normal editing and tests.
function manualDetourUnavailable(){
 if(!state.navActive)return '音声案内中のみ利用できます';
 if(state.navPaused||state.finishing||state.rerouting)return '現在の案内処理が終わってから試してね';
 if(!['normal','shimanami'].includes(state.routeType))return '読込GPXや未確認の経路では迂回できません';
 if(state.shimanamiBigMode&&state.activeRoutingMode===3)return '高速優先の走行中は道路種別を確認できないため迂回できません';
 if(state.routeType==='shimanami'){
  if(state.awaitingBridge)return '橋区間は迂回できません。次の島内道路で利用してね';
  const road=state.islandLegs[state.islandIndex];
  if(!road?.points?.length||!Number.isInteger(road.sectionIndex)||state.routes[road.sectionIndex]?.type!=='road')
   return '橋に接続する一般道の区間が確認できません';
 }
 if(state.biwakoBridgeActive&&BNaviBiwakoBridge.isAhead(state.location,state.gpsPoints))
  return '琵琶湖大橋を通る案内中は橋までの手動迂回を一時停止しています';
 if(!usePublicBrouter())return '公開BRouterへの接続が必要です';
 if(!state.location||!Number.isFinite(state.gpsAccuracy)||state.gpsAccuracy>35)return 'GPS精度35m以内で現在地を取得してね';
 if(!state.gpsPoints||state.gpsPoints.length<2||!state.activeTargets.slice(state.targetIndex).length)
  return '経路または目的地を確認できません';
 return null;
}
function syncManualDetourButton(){
 const btn=$('nav-detour');if(!btn)return;
 const reason=manualDetourUnavailable();
 btn.disabled=Boolean(reason);
 btn.title=reason||'安全な場所で操作。約230m先の道路を避けて再探索します';
 btn.textContent=state.rerouting?'↪ 迂回を探索中…':'↪ 迂回を探す';
}
function syncNavigationHud(){
 const hud=$('navigation-hud');if(!hud)return;
 hud.hidden=!state.navActive;
 syncManualDetourButton();
 if(!state.navActive)return;
 const raw=($('nav-status').textContent||'').replace(/\s+/g,' ').trim();
 const step=raw.match(/次：([^約／（。]+)\s*約\s*([0-9.]+\s*(?:km|m))/);
 const stepLoose=raw.match(/次：([^／（。]+)/);
 const remain=raw.match(/(?:島内)?残り約\s*([0-9.]+\s*(?:km|m))/);
 const offRoute=raw.match(/経路まで約\s*([0-9.]+\s*(?:km|m))/);
 const island=raw.match(/しまなみ島内\s*([0-9]+\/[0-9]+)/);
 const bridge=/橋の入口|橋区間|橋の区間|橋渡り|橋の参考線/.test(raw);
 const failure=/GPSエラー|音声の再生に失敗|音声を開始できません/.test(raw);
 let main='音声案内中';
 if(failure)main='位置情報・音声を確認';
 else if(bridge)main='橋区間：現地標識を確認';
 else if(step)main=`${step[2].trim()}先 ${step[1].trim()}`;
 else if(stepLoose)main=stepLoose[1].trim();
 else if(/目的地に到着/.test(raw))main='目的地に到着';
 else if(!state.location)main='GPS取得中…';
 const parts=[];
 if(remain)parts.push('残り '+remain[1].trim());
 if(offRoute)parts.push('経路まで '+offRoute[1].trim());
 if(island)parts.push('島内 '+island[1]);
 if(!parts.length)parts.push(!state.location?'現在地を取得中':state.turnCues.length?'GPS追従中':'右左折情報なし');
 $('navigation-hud-main').textContent=main;
 $('navigation-hud-sub').textContent=parts.join(' ／ ');
}
new MutationObserver(syncNavigationHud).observe($('nav-status'),{childList:true,characterData:true,subtree:true});
// The destination order is the user's via list followed by G. Do not edit S/G on arrival.
function beginTargetSequence(){
 const targets=[];
 if(state.routeType!=='imported')for(const v of state.via){try{targets.push(parsePoint(v))}catch{}}
 let goal=null;
 if(state.routeType==='imported'&&state.gpsPoints.length)goal=state.gpsPoints.at(-1);
 else try{goal=inputPoint('goal')}catch{}
 if(['normal','imported'].includes(state.routeType)&&state.gpsPoints.length){
   const routeEnd=state.gpsPoints.at(-1);if(!goal||BNaviRideLogic.meters(goal,routeEnd)>150)goal=routeEnd;
 }
 if(goal)targets.push(goal);
 state.activeTargets=targets;state.targetIndex=0;state.navPaused=false;state.finishing=false;state.hasDeparted=false;
 state.arrivalPolicy=new BNaviRideLogic.ArrivalPolicy();state.offRoutePolicy=new BNaviRideLogic.OffRoutePolicy();state.motionGate=new BNaviRideLogic.MotionGate();state.lastRerouteError=-Infinity;
}
function activeTarget(){return state.activeTargets[state.targetIndex]||null;}
window.BNaviGetActiveDestination=activeTarget;
window.BNaviActiveTargetLabel=()=>state.targetIndex<state.activeTargets.length-1?'経由地 '+(state.targetIndex+1):'目的地';
window.BNaviInitRadarTargets=beginTargetSequence;
// Two accurate GPS fixes within 20m are required, so brief GPS jumps cannot finish a trip.
function observeDestination(position,accuracy,source='nav'){
 if(!state.activeTargets.length||state.navPaused||state.finishing)return false;
 const target=activeTarget();if(!target)return false;
 // A loop can begin and end at the same coordinate; never announce arrival on departure.
 if(state.targetIndex===state.activeTargets.length-1&&['normal','imported'].includes(state.routeType)&&state.gpsPoints.length>1){
   const start=state.gpsPoints[0],end=state.gpsPoints.at(-1);
   if(BNaviRideLogic.meters(start,end)<40&&(state.cumKm.at(-1)||0)>0.3){
     if(BNaviRideLogic.meters(position,start)>60)state.hasDeparted=true;
     if(!state.hasDeparted)return false;
   }
 }
 if(!state.arrivalPolicy)state.arrivalPolicy=new BNaviRideLogic.ArrivalPolicy();
 if(!state.arrivalPolicy.observe(BNaviRideLogic.meters(position,target),accuracy))return false;
 const last=state.targetIndex>=state.activeTargets.length-1;
 if(last){
   state.finishing=true;
   $('nav-status').textContent='目的地に到着しました。案内を終了します。';
   const done=()=>{if(source==='radar'&&!state.navActive)window.BNaviRideMode?.stop?.();else stopVoiceGuidance(true);};
   // Keep the arrival message audible: stopVoiceGuidance cancels speech.
   announceArrival('目的地に到着しました。案内を終了します。',done);
 }else{
   state.navPaused=true;
   if(state.navActive){$('nav-status').textContent='経由地に到着しました。次の目的地を案内しますか？';}
   speak('経由地に到着しました。');
   const dialog=$('next-destination-dialog');
   $('next-destination-message').textContent='次の目的地を案内しますか？';
   if(!dialog.open)dialog.showModal();
 }
 return true;
}
window.BNaviObserveDestination=observeDestination;
function announceArrival(message,onDone){
 // Completion must not wait on muted TTS: final arrival still ends guidance.
 if(window.BNaviRideMode?.isRadarVisible?.()||!voiceOptions.enabled||!window.speechSynthesis||!window.SpeechSynthesisUtterance){onDone();return;}
 try{const synth=window.speechSynthesis;synth.cancel();const u=new SpeechSynthesisUtterance(message);
  VOICE.apply(u,voiceOptions,synth.getVoices?.()||[]);
  let finished=false;const complete=()=>{if(finished)return;finished=true;onDone();};
  u.onend=complete;u.onerror=complete;
  synth.speak(u);
 }catch{onDone()}
}
$('next-destination-continue').addEventListener('click',()=>{
 $('next-destination-dialog').close();
 if(state.targetIndex<state.activeTargets.length-1){
   state.targetIndex++;state.arrivalPolicy.reset();state.offRoutePolicy?.reset();state.navPaused=false;
   if(state.routeType==='shimanami'&&!state.awaitingBridge){const leg=state.islandLegs[state.islandIndex];if(leg&&!leg.bridgeAfter&&leg.checkpointAfter===state.targetIndex&&state.islandIndex<state.islandLegs.length-1){state.islandIndex++;loadIslandGuidance(state.islandIndex);}}
   if(state.navActive){$('nav-status').textContent='次の目的地を案内します。';speak('次の目的地を案内します。');}
   else window.BNaviRideMode?.refreshTarget?.();
 }
});
$('next-destination-stop').addEventListener('click',()=>{
 $('next-destination-dialog').close();state.navPaused=false;
 if(state.navActive)stopVoiceGuidance(true);else window.BNaviRideMode?.stop?.();
});
$('next-destination-dialog').addEventListener('cancel',e=>e.preventDefault());
// Never reroute the displayed bridge reference. Reroute only the active
// BRouter-computed island road to its original road-leg endpoint.
async function rerouteShimanamiFromGps(){
 if(state.rerouting||!state.navActive||state.navPaused||state.finishing||state.awaitingBridge||!usePublicBrouter())return;
 const leg=state.islandLegs[state.islandIndex],current=state.location;
 if(!leg?.points?.length||!current)return;
 // Re-routing a mixed mainland/bridge approach must retain the original
 // verified gateway. Until that is supported, do not replace its road line.
 if(leg.wide||leg.mainlandCrossing){state.lastRerouteError=performance.now();$('nav-status').textContent='広域接続区間の自動再探索は停止中。安全な場所でルートを再検索してね。';return;}
 if(!BNaviShimanamiWebRouter.inArea(current))return;
 const finish=leg.points.at(-1);
 if(BNaviShimanamiWebRouter.island(current)!==BNaviShimanamiWebRouter.island(finish)){
  state.lastRerouteError=performance.now();$('nav-status').textContent='橋を渡る間は再探索しません。次の島でGPS案内を再開します。';return;
 }
 state.rerouting=true;
 const sectionIndex=leg.sectionIndex;
 $('nav-status').textContent='現在の島内道路を再探索中…';speak('島内道路を再探索します。');
 try{
  const result=await BNaviPublicBrouter.query([current.slice(),finish.slice()],state.activeRoutingVehicle??$('vehicle').value,state.activeRoutingMode??1,fetch,null,state.activeRouteTuning,
   state.manualDetour&&state.manualDetourLegIndex===state.islandIndex?{nogos:[state.manualDetour]}:null);
  BNaviShimanamiWebRouter.validateRoad({from:current,to:finish,island:BNaviShimanamiWebRouter.island(finish)},result.track);
  if(leg.bridgeAfter&&BNaviShimanamiWebRouter.meters(result.track.points.at(-1),finish)>25)throw Error('橋入口に正確につながらないため新経路を採用できません');
  if(!state.navActive||state.navPaused||state.islandLegs[state.islandIndex]!==leg)return;
  if(!Number.isInteger(sectionIndex)||state.routes[sectionIndex]?.type!=='road')throw Error('保存済み区間の位置が不正です');
  state.routes[sectionIndex]={...state.routes[sectionIndex],points:result.track.points,gpx:result.gpx,label:leg.name+'：再探索済み'};
  leg.points=result.track.points;leg.turnCues=result.track.cues||[];loadIslandGuidance(state.islandIndex);
  state.offRoutePolicy?.reset();refreshMap();queueOfflineSave();
  $('nav-status').textContent='島内道路を更新しました。次の橋の入口または目的地まで案内します。';speak('新しい島内ルートで案内を続けます。');
 }catch(e){state.lastRerouteError=performance.now();$('nav-status').textContent='島内ルートの再探索に失敗：'+String(e.message||e).slice(0,120);}
 finally{state.rerouting=false;state.offRoutePolicy?.markAttempt(performance.now());}
}
async function rerouteFromGps(){
 if(state.rerouting||!state.navActive||state.navPaused||!state.location||!['normal','imported'].includes(state.routeType))return;
 if(state.shimanamiBigMode&&state.manualDetour){
  state.lastRerouteError=performance.now();
  $('nav-status').textContent='迂回区間を走行中。元のルートに合流するまでは自動再探索を停止します。';
  return;
 }
 const dest=state.activeTargets.slice(state.targetIndex);
 if(!dest.length)return;
 const basePoints=[state.location.slice(),...dest];
 const bridgePending=state.biwakoBridgeActive&&typeof BNaviBiwakoBridge!=='undefined'&&
   BNaviBiwakoBridge.isAhead(state.location,state.gpsPoints);
 const points=bridgePending?BNaviBiwakoBridge.plan(basePoints).points:basePoints;
 if(needsDedicatedApi(points)&&usePublicBrouter()){
   $('nav-status').textContent='原付専用区間の再探索には専用経路サーバーが必要です。';return;
 }
 state.rerouting=true;
 const prevZoom=map.zoom,prevPos=state.location.slice();
 $('nav-status').textContent='ルートを再探索中…';
 speak('ルートを再探索します。');
 try{
  if(usePublicBrouter()){
   const cross=state.shimanamiBigMode&&Number(state.activeRoutingVehicle)===2&&
     typeof BNaviShimanamiBigRouter!=='undefined'&&BNaviShimanamiBigRouter.potential(points,2);
   const big=cross?await queryBigShimanami(points,state.activeRoutingMode??1,state.activeRouteTuning,routePlanVersion):null;
   const r=big?{track:big.track,gpx:big.gpx}:
    await BNaviPublicBrouter.query(points,state.activeRoutingVehicle??$('vehicle').value,
      state.shimanamiBigMode&&state.activeRoutingMode===3?1:state.activeRoutingMode??1,fetch,null,state.activeRouteTuning,
      state.manualDetour&&!state.shimanamiBigMode?{nogos:[state.manualDetour]}:null);
   if(bridgePending)BNaviBiwakoBridge.verify(r.track.points);
   if(points.length>2){
    const missed=points.slice(1,-1).map((p,i)=>({n:i+1,d:BNaviRideLogic.distanceToPolyline(p,r.track.points)})).filter(v=>v.d>300);
    if(missed.length)throw Error('リルートで経由地を通れません。残りの中継地点を維持します。');
   }
   if(!state.navActive)return;
   const keepBig=state.shimanamiBigMode,keepDetour=state.manualDetour,keepBridge=state.biwakoBridgeActive;
   routeView('normal',[{type:'road',points:r.track.points,color:'#06799b',width:5,label:'リルート済み道路経路',gpx:r.gpx}],r.gpx,'GPS現在地から再探索しました。',{keepView:true});
   state.shimanamiBigMode=keepBig;state.manualDetour=keepDetour;state.biwakoBridgeActive=keepBridge;
   if(keepBig)$('route-label').textContent='しまなみ島渡り';
  }else{
   const {response,text}=await postApi('route',points);
   if((response.headers.get('content-type')||'').includes('json'))throw Error('押し歩き・特殊経路は自動リルートできません。');
   const pts=gpxPoints(text);
   if(!state.navActive)return;
   routeView('normal',[{type:'road',points:pts,color:'#06799b',width:5,label:'リルート済み道路経路',gpx:text}],text,'GPS現在地から再探索しました。',{keepView:true});
  }
  map.center(...prevPos,prevZoom);refreshMap();state.offRoutePolicy?.reset();
  $('nav-status').textContent='ルートを更新しました。案内を続けます。';
  speak('新しいルートで案内を続けます。');
 }catch(e){state.lastRerouteError=performance.now();$('nav-status').textContent='再探索できません：'+String(e.message||e).slice(0,100)+'。安全な場所で確認してください。';}
 finally{state.rerouting=false;state.offRoutePolicy?.markAttempt(performance.now());}
}
async function requestShimanamiRoadLegDetour(origin,targets,version){
 if(typeof BNaviRoadLegDetour==='undefined'||typeof BNaviBridgeReferences==='undefined'){
  $('nav-status').textContent='しまなみ一般道の迂回モジュールがありません。PWAを再読み込みしてね';return;
 }
 const isIslandLeg=state.routeType==='shimanami',islandIndex=state.islandIndex;
 const leg=isIslandLeg?state.islandLegs[islandIndex]:null;
 const original=isIslandLeg?leg?.points:state.gpsPoints;
 const originalCues=isIslandLeg?leg?.turnCues:state.turnCues;
 let prepared;
 try{
  prepared=BNaviRoadLegDetour.prepare(origin,original,targets,{
   refs:BNaviBridgeReferences,bridgeAfter:Boolean(leg?.bridgeAfter)
  });
 }catch(error){
  $('nav-status').textContent='この場所では迂回できません：'+String(error?.message||error);return;
 }
 // Use the ordinary motorcycle BRF only for the local detour. Never alter the
 // original highway/bridge reference segments or reuse cycling bridge GPX.
 const vehicle=state.activeRoutingVehicle??Number($('vehicle').value);
 const mode=state.activeRoutingMode===3?1:state.activeRoutingMode??1;
 const tuning=state.activeRouteTuning?BNaviRouteTuning.normalize({
  ...state.activeRouteTuning,allowMotorway:false,allowToll:false
 },vehicle):null;
 state.rerouting=true;syncManualDetourButton();
 $('nav-status').textContent='前方の一般道だけ迂回して、約1.5km先の元ルートに合流する道を探索中…';
 speak('前方の一般道を避ける道を検索します。');
 try{
  if(!isIslandLeg){
   // The originally composed 126cc+ crossing profile can include E76 even on
   // a long mainland approach. Before patching, prove this local stretch is
   // also reachable by the ordinary motorcycle BRF with motorways forbidden.
   $('nav-status').textContent='今の道が一般道路として接続できるか確認中…';
   const probe=await BNaviPublicBrouter.query([origin,prepared.rejoin],vehicle,mode,fetch,null,tuning);
   if(version!==routePlanVersion||!state.navActive||state.navPaused)return;
   BNaviRoadLegDetour.validateGeneralRoad(prepared,probe.track);
  }
  $('nav-status').textContent='一般道の迂回ルートを探索中…';
  const response=await BNaviPublicBrouter.query([origin,prepared.rejoin],vehicle,mode,fetch,null,tuning,
   {nogos:[prepared.avoid]});
  if(version!==routePlanVersion||!state.navActive||state.navPaused||
     (isIslandLeg&&(state.islandLegs[islandIndex]!==leg||state.islandIndex!==islandIndex||state.awaitingBridge)))return;
  const merged=BNaviRoadLegDetour.merge(prepared,response.track,originalCues||[]);
  const gpx=BNaviPublicBrouter.gpxFromTrack(merged,'Shimanami road-only local detour');
  if(isIslandLeg){
   const sectionIndex=leg.sectionIndex;
   if(!Number.isInteger(sectionIndex)||state.routes[sectionIndex]?.type!=='road')
    throw Error('島内の道路区間が変更されました');
   state.routes[sectionIndex]={...state.routes[sectionIndex],points:merged.points,gpx,
     label:leg.name+'：一般道の手動迂回'};
   leg.points=merged.points;leg.turnCues=merged.cues;
   loadIslandGuidance(islandIndex);
  }else{
   const keepShimanami=state.shimanamiBigMode;
   const untouchedFollowingSections=state.routes.slice(1);
   routeView('normal',[{type:'road',points:merged.points,color:'#06799b',width:5,
    label:'しまなみへの一般道のみ迂回（後半の高速・橋は維持）',gpx},...untouchedFollowingSections],gpx,
    '一般道だけを迂回。橋と高速の元の接続は変更していません。',{keepView:true});
   state.shimanamiBigMode=keepShimanami;
   $('route-label').textContent='しまなみ島渡り';
  }
  state.manualDetour={...prepared.avoid,rejoin:prepared.rejoin};
  state.manualDetourLegIndex=isIslandLeg?islandIndex:null;
  state.offRoutePolicy?.reset();
  refreshMap();queueOfflineSave();
  $('nav-status').textContent='一般道を迂回して元ルートへ合流する道を設定したよ。橋・高速への接続は元のままだよ。';
  speak('一般道の迂回ルートへ案内します。元のルートへ合流します。');
 }catch(error){
  if(version===routePlanVersion&&state.navActive)
   $('nav-status').textContent='迂回を計算できません：'+String(error?.message||error).slice(0,145)+'。元の案内を維持しました。';
 }finally{
  state.rerouting=false;state.offRoutePolicy?.markAttempt(performance.now());syncManualDetourButton();
 }
}
async function requestManualDetour(){
 const reason=manualDetourUnavailable();
 if(reason){$('nav-status').textContent=reason;return;}
 const version=routePlanVersion,origin=state.location.slice(),targets=state.activeTargets.slice(state.targetIndex).map(p=>p.slice());
 let avoid;
 try{avoid=BNaviManualDetour.plan(origin,state.gpsPoints,targets)}
 catch(e){$('nav-status').textContent='迂回できません：'+String(e?.message||e);return;}
 // A Shimanami trip must preserve all later bridge and motorway connections.
 if(state.routeType==='shimanami'||state.shimanamiBigMode)
  return requestShimanamiRoadLegDetour(origin,targets,version);
 const points=[origin,...targets];
 if(needsDedicatedApi(points)){$('nav-status').textContent='原付専用道路を含むため公開BRouterでの迂回は停止しました';return;}
 state.rerouting=true;syncManualDetourButton();
 $('nav-status').textContent='約'+avoid.aheadMeters+'m先を避けて、迂回ルートを検索中…';
 speak('前方の道路を避けて、迂回ルートを検索します。');
 try{
  const response=await BNaviPublicBrouter.query(points,state.activeRoutingVehicle??Number($('vehicle').value),
   state.activeRoutingMode??routingMode(),fetch,null,state.activeRouteTuning,{nogos:[avoid]});
  if(version!==routePlanVersion||!state.navActive||state.navPaused)return;
  BNaviManualDetour.verify(response.track.points,avoid);
  for(const [i,target] of targets.entries()){
   if(BNaviRideLogic.distanceToPolyline(target,response.track.points)>300)
    throw Error('経由地'+(i+1)+'を通らないルートは採用できません');
  }
  const view=state.location.slice(),zoom=map.zoom;
  routeView('normal',[{type:'road',points:response.track.points,color:'#06799b',width:5,
   label:'手動迂回道路ルート',gpx:response.gpx}],response.gpx,
   '前方の道路を避けたルートを計算したよ。',{keepView:true});
  state.manualDetour=avoid;
  map.center(...view,zoom);refreshMap();state.offRoutePolicy?.reset();
  $('nav-status').textContent='迂回ルートを表示したよ。音声案内を続けます。';
  speak('新しい迂回ルートで案内を続けます。');
 }catch(e){
  if(version===routePlanVersion&&state.navActive)
   $('nav-status').textContent='迂回を計算できません：'+String(e?.message||e).slice(0,125)+'。元のルートで案内を続けます。';
 }finally{
  state.rerouting=false;state.offRoutePolicy?.markAttempt(performance.now());syncManualDetourButton();
 }
}
$('nav-detour').addEventListener('click',()=>requestManualDetour().catch(e=>{
 $('nav-status').textContent='迂回処理に失敗しました：'+String(e?.message||e);state.rerouting=false;syncManualDetourButton();
}));
function clearPassedLocalDetour(position,accuracy){
 if(!state.manualDetour?.rejoin||!Number.isFinite(accuracy)||accuracy>35)return;
 if(BNaviManualDetour.meters(position,state.manualDetour.rejoin)<=65){
  state.manualDetour=null;state.manualDetourLegIndex=null;
 }
}
function observeOffRoute(position,accuracy){
 if(!state.navActive||state.navPaused||state.finishing||state.rerouting)return;
 // Only moving bikes can reroute: indoor GPS jumps cannot trigger new routes.
 if(!state.motionGate?.isMoving(performance.now())){state.offRoutePolicy?.reset();return;}
 if(!Number.isFinite(accuracy)||accuracy>35||performance.now()-state.lastRerouteError<45000)return;
 if(state.routeType==='shimanami'){
  // While crossing the bridge, distance from the island road is expected.
  if(state.awaitingBridge||!usePublicBrouter())return;
  const leg=state.islandLegs[state.islandIndex];if(!leg?.points?.length)return;
  const d=BNaviRideLogic.distanceToPolyline(position,leg.points);
  if(state.offRoutePolicy?.observe(d,accuracy,performance.now()))rerouteShimanamiFromGps();
  return;
 }
 if(!['normal','imported'].includes(state.routeType)||!state.gpsPoints.length)return;
 const d=BNaviRideLogic.distanceToPolyline(position,state.gpsPoints);
 if(state.offRoutePolicy?.observe(d,accuracy,performance.now()))rerouteFromGps();
}
function syncNavigationButtons(){const allowed=canVoiceNavigate();for(const id of ['nav-start','nav-start-quick'])$(id).disabled=!allowed||state.navActive;
 for(const id of ['nav-stop','nav-stop-quick'])$(id).disabled=!state.navActive;
 $('nav-start-quick').hidden=state.navActive;$('nav-stop-quick').hidden=!state.navActive;$('navigation-quickbar').hidden=!(allowed||state.navActive);
 document.body.classList.toggle('navigation-active',state.navActive);
 $('nav-radar-toggle').hidden=!state.navActive;
 syncNavigationHud();
}
function startVoiceGuidance(){
 if(state.routeType==='shimanami'&&Number($('vehicle').value)===2){
  $('nav-status').textContent='126cc以上では原付用の橋参考線を走行案内に利用できません。車種に合うルートを検索してね。';return;
 }
 if(!canVoiceNavigate()){$('nav-status').textContent='先に通常道路のルートを計算するか、案内用GPXを読み込んでね。';return;}
 if(!window.isSecureContext||!navigator.geolocation){$('nav-status').textContent='音声案内にGPSが必要です。HTTPSと位置情報の許可を確認してね。';return;}
 // Browser/iOS speech begins directly inside the button click, before any geolocation permission prompt.
 beginTargetSequence();window.BNaviTrack?.start('nav');state.navActive=true;state.saidCues=new Set();state.followGps=true;
 window.BNaviCloseRouteSheet?.();
 syncNavigationButtons();
 const hasHints=state.routeType==='shimanami'?state.islandLegs.some(x=>x.turnCues?.length):state.turnCues.length>0;
 $('nav-status').textContent=hasHints?'音声案内中。GPS取得後、次の右左折を読み上げるよ。':'音声案内開始。GPXに右左折指示がないため、音声テストと現在位置表示のみ利用できます。';
 speak(hasHints?'音声案内を開始します。':'案内を開始します。右左折の音声情報がない経路です。');
 // A single main GPS watch also drives the map arrow / heading and free-running audio cues.
 startGps();
}
function stopVoiceGuidance(stopTracking=true){
 if($('next-destination-dialog').open)$('next-destination-dialog').close();
 if(state.navActive)window.BNaviTrack?.stop();state.navActive=false;state.navPaused=false;state.finishing=false;window.BNaviRideMode?.closeNavRadar?.();window.speechSynthesis?.cancel?.();if(stopTracking)stopGps();syncNavigationButtons();
 if(stopTracking)$('nav-status').textContent='案内終了。';
}
function voiceTest(){const ok=speak('音声テストです。およそ100メートル先、右方向です。',true);
 if(ok)$('nav-status').textContent='テスト音声を再生しています。速さや音量は「設定」で変更できます。';}

function cueText(desc){const name={'start':'出発です','destination':'目的地です','left':'左折です','right':'右折です','slight left':'やや左方向です','slight right':'やや右方向です','sharp left':'大きく左折です','sharp right':'大きく右折です','straight':'直進です','keep left':'左方向です','keep right':'右方向です','u-turn':'Uターンです'};return name[desc]||'この先、曲がり角です';}
function startDemo(){if(!['normal','imported'].includes(state.routeType)||!state.gpsPoints.length)return;stopVoiceGuidance(false);stopGps();stopDemo();state.demoIndex=0;state.saidCues=new Set();state.gpsAccuracy=0;$('demo-on').disabled=true;$('demo-off').disabled=false;state.demoTimer=setInterval(()=>{state.demoIndex=Math.min(state.gpsPoints.length-1,state.demoIndex+Math.max(1,Math.floor(state.gpsPoints.length/260)));state.location=state.gpsPoints[state.demoIndex];const prev=state.gpsPoints[Math.max(0,state.demoIndex-1)],cur=state.location;if(km(prev,cur)>.002){const r=Math.PI/180,d=(cur[1]-prev[1])*r,la=prev[0]*r,lb=cur[0]*r;const h=(Math.atan2(Math.sin(d)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(d))/r+360)%360;map.setGpsHeading(h);if(state.orientation==='head')map.setBearing(-h);}map.center(...state.location,Math.max(map.zoom,14));refreshMap();updateGpsProgress(true);if(state.demoIndex>=state.gpsPoints.length-1){stopDemo();$('nav-status').textContent='案内デモ：目的地に到着。';speak('目的地に到着しました');}},175);updateGpsProgress(true);}
// Android ShimanamiIslandHandoff: pause <=65m from current leg end AND <=160m remaining;
// resume <=90m from next island leg start. Bridge reference line is never a navigable GPX.
function loadIslandGuidance(i){
 // The avoidance area belongs to this road leg, never to any bridge or next island.
 if(state.manualDetourLegIndex!==null&&state.manualDetourLegIndex!==i){
  state.manualDetour=null;state.manualDetourLegIndex=null;
 }
 const leg=state.islandLegs[i];if(!leg)return;
 state.gpsPoints=leg.points;state.turnCues=leg.turnCues;state.saidCues=new Set();state.cumKm=[];
 for(let j=0;j<leg.points.length;j++)state.cumKm[j]=(state.cumKm[j-1]||0)+(j?km(leg.points[j-1],leg.points[j]):0);
}
function updateShimanamiGuidance(){
 if(state.navPaused||state.finishing||!state.location||!state.islandLegs.length)return;
 // Ignore low-precision fixes for gate changes. This is not a proof of legal bridge access.
 const goodFix=state.gpsAccuracy<=35;
 const i=state.islandIndex,leg=state.islandLegs[i];
 if(state.awaitingBridge){
  const next=state.islandLegs[i+1];if(!next)return;
  const d=km(state.location,next.points[0])*1000;
  if(goodFix&&d<=90){
   state.islandIndex=i+1;state.awaitingBridge=false;loadIslandGuidance(i+1);
   if(state.navActive)speak('次の島に入りました。一般道の音声案内を再開します');
  }else{$('nav-status').textContent=`しまなみ：橋区間の道路音声は停止中。${next.name}の開始地点まで約${Math.round(d)}m。現地原付道標識を優先してね。`;return;}
 }
 const active=state.islandLegs[state.islandIndex],pts=active.points,cum=state.cumKm;
 let nearest=Infinity,index=0;
 for(let j=0;j<pts.length;j++){const d=km(state.location,pts[j]);if(d<nearest){nearest=d;index=j;}}
 const remaining=Math.max(0,(cum.at(-1)||0)-(cum[index]||0))*1000;
 const endpointDistance=km(state.location,pts.at(-1))*1000;
 if(goodFix&&!active.checkpointAfter&&state.islandIndex<state.islandLegs.length-1&&!active.bridgeAfter&&endpointDistance<=90&&remaining<=160&&nearest<=.08){state.islandIndex++;loadIslandGuidance(state.islandIndex);if(state.navActive)speak('経由地を通過しました。次の区間を案内します');return;}
 if(goodFix&&active.bridgeAfter&&state.islandIndex<state.islandLegs.length-1&&endpointDistance<=65&&remaining<=160&&nearest<=.08){
  state.awaitingBridge=true;if(state.navActive)window.speechSynthesis?.cancel();
  if(state.navActive)speak('橋の入口付近です。ここからは現地の原付道標識を確認してください。橋の区間は音声案内を一時停止します');
  $('nav-status').textContent='しまなみ：橋の入口付近。島内音声停止中。次の島に入ったらGPSで自動再開します。';return;
 }
 const next=state.turnCues.find(c=>c.offset>=index&&c.desc!=='destination');let info='';
 if(next){const at=Math.min(pts.length-1,Math.max(0,next.offset));const until=Math.max(0,Math.round(1000*((cum[at]||0)-(cum[index]||0))),Math.round(BNaviRideLogic.meters(state.location,pts[at])));info=`／次：${cueText(next.desc)} 約${until}m`;
 if(state.navActive&&goodFix&&nearest<.08){
 if(until<=20&&until>=0&&nearest<.035&&state.gpsAccuracy<=25&&!state.saidCues.has('now-'+next.offset)){state.saidCues.add('now-'+next.offset);state.saidCues.add(next.offset);speak(cueText(next.desc));}
 else if(until<=130&&!state.saidCues.has(next.offset)){state.saidCues.add(next.offset);speak(`およそ${Math.max(10,Math.round(until/10)*10)}メートル先、${cueText(next.desc)}`);}
 }}
 $('nav-status').textContent=`しまなみ島内 ${state.islandIndex+1}/${state.islandLegs.length}：${active.name}／島内残り約${Math.round(remaining)}m／道路から約${Math.round(nearest*1000)}m${info}${!goodFix?'（GPS精度不足のため自動切替保留）':''}`;
}
function stopDemo(){if(state.demoTimer!=null)clearInterval(state.demoTimer);state.demoTimer=null;$('demo-off').disabled=true;$('demo-on').disabled=!['normal','imported'].includes(state.routeType);}
function showGpsMessage(message,ms=0){const el=$('map-gps-message');el.textContent=message;el.hidden=false;if(window.bnaviGpsMessageTimeout)clearTimeout(window.bnaviGpsMessageTimeout);if(ms)window.bnaviGpsMessageTimeout=setTimeout(()=>el.hidden=true,ms);}
function startGps(){
 stopDemo();
 if(state.watchId!=null){state.followGps=true;if(state.location){map.center(...state.location,Math.max(map.zoom,16));refreshMap();showGpsMessage('現在地に移動しました',2500);}return;}
 if(!window.isSecureContext){showGpsMessage('現在地を取得できません。スマホではHTTPSが必要です（PCのlocalhostは例外）。');$('gps-status').textContent='HTTPS接続が必要';return;}
 if(!navigator.geolocation){showGpsMessage('このブラウザでは位置情報を利用できません。');$('gps-status').textContent='GPS非対応';return;}
 state.followGps=true;state.gpsNotified=false;state.heading={heading:null,at:-Infinity};map.setGpsHeading(null);showGpsMessage('現在地を取得中…位置情報の許可を確認してね。');
 const ok=pos=>{if(state.navActive)window.BNaviTrack?.add(pos);state.location=[pos.coords.latitude,pos.coords.longitude];state.gpsAccuracy=pos.coords.accuracy;updateHeadingFromPosition(pos);state.motionGate?.observe(state.location,state.gpsAccuracy,pos.coords.speed,performance.now());$('gps-status').textContent=`位置取得 ±${Math.round(pos.coords.accuracy)}m${Number.isFinite(state.heading.heading)?'・進行方位あり':'・方位待ち'}`;if(state.followGps)map.center(...state.location,Math.max(map.zoom,16));refreshMap();window.BNaviRideMode?.updateNavigationRadar?.(state.location,state.heading.heading);const arrived=(state.navActive&&!state.navPaused)?observeDestination(state.location,state.gpsAccuracy,'nav'):false;if(!arrived&&!state.navPaused&&!state.finishing)updateGpsProgress();if(!arrived){clearPassedLocalDetour(state.location,state.gpsAccuracy);observeOffRoute(state.location,state.gpsAccuracy);}if(!state.gpsNotified){showGpsMessage(`現在地を表示中（精度 ±${Math.round(pos.coords.accuracy)}m）`,3300);state.gpsNotified=true;}};
 const err=x=>{const msg=x.code===1?'位置情報が拒否されています。ブラウザのサイト設定で許可してね。':x.code===2?'位置を取得できません。GPS・通信・端末の位置情報設定を確認してね。':'取得が時間切れです。屋外などで再試行してね。';$('gps-status').textContent='GPS失敗';showGpsMessage(msg);if(state.navActive){stopVoiceGuidance(false);$('nav-status').textContent='GPSエラー：'+msg;}stopGps();};
 $('gps-on').disabled=true;$('gps-off').disabled=false;state.watchId=navigator.geolocation.watchPosition(ok,err,{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
}
function stopGps(){if(state.watchId!=null)navigator.geolocation.clearWatch(state.watchId);state.watchId=null;state.location=null;map.setGpsHeading(null);refreshMap();$('gps-on').disabled=false;$('gps-off').disabled=true;$('gps-status').textContent='追従停止';}
function updateGpsProgress(demo=false){if(!state.location||state.navPaused||state.finishing)return;if(state.routeType==='shimanami'){updateShimanamiGuidance();return;}if(!['normal','imported'].includes(state.routeType)||state.gpsPoints.length<2){$('nav-status').textContent='現在地を表示中。橋の参考線・人道はGPS走行案内に利用しません。';return;}let nearest=Infinity,index=0;const pts=state.gpsPoints;for(let i=0;i<pts.length;i++){const d=km(state.location,pts[i]);if(d<nearest){nearest=d;index=i;}}const cum=state.cumKm,remaining=(cum.at(-1)||0)-(cum[index]||0);const next=state.turnCues.find(c=>c.offset>=index&&c.desc!=='destination');let instruction='';if(next){const nextIndex=Math.min(pts.length-1,Math.max(0,next.offset));const until=Math.max(0,Math.round(1000*((cum[nextIndex]||0)-(cum[index]||0))),Math.round(BNaviRideLogic.meters(state.location,pts[nextIndex])));instruction=`／次：${cueText(next.desc)} 約${until}m`;if((state.navActive||demo)&&state.gpsAccuracy<=35&&nearest<.08){
 if(until<=20&&until>=0&&nearest<.035&&state.gpsAccuracy<=25&&!state.saidCues.has('now-'+next.offset)){state.saidCues.add('now-'+next.offset);state.saidCues.add(next.offset);speak(cueText(next.desc));}
 else if(until<=130&&!state.saidCues.has(next.offset)){state.saidCues.add(next.offset);speak(`およそ${Math.max(10,Math.round(until/10)*10)}メートル先、${cueText(next.desc)}`);}
 }}$('nav-status').textContent=`${demo?'案内デモ':'GPS'}：経路まで約${Math.round(nearest*1000)}m／残り約${remaining.toFixed(1)}km${instruction}${nearest>.08?'（経路から離れています）':''}。GPX指示に基づく概算案内。`;}
$('vehicle').addEventListener('change',()=>{invalidateDisplayedRoute('排気量');updateModes();updateTuningUI();updatePresetUI('');$('preset-name').value='';persist();});$('mode').addEventListener('change',()=>{invalidateDisplayedRoute('走り方');chooseCustom(false);updateCustomRouteUI();updatePolicy();persist();});
$('start').addEventListener('input',()=>{updatePointSummaries();refreshMap();persist();});$('goal').addEventListener('input',()=>{updatePointSummaries();refreshMap();persist();});
$('clear-vias').addEventListener('click',()=>{state.via=[];renderVia();refreshMap();persist();});
$('calculate').addEventListener('click',calculate);// Registered before mobile-ui.js: suppress any stale legacy onclick still cached by an older PWA.
$('swap-endpoints').addEventListener('click',(event)=>{
 event.stopImmediatePropagation();
 swapEndpointsAndClearVias().catch(e=>setMessage('地点の交換に失敗しました：'+String(e?.message||e),true));
});bindFullRouteClear();$('clear-route').addEventListener('click',()=>{routePlanVersion++;clearResult();$('calculate').disabled=false;setMessage('結果だけ消したよ。出発地・目的地・経由地は残してあります。');});$('save-gpx').addEventListener('click',()=>{if(state.currentGpx)downloadGpx(state.currentGpx,'B_Navi_route.gpx');});
for(const id of ['hiroshima','shimanami','kanmon'])$(`sample-${id}`).addEventListener('click',()=>setExample(id));
$('zoom-in').addEventListener('click',()=>map.setZoom(map.zoom+1));$('zoom-out').addEventListener('click',()=>map.setZoom(map.zoom-1));$('center-hiroshima').addEventListener('click',()=>map.center(34.4,132.46,11));$('map-location').addEventListener('click',startGps);$('nav-radar-toggle').addEventListener('click',()=>window.BNaviRideMode?.openNavRadar?.());$('compass-reset').addEventListener('click',()=>setOrientationMode('north'));$('help-btn').addEventListener('click',()=>$('help-dialog').showModal());$('gps-on').addEventListener('click',startGps);$('gps-off').addEventListener('click',stopGps);$('demo-on').addEventListener('click',startDemo);$('demo-off').addEventListener('click',stopDemo);for(const id of ['nav-start','nav-start-quick'])$(id).addEventListener('click',startVoiceGuidance);for(const id of ['nav-stop','nav-stop-quick'])$(id).addEventListener('click',()=>stopVoiceGuidance(true));for(const id of ['voice-test','voice-test-quick'])$(id).addEventListener('click',voiceTest);
let restoringOffline=false;
let offlineSaveTimer=null;
function offlinePayload(){return {type:state.routeType,activeRouteTuning:state.activeRouteTuning,activeRoutingVehicle:state.activeRoutingVehicle,activeRoutingMode:state.activeRoutingMode,customRouting:state.customRouting,shimanamiBigMode:state.shimanamiBigMode,sections:state.routes.map(x=>({type:x.type,points:x.points,color:x.color,width:x.width,dash:x.dash,label:x.label,gpx:x.gpx,bridgeIndex:x.bridgeIndex,referenceOnly:x.referenceOnly,stageCheckpoint:x.stageCheckpoint})),mainGpx:state.currentGpx,shimanamiPlanPoints:state.shimanamiPlanPoints,shimanamiWebBuilt:state.shimanamiWebBuilt,islandLegs:state.islandLegs.map(x=>({name:x.name,points:x.points,turnCues:x.turnCues,bridgeAfter:x.bridgeAfter,sectionIndex:x.sectionIndex,checkpointAfter:x.checkpointAfter,wide:!!x.wide,mainlandCrossing:x.mainlandCrossing||null}))}}
function queueOfflineSave(){if(restoringOffline)return;if(offlineSaveTimer)clearTimeout(offlineSaveTimer);offlineSaveTimer=setTimeout(()=>saveOfflineRoute(),200)}
async function saveOfflineRoute(){try{if(!state.routeType||!state.routes.length)throw Error('ルートまたはGPXを先に読み込んでね');await BNaviOfflineRouteStore.save(offlinePayload());$('offline-status').textContent='この端末に経路を保存したよ。通信がなくても読み込めます。'}catch(e){$('offline-status').textContent='端末保存できませんでした：'+e.message}}
function storedRouteMismatch(data,vehicle,mode,currentPrefs){
 if(!data||data.activeRoutingVehicle===undefined||data.activeRoutingVehicle===null||
   ![0,1,2].includes(Number(data.activeRoutingVehicle)))
  return '前回の保存ルートは車種が確認できないため自動表示しなかったよ。ルート検索で再計算してね。';
 const saved=Number(data.activeRoutingVehicle),names=['50cc','51〜125cc','126cc以上'];
 if(saved!==vehicle)
  return '前回の保存ルートは'+names[saved]+'用。現在の'+names[vehicle]+'とは違うため表示せずに残してあるよ。ルート検索で再計算してね。';
 if(data.type==='shimanami'&&saved===2)
  return '原付用の橋参考線を126cc以上の経路として表示できません。しまなみ島渡りモードで再計算してね。';
 if(Number.isInteger(data.activeRoutingMode)&&data.activeRoutingMode!==mode)
  return '前回の保存ルートは別の走り方で計算したもの。現在の設定では表示せず、ルート検索で再計算してね。';
 if(mode<=2&&currentPrefs){
  const base=x=>({view:x?.view||'normal',ride:x?.ride||'normal',backroad:x?.backroad===true,coast:x?.coast===true});
  const selected=base(currentPrefs),old=base(data.activeRouteTuning?.preferences);
  if(selected.view!==old.view||selected.ride!==old.ride||selected.backroad!==old.backroad)
   return '前回の保存ルートは異なる好みのオプションで計算したもの。現在の設定でルート検索してね。';
 }
 return null;
}
async function restoreOfflineRoute(){const version=routePlanVersion;try{const data=await BNaviOfflineRouteStore.load();if(version!==routePlanVersion)return;if(!data){$('offline-status').textContent='まだ保存済みの経路はありません。';return}if(!Array.isArray(data.sections)||!data.sections.length)throw Error('保存データが壊れています');
 const mismatch=storedRouteMismatch(data,Number($('vehicle').value),routingMode(),currentPreferences());
 if(mismatch){$('offline-status').textContent=mismatch;setMessage(mismatch,true);return;}
 restoringOffline=true;
 await displayStoredRoute(data,'前回の'+(['50cc','51〜125cc','126cc以上'][Number(data.activeRoutingVehicle)]||'')+'用ルートを復元したよ（新規計算ではありません）。通信なしで案内できます。');
 $('offline-status').textContent='端末内に保存した経路を読み込んだよ。音声をONにしてGPS追従を開始してね。'
 }catch(e){$('offline-status').textContent='経路の読み込みに失敗しました：'+e.message}finally{restoringOffline=false}}
// Named *calculated* route collection: this includes route geometry and the tuning used
// to calculate it. Unlike named tuning presets, opening one requires no new BRouter call.
let myRouteSummaries=[];
function myRouteStatus(msg,error=false){const el=$('my-route-status');el.textContent=msg;el.classList.toggle('error',!!error);}
function selectedMyRoute(){return myRouteSummaries.find(x=>x.id===$('my-route-select').value);}
async function refreshMyRouteList(selectId){
 myRouteSummaries=await BNaviMyRouteLibrary.list();
 const select=$('my-route-select'),prev=selectId===undefined?select.value:selectId;
 select.replaceChildren();
 const empty=document.createElement('option');empty.value='';empty.textContent=myRouteSummaries.length?'マイルートを選んでね':'保存ルートはまだありません';select.append(empty);
 const vehicleNames=['50cc','51〜125cc','126cc以上'];
 for(const item of myRouteSummaries){const opt=document.createElement('option');opt.value=item.id;opt.textContent='['+vehicleNames[item.vehicle]+'] '+item.name;select.append(opt);}
 select.value=myRouteSummaries.some(x=>x.id===prev)?prev:'';
 $('my-route-count').textContent=myRouteSummaries.length+'件';
 $('my-route-load').disabled=!select.value;$('my-route-delete').disabled=!select.value;
}
function bindMyRouteUI(){
 $('my-route-select').addEventListener('change',()=>{
  const item=selectedMyRoute();$('my-route-load').disabled=!item;$('my-route-delete').disabled=!item;
  if(item)myRouteStatus('「'+item.name+'」を選択中。地図への読み込みはまだ行っていません。');
 });
 $('my-route-save').addEventListener('click',async()=>{
  try{
   if(!state.routeType||!state.routes.length)throw Error('まずルート検索またはGPX読み込みをしてね。');
   const name=BNaviMyRouteLibrary.cleanName($('my-route-name').value);
   if(!name)throw Error('ルート名を入力してね。');
   const vehicle=state.activeRoutingVehicle??Number($('vehicle').value);
   const prior=myRouteSummaries.find(x=>x.vehicle===vehicle&&x.name.toLocaleLowerCase('ja-JP')===name.toLocaleLowerCase('ja-JP'));
   if(prior&&!window.confirm('「'+name+'」の経路線とパラメータを上書きする？'))return;
   const saved=await BNaviMyRouteLibrary.save({name,vehicle,tuning:BNaviRouteTuning.normalize(state.activeRouteTuning??null,vehicle),start:$('start').value,goal:$('goal').value,via:state.via,route:offlinePayload()},prior?.id);
   await refreshMyRouteList(saved.id);myRouteStatus('「'+saved.name+'」を'+(saved.replaced?'上書き':'保存')+'したよ。道路線と計算条件をまとめて保管しています。');
  }catch(err){myRouteStatus('保存できませんでした：'+err.message,true)}
 });
 $('my-route-load').addEventListener('click',async()=>{
  try{
   if(state.navActive||window.BNaviRideMode?.isActive?.())throw Error('走行案内を終了してからマイルートを読み込んでね。');
   const item=selectedMyRoute();if(!item)return;
   const stored=await BNaviMyRouteLibrary.get(item.id);if(!stored)throw Error('保存済みルートがありません。');
   if(!stored.route?.sections?.length)throw Error('保存データが壊れています。');
   if(state.routeType&&state.routes.length&&!window.confirm('現在表示中の経路を「'+stored.name+'」に切り替える？'))return;
   const vehicle=stored.vehicle;
   $('vehicle').value=String(vehicle);
   const previouslySaved=BNaviRouteTuning.normalize(stored.route?.activeRouteTuning??stored.tuning,vehicle);
   routePreferences=BNaviRouteTuning.normalizePreferences(previouslySaved.preferences??OLD_STYLE_MIGRATION[previouslySaved.style]);
   customEnabled=false;
   updateModes();
   if(MODES[vehicle][Number(stored.route?.activeRoutingMode)]!==undefined)$('mode').value=String(stored.route.activeRoutingMode);
   else $('mode').value='1';
   tuningByVehicle[vehicle]=BNaviRouteTuning.normalize(stored.tuning,vehicle);
   storeTuning();updateTuningUI();updateCustomRouteUI();updatePolicy();updatePresetUI('');
   $('start').value=stored.start||'';$('goal').value=stored.goal||'';state.via=[...(stored.via||[])];
   renderVia();updatePointSummaries();persist();
   restoringOffline=true;
   try{await displayStoredRoute(stored.route,'「'+stored.name+'」を開いたよ。オンライン再計算なしで地図に表示しました。');}
   finally{restoringOffline=false;}
   $('my-route-name').value=stored.name;
   myRouteStatus('「'+stored.name+'」を開いたよ。計算時のパラメータと道路線・経由地を復元しました。');
  }catch(err){myRouteStatus('読み込めませんでした：'+err.message,true)}
 });
 $('my-route-delete').addEventListener('click',async()=>{
  const item=selectedMyRoute();if(!item)return;
  if(!window.confirm('保存済みの「'+item.name+'」を削除する？（現在表示している経路は残ります）'))return;
  try{await BNaviMyRouteLibrary.drop(item.id);await refreshMyRouteList('');myRouteStatus('「'+item.name+'」を削除したよ。');}
  catch(err){myRouteStatus('削除できませんでした：'+err.message,true)}
 });
 refreshMyRouteList().catch(err=>myRouteStatus('保存済みルートを読めません：'+err.message,true));
}
async function displayStoredRoute(data,message){
 if(!Array.isArray(data.sections)||!data.sections.length)throw Error('保存した経路データがありません。');
 if(data.type==='shimanami'&&Number(data.activeRoutingVehicle??$('vehicle').value)===2)
  throw Error('126cc以上では原付用の橋参考線を経路として読み込めません。');
 state.activeRoutingVehicle=data.activeRoutingVehicle??Number($('vehicle').value);
 state.activeRoutingMode=Number.isInteger(data.activeRoutingMode)?data.activeRoutingMode:1;
 // Read old saved routes as general unless their stored tuning was nondefault.
 state.customRouting=Boolean(data.customRouting??!BNaviRouteTuning.isDefault(data.activeRouteTuning,state.activeRoutingVehicle));
 state.activeRouteTuning=state.customRouting?BNaviRouteTuning.normalize(data.activeRouteTuning??null,state.activeRoutingVehicle):null;
 routeView(data.type,data.sections,data.mainGpx||null,message);
 state.shimanamiBigMode=data.shimanamiBigMode===true;
 if(state.shimanamiBigMode)$('route-label').textContent='しまなみ島渡り';
 if(data.type==='shimanami'&&Array.isArray(data.islandLegs)&&data.islandLegs.length){
  state.islandLegs=data.islandLegs;
  state.shimanamiPlanPoints=Array.isArray(data.shimanamiPlanPoints)?data.shimanamiPlanPoints:[];
  state.shimanamiWebBuilt=Boolean(data.shimanamiWebBuilt);
  state.islandIndex=0;loadIslandGuidance(0);
 }
}
$('shimanami-desk-verify').addEventListener('click',verifyShimanamiDesk);
$('offline-save').addEventListener('click',saveOfflineRoute);
$('offline-load').addEventListener('click',restoreOfflineRoute);
updateModes();loadTuning();restore();bindTuning();bindCustomRouteUI();bindRoutePreferenceHelp();bindRoutePreferenceToggle();bindBiwakoDecisionDialog();bindShimanamiBigDialog();bindPresetUI();bindMyRouteUI();renderVia();updatePointSummaries();syncNavigationButtons();refreshMap();fitMarkers();refreshServer();setPick('start');if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});restoreOfflineRoute();
