/* Actual GPS fixes only; route geometry and reroute calculations are never recorded. */
'use strict';
(()=>{
 const KEY='bnavi.actual-track.v1';let record=null,active=false,lastStamp=0;
 const el=id=>document.getElementById(id);
 const safe=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(record));return true}catch{return false}}
 function render(){const count=record?.points.length||0;el('track-status').textContent=active?`記録中 ${count}点（${record.mode}）`:count?`保存待ち ${count}点`:'記録待機中';el('track-save').disabled=!count;el('track-share').disabled=!count;el('track-discard').disabled=!record;}
 function start(mode){if(active){if(record)record.modeHistory.push({mode,at:new Date().toISOString()});render();return}if(record?.points.length){record.modeHistory.push({mode,at:new Date().toISOString()});active=true;lastStamp=record.points.at(-1)?.t||0;persist();render();return}record={mode,modeHistory:[{mode,at:new Date().toISOString()}],started:new Date().toISOString(),points:[]};active=true;lastStamp=0;persist();render()}
 function add(pos){if(!active||!record||!pos?.coords)return false;const c=pos.coords,t=Number(pos.timestamp)||Date.now(),lat=c.latitude,lon=c.longitude,accuracy=c.accuracy;if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180||!Number.isFinite(accuracy)||accuracy>65||accuracy<0||t<=lastStamp)return false;
 const prev=record.points.at(-1);if(prev){const r=Math.PI/180,dLat=(lat-prev.lat)*r,dLon=(lon-prev.lon)*r,x=Math.sin(dLat/2)**2+Math.cos(lat*r)*Math.cos(prev.lat*r)*Math.sin(dLon/2)**2,meters=12742000*Math.asin(Math.min(1,Math.sqrt(x))),seconds=(t-prev.t)/1000;if(seconds<=0)return false;if(meters<3&&seconds<15)return false;if(meters/seconds>65)return false;}
 record.points.push({lat,lon,t,accuracy,ele:Number.isFinite(c.altitude)?c.altitude:null});lastStamp=t;persist();render();return true}
 function stop(){if(!active)return;active=false;if(record)record.ended=new Date().toISOString();persist();render()}
 function xml(){if(!record?.points.length)throw Error('保存するGPS軌跡がありません');const name='B_Navi 実走 '+record.started;return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="B_Navi PWA" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>'+safe(name)+'</name></metadata><trk><name>'+safe(name)+'</name><trkseg>'+record.points.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.ele===null?'':`<ele>${p.ele.toFixed(2)}</ele>`}<time>${new Date(p.t).toISOString()}</time></trkpt>`).join('')+'</trkseg></trk></gpx>'}
 function save(){if(!record?.points.length)return;const blob=new Blob([xml()],{type:'application/gpx+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='B_Navi_actual_'+record.started.replace(/[:.]/g,'-')+'.gpx';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);/* Retain until explicitly discarded to avoid accidental loss. */}
 async function share(){
  if(!record?.points.length)return;
  const filename='B_Navi_actual_'+record.started.replace(/[:.]/g,'-')+'.gpx';
  const file=new File([xml()],filename,{type:'application/gpx+xml'});
  try{
   if(!navigator.share||!navigator.canShare||!navigator.canShare({files:[file]})){
    alert('この端末・ブラウザではGPXファイルの直接共有に対応していません。先に「実走GPXを保存」で保存し、LINEのファイル送信から選んでね。');return;
   }
   await navigator.share({files:[file],title:'B_Navi 実走GPX'});
  }catch(e){if(e?.name!=='AbortError')alert('共有できませんでした。GPXを保存してからLINEでファイル送信してね。');}
 }
 function discard(){if(active){alert('走行記録中です。先に走行を終了してね。');return}if(!confirm('保存待ちの走行記録を破棄しますか？'))return;record=null;lastStamp=0;localStorage.removeItem(KEY);render()}
 try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old&&Array.isArray(old.points)){record=old;active=false;lastStamp=old.points.at(-1)?.t||0}}catch{}
 el('track-save').addEventListener('click',save);el('track-share').addEventListener('click',share);el('track-discard').addEventListener('click',discard);render();window.BNaviTrack={start,add,stop,xml,getState:()=>({active,count:record?.points.length||0})};
})();
