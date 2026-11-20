/* GPX file import for external apps and Web Share Target. No server upload. */
'use strict';
(()=>{
const el=id=>document.getElementById(id);
const MAX_BYTES=12*1024*1024;
async function ingestFile(file){
 if(!file) return;
 if(file.size>MAX_BYTES)throw Error('GPXは12MB以下のファイルを選んでね。');
 const xml=await file.text();
 if(!/<(?:[A-Za-z0-9_]+:)?gpx(?:\s|>)/i.test(xml.slice(0,500)))throw Error('GPXファイルとして認識できなかったよ。');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('GPXのXML形式が正しくありません。');
 let track=[];
 const trks=[...doc.getElementsByTagNameNS('*','trkseg')];
 if(trks.length){for(const seg of trks){const pts=[...seg.getElementsByTagNameNS('*','trkpt')].map(node=>[Number(node.getAttribute('lat')),Number(node.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(pts.length>1)track.push(pts)}}
 else{const pts=[...doc.getElementsByTagNameNS('*','rtept')].map(node=>[Number(node.getAttribute('lat')),Number(node.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(pts.length>1)track.push(pts)}
 if(!track.length){const waypoints=[...doc.getElementsByTagNameNS('*','wpt')].map(node=>[Number(node.getAttribute('lat')),Number(node.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(waypoints.length>=2){el('start').value=fmt(waypoints[0]);el('goal').value=fmt(waypoints.at(-1));state.via=waypoints.slice(1,-1).map(fmt).slice(0,50);renderVia();refreshMap();fitMarkers();persist();el('gpx-import-status').textContent='地点だけのGPXを読み込んだよ。道路ルートは「ルート検索」で計算してね。';return;}throw Error('軌跡または2点以上の地点が見つからないGPXだったよ。')}
 const sections=track.map((points,i)=>({type:'road',points,color:'#06799b',width:5,label:`読み込みGPX ${i+1}区間`,gpx:xml}));
 // Multiple trkseg: preserve segmentation and prevent fictitious lines across gaps.
 if(track.length===1)routeView('normal',sections,xml,'GPXを読み込んだよ。軌跡を地図に表示したよ。');
 else{routeView('imported',sections,xml,'GPXを読み込んだよ。複数の軌跡は連結せず表示します（音声案内は未対応）。');}
 el('gpx-import-status').textContent=file.name+' を読み込みました。右左折の音声は案内情報付きGPXのみ対応します。';
 const first=track[0][0],last=track.at(-1).at(-1);el('start').value=fmt(first);el('goal').value=fmt(last);state.via=[];renderVia();updatePointSummaries();persist();
}
const fileInput=el('gpx-file');el('import-gpx').addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',async()=>{try{await ingestFile(fileInput.files?.[0])}catch(e){el('gpx-import-status').textContent='読み込み失敗：'+e.message}finally{fileInput.value=''}});
// Web Share Target is supported only for installed PWAs in compatible browsers.
async function receiveShare(){if(!new URLSearchParams(location.search).has('gpx_share'))return;
 try{if(!navigator.serviceWorker)throw Error('共有受信に対応していません');await navigator.serviceWorker.ready;
 const r=await fetch('./__bnavi_shared_gpx__',{cache:'no-store'});if(!r.ok)throw Error('共有されたGPXが見つかりません');const file=new File([await r.blob()],'Shared_route.gpx',{type:'application/gpx+xml'});await ingestFile(file);
 }catch(e){el('gpx-import-status').textContent='共有GPXの読み込み失敗：'+e.message}
 finally{history.replaceState(null,'',location.pathname);}}
// iPhone/Safari: manual text Paste works even if navigator.clipboard is blocked by HTTP or permission.
const gpxPasteField=el('gpx-paste-text'),gpxPasteStatus=el('gpx-paste-status');
async function ingestClipboardText(text){
 const xml=String(text||'').trim();
 if(!xml)throw Error('GPXの文字データを貼り付けてね。');
 const file=new File([xml],'Clipboard_route.gpx',{type:'application/gpx+xml;charset=utf-8'});
 if(file.size>MAX_BYTES)throw Error('GPXが12MBを超えているよ。ファイル読み込みを使ってね。');
 await ingestFile(file);
 gpxPasteStatus.textContent='GPXを受け取ったよ。地図上に表示したので確認してね。';
 gpxPasteField.value='';
}
el('gpx-paste-import').addEventListener('click',async()=>{
 gpxPasteStatus.textContent='GPXを読み込み中…';
 try{await ingestClipboardText(gpxPasteField.value)}
 catch(e){gpxPasteStatus.textContent='貼り付けの読み込み失敗：'+e.message}
});
el('gpx-paste-auto').addEventListener('click',async()=>{
 if(!navigator.clipboard?.readText){gpxPasteStatus.textContent='自動読み取りは使えないよ。下の入力欄を長押しして「ペースト」してね。';gpxPasteField.focus();return;}
 try{
   const xml=await navigator.clipboard.readText();
   gpxPasteField.value=xml;
   await ingestClipboardText(xml);
 }catch(e){gpxPasteStatus.textContent='自動読み取りができなかったよ。入力欄を長押しして「ペースト」すれば読み込めるよ。';}
});
receiveShare();
})();
