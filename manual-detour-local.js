/* Detour only an ordinary-road subsection of a mixed Shimanami itinerary.
 * The remainder (including any bridge references and motorcycle-only expressway
 * connections) is kept exactly as previously calculated. No fake bridge links.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.BNaviRoadLegDetour=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const manual=root.BNaviManualDetour||(typeof require==='function'?require('./manual-detour.js'):null);
 const regions=root.BNaviShimanamiWebRouter||(typeof require==='function'?require('./shimanami-web-router.js'):null);
 const REJOIN_AHEAD_METERS=1500,MIN_SUFFIX_METERS=650,MIN_BRIDGE_BUFFER_METERS=1350;
 const MAX_JOIN_GAP_METERS=12,MAX_ORIGIN_SNAP_METERS=35;
 const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
 function closestProgress(position,track){
  const sy=111195,sx=sy*Math.cos(position[0]*Math.PI/180);
  let best=Infinity,progress=0,along=0;
  for(let i=1;i<track.length;i++){
   const p=track[i-1],q=track[i],dx=(q[1]-p[1])*sx,dy=(q[0]-p[0])*sy;
   const ax=(p[1]-position[1])*sx,ay=(p[0]-position[0])*sy;
   const len=Math.hypot(dx,dy),t=len?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(len*len))):0;
   const dist=Math.hypot(ax+t*dx,ay+t*dy);
   if(dist<best){best=dist;progress=along+manual.meters(p,q)*t;}
   along+=manual.meters(p,q);
  }
  return {progress,meters:best,total:along};
 }
 function region(point){return regions.journeyRegion(point);}
 function protectedCrossingPoints(refs){
  const points=[];
  if(Array.isArray(refs))for(const x of refs){
   if(Array.isArray(x?.points)&&x.points.length>2)points.push(x.points[Math.floor(x.points.length/2)]);
  }
  if(valid(regions.ONOMICHI_BRIDGE_ROAD_ANCHOR))points.push(regions.ONOMICHI_BRIDGE_ROAD_ANCHOR);
  return points;
 }
 function stageAllowed(points,group){
  return Array.isArray(points)&&points.every(p=>valid(p)&&region(p)===group);
 }
 function prepare(position,oldTrack,targets=[],{refs=[],bridgeAfter=false}={}){
  if(!manual||!regions||!valid(position)||!Array.isArray(oldTrack)||oldTrack.length<3||
     oldTrack.length>100000||!oldTrack.every(valid))
   throw Error('現在位置と道路区間の情報が不足しています');
  const group=region(position);
  if(group===null)throw Error('この場所の一般道路区間を特定できません');
  const avoid=manual.plan(position,oldTrack,targets);
  const nearest=closestProgress(position,oldTrack);
  if(nearest.meters>manual.MAX_GPS_ROUTE_OFFSET)throw Error('現在地が道路ルートから離れています');
  const target=nearest.progress+REJOIN_AHEAD_METERS;
  let sum=0,index=-1;
  for(let i=1;i<oldTrack.length;i++){
   sum+=manual.meters(oldTrack[i-1],oldTrack[i]);
   if(sum>=target){index=i;break;}
  }
  if(index<0||sum-target>350||nearest.total-sum<(bridgeAfter?1100:MIN_SUFFIX_METERS))
   throw Error('橋入口または区間終端が近く、前方の一般道だけを安全に迂回できません');
  const rejoin=oldTrack[index];
  if(!stageAllowed(oldTrack.slice(Math.max(0,Math.floor(index/2)),index+1),group)){
   // The more exact check below covers the entire traveled subsection;
   // we never accept a segment crossing a regional bridge boundary.
   throw Error('島・本州の境界を含むため、この道路区間は迂回できません');
  }
  let distance=0,startIndex=0;
  for(let i=1;i<oldTrack.length;i++){
   distance+=manual.meters(oldTrack[i-1],oldTrack[i]);
   if(distance>=Math.max(0,nearest.progress-50)){startIndex=i-1;break;}
  }
  if(!stageAllowed(oldTrack.slice(startIndex,index+1),group))
   throw Error('橋をまたぐ道路区間は手動迂回しません');
  // A user checkpoint on the short segment must NEVER vanish when we splice.
  const prefix=oldTrack.slice(startIndex,index+1);
  if(targets.some(t=>manual.distanceToPolyline(t,prefix)<85))
   throw Error('この区間に経由地があるので、経由地を飛ばす迂回は行いません');
  const protectedPlaces=protectedCrossingPoints(refs);
  if(protectedPlaces.some(p=>manual.meters(position,p)<MIN_BRIDGE_BUFFER_METERS||
     manual.meters(rejoin,p)<MIN_BRIDGE_BUFFER_METERS||
     manual.meters(avoid.point,p)<MIN_BRIDGE_BUFFER_METERS))
   throw Error('橋の接続付近は保護対象です。十分手前の一般道で迂回してね');
  const suffix=oldTrack.slice(index);
  if(manual.distanceToPolyline(avoid.point,suffix)<avoid.radius+10)
   throw Error('合流後の元ルートが回避エリアを通るため、安全に接続できません');
  return {avoid,index,original:oldTrack,origin:position.slice(),rejoin:rejoin.slice(),group,bridgeAfter};
 }
 function merge(prepared,track,originalCues=[]){
  if(!prepared||!Array.isArray(track?.points)||track.points.length<2||
    !Array.isArray(originalCues)||!stageAllowed(track.points,prepared.group))
   throw Error('迂回の道路線が本州・島内の同一区間へ収まりません');
  if(manual.meters(track.points[0],prepared.origin)>MAX_ORIGIN_SNAP_METERS)
   throw Error('現在地から新しい迂回路への接続が離れすぎています');
  const gap=manual.meters(track.points.at(-1),prepared.rejoin);
  if(gap>MAX_JOIN_GAP_METERS)
   throw Error('元ルートへの合流位置が'+Math.round(gap)+'m離れています。道路をつないだふりはしません');
  manual.verify(track.points,prepared.avoid);
  const old=prepared.original,offset=track.points.length-1-prepared.index;
  const points=[...track.points,...old.slice(prepared.index+1)];
  const cues=[];
  for(const cue of track.cues||[]){
   if(Number.isInteger(cue.offset)&&cue.offset>=0&&cue.offset<track.points.length)
    cues.push({...cue,point:track.points[cue.offset]});
  }
  for(const cue of originalCues){
   if(!Number.isInteger(cue.offset)||cue.offset<prepared.index||cue.offset>=old.length)continue;
   const newIndex=cue.offset+offset;
   cues.push({desc:cue.desc,offset:newIndex,point:points[newIndex],roundaboutExit:cue.roundaboutExit});
  }
  cues.sort((a,b)=>a.offset-b.offset);
  if(!stageAllowed(track.points,prepared.group))
   throw Error('迂回道路が橋を通るため採用できません');
  if(manual.distanceToPolyline(prepared.avoid.point,points.slice(0,track.points.length))<prepared.avoid.radius-5)
   throw Error('迂回した道路が回避範囲へ侵入しています');
  return {points,cues,joinGapMeters:gap,avoid:prepared.avoid,rejoin:prepared.rejoin};
 }
 return Object.freeze({prepare,merge,closestProgress,region,stageAllowed,REJOIN_AHEAD_METERS,MIN_SUFFIX_METERS,MIN_BRIDGE_BUFFER_METERS,MAX_JOIN_GAP_METERS});
});
