/* One-tap manual detour: avoid a forward section of the actual routed road.
   No traffic prediction and no artificial road connectors. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BNaviManualDetour=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const AHEAD_METERS=230,RADIUS_METERS=110,MAX_GPS_ROUTE_OFFSET=80,RAD=Math.PI/180;
 const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
 function meters(p,q){
  const a=(q[0]-p[0])*RAD,b=(q[1]-p[1])*RAD;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(a/2)**2+Math.cos(p[0]*RAD)*Math.cos(q[0]*RAD)*Math.sin(b/2)**2)));
 }
 function projection(p,a,b){
  const sy=111195,sx=sy*Math.cos(p[0]*RAD);
  const ax=(a[1]-p[1])*sx,ay=(a[0]-p[0])*sy,dx=(b[1]-a[1])*sx,dy=(b[0]-a[0])*sy;
  const den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
  return {t,distance:Math.hypot(ax+t*dx,ay+t*dy)};
 }
 function distanceToPolyline(p,pts){
  if(!valid(p)||!Array.isArray(pts)||pts.length<2)return Infinity;
  let d=Infinity;for(let i=1;i<pts.length;i++)if(valid(pts[i-1])&&valid(pts[i]))d=Math.min(d,projection(p,pts[i-1],pts[i]).distance);
  return d;
 }
 function plan(position,track,targets=[],opts={}){
  if(!valid(position)||!Array.isArray(track)||track.length<2||track.length>100000||!track.every(valid))
    throw Error('GPS位置または計算済み道路ルートを確認できません');
  const ahead=opts.aheadMeters??AHEAD_METERS,radius=opts.radiusMeters??RADIUS_METERS;
  if(!Number.isFinite(ahead)||ahead<160||ahead>800||!Number.isFinite(radius)||radius<50||radius>300||ahead<=radius+65)
    throw Error('迂回する範囲の設定が不正です');
  let best=Infinity,progress=0,total=0;const lengths=[];
  for(let i=1;i<track.length;i++){
   const len=meters(track[i-1],track[i]),hit=projection(position,track[i-1],track[i]);lengths.push(len);
   if(hit.distance<best){best=hit.distance;progress=total+len*hit.t;}total+=len;
  }
  if(best>MAX_GPS_ROUTE_OFFSET)throw Error('現在地がルートから離れています。安全な場所でルートを再探索してね');
  const targetDistance=progress+ahead;
  if(targetDistance+radius+45>total)throw Error('目的地が近いため前方の迂回エリアを安全に作れません');
  let sum=0,point=null;
  for(let i=1;i<track.length;i++){
   const len=lengths[i-1];
   if(sum+len>=targetDistance||i===track.length-1){
    const t=len?Math.max(0,Math.min(1,(targetDistance-sum)/len)):0;
    point=[track[i-1][0]+t*(track[i][0]-track[i-1][0]),track[i-1][1]+t*(track[i][1]-track[i-1][1])];break;
   }
   sum+=len;
  }
  if(!point||meters(position,point)<radius+55)throw Error('現在地に近すぎるため迂回エリアを設定できません');
  if(!Array.isArray(targets)||!targets.every(valid))throw Error('経由地を確認できません');
  if(targets.some(t=>meters(t,point)<radius+45))throw Error('経由地・目的地の近くを避けてしまうため迂回できません');
  return {point,radius:Math.round(radius),aheadMeters:Math.round(ahead),gpsOffsetMeters:Math.round(best)};
 }
 function verify(track,avoid){
  if(!Array.isArray(track)||!valid(avoid?.point))throw Error('迂回先の道路線が不正です');
  if(distanceToPolyline(avoid.point,track)<avoid.radius-5)throw Error('新ルートが回避エリアを通るため、元の経路を維持しました');
  return true;
 }
 return Object.freeze({AHEAD_METERS,RADIUS_METERS,MAX_GPS_ROUTE_OFFSET,meters,distanceToPolyline,plan,verify});
});
