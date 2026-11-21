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
// Movement confirmation is independent from route deviation. Stationary GPS drift
// must never start a route calculation. Strong course motion works even if the
// platform doesn't expose coords.speed (e.g. some browsers).
class MotionGate{
 constructor(){this.reset();}
 reset(){this.previous=null;this.previousStep=null;this.stepRun=0;this.signalHits=0;this.firstSignal=-1;this.activeUntil=-Infinity;}
 isMoving(now){return Number.isFinite(now)&&now<=this.activeUntil;}
 observe(point,accuracy,speed,now){
  if(!Array.isArray(point)||!point.every(Number.isFinite)||!Number.isFinite(now)||!Number.isFinite(accuracy)||accuracy>30){
   this.previous=null;this.previousStep=null;this.stepRun=0;this.signalHits=0;this.firstSignal=-1;
   return this.isMoving(now);
  }
  // Speed alone needs two valid fixes; a single spike cannot enable rerouting.
  const fast=Number.isFinite(speed)&&speed>=2;
  let coherentStep=false;
  if(this.previous){
   const dt=now-this.previous.at;
   if(dt>=450&&dt<=8000){
    const displacement=meters(point,this.previous.point);
    const required=Math.max(15,1.4*(accuracy+this.previous.accuracy)+5);
    if(displacement>=required&&displacement/(dt/1000)>=2.2){
     const vx=(point[1]-this.previous.point[1])*Math.cos(point[0]*radians);
     const vy=point[0]-this.previous.point[0];
     const mag=Math.hypot(vx,vy);
     const vec=mag>0?[vx/mag,vy/mag]:null;
     const sameDirection=vec&&this.previousStep&&(vec[0]*this.previousStep[0]+vec[1]*this.previousStep[1])>=0.65;
     this.stepRun=sameDirection?this.stepRun+1:1;
     this.previousStep=vec;
     coherentStep=this.stepRun>=2;
    }else{this.stepRun=0;this.previousStep=null;}
   }else{this.stepRun=0;this.previousStep=null;}
  }
  this.previous={point:[...point],accuracy,at:now};
  if(fast||coherentStep){
   if(this.signalHits===0)this.firstSignal=now;
   this.signalHits++;
   if(this.signalHits>=2&&now-this.firstSignal>=600)this.activeUntil=now+6000;
  }else{this.signalHits=0;this.firstSignal=-1;}
  return this.isMoving(now);
 }
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
const api={meters,distanceToPolyline,MotionGate,OffRoutePolicy,ArrivalPolicy};
root.BNaviRideLogic=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
