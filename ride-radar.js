/* Android vf1 foreground-only free ride and radar port. No speed-limit lookup. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const marks=[[10,20,40,80,100],[100,200,300,400,500],[500,2000,4000,8000,10000],[10000,20000,30000,40000,50000]];
 let mode='off',watch=null,heading=NaN,scale=-1,lastChange=0,fix=null,audio=null,visible=true;
 const panel=$('ride-panel'),screen=$('radar-screen'),canvas=$('radar-canvas');
 const status=s=>{$('ride-status').textContent=s; if(mode==='radar')$('radar-readout').textContent=s;};
 function haversine(a,b){const r=Math.PI/180,x=(b[0]-a[0])*r,y=(b[1]-a[1])*r,q=Math.sin(x/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(y/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)));}
 function azimuth(a,b){const r=Math.PI/180,p1=a[0]*r,p2=b[0]*r,d=(b[1]-a[1])*r;return (Math.atan2(Math.sin(d)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(d))/r+360)%360;}
 function fmt(m){return !Number.isFinite(m)?'--':m<1000?Math.round(m)+' m':(m<10000?(m/1000).toFixed(2):(m/1000).toFixed(1))+' km';}
 function goal(){const active=window.BNaviGetActiveDestination?.();if(active)return active;try{return inputPoint('goal')}catch{return null}}
 function targetLabel(){return window.BNaviActiveTargetLabel?.()||'目的地';}
 function tone(ctx,freq,when,duration){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0.0001,when);g.gain.linearRampToValueAtTime(.17,when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+duration);o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+duration+.012)}
 function chime(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const t=audio.currentTime+.015;for(const shift of [0,.46]){tone(audio,740,t+shift,.095);tone(audio,990,t+shift+.115,.155);}}catch(e){console.warn('Radar audio unavailable',e)}}
 function stop(silent=false){if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null}if(mode==='free'){state.location=null;map.setGpsHeading(null);refreshMap();}document.body.classList.remove('free-ride-active');mode='off';screen.hidden=true;$('ride-pill').hidden=true;$('ride-free').textContent='🏍 フリー走行開始';$('ride-radar').textContent='📡 レーダー開始';$('ride-free').classList.remove('active');$('ride-radar').classList.remove('active');if(!silent)status('停止中');}
 function start(which){if(mode===which){stop();return}if(which==='radar'&&!goal()){status('先に目的地を設定してね');panel.hidden=false;return}if(!window.isSecureContext){status('スマホGPSにはHTTPS接続が必要です（PC localhost は例外）');panel.hidden=false;return}if(!navigator.geolocation){status('このブラウザではGPSを使えません');return}
  stop(true);if(typeof stopGps==='function'&&state.watchId!=null)stopGps();if(which==='radar')window.BNaviInitRadarTargets?.();if(which==='free'){state.heading={heading:null,at:-Infinity};map.setGpsHeading(null);setOrientationMode('head');}if(which==='radar'){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch(e){console.warn(e)}}mode=which;heading=NaN;scale=-1;lastChange=0;fix=null;
  document.body.classList.toggle('free-ride-active',which==='free');
  if(which==='radar'){screen.hidden=false;$('ride-radar').textContent='📡 レーダー終了';$('ride-radar').classList.add('active');draw();}
  else{$('ride-free').textContent='■ フリー走行終了';$('ride-free').classList.add('active');$('ride-pill').hidden=false;panel.hidden=true;}
  status('GPSを取得中…');
  // Intentionally independent from route guidance; no BRouter route is needed.
  watch=navigator.geolocation.watchPosition(onFix,e=>{status('GPSエラー：'+e.message);if(e.code===1)stop(true);},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
 }
 function onFix(pos){if(mode==='off'||!visible)return;const c=pos.coords;if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return;
  if(c.accuracy>(mode==='radar'?65:45)){status('GPS精度が不足しています ±'+Math.round(c.accuracy)+'m');return}
  const at=[c.latitude,c.longitude];fix=at;
  if(Number.isFinite(c.heading)&&c.speed>=2)heading=c.heading;
  if(mode==='free'){
   state.location=at;state.gpsAccuracy=c.accuracy;updateHeadingFromPosition(pos);refreshMap();
   // Reuse the same Android-inspired red course arrow and head-up map mode.
   let latitude=at[0],longitude=at[1];if(Number.isFinite(heading)){const rad=heading*Math.PI/180;latitude+=35*Math.cos(rad)/111132;longitude+=35*Math.sin(rad)/(111320*Math.max(.2,Math.cos(at[0]*Math.PI/180)));}
   map.center(latitude,longitude,Math.max(map.zoom,15));status('フリー走行中｜GPS ±'+Math.round(c.accuracy)+'m・地図追従');return;
  }
  if(window.BNaviObserveDestination?.(at,c.accuracy,'radar'))return;
  const dest=goal();if(!dest){status('目的地が解除されました');return}const d=haversine(at,dest),bearing=azimuth(at,dest),now=performance.now();
  if(scale<0){scale=0;while(scale<3&&d>marks[scale][4])scale++;}
  else if(now-lastChange>=2500){let next=scale;if(d>marks[scale][4]*1.10&&scale<3)next++;else if(scale>0&&d<marks[scale-1][4]*.90)next--;if(next!==scale){const narrower=next<scale;scale=next;lastChange=now;if(narrower)chime()}}
  status(targetLabel()+'まで直線 '+fmt(d)+'｜'+(Number.isFinite(heading)?'進行方向を上':'進行方向を確認中')+'｜GPS ±'+Math.round(c.accuracy)+'m');draw(d,bearing);
 }
 function draw(d=NaN,bearing=0){if(screen.hidden)return;const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),ratio=window.devicePixelRatio||1;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#0a231e';ctx.fillRect(0,0,w,h);
 const x=w/2,y=h*.5,rad=Math.max(32,Math.min(w*.43,y-52,h-y-52)),m=marks[Math.max(0,scale)],center=.12;
 ctx.fillStyle='#0c392b';ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#36775c';ctx.lineWidth=1;
 for(let i=0;i<=4;i++){const f=i===0?center:center+(1-center)*i/4;ctx.beginPath();ctx.arc(x,y,rad*f,0,Math.PI*2);ctx.stroke();}
 ctx.strokeStyle='#36775c';ctx.beginPath();ctx.moveTo(x-rad,y);ctx.lineTo(x+rad,y);ctx.moveTo(x,y-rad);ctx.lineTo(x,y+rad);ctx.stroke();
 ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle='#a8d8bd';ctx.fillText('前方',x,y-rad-17);
 ctx.font='10px sans-serif';for(let i=1;i<=4;i++){const f=center+(1-center)*i/4;ctx.fillText(fmt(m[i]),x+rad*f-22,y-8)}ctx.fillText('中心 ≦'+fmt(m[0]),x,y+rad*center+17);
 if(Number.isFinite(d)){
  let frac=0;if(d>0&&d<=m[0])frac=center*d/m[0];else if(d>m[0]){frac=1;for(let i=1;i<m.length;i++){if(d<=m[i]){frac=center+(1-center)*(i-1+(d-m[i-1])/(m[i]-m[i-1]))/4;break}}}
  const angle=((Number.isFinite(heading)?bearing-heading:bearing)-90)*Math.PI/180,len=frac*rad,dx=Math.cos(angle),dy=Math.sin(angle);
  ctx.fillStyle='#f7d345';for(let k=22;k<len-8;k+=27){const px=x+dx*k,py=y+dy*k;ctx.save();ctx.translate(px,py);ctx.rotate(angle+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-5,6);ctx.lineTo(5,6);ctx.closePath();ctx.fill();ctx.restore()}
  ctx.beginPath();ctx.arc(x+dx*len,y+dy*len,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff8c7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+dx*len,y+dy*len,12,0,Math.PI*2);ctx.stroke();
 }
 ctx.fillStyle='#ea4141';ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a8d8bd';ctx.font='14px sans-serif';ctx.fillText(targetLabel()+'まで（直線）',x,Math.min(h-30,y+rad+33));ctx.fillStyle='#fff';ctx.font='bold 29px sans-serif';ctx.fillText(fmt(d),x,Math.min(h-3,y+rad+66));}
 function refreshTarget(){scale=-1;lastChange=0;const at=fix||state.location;const dest=goal();if(at&&dest){const d=haversine(at,dest);draw(d,azimuth(at,dest));status(targetLabel()+'まで直線 '+fmt(d));}else{draw();status('GPSを取得中…');}}
 function openNavRadar(){
  if(!state.navActive)return;
  if(mode==='radar'||mode==='free')stop(true);
  mode='nav-radar';fix=state.location;heading=Number.isFinite(state.heading?.heading)?state.heading.heading:NaN;scale=-1;
  screen.hidden=false;panel.hidden=true;refreshTarget();
 }
 function closeNavRadar(){if(mode!=='nav-radar')return;mode='off';screen.hidden=true;}
 function updateNavigationRadar(at,course){
  if(mode!=='nav-radar'||!at||state.navPaused||state.finishing)return;
  fix=at;if(Number.isFinite(course))heading=course;
  const dest=goal();if(!dest)return;
  const d=haversine(at,dest),b=azimuth(at,dest);let n=0;while(n<3&&d>marks[n][4])n++;
  if(scale<0)scale=n;else if(n<scale){scale=n;chime();}else if(n>scale)scale=n;
  status(targetLabel()+'まで直線 '+fmt(d));draw(d,b);
 }
 window.BNaviRideMode={stop,openNavRadar,closeNavRadar,updateNavigationRadar,refreshTarget,getMode:()=>mode};
 $('mobile-ride').onclick=()=>{panel.hidden=!panel.hidden};$('ride-close').onclick=()=>panel.hidden=true;
 $('ride-free').onclick=()=>start('free');$('ride-radar').onclick=()=>start('radar');$('radar-exit').onclick=()=>{if(mode==='nav-radar')closeNavRadar();else stop()};$('ride-stop').onclick=()=>stop();
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(!visible&&mode!=='off'){stop(true);status('画面が非表示になったため走行モードを終了しました')}});
 window.addEventListener('resize',()=>{if(mode==='radar'||mode==='nav-radar')refreshTarget()});
})();
