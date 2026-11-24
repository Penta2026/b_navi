/* B_Navi: optional, user-requested Biwako Ohashi waypoint (Route 477).
 * Verified bridge centre: JSCE Kansai civil heritage registry.
 * This is a POINT CONSTRAINT, not a promised real-time closure or turn by turn route.
 * A real BRouter road must reach/cross the point; never create a straight bridge.
 */
(function(root,factory){
 const result=factory();
 if(typeof module==='object'&&module.exports)module.exports=result;
 else root.BNaviBiwakoBridge=result;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CENTER=Object.freeze([35.120902,135.935418]);
 const R=Math.PI/180;
 function meters(a,b){
  const dlat=(b[0]-a[0])*R,dlon=(b[1]-a[1])*R;
  return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[0]*R)*Math.cos(b[0]*R)*Math.sin(dlon/2)**2)));
 }
 function valid(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<90&&Math.abs(p[1])<180}
 function proximity(point,vertices){
  let best=Infinity;
  for(let i=1;i<vertices.length;i++){
   const a=vertices[i-1],b=vertices[i],sx=111195*Math.cos(point[0]*R),sy=111195;
   const ax=(a[1]-point[1])*sx,ay=(a[0]-point[0])*sy,dx=(b[1]-a[1])*sx,dy=(b[0]-a[0])*sy;
   const den=dx*dx+dy*dy,t=den?Math.min(1,Math.max(0,-(ax*dx+ay*dy)/den)):0;
   best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
  }
  return best;
 }
 function plan(points){
  if(!Array.isArray(points)||points.length<2||points.length>51||!points.every(valid))
   throw Error('琵琶湖大橋を経由するための地点が多すぎるか不正です');
  if(points.slice(1,-1).some(p=>meters(p,CENTER)<80))
   return {points:points.map(p=>p.slice()),inserted:false,center:CENTER.slice()};
  let best=Infinity,insert=-1;
  for(let i=1;i<points.length;i++){
   const extra=meters(points[i-1],CENTER)+meters(CENTER,points[i])-meters(points[i-1],points[i]);
   if(extra<best){best=extra;insert=i;}
  }
  // Prevent unintentional thousand-kilometre scenic diversions; a forced
  // bridge must be geographically relevant to the user's chosen itinerary.
  if(best>250000)throw Error('琵琶湖大橋は指定した旅程から大きく離れています。経由を外すか地点を見直してね');
  const copy=points.map(p=>p.slice());copy.splice(insert,0,CENTER.slice());
  return {points:copy,inserted:true,index:insert,center:CENTER.slice(),extraMeters:Math.round(best)};
 }
 function verify(track){
  if(!Array.isArray(track)||track.length<2||track.length>100000||!track.every(valid))
   throw Error('琵琶湖大橋の道路経路を確認できません');
  // Endpoint snap alone is not proof of a bridge crossing. It must touch the
  // centre AND reach both shores within the known short approach corridor.
  const d=proximity(CENTER,track);
  const west=track.some(p=>p[1]<135.925&&p[0]>35.090&&p[0]<35.155);
  const east=track.some(p=>p[1]>135.946&&p[0]>35.090&&p[0]<35.155);
  if(d>150||!west||!east)
   throw Error('公開BRouterの経路が琵琶湖大橋を横断したと確認できません。元の道路に直線を足すことはしません');
  return {distanceMeters:Math.round(d)};
 }
 return Object.freeze({CENTER,meters,proximity,plan,verify});
});
