/* B_Navi PC PWA: local interactive map + original Android-derived Java BRouter API.
 * Map tiles are visual only; they never decide vehicle permissions or routing.
 * Bridge reference and Kanmon push-walk lines MUST NOT be exported as riding GPX.
 */
'use strict';
const $=id=>document.getElementById(id);
const ROUTE_POLICIES=['ビギナー：狭い道と曲がりを抑え、走りやすい道を優先。信号は多少許容。','一般：適度な道幅と連続性を重視し、登録済み信号を強めに回避。','探索：市街地は走りやすい裏道、郊外は緑や水辺の近さを推定評価。','ファストトラベル：高速・有料道路を優先（126cc以上のみ）。'];
const MODES=[['ビギナー','一般','探索'],['ビギナー','一般','探索'],['ビギナー','一般','探索','ファストトラベル（高速・有料優先）']];
const state={pick:'start',via:[],routes:[],currentGpx:null,location:null,watchId:null,routeType:null,gpsPoints:[],lastInputHash:'',turnCues:[],demoTimer:null,demoIndex:0,saidCues:new Set(),cumKm:[],islandLegs:[],islandIndex:0,awaitingBridge:false,gpsAccuracy:Infinity};
const map=new BNaviMapCore.MapCore($('map-container'),$('tile-layer'),$('map-overlay'),$('path-layer'),$('point-layer'),$('gps-layer'),handleMapClick);
// The existing search/favorites action dialog is also used for a map long-press.
map.onLongPress=point=>window.BNaviSelectMapPoint?.(point);
function setMessage(message,error=false){$('message').textContent=message;$('message').classList.toggle('error',error);}
function setPick(kind){state.pick=kind;for(const btn of document.querySelectorAll('.pick'))btn.classList.toggle('active',btn.dataset.pick===kind);$('map-hint').textContent=kind==='start'?'地図をクリック → 出発地':kind==='goal'?'地図をクリック → 目的地':'地図をクリック → 経由地を追加';}
const placeLabels={};
function rememberPlaceLabel(coord,name){if(coord&&name){placeLabels[coord]=String(name).slice(0,100);try{localStorage.setItem('bnavi.placeLabels.v1',JSON.stringify(placeLabels))}catch{}}updatePointSummaries();}
function pointLabel(coord){return placeLabels[coord]||'地図で指定した地点';}
function updatePointSummaries(){for(const [id,title,mark] of [['start','出発地','●'],['goal','目的地','◆']]){const el=$(id+'-summary');if(el)el.textContent=mark+' '+title+'：'+($(id).value.trim()?pointLabel($(id).value.trim()):'未設定');}}
try{Object.assign(placeLabels,JSON.parse(localStorage.getItem('bnavi.placeLabels.v1')||'{}'))}catch{}
function fmt(p){return `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`;}
function parsePoint(s){const arr=s.trim().split(',').map(x=>Number(x.trim()));if(arr.length!==2||!arr.every(Number.isFinite)||arr[0]<20||arr[0]>46||arr[1]<122||arr[1]>154)throw new Error('地点は「緯度,経度」で入力してね（日本国内の座標）。');return arr;}
function inputPoint(id){return $(id).value.trim()?parsePoint($(id).value):null;}
function handleMapClick(p){const point=[p.lat,p.lon];if(state.pick==='via'){if(state.via.length>=50){setMessage('経由地は50件までだよ。',true);return;}state.via.push(fmt(point));rememberPlaceLabel(fmt(point),'地図で指定した地点');renderVia();}else{$(state.pick).value=fmt(point);rememberPlaceLabel(fmt(point),'地図で指定した地点');if(state.pick==='start'&&!$('goal').value.trim())setPick('goal');}refreshMap();updatePointSummaries();persist();}
function updatePolicy(){const el=$('route-policy');if(el)el.textContent=ROUTE_POLICIES[Number($('mode').value)]||'';}
function updateModes(){const i=Number($('vehicle').value),sel=$('mode'),prev=sel.value;sel.replaceChildren();MODES[i].forEach((m,n)=>{const o=document.createElement('option');o.value=String(n);o.textContent=m;sel.append(o);});sel.value=Number(prev)<MODES[i].length?prev:'1';updatePolicy();}
function renderVia(){const el=$('via-list');el.replaceChildren();state.via.forEach((v,i)=>{const row=document.createElement('div');row.className='via-row';const info=document.createElement('div');info.className='via-info';const label=document.createElement('strong');label.textContent=(i+1)+'. '+pointLabel(v);info.append(label);const details=document.createElement('details');details.className='coordinate-details';const summary=document.createElement('summary');summary.textContent='座標を確認・編集';details.append(summary);const input=document.createElement('input');input.setAttribute('aria-label',`経由地${i+1}の座標`);input.value=v;input.placeholder='緯度,経度';input.addEventListener('input',()=>{state.via[i]=input.value;label.textContent=(i+1)+'. '+pointLabel(input.value);refreshMap();persist();});details.append(input);info.append(details);row.append(info);for(const [sym,title,action] of [['↑','上へ',()=>swapVia(i,i-1)],['↓','下へ',()=>swapVia(i,i+1)],['×','削除',()=>{state.via.splice(i,1);renderVia();refreshMap();persist();}]]){const b=document.createElement('button');b.textContent=sym;b.type='button';b.title=title;b.setAttribute('aria-label',`経由地${i+1}を${title}`);b.disabled=(sym==='↑'&&i===0)||(sym==='↓'&&i===state.via.length-1);b.addEventListener('click',action);row.append(b);}el.append(row);});$('via-count').textContent=String(state.via.length);updatePointSummaries();}
function swapVia(a,b){if(b<0||b>=state.via.length)return;[state.via[a],state.via[b]]=[state.via[b],state.via[a]];renderVia();refreshMap();persist();}
function getMarkers(){const markers=[];try{const p=inputPoint('start');if(p)markers.push({point:p,label:'出発',symbol:'S',color:'#15955f'});}catch{}state.via.forEach((str,i)=>{try{markers.push({point:parsePoint(str),label:'経由'+(i+1),symbol:String((i+1)%10),color:'#df9237'});}catch{}});try{const p=inputPoint('goal');if(p)markers.push({point:p,label:'目的地',symbol:'G',color:'#cc4f57'});}catch{}return markers;}
function refreshMap(){map.setData(state.routes,getMarkers(),state.location);}
function persist(){try{localStorage.setItem('bnavi.pc.v1',JSON.stringify({start:$('start').value,goal:$('goal').value,via:state.via,vehicle:$('vehicle').value,mode:$('mode').value}));}catch{}}
function restore(){try{const x=JSON.parse(localStorage.getItem('bnavi.pc.v1')||'null');if(!x)return;$('start').value=x.start||'';$('goal').value=x.goal||'';state.via=Array.isArray(x.via)?x.via.slice(0,50).map(String):[];$('vehicle').value=['0','1','2'].includes(x.vehicle)?x.vehicle:'1';updateModes();$('mode').value=x.mode||'1';updatePolicy();}catch{}}
function getRequestPoints(){if(!$('start').value.trim()||!$('goal').value.trim())throw new Error('出発地と目的地を、地図で指定してね。');const a=[parsePoint($('start').value)];for(const text of state.via)a.push(parsePoint(text));a.push(parsePoint($('goal').value));if(a.length>52)throw new Error('地点が多すぎます。');return a;}
function gpxTurnCues(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');return [...doc.getElementsByTagNameNS('*','rtept')].map(n=>{const d=n.getElementsByTagNameNS('*','desc')[0]?.textContent||'';const offsetNode=n.getElementsByTagNameNS('*','offset')[0];return {desc:d,offset:offsetNode?Number(offsetNode.textContent):NaN,lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon'))};}).filter(x=>Number.isFinite(x.offset)&&Number.isFinite(x.lat)&&Number.isFinite(x.lon));}
function gpxPoints(xml){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('GPXの解析に失敗しました');let nodes=[...doc.getElementsByTagNameNS('*','trkpt')];if(!nodes.length)nodes=[...doc.getElementsByTagNameNS('*','rtept')];const pts=nodes.map(x=>[Number(x.getAttribute('lat')),Number(x.getAttribute('lon'))]).filter(x=>x.every(Number.isFinite));if(pts.length<2)throw new Error('GPXに道路の軌跡点がありません。');return pts;}
function km(a,b){const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;const t=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(t)));}
function distance(pts){let sum=0;for(let i=1;i<pts.length;i++)sum+=km(pts[i-1],pts[i]);return sum;}
function sampled(pts,max=6500){if(pts.length<=max)return pts;const step=Math.ceil(pts.length/max);const a=pts.filter((_,i)=>i%step===0);if(a.at(-1)!==pts.at(-1))a.push(pts.at(-1));return a;}
function routeView(type,sections,mainGpx,msg){state.islandLegs=[];state.islandIndex=0;state.awaitingBridge=false;state.routeType=type;state.currentGpx=mainGpx||null;state.routes=sections.filter(x=>x.points?.length>=2).map(x=>({...x,points:sampled(x.points)}));state.gpsPoints=type==='normal'?sections[0]?.points||[]:[];state.turnCues=type==='normal'&&mainGpx?gpxTurnCues(mainGpx):[];state.saidCues=new Set();state.cumKm=[];for(let i=0;i<state.gpsPoints.length;i++)state.cumKm[i]=(state.cumKm[i-1]||0)+(i?km(state.gpsPoints[i-1],state.gpsPoints[i]):0);$('demo-on').disabled=type!=='normal';$('demo-off').disabled=true;$('save-gpx').disabled=!mainGpx;$('fit-route').disabled=!state.routes.length;
 const road=sections.filter(x=>x.type!=='bridge'&&x.type!=='walk'),len=road.reduce((a,b)=>a+distance(b.points),0);const bad=sections.filter(x=>x.type==='bridge'||x.type==='walk').length;
 $('route-label').textContent=type==='normal'?'通常道路':type==='shimanami'?'しまなみ島内':type==='kanmon50'?'関門・人道':'ルート';
 $('metrics').innerHTML='';const metric=document.createElement('div');const bold=document.createElement('strong');bold.textContent=`${len.toFixed(1)} km`;metric.append(bold);const sub=document.createElement('div');sub.textContent=`道路区間 ${road.length} 本　/　参考区間 ${bad} 本`;metric.append(sub);$('metrics').append(metric);
 const list=$('route-segments');list.replaceChildren();sections.forEach((sec,i)=>{const row=document.createElement('div');row.className='segment';const text=document.createElement('div');text.textContent=sec.label||`区間${i+1}`;if(sec.type==='bridge'||sec.type==='walk'){const s=document.createElement('span');s.className='sub';s.textContent=sec.type==='walk'?'押し歩き（走行GPX対象外）':'橋の参考線（走行GPX対象外）';text.append(s);}const btn=document.createElement('button');btn.type='button';btn.textContent=sec.gpx?'GPX':'表示';btn.addEventListener('click',()=>{map.fit(sec.points);if(sec.gpx)downloadGpx(sec.gpx,`B_Navi_${i+1}_${sanitizeName(sec.label||'route')}.gpx`);});row.append(text,btn);list.append(row);});
 refreshMap();fitResult();setMessage(msg);if(type==='normal'||type==='imported')queueOfflineSave();}
function sanitizeName(text){return text.replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,36);}
function downloadGpx(xml,name){const blob=new Blob([xml],{type:'application/gpx+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function fitResult(){const points=state.routes.flatMap(x=>x.points);if(points.length)map.fit(sampled(points,4000));else fitMarkers();}
function fitMarkers(){const x=getMarkers().map(m=>m.point);if(x.length)map.fit(x);}
function clearResult(){stopDemo();state.islandLegs=[];state.islandIndex=0;state.awaitingBridge=false;state.turnCues=[];state.cumKm=[];$('demo-on').disabled=true;$('demo-off').disabled=true;state.routeType=null;state.currentGpx=null;state.routes=[];state.gpsPoints=[];$('save-gpx').disabled=true;$('fit-route').disabled=true;$('route-label').textContent='未計算';$('metrics').textContent='計算すると距離や経路が表示されるよ。';$('route-segments').replaceChildren();refreshMap();}
const API_CONFIG_KEY='bnavi.routeApiBase.v1';
function hostedOnPages(){return location.hostname.endsWith('.github.io')}
function usePublicBrouter(){return hostedOnPages()&&!(localStorage.getItem(API_CONFIG_KEY)||'').trim()}
function needsDedicatedApi(points){
 // Public BRouter has no B_Navi-specific island-bridge or tunnel-push API.
 const inShimanami=p=>p[0]>=34.0&&p[0]<=34.45&&p[1]>=132.88&&p[1]<=133.26;
 const inKanmon=p=>p[0]>=33.89&&p[0]<=34.04&&p[1]>=130.8&&p[1]<=131.10;
 const longTrip=(km(points[0],points.at(-1))>8);
 return Number($('vehicle').value)<=1&&longTrip&&
   ((points.every(inShimanami))||(points.every(inKanmon)));
}
async function calculatePublicRoute(points){
 if(needsDedicatedApi(points))throw Error('しまなみ・関門の原付専用案内は公開BRouterでは再現できません。専用B_Navi Javaサーバー接続が必要です。');
 if(typeof BNaviPublicBrouter==='undefined')throw Error('旧PWAのBRouterクライアントを読み込めません');
 setMessage('旧PWA方式：公開BRouterへAndroid由来BRFを送って経路を計算中…');
 const result=await BNaviPublicBrouter.query(points,$('vehicle').value,$('mode').value);
 routeView('normal',[{type:'road',points:result.track.points,color:'#06799b',width:5,label:'公開BRouter・旧PWA方式（試験）',gpx:result.gpx}],result.gpx,
   '公開BRouter試験計算：'+result.profile+'。GPXと案内指示を端末に保存。道路規制・適法性は未検証。'+(!result.track.cues.length?'今回は音声用右左折指示が返りませんでした。':''));
}

function apiRoot(){
 const configured=(localStorage.getItem(API_CONFIG_KEY)||'').trim();
 if(configured){const url=new URL(configured);if(url.protocol!=='https:'&&!(url.hostname==='localhost'&&url.protocol==='http:'))throw Error('経路サーバーはHTTPSのURLを指定してください');return url.href.endsWith('/')?url.href:url.href+'/'}
 if(hostedOnPages())throw Error('オンライン経路サーバーが未設定です。「オンライン経路計算の接続設定」からHTTPS APIを指定してね。');
 return new URL('./',location.href).href;
}
function apiUrl(path){return new URL('api/'+path,apiRoot()).href}
function updateApiSettings(){const u=localStorage.getItem(API_CONFIG_KEY)||'';$('route-api-base').value=u;$('route-api-status').textContent=u?'接続先：'+u:(hostedOnPages()?'旧PWA方式の公開BRouterで通常経路を試験計算します。しまなみ・関門の専用処理は別のB_Navi Java APIが必要です。':'この端末のローカルJavaサーバーを利用します。')}
$('route-api-save').addEventListener('click',()=>{try{const raw=$('route-api-base').value.trim();if(!raw)throw Error('URLを入力してください');const url=new URL(raw);if(url.protocol!=='https:'&&!(url.hostname==='localhost'&&url.protocol==='http:'))throw Error('HTTPSのURLを指定してください');localStorage.setItem(API_CONFIG_KEY,url.href);updateApiSettings();refreshServer()}catch(e){$('route-api-status').textContent='設定エラー：'+e.message}});
$('route-api-clear').addEventListener('click',()=>{localStorage.removeItem(API_CONFIG_KEY);updateApiSettings();refreshServer()});
updateApiSettings();
async function postApi(path,points){const form=new URLSearchParams({vehicle:$('vehicle').value,mode:$('mode').value,points:points.map(fmt).join('|')});const response=await fetch(apiUrl(path),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});const text=await response.text();if(!response.ok)throw new Error(text.slice(0,300));return {response,text};}
async function calculate(){const btn=$('calculate');btn.disabled=true;clearResult();try{const points=getRequestPoints();persist();setMessage('BRouter計算中。道路データを照合しています…');
 if(usePublicBrouter()){await calculatePublicRoute(points);return;}
  // Each waypoint is mandatory and stays in the requested order. A Shimanami
  // crossing is handled one pair at a time, including reverse crossings.
  if(Number($('vehicle').value)<=1 && points.length>2 && points.every(p=>p[0]>34.0&&p[0]<34.45&&p[1]>132.9&&p[1]<133.25)){
   await calculateWaypointJourney(points);
  }else{
   try{const {response,text}=await postApi('route',points);const mime=response.headers.get('content-type')||'';
    if(mime.includes('application/json')){const data=JSON.parse(text);if(data.type!=='kanmon_50cc_push_walk')throw new Error('未対応のルート形式です。');const sections=data.segments.filter(s=>Array.isArray(s.points)&&s.points.length>=2).map((s,i)=>({type:s.type==='human_push_walk_reference'?'walk':'road',points:s.points,color:s.type==='human_push_walk_reference'?'#e64a64':'#06799b',width:4,dash:s.type==='human_push_walk_reference'?'8 7':null,label:s.type==='human_push_walk_reference'?'関門人道（エンジン停止・押し歩き）':i===0?'人道入口までの道路':'人道出口からの道路'}));routeView('kanmon50',sections,null,'50cc：人道入口・出口までを道路計算。人道区間は押し歩きのみ。走行GPXに連結しません。');}
    else{const road=gpxPoints(text);routeView('normal',[{type:'road',points:road,color:'#06799b',width:5,label:'BRouter道路経路',gpx:text}],text,response.headers.get('X-BNavi-Route')==='kanmon-r2-verified'?'125cc：関門国道2号のトンネル経由を計算したよ。':`選択した探索条件：${$('mode').selectedOptions[0]?.textContent}（${ROUTE_POLICIES[Number($('mode').value)]}）。異なる条件でも道路網と区間によっては同じ経路になる場合があります。`);}
   }catch(error){const reason=String(error.message||error);if(Number($('vehicle').value)<=1&&state.via.length===0&&reason.includes('しまなみ')){await calculateShimanami(points);}else throw error;}
  }
 }catch(e){setMessage('計算できなかったよ：'+String(e?.message||e),true);}finally{btn.disabled=false;}}
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
async function calculateShimanami(points){setMessage('しまなみ島内道路と橋参考線を計算中…');const result=await buildShimanamiPair(points);routeView('shimanami',result.sections,null,`しまなみ：島内${result.guidance.length}区間・橋${result.bridges}本。橋は参考表示のみ。GPXは島内道路ごとに保存できます。`);state.islandLegs=result.guidance;loadIslandGuidance(0);queueOfflineSave();}
async function calculateWaypointJourney(points){
 const sections=[],guidance=[];let bridgeCount=0;
 for(let i=0;i<points.length-1;i++){
  setMessage(`経由地を順番に計算中：${i+1}/${points.length-1}区間…`);
  const pair=[points[i],points[i+1]];
  try{
   const {response,text}=await postApi('route',pair);
   if((response.headers.get('content-type')||'').includes('json'))throw new Error('この区間は通常の走行GPXを生成できません');
   const road=gpxPoints(text);sections.push({type:'road',points:road,color:'#06799b',width:5,label:`${i+1}区間目：道路`,gpx:text});guidance.push({name:`${i+1}区間目`,points:road,turnCues:gpxTurnCues(text),bridgeAfter:false});
  }catch(error){
   if(!String(error.message||error).includes('しまなみ'))throw new Error(`${i+1}区間目：${error.message||error}`);
   const result=await buildShimanamiPair(pair,`${i+1}区間目・`);sections.push(...result.sections);guidance.push(...result.guidance);bridgeCount+=result.bridges;
  }
 }
 if(!sections.length)throw new Error('経由地ルートを作成できませんでした');
 routeView('shimanami',sections,null,`経由地${points.length-2}件を指定順に計算。道路${guidance.length}区間、橋${bridgeCount}回。島内GPXは区間別保存。橋参考線はGPX・音声案内へ含めません。`);
 state.islandLegs=guidance;loadIslandGuidance(0);
}
function setExample(which){clearResult();state.via=[];if(which==='hiroshima'){$('vehicle').value='1';updateModes();$('mode').value='1';updatePolicy();$('start').value='34.397340,132.459390';$('goal').value='34.406310,132.476000';}
 if(which==='shimanami'){$('vehicle').value='1';updateModes();$('mode').value='1';updatePolicy();$('start').value='34.389000,133.200000';$('goal').value='34.064000,132.995000';}
 if(which==='kanmon'){$('vehicle').value='0';updateModes();$('mode').value='1';updatePolicy();$('start').value='33.975115,130.947556';$('goal').value='33.951385,130.968889';}
 renderVia();refreshMap();fitMarkers();persist();setPick('start');setMessage('テスト地点を設定したよ。計算ボタンで実際のBRouterを試せるよ。');}
async function refreshServer(){if(usePublicBrouter()){$('server-status').textContent='● 公開BRouter試験モード';$('server-status').classList.remove('bad');return;}try{const r=await fetch(apiUrl('status'),{cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);const d=await r.json();$('server-status').textContent=d.routeReady?`● BRouter準備OK / RD5 ${d.segments}件`:'● 道路データがありません';$('server-status').classList.toggle('bad',!d.routeReady);}catch(e){$('server-status').textContent='● サーバーに接続できません';$('server-status').classList.add('bad');setMessage(hostedOnPages()?'オンライン経路サーバーは未接続です。GPXの読み込みとオフライン案内は使えます。':'BRouterサーバーへ接続できません。',true);}}
function speak(text){if(!$('voice-on').checked||!('speechSynthesis'in window))return;try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ja-JP';u.rate=1.05;window.speechSynthesis.speak(u);}catch(e){console.warn(e);}}
function cueText(desc){const name={'start':'出発です','destination':'目的地です','left':'左折です','right':'右折です','slight left':'やや左方向です','slight right':'やや右方向です','sharp left':'大きく左折です','sharp right':'大きく右折です','straight':'直進です','keep left':'左方向です','keep right':'右方向です','u-turn':'Uターンです'};return name[desc]||'この先、曲がり角です';}
function startDemo(){if(state.routeType!=='normal'||!state.gpsPoints.length)return;stopGps();stopDemo();state.demoIndex=0;state.saidCues=new Set();$('demo-on').disabled=true;$('demo-off').disabled=false;state.demoTimer=setInterval(()=>{state.demoIndex=Math.min(state.gpsPoints.length-1,state.demoIndex+Math.max(1,Math.floor(state.gpsPoints.length/260)));state.location=state.gpsPoints[state.demoIndex];map.center(...state.location,Math.max(map.zoom,14));refreshMap();updateGpsProgress(true);if(state.demoIndex>=state.gpsPoints.length-1){stopDemo();$('nav-status').textContent='案内デモ：目的地に到着。';speak('目的地に到着しました');}},175);updateGpsProgress(true);}
// Android ShimanamiIslandHandoff: pause <=65m from current leg end AND <=160m remaining;
// resume <=90m from next island leg start. Bridge reference line is never a navigable GPX.
function loadIslandGuidance(i){
 const leg=state.islandLegs[i];if(!leg)return;
 state.gpsPoints=leg.points;state.turnCues=leg.turnCues;state.saidCues=new Set();state.cumKm=[];
 for(let j=0;j<leg.points.length;j++)state.cumKm[j]=(state.cumKm[j-1]||0)+(j?km(leg.points[j-1],leg.points[j]):0);
}
function updateShimanamiGuidance(){
 if(!state.location||!state.islandLegs.length)return;
 // Ignore low-precision fixes for gate changes. This is not a proof of legal bridge access.
 const goodFix=state.gpsAccuracy<=35;
 const i=state.islandIndex,leg=state.islandLegs[i];
 if(state.awaitingBridge){
  const next=state.islandLegs[i+1];if(!next)return;
  const d=km(state.location,next.points[0])*1000;
  if(goodFix&&d<=90){
   state.islandIndex=i+1;state.awaitingBridge=false;loadIslandGuidance(i+1);
   speak('次の島に入りました。一般道の音声案内を再開します');
  }else{$('nav-status').textContent=`しまなみ：橋区間の道路音声は停止中。${next.name}の開始地点まで約${Math.round(d)}m。現地原付道標識を優先してね。`;return;}
 }
 const active=state.islandLegs[state.islandIndex],pts=active.points,cum=state.cumKm;
 let nearest=Infinity,index=0;
 for(let j=0;j<pts.length;j++){const d=km(state.location,pts[j]);if(d<nearest){nearest=d;index=j;}}
 const remaining=Math.max(0,(cum.at(-1)||0)-(cum[index]||0))*1000;
 const endpointDistance=km(state.location,pts.at(-1))*1000;
 if(goodFix&&state.islandIndex<state.islandLegs.length-1&&!active.bridgeAfter&&endpointDistance<=90&&remaining<=160&&nearest<=.08){state.islandIndex++;loadIslandGuidance(state.islandIndex);speak('経由地を通過しました。次の区間を案内します');return;}
 if(goodFix&&active.bridgeAfter&&state.islandIndex<state.islandLegs.length-1&&endpointDistance<=65&&remaining<=160&&nearest<=.08){
  state.awaitingBridge=true;window.speechSynthesis?.cancel();
  speak('橋の入口付近です。ここからは現地の原付道標識を確認してください。橋の区間は音声案内を一時停止します');
  $('nav-status').textContent='しまなみ：橋の入口付近。島内音声停止中。次の島に入ったらGPSで自動再開します。';return;
 }
 const next=state.turnCues.find(c=>c.offset>index&&c.desc!=='destination');let info='';
 if(next){const at=Math.min(pts.length-1,Math.max(0,next.offset));const until=Math.max(0,Math.round(1000*((cum[at]||0)-(cum[index]||0))));info=`／次：${cueText(next.desc)} 約${until}m`;
 if(goodFix&&nearest<.08&&until<=130&&!state.saidCues.has(next.offset)){
 state.saidCues.add(next.offset);speak(`およそ${Math.max(10,Math.round(until/10)*10)}メートル先、${cueText(next.desc)}`);
 }}
 $('nav-status').textContent=`しまなみ島内 ${state.islandIndex+1}/${state.islandLegs.length}：${active.name}／島内残り約${Math.round(remaining)}m／道路から約${Math.round(nearest*1000)}m${info}${!goodFix?'（GPS精度不足のため自動切替保留）':''}`;
}
function stopDemo(){if(state.demoTimer!=null)clearInterval(state.demoTimer);state.demoTimer=null;$('demo-off').disabled=true;$('demo-on').disabled=state.routeType!=='normal';}
function showGpsMessage(message,ms=0){const el=$('map-gps-message');el.textContent=message;el.hidden=false;if(window.bnaviGpsMessageTimeout)clearTimeout(window.bnaviGpsMessageTimeout);if(ms)window.bnaviGpsMessageTimeout=setTimeout(()=>el.hidden=true,ms);}
function startGps(){
 stopDemo();
 if(state.watchId!=null){if(state.location){map.center(...state.location,Math.max(map.zoom,16));refreshMap();showGpsMessage('現在地に移動しました',2500);}return;}
 if(!window.isSecureContext){showGpsMessage('現在地を取得できません。スマホではHTTPSが必要です（PCのlocalhostは例外）。');$('gps-status').textContent='HTTPS接続が必要';return;}
 if(!navigator.geolocation){showGpsMessage('このブラウザでは位置情報を利用できません。');$('gps-status').textContent='GPS非対応';return;}
 showGpsMessage('現在地を取得中…位置情報の許可を確認してね。');
 const ok=pos=>{state.location=[pos.coords.latitude,pos.coords.longitude];state.gpsAccuracy=pos.coords.accuracy;$('gps-status').textContent=`位置取得 ±${Math.round(pos.coords.accuracy)}m`;map.center(...state.location,Math.max(map.zoom,16));refreshMap();updateGpsProgress();showGpsMessage(`現在地を表示中（精度 ±${Math.round(pos.coords.accuracy)}m）`,3300);};
 const err=x=>{const msg=x.code===1?'位置情報が拒否されています。ブラウザのサイト設定で許可してね。':x.code===2?'位置を取得できません。GPS・通信・端末の位置情報設定を確認してね。':'取得が時間切れです。屋外などで再試行してね。';$('gps-status').textContent='GPS失敗';showGpsMessage(msg);stopGps();};
 $('gps-on').disabled=true;$('gps-off').disabled=false;state.watchId=navigator.geolocation.watchPosition(ok,err,{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
}
function stopGps(){if(state.watchId!=null)navigator.geolocation.clearWatch(state.watchId);state.watchId=null;$('gps-on').disabled=false;$('gps-off').disabled=true;$('gps-status').textContent='追従停止';}
function updateGpsProgress(demo=false){if(!state.location)return;if(state.routeType==='shimanami'){updateShimanamiGuidance();return;}if(state.routeType!=='normal'||state.gpsPoints.length<2){$('nav-status').textContent='現在地を表示中。橋の参考線・人道はGPS走行案内に利用しません。';return;}let nearest=Infinity,index=0;const pts=state.gpsPoints;for(let i=0;i<pts.length;i++){const d=km(state.location,pts[i]);if(d<nearest){nearest=d;index=i;}}const cum=state.cumKm,remaining=(cum.at(-1)||0)-(cum[index]||0);const next=state.turnCues.find(c=>c.offset>index&&c.desc!=='destination');let instruction='';if(next){const nextIndex=Math.min(pts.length-1,Math.max(0,next.offset));const until=Math.max(0,Math.round(1000*((cum[nextIndex]||0)-(cum[index]||0))));instruction=`／次：${cueText(next.desc)} 約${until}m`;if(until<=130&&!state.saidCues.has(next.offset)&&nearest<.08){state.saidCues.add(next.offset);speak(`およそ${Math.max(10,Math.round(until/10)*10)}メートル先、${cueText(next.desc)}`);}}$('nav-status').textContent=`${demo?'案内デモ':'GPS'}：経路まで約${Math.round(nearest*1000)}m／残り約${remaining.toFixed(1)}km${instruction}${nearest>.08?'（経路から離れています）':''}。GPX指示に基づく概算案内。`;}
$('vehicle').addEventListener('change',()=>{updateModes();persist();});$('mode').addEventListener('change',()=>{updatePolicy();persist();});
for(const b of document.querySelectorAll('.pick'))b.addEventListener('click',()=>setPick(b.dataset.pick));$('start-pick').addEventListener('click',()=>setPick('start'));$('goal-pick').addEventListener('click',()=>setPick('goal'));
$('start').addEventListener('input',()=>{updatePointSummaries();refreshMap();persist();});$('goal').addEventListener('input',()=>{updatePointSummaries();refreshMap();persist();});
$('add-via').addEventListener('click',()=>{if(state.via.length>=50){setMessage('経由地は50件まで。',true);return;}setPick('via');setMessage('地図上で経由地をクリックしてね。');});$('clear-vias').addEventListener('click',()=>{state.via=[];renderVia();refreshMap();persist();});
$('calculate').addEventListener('click',calculate);$('clear-route').addEventListener('click',()=>{clearResult();setMessage('結果を消したよ。地点は残してあります。');});$('fit-route').addEventListener('click',fitResult);$('save-gpx').addEventListener('click',()=>{if(state.currentGpx)downloadGpx(state.currentGpx,'B_Navi_route.gpx');});
for(const id of ['hiroshima','shimanami','kanmon'])$(`sample-${id}`).addEventListener('click',()=>setExample(id));
$('zoom-in').addEventListener('click',()=>map.setZoom(map.zoom+1));$('zoom-out').addEventListener('click',()=>map.setZoom(map.zoom-1));$('center-hiroshima').addEventListener('click',()=>map.center(34.4,132.46,11));$('map-location').addEventListener('click',startGps);$('compass-reset').addEventListener('click',()=>map.setBearing(0));$('help-btn').addEventListener('click',()=>$('help-dialog').showModal());$('gps-on').addEventListener('click',startGps);$('gps-off').addEventListener('click',stopGps);$('demo-on').addEventListener('click',startDemo);$('demo-off').addEventListener('click',stopDemo);
let restoringOffline=false;
let offlineSaveTimer=null;
function offlinePayload(){return {type:state.routeType,sections:state.routes.map(x=>({type:x.type,points:x.points,color:x.color,width:x.width,dash:x.dash,label:x.label,gpx:x.gpx})),mainGpx:state.currentGpx,islandLegs:state.islandLegs.map(x=>({name:x.name,points:x.points,turnCues:x.turnCues,bridgeAfter:x.bridgeAfter}))}}
function queueOfflineSave(){if(restoringOffline)return;if(offlineSaveTimer)clearTimeout(offlineSaveTimer);offlineSaveTimer=setTimeout(()=>saveOfflineRoute(),200)}
async function saveOfflineRoute(){try{if(!state.routeType||!state.routes.length)throw Error('ルートまたはGPXを先に読み込んでね');await BNaviOfflineRouteStore.save(offlinePayload());$('offline-status').textContent='この端末に経路を保存したよ。通信がなくても読み込めます。'}catch(e){$('offline-status').textContent='端末保存できませんでした：'+e.message}}
async function restoreOfflineRoute(){try{const data=await BNaviOfflineRouteStore.load();if(!data){$('offline-status').textContent='まだ保存済みの経路はありません。';return}if(!Array.isArray(data.sections)||!data.sections.length)throw Error('保存データが壊れています');restoringOffline=true;
 routeView(data.type,data.sections,data.mainGpx||null,'保存済みルートを開いたよ。通信なしで案内できます。');
 if(data.type==='shimanami'&&Array.isArray(data.islandLegs)&&data.islandLegs.length){state.islandLegs=data.islandLegs;state.islandIndex=0;loadIslandGuidance(0)}
 $('offline-status').textContent='端末内に保存した経路を読み込んだよ。音声をONにしてGPS追従を開始してね。'
 }catch(e){$('offline-status').textContent='経路の読み込みに失敗しました：'+e.message}finally{restoringOffline=false}}
$('offline-save').addEventListener('click',saveOfflineRoute);
$('offline-load').addEventListener('click',restoreOfflineRoute);
updateModes();restore();renderVia();updatePointSummaries();refreshMap();fitMarkers();refreshServer();setPick('start');if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});restoreOfflineRoute();
