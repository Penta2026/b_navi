/* Shimanami web composer: preserves Android ShimanamiJourneyPlan semantics.
 * Only road legs returned by actual BRouter are navigable. All six bridge
 * shapes are reference overlays and must not be exported as a rideable GPX.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 else root.BNaviShimanamiWebRouter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const ISLANDS=[[34.389,133.200],[34.320,133.170],[34.290,133.095],[34.239,133.033],[34.205,133.070],[34.157,133.060],[34.064,132.995]];
const ISLAND_NAMES=['向島','因島','生口島','大三島','伯方島','大島','今治側'];
// A user's point may lie off the mapped road (station forecourt / car park).
// Bridge entrances must remain on a verified connected road; do not increase
// their tolerance just because a waypoint snapped 52m away.
const MAX_USER_WAYPOINT_SNAP_METERS=80;
const MAX_BRIDGE_SEAM_METERS=25;
const meters=(a,b)=>{const r=Math.PI/180,dLat=(b[0]-a[0])*r,dLon=(b[1]-a[1])*r,x=Math.sin(dLat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,x)));};
function inArea(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>34.0&&p[0]<34.45&&p[1]>132.9&&p[1]<133.25;}
function island(p){if(!inArea(p))throw Error('しまなみの指定範囲外です');let best=0,dist=Infinity;ISLANDS.forEach((center,i)=>{const d=meters(center,p);if(d<dist){best=i;dist=d;}});return best;}
// Nearest-island classification by itself mistakes JR Onomichi Station on
// HONSHU for Mukoshima (they are ~1.9 km apart, separated by water).
// This is intentionally a small, verified station-vicinity guard, NOT an
// invented boundary polygon for the whole mainland.
const ONOMICHI_STATION=[34.404838,133.193008]; // B_Navi JR station index
const ONOMICHI_STATION_MAINLAND_RADIUS=1100;
// R317 Onomichi Bridge (ordinary road, NOT the motorway-only Shin-Onomichi Bridge).
// This reference waypoint is only used to constrain an actual BRouter road response.
// It never becomes a fabricated drivable GPX line.
const ONOMICHI_BRIDGE_ROAD_ANCHOR=[34.40917,133.216611];
const MAX_ONOMICHI_BRIDGE_ANCHOR_METERS=60;
function onomichiMainlandPoint(points){
 return Array.isArray(points)?(points.find(p=>Array.isArray(p)&&meters(p,ONOMICHI_STATION)<ONOMICHI_STATION_MAINLAND_RADIUS)||null):null;
}
function isOnomichiMainland(p){
 return Array.isArray(p)&&inArea(p)&&meters(p,ONOMICHI_STATION)<ONOMICHI_STATION_MAINLAND_RADIUS;
}
function region(p){return isOnomichiMainland(p)?-1:island(p);}
// Corridor gateway classification, NOT a coastline polygon. External points
// are routed on actual roads; a gateway candidate is not proof of land access.
const TAKEHARA_ROADSIDE=[34.343938,132.912168];
function validJourneyPoint(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=20&&p[0]<=46&&p[1]>=122&&p[1]<=154;}
function journeyRegion(p){
 if(!validJourneyPoint(p))throw Error('旅程の座標が不正です');
 if(isOnomichiMainland(p))return -1;
 // The known Takehara mainland vicinity and the western/northern outer
 // corridor must not be mistaken for the nearest island.
 if(meters(p,TAKEHARA_ROADSIDE)<=2000||(p[0]>=34.31&&p[1]<132.95)||(p[0]>=34.41&&p[1]<=133.25))return -1;
 if(inArea(p))return island(p);
 if(p[0]>=34.25&&p[1]<=133.25)return -1; // north gateway candidate
 if(p[0]<=34.0)return 7; // south gateway candidate (Imabari side)
 return null; // ambiguous: no invented island classification
}
function corridorRegion(r){return Number.isInteger(r)&&r>=0&&r<=6;}
function needsSpecialJourney(points,vehicle){
 if(![0,1].includes(Number(vehicle))||!Array.isArray(points)||points.length<2||!points.every(validJourneyPoint))return false;
 const groups=points.map(journeyRegion);
 return groups.some((r,i)=>i>0&&r!==groups[i-1]&&(corridorRegion(r)||corridorRegion(groups[i-1])));
}
function referenceData(geometry,refs){
 if(!geometry||geometry.schema_version!==1||geometry.bridges?.length!==6||refs?.length!==6)throw Error('しまなみ海道の6橋データが揃っていません');
 for(let i=0;i<6;i++){
   const g=geometry.bridges[i],r=refs[i];
   if(!g||!r||g.name!==r.name||r.index!==i+1||r.points.length<3||!g.directions?.forward||!g.directions?.reverse)throw Error(`第${i+1}橋の元データを確認できません`);
   if(meters(r.points[0],g.directions.forward[0].points[0])>15||meters(r.points.at(-1),g.directions.forward[1].points.at(-1))>15)throw Error(g.name+'の参考GPXの入口・出口が合いません');
 }
}
function plan(points,vehicle,geometry,refs){
 if(!Array.isArray(points)||points.length<2||points.length>52||!points.every(validJourneyPoint))throw Error('有効な2〜52地点を指定してください');
 if(![0,1].includes(Number(vehicle)))throw Error('しまなみ専用計算は原付・125cc以下のみに使用します');
 // Mainland station points join the moped itinerary ONLY through a road
 // calculation forced over the ordinary R317 Onomichi Bridge. Ferries are
 // never represented as riding roads, and the motorway bridge is forbidden.
 referenceData(geometry,refs);
 const stages=[];
 for(let leg=0;leg<points.length-1;leg++){
   const a=journeyRegion(points[leg]),b=journeyRegion(points[leg+1]);
   // Ordinary legs outside the island chain remain ordinary BRouter roads.
   if(!corridorRegion(a)&&!corridorRegion(b)){
     stages.push({type:'road',from:points[leg],to:points[leg+1],fromRole:'user',toRole:'user',island:null,wide:true,checkpoint:leg+1,checkpointEnd:true});
     continue;
   }
   if(a===null||b===null)throw Error('区間'+(leg+1)+'：しまなみへの接続方向を判定できません。尾道駅または今治側の経由地を指定してください。');
   const fromMainland=a===-1,toMainland=b===-1;
   const start=fromMainland?0:a===7?6:a;
   const end=toMainland?0:b===7?6:b;
   const fromWide=!inArea(points[leg])||(fromMainland&&!isOnomichiMainland(points[leg]));
   const toWide=!inArea(points[leg+1])||(toMainland&&!isOnomichiMainland(points[leg+1]));
   const step=Math.sign(end-start);
   let from=points[leg],fromRole='user';
   if(step){
     for(let pos=start;pos!==end;pos+=step){
       const bridgeIndex=step>0?pos:pos-1;
       const g=geometry.bridges[bridgeIndex],forward=step>0;
       const pieces=g.directions[forward?'forward':'reverse'];
       const entry=pieces[0].points[0],exit=pieces[1].points.at(-1);
       const pointsRef=forward?refs[bridgeIndex].points:refs[bridgeIndex].points.slice().reverse();
       const mainlandCrossing=fromMainland&&pos===0?'to_island':null;
       stages.push({type:'road',from,to:entry,fromRole,toRole:'bridge',island:pos,
         mainlandCrossing,via:mainlandCrossing?[ONOMICHI_BRIDGE_ROAD_ANCHOR]:null,
         wide:fromRole==='user'&&fromWide,
         checkpoint:leg+1,checkpointEnd:false});
       stages.push({type:'bridge',bridgeIndex:bridgeIndex+1,forward,name:g.name,from:entry,to:exit,points:pointsRef,checkpoint:leg+1});
       from=exit;fromRole='bridge';
     }
   }
   // The first outbound road (to bridge 1) already crossed R317.
   // Only a mainland->Mukoshima leg without another Shimanami bridge
   // needs the R317 anchor in its final road stage.
   const mainlandCrossing=toMainland&&!fromMainland?'to_mainland':
     fromMainland&&!toMainland&&step===0?'to_island':null;
   // For Onomichi->Mukoshima local legs and round-trip return legs, this
   // R317 crossing must be calculated as real roads via the named bridge.
   stages.push({type:'road',from,to:points[leg+1],fromRole,toRole:'user',island:end,
     mainlandCrossing,via:mainlandCrossing?[ONOMICHI_BRIDGE_ROAD_ANCHOR]:null,
     wide:toWide||(fromRole==='user'&&fromWide),
     checkpoint:leg+1,checkpointEnd:true});
 }
 for(let i=0;i<stages.length-1;i++){
   if(meters(stages[i].to,stages[i+1].from)>0.1)throw Error('しまなみ計画に接続不良があります');
 }
 return stages;
}
function distanceToRoadLine(point,pts){
 const latFactor=111195,lonFactor=latFactor*Math.cos(point[0]*Math.PI/180);
 let closest=Infinity;
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];
  const ax=(a[1]-point[1])*lonFactor,ay=(a[0]-point[0])*latFactor;
  const bx=(b[1]-point[1])*lonFactor,by=(b[0]-point[0])*latFactor;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
  closest=Math.min(closest,Math.hypot(ax+t*dx,ay+t*dy));
 }
 return closest;
}
function validateRoad(stage,track){
 const pts=track?.points;
 if(!Array.isArray(pts)||pts.length<2||pts.length>100000||pts.some(p=>!(stage.wide?validJourneyPoint(p):inArea(p))))
  throw Error('島内道路の経路形状が不正です');
 const from=meters(pts[0],stage.from),to=meters(pts.at(-1),stage.to);
 if(stage.mainlandCrossing){
  const gap=distanceToRoadLine(ONOMICHI_BRIDGE_ROAD_ANCHOR,pts);
  if(gap>MAX_ONOMICHI_BRIDGE_ANCHOR_METERS)
   throw Error('尾道駅と向島の道路ルートが尾道大橋（国道317号）を通っていません（橋まで'+Math.round(gap)+'m）。新尾道大橋・渡船・海上経路を代用せず停止しました。');
 }
 const validateEndpoint=(gap,role,side)=>{
  if(role==='bridge'){
   if(gap>MAX_BRIDGE_SEAM_METERS)
    throw Error(`${(ISLAND_NAMES[stage.island]||'一般道路')}：${side==='start'?'橋出口側':'橋入口側'}の島内道路が${Math.round(gap)}m離れています（橋との接続は${MAX_BRIDGE_SEAM_METERS}m以内が必要）。原付通路の道路網を確認できないため、参考線を走行経路として接続しません。`);
  }else if(gap>MAX_USER_WAYPOINT_SNAP_METERS){
   throw Error(`${(ISLAND_NAMES[stage.island]||'一般道路')}：${side==='start'?'出発地・経由地':'目的地・経由地'}から計算道路まで${Math.round(gap)}m離れています（${MAX_USER_WAYPOINT_SNAP_METERS}m以内が必要）。道路上の地点を指定してね。`);
  }
 };
 validateEndpoint(from,stage.fromRole||'user','start');
 validateEndpoint(to,stage.toRole||'user','end');
 const length=pts.slice(1).reduce((acc,p,i)=>acc+meters(pts[i],p),0);
 if(!stage.wide&&length>Math.max(32000,meters(stage.from,stage.to)*8+6000))
  throw Error((ISLAND_NAMES[stage.island]||'一般道路')+'：島内道路が大きく遠回りしています');
 // Never insert a made-up connecting line from an off-road user pin.
 const warnings=[];
 if(stage.fromRole==='user'&&from>MAX_BRIDGE_SEAM_METERS)
  warnings.push(`${(ISLAND_NAMES[stage.island]||'一般道路')}：指定地点から約${Math.round(from)}m先の道路上が案内開始点です（その間の移動は案内対象外）`);
 if(stage.toRole==='user'&&to>MAX_BRIDGE_SEAM_METERS)
  warnings.push(`${(ISLAND_NAMES[stage.island]||'一般道路')}：道路上の案内終了点から指定地点まで約${Math.round(to)}mあります（その間の移動は案内対象外）`);
 return {length,fromGap:from,toGap:to,warnings};
}
async function compose(points,vehicle,mode,{geometry,refs,query,bridgePreview,onProgress=()=>{},concurrency=2}){
 const stages=plan(points,vehicle,geometry,refs),roadStages=stages.filter(s=>s.type==='road');
 if(typeof query!=='function'||typeof bridgePreview!=='function')throw Error('経路計算・橋形状確認がありません');
 // The shared public service must never receive simultaneous island-road queries.
 // An HTTP 403 stops the itinerary; no eager retries or unsafe bridge fallbacks.
 const results=new Map(),snapWarnings=[],count=1;let next=0;
 async function worker(){
   while(next<roadStages.length){
     const stage=roadStages[next++],index=next;
     onProgress({phase:'road',index,total:roadStages.length,bridgeTotal:stages.filter(x=>x.type==='bridge').length});
     let route;
     if(!stage.mainlandCrossing&&meters(stage.from,stage.to)<5){
       // A waypoint precisely at the bridge anchor needs no invented road.
       route={profile:null,track:{points:[stage.from,stage.to],cues:[]},gpx:null,anchorOnly:true};
     }else{
       try{route=await query(stage.via?[stage.from,...stage.via,stage.to]:[stage.from,stage.to],vehicle,mode);}
       catch(error){throw Error('経由区間'+stage.checkpoint+'（道路 '+index+'/'+roadStages.length+'）：'+String(error?.message||error));}
     }
     const checked=validateRoad(stage,route.track);
     snapWarnings.push(...checked.warnings);
     results.set(stage,route);
   }
 }
 await Promise.all(Array.from({length:count},worker));
 const sections=[],guidance=[];let bridges=0;
 for(let i=0;i<stages.length;i++){
   const stage=stages[i];
   if(stage.type==='road'){
     const result=results.get(stage),pts=result.track.points;
     const sec={type:'road',points:pts,color:'#06799b',width:5,gpx:result.gpx||null,label:stage.mainlandCrossing?'尾道大橋（国道317号・一般道）':stage.wide?'広域一般道路':(isOnomichiMainland(stage.from)&&isOnomichiMainland(stage.to)?'尾道市街地：一般道':`${(ISLAND_NAMES[stage.island]||'一般道路')}：島内道路`),stageCheckpoint:stage.checkpoint,anchorOnly:!!result.anchorOnly};
     const sectionIndex=sections.length;
     sections.push(sec);
     guidance.push({name:stage.wide?'広域一般道路':(ISLAND_NAMES[stage.island]||'一般道路'),wide:!!stage.wide,mainlandCrossing:stage.mainlandCrossing||null,points:pts,turnCues:result.track.cues||[],bridgeAfter:stages[i+1]?.type==='bridge',sectionIndex,checkpointAfter:stage.checkpointEnd?stage.checkpoint:null});
   }else{
     const prev=sections.at(-1),nextRoad=stages[i+1];
     if(prev?.type!=='road'||nextRoad?.type!=='road')throw Error(stage.name+'：島内の前後道路がありません');
     const nextPts=results.get(nextRoad)?.track?.points;
     if(!nextPts)throw Error(stage.name+'：橋の出口側道路がありません');
     if(meters(prev.points.at(-1),stage.from)>MAX_BRIDGE_SEAM_METERS||meters(nextPts[0],stage.to)>MAX_BRIDGE_SEAM_METERS)throw Error(stage.name+'：道路と橋の接続が25m以上ずれました。架空の直線では接続しません');
     const visible=bridgePreview({bridgeIndex:stage.bridgeIndex,forward:stage.forward,points:stage.points},prev.points,nextPts);
     if(!visible?.points?.length||meters(visible.points[0],prev.points.at(-1))>MAX_BRIDGE_SEAM_METERS||meters(visible.points.at(-1),nextPts[0])>MAX_BRIDGE_SEAM_METERS)throw Error(stage.name+'：橋の参考線を道路経路に接続できません');
     sections.push({type:'bridge',points:visible.points,color:'#b57a20',dash:'7 4',width:5,label:stage.name+'（原付通路参考線・走行GPX対象外）',bridgeIndex:stage.bridgeIndex,referenceOnly:true});
     bridges++;
   }
 }
 const result={sections,guidance,bridges,checkpoints:points.length,roadSegments:roadStages.length,warnings:snapWarnings};
 const report=verifyPlan(result,points);
 if(!report.ok)throw Error('しまなみ旅程の検証失敗：'+report.errors.join('／'));
 return result;
}
function verifyPlan(result,points){
 const errors=[],secs=result?.sections||[],guide=result?.guidance||[];
 const bridges=secs.filter(s=>s.type==='bridge');
 const roadmap=secs.filter(s=>s.type==='road');
 if(!secs.length||!guide.length)errors.push('走行区間がありません');
 if(roadmap.length!==guide.length)errors.push('GPS案内区間数の不一致');
 if(bridges.length!==result.bridges)errors.push('橋の計算本数が不一致');
 if(secs.some(x=>x.type==='bridge'&&(x.gpx||!x.referenceOnly)))errors.push('橋の参考線を走行GPXとして扱っています');
 for(let i=0;i<secs.length-1;i++){
  const a=secs[i],b=secs[i+1];
  const seam=meters(a.points.at(-1),b.points[0]);
  if(seam>MAX_BRIDGE_SEAM_METERS)errors.push(`接続${i+1}が${Math.round(seam)}m離れています`);
 }
 let lastCheckpoint=0;
 for(const leg of guide){
  if(leg.checkpointAfter){if(leg.checkpointAfter<lastCheckpoint)errors.push('経由地の順序が逆転しています');lastCheckpoint=leg.checkpointAfter;}
 }
 if(lastCheckpoint!==points.length-1)errors.push('最終目的地まで計算されていません');
 if(secs.length&&meters(secs[0].points[0],points[0])>MAX_USER_WAYPOINT_SNAP_METERS)errors.push('出発地が道路の許容位置と一致しません');
 if(secs.length&&meters(secs.at(-1).points.at(-1),points.at(-1))>MAX_USER_WAYPOINT_SNAP_METERS)errors.push('目的地が道路の許容位置と一致しません');
 return {ok:errors.length===0,errors,bridges:bridges.length,islandRoads:roadmap.length,checkpoints:points.length};
}
// Offline desk validation: feeds conceptual bridge entrance/exit states without
// registering browser GPS or claiming to simulate real-world accuracy.
function deskCheck(result,points){
 const plan=verifyPlan(result,points);
 const steps=[];
 for(const leg of result.guidance){
  steps.push(leg.name+'：島内道路の案内');
  if(leg.bridgeAfter)steps.push('橋入口で音声停止 → 次の島の入口90m以内で再開');
  if(leg.checkpointAfter&&leg.checkpointAfter<points.length-1)steps.push('経由地'+leg.checkpointAfter+'：次へ進むか確認');
 }
 steps.push('最終目的地：到着案内');
 return {...plan,steps};
}
return Object.freeze({ISLANDS,ISLAND_NAMES,MAX_USER_WAYPOINT_SNAP_METERS,MAX_BRIDGE_SEAM_METERS,ONOMICHI_STATION,ONOMICHI_BRIDGE_ROAD_ANCHOR,MAX_ONOMICHI_BRIDGE_ANCHOR_METERS,onomichiMainlandPoint,isOnomichiMainland,region,journeyRegion,meters,inArea,island,needsSpecialJourney,plan,validateRoad,compose,verifyPlan,deskCheck});
});
