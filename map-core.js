/* B_Navi self-hosted map interaction. No external JavaScript packages.
 * Foreground OSM tile imagery requires Internet access. Never prefetch/bulk download tiles.
 * © OpenStreetMap contributors: https://www.openstreetmap.org/copyright
 */
(function(root){
'use strict';
const DEG=Math.PI/180, TILE=256, MAX_LAT=85.05112878;
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
function project(lat,lon,z){const scale=TILE*2**z;lat=clamp(lat,-MAX_LAT,MAX_LAT);const f=Math.sin(lat*DEG);return {x:(lon+180)/360*scale,y:(0.5-Math.log((1+f)/(1-f))/(4*Math.PI))*scale};}
function unproject(x,y,z){const scale=TILE*2**z;return {lat:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))/DEG,lon:x/scale*360-180};}
const svgNS='http://www.w3.org/2000/svg';
function makeSvg(tag,attributes){const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attributes))n.setAttribute(k,String(v));return n;}
class MapCore{
  constructor(container,tiles,svg,pathLayer,pointLayer,gpsLayer,onClick){this.el=container;this.tiles=tiles;this.svg=svg;this.pathLayer=pathLayer;this.pointLayer=pointLayer;this.gpsLayer=gpsLayer;this.onClick=onClick;this.lat=34.40;this.lon=132.46;this.zoom=11;this.paths=[];this.markers=[];this.gps=null;this.gpsHeading=null;this.tileNodes=new Map();this.drag=null;this.raf=0;this.hasTileLoaded=false;this.failedTiles=0;this.bearing=0;this._pathCache=null;this.init();}
  init(){
    const pointers=new Map();let holdTimer=null,holdFired=false,drag=null,gesture=null;
    const cancelHold=()=>{if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null;}};
    const skip=ev=>Boolean(ev.target.closest('button,a'));
    const local=ev=>{const r=this.el.getBoundingClientRect();return {x:ev.clientX-r.left,y:ev.clientY-r.top};};
    const point=ev=>{const p=local(ev);return this.screenToLatLon(p.x,p.y);};
    const snapshot=()=>{const a=[...pointers.values()];const dx=a[1].x-a[0].x,dy=a[1].y-a[0].y;return {length:Math.hypot(dx,dy),angle:Math.atan2(dy,dx)*180/Math.PI,midX:(a[0].x+a[1].x)/2,midY:(a[0].y+a[1].y)/2};};
    this.el.addEventListener('pointerdown',ev=>{
      if(skip(ev))return;
      ev.preventDefault();this.el.setPointerCapture?.(ev.pointerId);pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
      if(pointers.size===2){cancelHold();holdFired=true;drag=null;const a=snapshot();gesture={lastLength:a.length,lastAngle:a.angle,startAngle:a.angle,rotationIntent:0,rotationEnabled:false,zoomAccum:0};return;}
      if(pointers.size!==1)return;
      holdFired=false;drag={x:ev.clientX,y:ev.clientY,center:project(this.lat,this.lon,this.zoom),moved:false};
      if(ev.pointerType==='touch'||ev.pointerType==='pen'){
        cancelHold();const xy={x:ev.clientX,y:ev.clientY};
        holdTimer=setTimeout(()=>{holdTimer=null;if(!drag||drag.moved||pointers.size!==1)return;holdFired=true;drag=null;this.onLongPress?.(this.screenToLatLon(local({clientX:xy.x,clientY:xy.y}).x,local({clientX:xy.x,clientY:xy.y}).y));navigator.vibrate?.(20);},550);
      }
    });
    this.el.addEventListener('pointermove',ev=>{
      if(!pointers.has(ev.pointerId))return;
      pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
      if(pointers.size===2&&gesture){
        cancelHold();const a=snapshot();if(a.length<12)return;
        const zoomDelta=Math.log2(a.length/Math.max(1,gesture.lastLength));
        // Prioritize pinch zoom; accumulate scale movement without the old step overshoot.
        // Raster tiles use integer zoom, so a deliberate ~35% pinch advances one level.
        gesture.zoomAccum+=zoomDelta;
        const ZOOM_STEP=0.43;
        if(Math.abs(gesture.zoomAccum)>=ZOOM_STEP){
          const step=Math.sign(gesture.zoomAccum);
          const next=clamp(this.zoom+step,3,18);
          if(next!==this.zoom)this.setZoom(next,a.midX-this.el.getBoundingClientRect().left,a.midY-this.el.getBoundingClientRect().top);
          gesture.zoomAccum-=step*ZOOM_STEP;
        }
        let da=a.angle-gesture.lastAngle;while(da>180)da-=360;while(da<-180)da+=360;
        gesture.rotationIntent+=da;
        // Do not rotate on small, unintended finger twists during pinch.
        // After a clear 25-degree twist, rotate at 70% sensitivity.
        if(!gesture.rotationEnabled && Math.abs(gesture.rotationIntent)>=25){gesture.rotationEnabled=true;this.onManualRotate?.();}
        if(gesture.rotationEnabled && Math.abs(da)>=0.15)this.setBearing(this.bearing+da*0.70);
        gesture.lastLength=a.length;gesture.lastAngle=a.angle;
        return;
      }
      if(!drag||pointers.size!==1)return;
      const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;
      if(Math.hypot(dx,dy)>9){if(!drag.moved)this.onUserPan?.();drag.moved=true;cancelHold();}
      if(!drag.moved)return;
      const theta=-this.bearing*DEG,ux=dx*Math.cos(theta)-dy*Math.sin(theta),uy=dx*Math.sin(theta)+dy*Math.cos(theta);
      const c=unproject(drag.center.x-ux,drag.center.y-uy,this.zoom);
      this.lat=clamp(c.lat,-85,85);this.lon=clamp(c.lon,-179.99,179.99);this.schedule();
    });
    const end=ev=>{if(!pointers.has(ev.pointerId))return;const wasSingle=pointers.size===1;const moved=drag?.moved??false;
      cancelHold();pointers.delete(ev.pointerId);
      if(wasSingle&&!moved&&!holdFired&&!skip(ev))this.onClick?.(point(ev));
      if(pointers.size===0){drag=null;gesture=null;holdFired=false;}
      else{drag=null;gesture=null;holdFired=true;}
    };
    this.el.addEventListener('pointerup',end);
    this.el.addEventListener('pointercancel',end);
    this.el.addEventListener('lostpointercapture',end);
    this.el.addEventListener('contextmenu',ev=>{if(skip(ev))return;ev.preventDefault();cancelHold();drag=null;holdFired=true;this.onLongPress?.(point(ev));});
    this.el.addEventListener('wheel',ev=>{ev.preventDefault();const r=this.el.getBoundingClientRect();this.setZoom(this.zoom+(ev.deltaY<0?1:-1),ev.clientX-r.left,ev.clientY-r.top);},{passive:false});
    this.el.addEventListener('keydown',ev=>{if(ev.key==='+'||ev.key==='='){this.setZoom(this.zoom+1);ev.preventDefault();}if(ev.key==='-'){this.setZoom(this.zoom-1);ev.preventDefault();}});
    new ResizeObserver(()=>this.schedule()).observe(this.el);this.schedule();
  }
  // Inverse-rotate screen coordinates for touch hit-testing at any map bearing.
  toUnrotated(sx,sy){const x=sx-this.el.clientWidth/2,y=sy-this.el.clientHeight/2,theta=-this.bearing*DEG;return {x:x*Math.cos(theta)-y*Math.sin(theta)+this.el.clientWidth/2,y:x*Math.sin(theta)+y*Math.cos(theta)+this.el.clientHeight/2};}
  screenToLatLon(sx,sy){const p=this.toUnrotated(sx,sy),c=project(this.lat,this.lon,this.zoom);return unproject(c.x+p.x-this.el.clientWidth/2,c.y+p.y-this.el.clientHeight/2,this.zoom);}
  screenPos(p){const c=project(this.lat,this.lon,this.zoom),q=project(p[0],p[1],this.zoom);return [q.x-c.x+this.el.clientWidth/2,q.y-c.y+this.el.clientHeight/2];}
  setGpsHeading(degrees){const next=Number.isFinite(degrees)?((degrees%360)+360)%360:null;if(this.gpsHeading===next)return;this.gpsHeading=next;this.schedule();}
  setBearing(v){this.bearing=((v%360)+360)%360;this.tiles.style.transform=`rotate(${this.bearing}deg)`;this.svg.style.transform=`rotate(${this.bearing}deg)`;const btn=document.getElementById('compass-reset');if(btn){btn.hidden=Math.min(this.bearing,360-this.bearing)<2;btn.style.transform=`rotate(${this.bearing}deg)`;}this.schedule();}
  center(lat,lon,zoom=this.zoom){this.lat=clamp(lat,-85,85);this.lon=clamp(lon,-179.99,179.99);this.zoom=clamp(zoom,3,18);this.schedule();}
  setZoom(zoom,x=this.el.clientWidth/2,y=this.el.clientHeight/2){zoom=clamp(zoom,3,18);if(this.zoom===zoom)return;const before=this.screenToLatLon(x,y);this.zoom=zoom;const c=project(before.lat,before.lon,this.zoom);const anchor=this.toUnrotated(x,y);const offsetX=anchor.x-this.el.clientWidth/2,offsetY=anchor.y-this.el.clientHeight/2;const n=unproject(c.x-offsetX,c.y-offsetY,this.zoom);this.lat=n.lat;this.lon=n.lon;this.schedule();}
  fit(points){const p=points.filter(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite));if(!p.length)return;let north=Math.max(...p.map(x=>x[0])),south=Math.min(...p.map(x=>x[0])),east=Math.max(...p.map(x=>x[1])),west=Math.min(...p.map(x=>x[1]));const w=Math.max(100,this.el.clientWidth-110),h=Math.max(120,this.el.clientHeight-110);let zoom=3;for(let z=18;z>=3;z--){const a=project(north,west,z),b=project(south,east,z);if(b.x-a.x<=w&&b.y-a.y<=h){zoom=z;break;}}const u=project(north,west,zoom),v=project(south,east,zoom),mid=unproject((u.x+v.x)/2,(u.y+v.y)/2,zoom);this.center(mid.lat,mid.lon,zoom);}
  setData(paths,markers,gps){if(this.paths!==paths)this._pathCache=null;this.paths=paths||[];this.markers=markers||[];this.gps=gps||null;this.schedule();}
  schedule(){if(this.raf)return;this.raf=requestAnimationFrame(()=>{this.raf=0;this.render();});}
  render(){const w=this.el.clientWidth,h=this.el.clientHeight;if(w<1||h<1)return;const z=this.zoom,c=project(this.lat,this.lon,z),tlx=c.x-w/2,tly=c.y-h/2;this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
   // Only request raster tiles within the rotated viewport, plus a small drag buffer.
   // The old diagonal overscan loaded many unnecessary OSM tiles on phones.
   const radians=this.bearing*DEG,cos=Math.abs(Math.cos(radians)),sin=Math.abs(Math.sin(radians));
   const margin=96,spanX=(w*cos+h*sin)/2+margin,spanY=(w*sin+h*cos)/2+margin;
   const firstX=Math.floor((c.x-spanX)/TILE),lastX=Math.floor((c.x+spanX)/TILE),firstY=Math.floor((c.y-spanY)/TILE),lastY=Math.floor((c.y+spanY)/TILE);
   const required=new Set();for(let tx=firstX;tx<=lastX;tx++)for(let ty=firstY;ty<=lastY;ty++){if(ty<0||ty>=2**z)continue;const wrapped=((tx%2**z)+2**z)%2**z;const key=`${z}/${wrapped}/${ty}`;required.add(key);let img=this.tileNodes.get(key);if(!img){img=document.createElement('img');img.alt='';img.draggable=false;img.referrerPolicy='strict-origin-when-cross-origin';img.decoding='async';img.loading='eager';img.src=`https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png`;img.addEventListener('load',()=>{this.hasTileLoaded=true;const warn=document.getElementById('tile-warning');if(warn)warn.hidden=true;});img.addEventListener('error',()=>{this.failedTiles++;const warn=document.getElementById('tile-warning');if(warn&&!this.hasTileLoaded&&this.failedTiles>1)warn.hidden=false;});this.tiles.append(img);this.tileNodes.set(key,img);}img.style.left=`${tx*TILE-tlx}px`;img.style.top=`${ty*TILE-tly}px`;}
   for(const [key,el] of this.tileNodes)if(!required.has(key)){el.remove();this.tileNodes.delete(key);}
   // Rebuild the GPX SVG only when geometry, zoom, or viewport size changes.
   // During panning/GPS follow, move the already rendered layer with one transform.
   // This is presentation-only: stored GPX points and voicehint offsets remain intact.
   let cache=this._pathCache;
   if(!cache||cache.paths!==this.paths||cache.z!==z||cache.w!==w||cache.h!==h){
     this.pathLayer.replaceChildren();
     for(const path of this.paths){const list=path.points;if(!list?.length)continue;const coords=[];
       for(let i=0;i<list.length;i++){const p=list[i];if(!Array.isArray(p)||p.length<2)continue;const q=project(p[0],p[1],z);coords.push(`${(q.x-c.x+w/2).toFixed(1)} ${(q.y-c.y+h/2).toFixed(1)}`);}
       if(coords.length<2)continue;const el=makeSvg('path',{d:'M'+coords.join(' L'),stroke:path.color||'#06799b','stroke-width':path.width||4,opacity:path.opacity??0.95});if(path.dash)el.setAttribute('stroke-dasharray',path.dash);this.pathLayer.append(el);
     }
     cache={paths:this.paths,z,w,h,cx:c.x,cy:c.y};this._pathCache=cache;
   }
   this.pathLayer.setAttribute('transform',`translate(${(cache.cx-c.x).toFixed(2)} ${(cache.cy-c.y).toFixed(2)})`);
   this.pointLayer.replaceChildren();for(const m of this.markers){const [x,y]=this.screenPos(m.point);if(x<-60||x>w+60||y<-60||y>h+60)continue;const g=makeSvg('g',{transform:`translate(${x},${y})`});g.append(makeSvg('circle',{r:12,fill:m.color||'#1785a0',stroke:'#fff','stroke-width':2.5}));const num=makeSvg('text',{'text-anchor':'middle','dominant-baseline':'middle',y:0,'font-size':11,fill:'#fff','font-weight':'bold'});num.textContent=m.symbol||'•';g.append(num);const lab=makeSvg('text',{x:17,y:4,fill:'#27424d',class:'point-label'});lab.textContent=m.label||'';g.append(lab);this.pointLayer.append(g);}
   this.gpsLayer.replaceChildren();if(this.gps){const [x,y]=this.screenPos(this.gps);const arrow=makeSvg('path',{d:'M0 -18 L-11 11 L0 6 L11 11 Z',transform:`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(this.gpsHeading??0).toFixed(1)})`,fill:'#e33b32',stroke:'#fff','stroke-width':3,'stroke-linejoin':'round'});this.gpsLayer.append(arrow);if(this.gpsHeading===null){const unknown=makeSvg('text',{x:x+14,y:y-9,fill:'#b72a22',stroke:'#fff','stroke-width':3,'paint-order':'stroke','font-size':13,'font-weight':'bold'});unknown.textContent='?';this.gpsLayer.append(unknown);}}
  }
}
root.BNaviMapCore={MapCore,project,unproject};
})(window);
