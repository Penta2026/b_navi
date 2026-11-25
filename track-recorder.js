/* Actual GPS fixes only; route geometry and reroute calculations are never recorded. */
'use strict';
(()=>{
 const KEY='bnavi.actual-track.v1';let record=null,active=false,lastStamp=0;
 const el=id=>document.getElementById(id);
 const safe=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(record));return true}catch{return false}}
 function render(){const count=record?.points.length||0;el('track-panel').dataset.state=active?'recording':count?'ready':'idle';el('track-status').textContent=active?`記録中 ${count}点（${record.mode}）`:count?`保存待ち ${count}点`:'記録待機中';el('track-save').disabled=!count;el('track-share').disabled=!count;el('track-copy').disabled=!count;el('track-discard').disabled=!record;}
 function start(mode){if(active){if(record)record.modeHistory.push({mode,at:new Date().toISOString()});render();return}if(record?.points.length){record.modeHistory.push({mode,at:new Date().toISOString()});active=true;lastStamp=record.points.at(-1)?.t||0;persist();render();return}record={mode,modeHistory:[{mode,at:new Date().toISOString()}],started:new Date().toISOString(),points:[]};active=true;lastStamp=0;persist();render()}
 function add(pos){if(!active||!record||!pos?.coords)return false;const c=pos.coords,t=Number(pos.timestamp)||Date.now(),lat=c.latitude,lon=c.longitude,accuracy=c.accuracy;if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180||!Number.isFinite(accuracy)||accuracy>65||accuracy<0||t<=lastStamp)return false;
 const prev=record.points.at(-1);if(prev){const r=Math.PI/180,dLat=(lat-prev.lat)*r,dLon=(lon-prev.lon)*r,x=Math.sin(dLat/2)**2+Math.cos(lat*r)*Math.cos(prev.lat*r)*Math.sin(dLon/2)**2,meters=12742000*Math.asin(Math.min(1,Math.sqrt(x))),seconds=(t-prev.t)/1000;if(seconds<=0)return false;if(meters<3&&seconds<15)return false;if(meters/seconds>65)return false;}
 record.points.push({lat,lon,t,accuracy,ele:Number.isFinite(c.altitude)?c.altitude:null});lastStamp=t;persist();render();return true}
 function stop(){if(!active)return;active=false;if(record)record.ended=new Date().toISOString();persist();render()}
 function xml(){if(!record?.points.length)throw Error('保存するGPS軌跡がありません');const name='B_Navi 実走 '+record.started;return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="B_Navi PWA" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>'+safe(name)+'</name></metadata><trk><name>'+safe(name)+'</name><trkseg>'+record.points.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.ele===null?'':`<ele>${p.ele.toFixed(2)}</ele>`}<time>${new Date(p.t).toISOString()}</time></trkpt>`).join('')+'</trkseg></trk></gpx>'}
 // Use the phone's LOCAL date/time at the first export, not the UTC time in record.started.
 // Keep this filename for subsequent save/share of the same recording, even after reloading.
 // A colon is forbidden in Windows filenames; use a hyphen between hours and minutes.
 function formatFilename(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))throw Error('保存日時が不正です');const pad=n=>String(n).padStart(2,'0');return `実走GPX-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}.gpx`}
 function filename(){if(!record?.points.length)throw Error('保存するGPS軌跡がありません');if(!record.exportedAt){record.exportedAt=new Date().toISOString();persist()}return formatFilename(record.exportedAt)}
 function downloadTrack(){
  const blob=new Blob([xml()],{type:'application/gpx+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  // The recorded points remain until the user explicitly discards them.
 }
 const shareStatus=()=>el('track-share-status');
 function reportShare(message){const status=shareStatus();if(status)status.textContent=message;}
 function save(){if(!record?.points.length)return;try{downloadTrack();reportShare('GPXの保存を開始したよ。端末の「ダウンロード」や「ファイル」から確認してね。');}catch(e){reportShare('GPXを保存できませんでした：'+String(e?.message||e));}}
 function showManualCopy(text){
  const panel=el('track-copy-manual'),field=el('track-copy-text');
  field.value=text;panel.hidden=false;
  field.focus();field.select();field.setSelectionRange(0,field.value.length);
 }
 async function copyTrack(){
  if(!record?.points.length)return;
  let text;
  try{text=xml();}catch(e){reportShare('GPXを生成できませんでした：'+String(e?.message||e));return;}
  // Call clipboard write directly in the click action so mobile browsers
  // still consider it a user gesture. Do not clear the stored recording.
  try{
   if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
   await navigator.clipboard.writeText(text);
   el('track-copy-manual').hidden=true;
   reportShare('実走GPXをコピーしたよ（'+text.length.toLocaleString('ja-JP')+'文字）。貼り付け先の文字数制限に注意してね。');
  }catch(e){
   showManualCopy(text);
   reportShare('自動コピーが使えないため、下のGPXテキストを選択したよ。長押ししてコピーしてね。長い記録はファイル保存がおすすめ。');
  }
 }
 function chromiumFileShareBlocked(){
  // Chromium's Web Share allowlist does not include .gpx (nor .xml).
  // Android Chrome may claim canShare=true and still reject on share().
  const ua=navigator.userAgent||'';
  return !/iPhone|iPad|iPod/i.test(ua)&&/(?:Chrome|Chromium|Edg|EdgA|SamsungBrowser|OPR)\//i.test(ua);
 }
 async function share(){
  if(!record?.points.length)return;
  // Preserve GPX extension and content; a .txt file would not be a GPX attachment.
  if(chromiumFileShareBlocked()){
   save();
   reportShare('Chrome系ブラウザではGPXの直接共有が制限されるため、GPXファイルの保存を開始したよ。LINEなどの「ファイル」添付からこのGPXを選んでね。');
   return;
  }
  let file;
  try{file=new File([xml()],filename(),{type:'application/gpx+xml'});}
  catch(e){reportShare('共有ファイルを作成できませんでした：'+String(e?.message||e));return;}
  if(typeof navigator.share!=='function'||typeof navigator.canShare!=='function'||!navigator.canShare({files:[file]})){
   save();
   reportShare('この端末ではGPXファイルを直接共有できないため、保存を開始したよ。ファイルアプリからLINEなどに添付してね。');
   return;
  }
  try{
   await navigator.share({files:[file],title:'B_Navi 実走GPX'});
   reportShare('GPXを共有メニューへ渡したよ。送信結果は共有先で確認してね。');
  }catch(e){
   if(e?.name==='AbortError'){reportShare('共有をキャンセルしたよ。走行記録はそのまま残してあるよ。');return;}
   // Do not pretend share succeeded. Browsers may reject after canShare=true.
   reportShare('直接共有に失敗（'+String(e?.name||'Error')+'）。下の「実走GPXを保存」を押して、LINEなどでファイル添付してね。');
  }
 }
 function discard(){if(active){alert('走行記録中です。先に走行を終了してね。');return}if(!confirm('保存待ちの走行記録を破棄しますか？'))return;record=null;lastStamp=0;localStorage.removeItem(KEY);el('track-copy-text').value='';el('track-copy-manual').hidden=true;render()}
 try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old&&Array.isArray(old.points)){record=old;active=false;lastStamp=old.points.at(-1)?.t||0}}catch{}
 el('track-save').addEventListener('click',save);el('track-share').addEventListener('click',share);el('track-copy').addEventListener('click',copyTrack);el('track-discard').addEventListener('click',discard);render();window.BNaviTrack={start,add,stop,xml,formatFilename,getFilename:filename,getState:()=>({active,count:record?.points.length||0})};
})();
