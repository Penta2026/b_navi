/* B_Navi 126cc+ Shimanami: confirm-only bridge crossing on real motorcycle roads.
 * Bridge cycling GPX is never a navigable route or connector.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.BNaviShimanamiBigRouter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const islands=root.BNaviShimanamiWebRouter||(typeof require==='function'?require('./shimanami-web-router.js'):null);
 const tuner=root.BNaviRouteTuning||(typeof require==='function'?require('./route-tuning.js'):null);
 const brouter=root.BNaviPublicBrouter||(typeof require==='function'?require('./public-brouter-client.js'):null);
 const BRIDGE_RADIUS_METERS=1500,JOIN_GAP_METERS=30;
 const valid=points=>Array.isArray(points)&&points.length>=2&&points.length<=52&&
   points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=20&&p[0]<=46&&p[1]>=122&&p[1]<=154);
 function bridgeIndices(a,b){
  if(!Number.isInteger(a)||!Number.isInteger(b))return [];
  const out=[];for(let i=Math.max(0,Math.min(a,b));i<Math.max(a,b);i++)out.push(i);
  return out;
 }
 function plan(points,vehicle=2){
  if(Number(vehicle)!==2||!valid(points))return null;
  const groups=points.map(p=>islands.journeyRegion(p));
  const local=r=>Number.isInteger(r)&&r>=0&&r<=6;
  const endpoint=r=>r===-1?0:r===7?6:r;
  const legs=groups.slice(1).map((r,i)=>{
   const from=groups[i],to=r;
   const crossing=from!==to&&(local(from)||local(to))&&from!==null&&to!==null;
   return {index:i+1,from,to,bridges:crossing?bridgeIndices(endpoint(from),endpoint(to)):[]};
  });
  return {legs,bridgeCount:legs.reduce((a,l)=>a+l.bridges.length,0)};
 }
 function potential(points,vehicle=2){const p=plan(points,vehicle);return Boolean(p&&p.bridgeCount);}
 function distanceToPolyline(p,points){
  const yscale=111195,xscale=yscale*Math.cos(p[0]*Math.PI/180);let min=Infinity;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],vx=(b[1]-a[1])*xscale,vy=(b[0]-a[0])*yscale;
   const wx=(p[1]-a[1])*xscale,wy=(p[0]-a[0])*yscale;
   const len=vx*vx+vy*vy,part=len?Math.max(0,Math.min(1,(wx*vx+wy*vy)/len)):0;
   min=Math.min(min,Math.hypot(wx-vx*part,wy-vy*part));
  }
  return min;
 }
 function checkBridgeProximity(track,indices,refs){
  if(!Array.isArray(refs)||refs.length!==6)throw Error('しまなみ6橋の照合資料がありません');
  for(const n of indices){
   const ref=refs[n],mid=ref?.points?.[Math.floor((ref?.points?.length||0)/2)];
   if(!mid)throw Error('しまなみ第'+(n+1)+'橋の照合資料が不完全です');
   if(distanceToPolyline(mid,track.points)>BRIDGE_RADIUS_METERS)
    throw Error(ref.name+'付近を通る道路経路を確認できません。橋の参考線を走行経路に流用しません');
  }
 }
 async function compose(points,mode,baseTuning,{query,refs,onProgress=()=>{}}={}){
  const journey=plan(points,2);
  if(!journey?.bridgeCount)throw Error('126cc以上のしまなみ島渡り区間が見つかりません');
  if(typeof query!=='function'||!brouter?.gpxFromTrack||!tuner?.normalize)
   throw Error('BRouterの道路計算プログラムが利用できません');
  const baseMode=Number(mode)===3?1:Number(mode);
  if(![0,1,2].includes(baseMode))throw Error('走り方が不正です');
  const merged={points:[],cues:[]};let crossingLegs=0;
  for(const leg of journey.legs){
   const crossing=Boolean(leg.bridges.length);
   const base=baseTuning&&typeof baseTuning==='object'?baseTuning:null;
   // Never persist expressway permission: each crossing is a temporary BRouter profile.
   const opts=crossing?tuner.normalize({
    ...(base||{}),preferences:base?.preferences||tuner.normalizePreferences(null),
    allowMotorway:true,allowToll:true
   },2):base?tuner.normalize({...base,allowMotorway:false,allowToll:false},2):null;
   onProgress({index:leg.index,total:journey.legs.length,crossing});
   let response;
   try{response=await query([points[leg.index-1],points[leg.index]],baseMode,opts,leg)}
   catch(error){throw Error('経由区間'+leg.index+'（'+(crossing?'島渡り':'一般道')+'）の計算失敗：'+String(error?.message||error));}
   const track=response?.track;
   if(!Array.isArray(track?.points)||track.points.length<2||
      !track.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))
    throw Error('経由区間'+leg.index+'の道路線が不正です');
   if(islands.meters(track.points[0],points[leg.index-1])>80||
      islands.meters(track.points.at(-1),points[leg.index])>80)
    throw Error('経由区間'+leg.index+'で道路線が出発地か目的地から離れすぎています');
   if(crossing){checkBridgeProximity(track,leg.bridges,refs);crossingLegs++;}
   if(merged.points.length){
    const gap=islands.meters(merged.points.at(-1),track.points[0]);
    if(gap>JOIN_GAP_METERS)
     throw Error('経由地'+(leg.index-1)+'の道路接続が'+Math.round(gap)+'m離れています。架空の接続線は挿入しません');
   }
   const offset=merged.points.length;
   // Only BRouter-returned geometries contribute to the rideable GPX.
   merged.points.push(...track.points);
   for(const cue of track.cues||[])if(Number.isInteger(cue.offset)&&cue.offset>=0&&cue.offset<track.points.length)
    merged.cues.push({...cue,offset:offset+cue.offset,point:track.points[cue.offset]});
  }
  return {track:merged,gpx:brouter.gpxFromTrack(merged,'Shimanami 126cc plus expressway crossing'),
    crossingLegs,bridgeCount:journey.bridgeCount,legCount:journey.legs.length};
 }
 return Object.freeze({plan,potential,bridgeIndices,compose,BRIDGE_RADIUS_METERS,JOIN_GAP_METERS});
});
