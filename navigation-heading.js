/* Heading-up map: Android vf1-inspired GPS course handling.
 * Do not invent a course when geolocation.heading is absent or the rider is stationary.
 * Uses true-north GPS course (not unreliable magnetic device orientation).
 */
(function(root){
'use strict';
const wrap=a=>((a%360)+360)%360;
const difference=(a,b)=>((wrap(b)-wrap(a)+540)%360)-180;
function acceptFix(previous,fix,now){
 const old=previous||{heading:null,at:-Infinity};
 const c=fix?.coords||fix||{};
 const heading=Number(c.heading),speed=Number(c.speed),accuracy=Number(c.accuracy);
 const valid=c.heading!==null&&c.heading!==undefined&&Number.isFinite(heading)&&heading>=0&&heading<360&&
    c.speed!==null&&c.speed!==undefined&&Number.isFinite(speed)&&speed>=2&&
    Number.isFinite(accuracy)&&accuracy<=35;
 if(!valid)return {heading:old.heading,at:old.at,accepted:false};
 const changed=old.heading===null||!Number.isFinite(old.heading)||Math.abs(difference(old.heading,heading))>=8;
 const elapsed=now-old.at>=1200;
 if(!changed||!elapsed)return {heading:old.heading,at:old.at,accepted:false};
 return {heading:wrap(heading),at:now,accepted:true};
}
function mapBearing(mode,heading){return mode==='head'&&Number.isFinite(heading)?-wrap(heading):0}
const api={wrap,difference,acceptFix,mapBearing};
root.BNaviHeading=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
