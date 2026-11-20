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
async function upload(name,netFetch=fetch){
 const url=new URL('./profiles/'+name+'.brf',location.href);
 const p=await netFetch(url,{cache:'no-store'});if(!p.ok)throw Error('走行プロファイルを取得できません HTTP '+p.status);
 const brf=await p.text();if(!brf.includes('---context:way')||!brf.includes('---context:node'))throw Error('プロファイルが不正です');
 const resp=await netFetch(SERVER+'/profile',{method:'POST',headers:{'Content-Type':'text/plain'},body:brf,signal:AbortSignal.timeout(30000),credentials:'omit'});
 const body=await resp.text();if(!resp.ok)throw Error('公開BRouterのプロファイル登録に失敗 HTTP '+resp.status+' '+body.slice(0,120));
 let obj;try{obj=JSON.parse(body)}catch{obj=body}
 const options=[obj?.profileId,obj?.id,obj?.profile,obj?.name,obj?.profileName,typeof obj==='string'?obj:null];
 const id=options.find(v=>typeof v==='string'&&/^(custom_|shared_)[A-Za-z0-9_-]+$/.test(v))||body.match(/(?:custom_|shared_)[A-Za-z0-9_-]+/)?.[0];
 if(!id)throw Error('BRouterのカスタムプロファイルIDを取得できません');IDS.set(name,id);return id;
}
async function query(points,vehicle,mode,netFetch=fetch){
 if(!Array.isArray(points)||points.length<2||points.length>52||points.some(p=>!validPoint(p)))throw Error('経路地点が不正です');
 const profile=profileName(vehicle,mode);
 let id=IDS.get(profile)||await upload(profile,netFetch);
 const calc=async()=>{const url=new URL(SERVER);url.searchParams.set('lonlats',points.map(p=>p[1]+','+p[0]).join('|'));url.searchParams.set('profile',id);url.searchParams.set('alternativeidx','0');url.searchParams.set('format','geojson');url.searchParams.set('timode','3');
 return netFetch(url,{signal:AbortSignal.timeout(90000),cache:'no-store',credentials:'omit'});};
 let r=await calc();if(!r.ok&&[400,404,500].includes(r.status)){IDS.delete(profile);id=await upload(profile,netFetch);r=await calc()}
 if(!r.ok)throw Error('公開BRouterの計算エラー HTTP '+r.status+' '+(await r.text()).slice(0,150));
 const track=trackFromGeoJSON(await r.json());
 const farMeters=(p,q)=>{const rad=Math.PI/180,dlat=(p[0]-q[0])*rad,dlon=(p[1]-q[1])*rad,a=Math.sin(dlat/2)**2+Math.cos(p[0]*rad)*Math.cos(q[0]*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,a)))};
 if(farMeters(track.points[0],points[0])>300||farMeters(track.points.at(-1),points.at(-1))>300)throw Error('BRouterの計算起終点が指定位置と一致しません');
 return {profile,track,gpx:gpxFromTrack(track,profile)};
}
const api={SERVER,profileName,trackFromGeoJSON,gpxFromTrack,query};root.BNaviPublicBrouter=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
