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
const MAX_ENDPOINT_METERS=45;
const MAX_BRIDGE_SEAM_METERS=25;
const meters=(a,b)=>{const r=Math.PI/180,dLat=(b[0]-a[0])*r,dLon=(b[1]-a[1])*r,x=Math.sin(dLat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.sqrt(Math.min(1,x)));};
function inArea(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>34.0&&p[0]<34.45&&p[1]>132.9&&p[1]<133.25;}
function island(p){if(!inArea(p))throw Error('しまなみの指定範囲外です');let best=0,dist=Infinity;ISLANDS.forEach((center,i)=>{const d=meters(center,p);if(d<dist){best=i;dist=d;}});return best;}
function needsSpecialJourney(points,vehicle){return Number(vehicle)<=1&&Array.isArray(points)&&points.length>=2&&points.every(inArea)&&points.some((p,i)=>i>0&&island(p)!==island(points[i-1]));}
function referenceData(geometry,refs){
 if(!geometry||geometry.schema_version!==1||geometry.bridges?.length!==6||refs?.length!==6)throw Error('しまなみ海道の6橋データが揃っていません');
 for(let i=0;i<6;i++){
   const g=geometry.bridges[i],r=refs[i];
   if(!g||!r||g.name!==r.name||r.index!==i+1||r.points.length<3||!g.directions?.forward||!g.directions?.reverse)throw Error(`第${i+1}橋の元データを確認できません`);
   if(meters(r.points[0],g.directions.forward[0].points[0])>15||meters(r.points.at(-1),g.directions.forward[1].points.at(-1))>15)throw Error(g.name+'の参考GPXの入口・出口が合いません');
 }
}
function plan(points,vehicle,geometry,refs){
 if(!Array.isArray(points)||points.length<2||points.length>52||!points.every(inArea))throw Error('しまなみ7島内の2〜52地点を指定してください');
 if(Number(vehicle)>1)throw Error('しまなみ専用計算は原付・125cc以下のみに使用します');
 referenceData(geometry,refs);
 const stages=[];
 for(let leg=0;leg<points.length-1;leg++){
   const start=island(points[leg]),end=island(points[leg+1]),step=Math.sign(end-start);
   let from=points[leg],fromKind='指定地点';
   if(step){
     for(let pos=start;pos!==end;pos+=step){
       const bridgeIndex=step>0?pos:pos-1;
       const g=geometry.bridges[bridgeIndex],forward=step>0;
       const pieces=g.directions[forward?'forward':'reverse'];
       const entry=pieces[0].points[0],exit=pieces[1].points.at(-1);
       const pointsRef=forward?refs[bridgeIndex].points:refs[bridgeIndex].points.slice().reverse();
       stages.push({type:'road',from,to:entry,island:pos,fromKind,toKind:'橋の入口',bridgeName:g.name,checkpoint:leg+1,checkpointEnd:false});
       stages.push({type:'bridge',bridgeIndex:bridgeIndex+1,forward,name:g.name,from:entry,to:exit,points:pointsRef,checkpoint:leg+1});
       from=exit;fromKind='橋の出口';
     }
   }
   stages.push({type:'road',from,to:points[leg+1],island:end,fromKind,toKind:'指定地点',checkpoint:leg+1,checkpointEnd:true});
 }
 for(let i=0;i<stages.length-1;i++){
   if(meters(stages[i].to,stages[i+1].from)>0.1)throw Error('しまなみ計画に接続不良があります');
 }
 return stages;
}
function validateRoad(stage,track){
 const pts=track?.points;if(!Array.isArray(pts)||pts.length<2||pts.length>100000||pts.some(p=>!inArea(p)))throw Error('島内道路の経路形状が不正です');
 const from=meters(pts[0],stage.from),to=meters(pts.at(-1),stage.to);
 if(from>MAX_ENDPOINT_METERS||to>MAX_ENDPOINT_METERS){
  const isStart=from>=to,side=isStart?'出発側':'到着側',gap=Math.round(isStart?from:to);
  const kind=isStart?(stage.fromKind||'接続地点'):(stage.toKind||'接続地点');
  const target=isStart?stage.from:stage.to,actual=isStart?pts[0]:pts.at(-1);
  const bridge=/^橋の/.test(kind);
  const issue=bridge?'橋への進入・退出道路が、公開道路データ上でつながっていない可能性があります。':
   '指定地点が道路中心線から離れている可能性があります。';
  const coords=p=>p.map(n=>n.toFixed(6)).join(',');
  throw Error(`${ISLAND_NAMES[stage.island]}：${side}（${kind}${bridge&&stage.bridgeName?'・'+stage.bridgeName:''}）が${gap}mずれています（道路端点検査${MAX_ENDPOINT_METERS}m以内）。${issue} 目標 ${coords(target)}／計算終点 ${coords(actual)}。未確認区間を直線接続せず停止しました。`);
 }
 const length=pts.slice(1).reduce((acc,p,i)=>acc+meters(pts[i],p),0);
 if(length>Math.max(32000,meters(stage.from,stage.to)*8+6000))throw Error(ISLAND_NAMES[stage.island]+'：島内道路が大きく遠回りしています');
 return {length,fromGap:from,toGap:to};
}
async function compose(points,vehicle,mode,{geometry,refs,query,bridgePreview,onProgress=()=>{},concurrency=2}){
 const stages=plan(points,vehicle,geometry,refs),roadStages=stages.filter(s=>s.type==='road');
 if(typeof query!=='function'||typeof bridgePreview!=='function')throw Error('経路計算・橋形状確認がありません');
 // The shared public service must never receive simultaneous island-road queries.
 // An HTTP 403 stops the itinerary; no eager retries or unsafe bridge fallbacks.
 const results=new Map(),count=1;let next=0;
 async function worker(){
   while(next<roadStages.length){
     const stage=roadStages[next++],index=next;
     onProgress({phase:'road',index,total:roadStages.length,bridgeTotal:stages.filter(x=>x.type==='bridge').length});
     let route;
     if(meters(stage.from,stage.to)<5){
       // A waypoint precisely at the bridge anchor needs no invented road.
       route={profile:null,track:{points:[stage.from,stage.to],cues:[]},gpx:null,anchorOnly:true};
     }else route=await query([stage.from,stage.to],vehicle,mode);
     validateRoad(stage,route.track);
     results.set(stage,route);
   }
 }
 await Promise.all(Array.from({length:count},worker));
 const sections=[],guidance=[];let bridges=0;
 for(let i=0;i<stages.length;i++){
   const stage=stages[i];
   if(stage.type==='road'){
     const result=results.get(stage),pts=result.track.points;
     const sec={type:'road',points:pts,color:'#06799b',width:5,gpx:result.gpx||null,label:`${ISLAND_NAMES[stage.island]}：島内道路`,stageCheckpoint:stage.checkpoint,anchorOnly:!!result.anchorOnly};
     const sectionIndex=sections.length;
     sections.push(sec);
     guidance.push({name:ISLAND_NAMES[stage.island],points:pts,turnCues:result.track.cues||[],bridgeAfter:stages[i+1]?.type==='bridge',sectionIndex,checkpointAfter:stage.checkpointEnd?stage.checkpoint:null});
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
 const result={sections,guidance,bridges,checkpoints:points.length,roadSegments:roadStages.length};
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
 if(secs.length&&meters(secs[0].points[0],points[0])>MAX_BRIDGE_SEAM_METERS)errors.push('出発地が一致しません');
 if(secs.length&&meters(secs.at(-1).points.at(-1),points.at(-1))>MAX_BRIDGE_SEAM_METERS)errors.push('目的地が一致しません');
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
return Object.freeze({ISLANDS,ISLAND_NAMES,meters,inArea,island,needsSpecialJourney,plan,validateRoad,compose,verifyPlan,deskCheck});
});
