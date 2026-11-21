/* Android vf1 inspired foreground ride rules; pure functions for repeatable tests. */
(function(root){
'use strict';
const radians=Math.PI/180;
function meters(a,b){
 const dlat=(b[0]-a[0])*radians,dlon=(b[1]-a[1])*radians;
 const q=Math.sin(dlat/2)**2+Math.cos(a[0]*radians)*Math.cos(b[0]*radians)*Math.sin(dlon/2)**2;
 return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));
}
function distanceToPolyline(point,pts){
 if(!point||!Array.isArray(pts)||pts.length<2)return Infinity;
 const sy=111195,sx=111320*Math.cos(point[0]*radians);
 let nearest=Infinity;
 for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i];if(!a||!b)continue;
   const ax=(a[1]-point[1])*sx,ay=(a[0]-point[0])*sy,bx=(b[1]-point[1])*sx,by=(b[0]-point[0])*sy;
   // Skip obviously remote segments without compromising the near-route distance.
   if(Math.min(Math.abs(ax),Math.abs(bx))>500&&ax*bx>0)continue;
   if(Math.min(Math.abs(ay),Math.abs(by))>500&&ay*by>0)continue;
   const dx=bx-ax,dy=by-ay,norm=dx*dx+dy*dy;
   const t=norm<1e-8?0:Math.min(1,Math.max(0,-(ax*dx+ay*dy)/norm));
   nearest=Math.min(nearest,Math.hypot(ax+t*dx,ay+t*dy));
 }
 return Number.isFinite(nearest)?nearest:Math.min(meters(point,pts[0]),meters(point,pts.at(-1)));
}
class OffRoutePolicy{
 constructor(){this.consecutive=0;this.first=-1;this.lastAttempt=-Infinity;}
 static threshold(accuracy){return Math.max(10,2*(Number.isFinite(accuracy)&&accuracy>0?accuracy:45)+3);}
 reset(){this.consecutive=0;this.first=-1;}
 markAttempt(now){this.lastAttempt=now;this.reset();}
 observe(distance,accuracy,now){
   if(!Number.isFinite(distance)||distance<=OffRoutePolicy.threshold(accuracy)){this.reset();return false;}
   if(this.first<0)this.first=now;
   this.consecutive=Math.min(3,this.consecutive+1);
   if(this.consecutive<3||now-this.first<1200)return false;
   if(now-this.lastAttempt<12000)return false;
   this.markAttempt(now);return true;
 }
}
class ArrivalPolicy{
 constructor(){this.hits=0;this.triggered=false;}
 reset(){this.hits=0;this.triggered=false;}
 observe(distance,accuracy){
  if(this.triggered)return false;
  if(!Number.isFinite(distance)||!Number.isFinite(accuracy)||accuracy>25||distance>20){this.hits=0;return false;}
  if(++this.hits<2)return false;
  this.triggered=true;return true;
 }
}
const api={meters,distanceToPolyline,OffRoutePolicy,ArrivalPolicy};
root.BNaviRideLogic=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
