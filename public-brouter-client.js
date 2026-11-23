/* B_Navi older-PWA-compatible public BRouter client. Trial-only.
 * Uses BRouter's /profile upload and GeoJSON timode=3 voicehints, exactly the
 * routing interface used by Penta2026/BikeNavigator in October 2026.
 * Service availability/limits and legal motorcycle access are NOT guaranteed.
 * Local/private Java B_Navi special Shimanami/Kanmon API is independent.
 */
(function(root){
'use strict';
const SERVER='https://brouter.de/brouter';
const IDS=new Map();
const PENDING_UPLOADS=new Map();
// A shared public router is not an unlimited per-app API. Space live requests
// across both POST /profile and GET /brouter; injected test fetches are unpaced.
const LIVE_REQUEST_SPACING_MS=2500;
function createPacer(spacingMs=LIVE_REQUEST_SPACING_MS,clock=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let lastStart=null,chain=Promise.resolve();
 return task=>{
  const run=chain.then(async()=>{
   const wait=lastStart===null?0:Math.max(0,lastStart+spacingMs-clock());
   if(wait>0)await sleep(wait);
   lastStart=clock();
   return task();
  });
  chain=run.then(()=>{},()=>{});
  return run;
 };
}
const pacePublicRequest=createPacer();
function publicFetch(netFetch,url,options){
 return netFetch===fetch?pacePublicRequest(()=>netFetch(url,options)):netFetch(url,options);
}
const ROUTE_RESULTS=new Map(); // successful exact road legs, for this open PWA session
const MAX_ROUTE_RESULTS=60;
function routeResultKey(profile,points){return profile+'|'+points.map(p=>p[0].toFixed(6)+','+p[1].toFixed(6)).join('|');}
function rememberRoute(key,result){
 ROUTE_RESULTS.delete(key);ROUTE_RESULTS.set(key,result);
 if(ROUTE_RESULTS.size>MAX_ROUTE_RESULTS)ROUTE_RESULTS.delete(ROUTE_RESULTS.keys().next().value);
}
function errorFromResponse(response,body,stage){
 const status=Number(response.status)||0,detail=String(body||'').trim();
 if(status===403&&/please[, ]*retry later|try again later|rate|limit/i.test(detail))
  return Error('公開BRouterが要求を一時的に受け付けませんでした（HTTP 403）。しまなみの計算を停止しました。しばらく間隔を空けて再検索してね。外部サービスの制限状況は確認できません。');
 if(status===403)return Error('公開BRouterが要求を拒否しました（HTTP 403）。'+stage+'を完了できません。接続制限などの可能性があります。');
 if(status===429)return Error('公開BRouterへの問い合わせが多すぎます（HTTP 429）。しばらく間隔を空けて再検索してね。');
 if(status===503||status===502)return Error('公開BRouterが一時的に応答できません（HTTP '+status+'）。時間を空けて再検索してね。');
 return Error('公開BRouterの'+stage+'に失敗しました（HTTP '+status+'）。'+detail.slice(0,120));
}

const profileNames=[['bn_50_beginner','bn_50_general','bn_50_explore'],['bn_125_beginner','bn_125_general','bn_125_explore'],['bn_big_beginner','bn_big_general','bn_big_explore','bn_big_fasttravel_priority']];
const commands={1:'straight',2:'left',3:'slight left',4:'sharp left',5:'right',6:'slight right',7:'sharp right',8:'keep left',9:'keep right',10:'u-turn',11:'u-turn',13:'roundabout',14:'roundabout',17:'exit left',18:'exit right',100:'destination'};
function xml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function profileName(vehicle,mode){const v=Number(vehicle),m=Number(mode);if(!Number.isInteger(v)||!Number.isInteger(m)||!profileNames[v]?.[m])throw Error('車種と走り方の指定が不正です');return profileNames[v][m]}
function validPoint(point){return Array.isArray(point)&&point.length>=2&&point.every((v,i)=>i<2?Number.isFinite(v):true)&&point[0]>=-90&&point[0]<=90&&point[1]>=-180&&point[1]<=180}
function trackFromGeoJSON(data){const f=(data?.type==='FeatureCollection'?data.features:[data]).find(f=>f?.geometry?.type==='LineString'&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>=2);
 if(!f)throw Error('公開BRouterから有効な経路が返っていません');
 const coords=f.geometry.coordinates;if(coords.length>100000)throw Error('経路が大きすぎます');
 const pts=coords.map(p=>[Number(p[1]),Number(p[0])]);if(pts.some(p=>!validPoint(p)))throw Error('BRouter経路座標が不正です');
 const hints=Array.isArray(f.properties?.voicehints)?f.properties.voicehints:[];
 const cues=[];for(const h of hints){if(!Array.isArray(h)||h.length<2)continue;
   const index=Number(h[0]),command=commands[Number(h[1])];
   if(!Number.isInteger(index)||index<0||index>=pts.length||!command)continue;
   cues.push({offset:index,desc:command,point:pts[index],roundaboutExit:Number(h[2])||0});
 }
 return {points:pts,cues,hintCount:hints.length,meters:Number(f.properties?.trackLength)||null};
}
function gpxFromTrack(track,profile){
 const points=track.points.map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"/>`).join('');
 const cues=track.cues.map(c=>`<rtept lat="${c.point[0]}" lon="${c.point[1]}"><desc>${xml(c.desc)}</desc><extensions><offset>${c.offset}</offset>${c.roundaboutExit?`<roundaboutExit>${c.roundaboutExit}</roundaboutExit>`:''}</extensions></rtept>`).join('');
 return `<?xml version="1.0" encoding="utf-8"?><gpx version="1.1" creator="B_Navi public BRouter trial" xmlns="http://www.topografix.com/GPX/1/1"><metadata><desc>${xml('Published BRouter trial: '+profile)}</desc></metadata><trk><name>B_Navi route</name><trkseg>${points}</trkseg></trk><rte>${cues}</rte></gpx>`;
}
const tuner=root.BNaviRouteTuning||(typeof require!=='undefined'?require('./route-tuning.js'):null);
async function upload(name,cacheKey,netFetch=fetch,custom=null,vehicle=1,mode=1){
 const url=new URL('./profiles/'+name+'.brf',location.href);
 const p=await netFetch(url,{cache:'no-store'});if(!p.ok)throw Error('走行プロファイルを取得できません HTTP '+p.status);
 const baseline=await p.text();if(!baseline.includes('---context:way')||!baseline.includes('---context:node'))throw Error('プロファイルが不正です');
 const brf=custom&&tuner?!tuner.isDefault(custom,vehicle)?tuner.tuneProfile(baseline,custom,vehicle,mode):baseline:baseline;
 const resp=await publicFetch(netFetch,SERVER+'/profile',{method:'POST',headers:{'Content-Type':'text/plain'},body:brf,signal:AbortSignal.timeout(30000),credentials:'omit'});
 const body=await resp.text();if(!resp.ok)throw errorFromResponse(resp,body,'走行プロファイル登録');
 let obj;try{obj=JSON.parse(body)}catch{obj=body}
 const options=[obj?.profileId,obj?.id,obj?.profile,obj?.name,obj?.profileName,typeof obj==='string'?obj:null];
 const id=options.find(v=>typeof v==='string'&&/^(custom_|shared_)[A-Za-z0-9_-]+$/.test(v))||body.match(/(?:custom_|shared_)[A-Za-z0-9_-]+/)?.[0];
 if(!id)throw Error('BRouterのカスタムプロファイルIDを取得できません');IDS.set(cacheKey,id);return id;
}
async function ensureProfile(name,cacheKey,netFetch,custom,vehicle,mode){
 if(IDS.has(cacheKey))return IDS.get(cacheKey);
 if(!PENDING_UPLOADS.has(cacheKey)){
  const task=upload(name,cacheKey,netFetch,custom,vehicle,mode).finally(()=>PENDING_UPLOADS.delete(cacheKey));
  PENDING_UPLOADS.set(cacheKey,task);
 }
 return PENDING_UPLOADS.get(cacheKey);
}
async function query(points,vehicle,mode,netFetch=fetch,onProgress=null,custom=null){
 const started=Date.now();const progress=(phase,message)=>{if(typeof onProgress==='function')onProgress({phase,message,elapsedMs:Date.now()-started})};
 if(!Array.isArray(points)||points.length<2||points.length>52||points.some(p=>!validPoint(p)))throw Error('経路地点が不正です');
 const profile=profileName(vehicle,mode);
 const isCustomized=custom&&tuner&&!tuner.isDefault(custom,vehicle);
 if(custom&&!tuner)throw Error('ルート微調整モジュールがありません');
 const cacheKey=isCustomized?profile+':'+tuner.key(custom,vehicle):profile;
 const resultKey=routeResultKey(cacheKey,points);
 if(netFetch===fetch&&ROUTE_RESULTS.has(resultKey)){
  const cached=ROUTE_RESULTS.get(resultKey);progress('done','保存済みの島内道路計算結果を再利用しました');
  return {...cached,elapsedMs:Date.now()-started,cached:true};
 }
 progress('profile',IDS.has(cacheKey)?'公開BRouter：前回の走行プロファイルを使用中…':'公開BRouter：走行プロファイルを送信中…');
 let id=await ensureProfile(profile,cacheKey,netFetch,custom,vehicle,mode);
 const calc=async()=>{const url=new URL(SERVER);url.searchParams.set('lonlats',points.map(p=>p[1]+','+p[0]).join('|'));url.searchParams.set('profile',id);url.searchParams.set('alternativeidx','0');url.searchParams.set('format','geojson');url.searchParams.set('timode','3');
 return publicFetch(netFetch,url,{signal:AbortSignal.timeout(90000),cache:'no-store',credentials:'omit'});};
 progress('route','公開BRouter：道路ルートを計算中…');
 let r=await calc();if(!r.ok&&[400,404].includes(r.status)){IDS.delete(cacheKey);progress('retry','公開BRouter：プロファイル期限切れを確認・再送信中…');id=await ensureProfile(profile,cacheKey,netFetch,custom,vehicle,mode);progress('route','公開BRouter：経路を再計算中…');r=await calc()}
 if(!r.ok)throw errorFromResponse(r,await r.text(),'経路計算');
 const track=trackFromGeoJSON(await r.json());
 const farMeters=(p,q)=>{const rad=Math.PI/180,dlat=(p[0]-q[0])*rad,dlon=(p[1]-q[1])*rad,a=Math.sin(dlat/2)**2+Math.cos(p[0]*rad)*Math.cos(q[0]*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,a)))};
 if(farMeters(track.points[0],points[0])>300||farMeters(track.points.at(-1),points.at(-1))>300)throw Error('BRouterの計算起終点が指定位置と一致しません');
 progress('done','公開BRouter：経路を受信しました');
 const result={profile:profile+(isCustomized?'・カスタム '+tuner.key(custom,vehicle):''),track,
  gpx:gpxFromTrack(track,cacheKey),elapsedMs:Date.now()-started};
 if(netFetch===fetch)rememberRoute(resultKey,result);
 return result;
}
const api={SERVER,LIVE_REQUEST_SPACING_MS,createPacer,errorFromResponse,profileName,trackFromGeoJSON,gpxFromTrack,query};root.BNaviPublicBrouter=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
