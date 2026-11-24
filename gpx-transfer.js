/* GPX file import for external apps and Web Share Target. No server upload. */
'use strict';
(()=>{
const el=id=>document.getElementById(id);
const MAX_BYTES=12*1024*1024;
const itineraryBox=el('gpx-itinerary-panel');
const itineraryNames=el('gpx-itinerary-list');
const itineraryCalcButton=el('gpx-itinerary-calculate');
let itineraryImport=false;
function routePointList(itinerary){
 const names=itinerary.points.map((p,i)=>`${i===0?'S':i===itinerary.points.length-1?'G':`経由${i}`}: ${p.name||p.coords.map(n=>n.toFixed(5)).join(', ')}`);
 itineraryNames.replaceChildren();
 for(const name of names){const li=document.createElement('li');li.textContent=name;itineraryNames.append(li);}
}
async function calculateImportedItinerary(){
 if(!itineraryImport)return;
 itineraryCalcButton.disabled=true;
 el('gpx-import-status').textContent='指定した中継地点を順番に通る道路ルートを計算中…';
 try{
  await calculate();
  if(state.routeType&&state.routes.length){
   const viaCount=state.via.length;
   el('gpx-import-status').textContent=`道路ルートを計算しました。経由地${viaCount}件を指定順に通るルートです。`;}
  else{el('gpx-import-status').textContent='中継地点は登録済み。'+(el('message').textContent||'道路計算ができませんでした。')+' 必要なら再計算してね。';}
 }catch(error){el('gpx-import-status').textContent='中継地点は登録済み。道路計算エラー：'+String(error?.message||error);}
 finally{itineraryCalcButton.disabled=false;}
}
itineraryCalcButton.addEventListener('click',calculateImportedItinerary);
function applyItinerary(itinerary,fileName){
 clearResult();
 const coords=p=>fmt(p.coords);
 el('start').value=coords(itinerary.start);
 el('goal').value=coords(itinerary.goal);
 state.via=itinerary.via.map(coords);
 for(const p of itinerary.points){
  if(p.name)rememberPlaceLabel(coords(p),p.name);
 }
 renderVia();updatePointSummaries();refreshMap();fitMarkers();persist();
 itineraryImport=true;itineraryBox.hidden=false;routePointList(itinerary);
 el('gpx-import-status').textContent=`${fileName}：S・経由地${itinerary.via.length}件・Gを読み込んだよ。道路ルートを計算します。`;
}
async function ingestFile(file,orderedOnly=false){
 if(!file) return;
 if(file.size>MAX_BYTES)throw Error('GPXは12MB以下のファイルを選んでね。');
 const xml=await file.text();
 if(!/<(?:[A-Za-z0-9_]+:)?gpx(?:\s|>)/i.test(xml.slice(0,500)))throw Error('GPXファイルとして認識できなかったよ。');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('GPXのXML形式が正しくありません。');
 // An ordered itinerary is NOT a road track: preserve every intermediate stop.
 const itinerary=BNaviGpxItinerary.parse(doc);
 if(orderedOnly){
  const root=doc.documentElement;
  const designated=root?.localName==='gpx'&&root.getAttribute('creator')==='MichiNoTochu'&&Array.from(doc.getElementsByTagNameNS('*','rte')).some(route=>Array.from(route.children||[]).some(child=>child.localName==='name'&&/\bBNAV-ITINERARY-1\b/.test(child.textContent||'')));
  if(!designated||!itinerary)throw Error('道の途中。で「B_Naviに送る」を押してから読み込んでね。');
  if(state.navActive||state.navPaused||state.finishing)throw Error('案内を終了してからルートを読み込んでね。');
 }
 if(itinerary){applyItinerary(itinerary,file.name||'GPX');await calculateImportedItinerary();return;}
 itineraryImport=false;itineraryBox.hidden=true;
 let track=[];
 const trks=[...doc.getElementsByTagNameNS('*','trkseg')];
 if(trks.length){for(const seg of trks){const pts=[...seg.getElementsByTagNameNS('*','trkpt')].map(node=>[Number(node.getAttribute('lat')),Number(node.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(pts.length>1)track.push(pts)}}
 else{const pts=[...doc.getElementsByTagNameNS('*','trkpt')].map(node=>[Number(node.getAttribute('lat')),Number(node.getAttribute('lon'))]).filter(p=>p.every(Number.isFinite));if(pts.length>1)track.push(pts)}
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
let michinoPaste=false;
async function ingestClipboardText(text,orderedOnly=false){
 const xml=String(text||'').trim();
 if(!xml)throw Error('GPXの文字データを貼り付けてね。');
 const file=new File([xml],'Clipboard_route.gpx',{type:'application/gpx+xml;charset=utf-8'});
 if(file.size>MAX_BYTES)throw Error('GPXが12MBを超えているよ。ファイル読み込みを使ってね。');
 await ingestFile(file,orderedOnly);
 gpxPasteStatus.textContent='GPXを受け取ったよ。中継地点または走行軌跡を確認してね。';
 gpxPasteField.value='';
}
el('gpx-paste-import').addEventListener('click',async()=>{
 gpxPasteStatus.textContent='GPXを読み込み中…';
 try{await ingestClipboardText(gpxPasteField.value,michinoPaste);michinoPaste=false}
 catch(e){gpxPasteStatus.textContent='貼り付けの読み込み失敗：'+e.message}
});
const michinoButton=el('import-michinotochu');
function showMichinoPaste(message){
 const panel=el('gpx-paste-panel');
 panel.open=true;michinoPaste=true;
 gpxPasteField.value='';
 gpxPasteStatus.textContent=message+' 入力欄を長押しして「ペースト」し、「貼り付けたGPXを読み込む」を押してね。';
 panel.scrollIntoView?.({block:'nearest'});
}
michinoButton.addEventListener('click',async()=>{
 if(state.navActive||state.navPaused||state.finishing){el('gpx-import-status').textContent='案内を終了してからルートを読み込んでね。';return;}
 michinoButton.disabled=true;
 try{
  let xml;
  try{
   if(!navigator.clipboard?.readText)throw Error('Clipboard unavailable');
   xml=await navigator.clipboard.readText();
  }catch(error){showMichinoPaste('自動読み取りができませんでした。');return;}
  try{
   await ingestClipboardText(xml,true);
   michinoPaste=false;el('gpx-paste-panel').open=false;
  }catch(error){
   el('gpx-import-status').textContent='読み込み失敗：'+String(error?.message||error);
   showMichinoPaste('道の途中。からのGPXを確認できませんでした。');
  }
 }finally{michinoButton.disabled=false;}
});
el('gpx-paste-auto').addEventListener('click',async()=>{
 if(!navigator.clipboard?.readText){gpxPasteStatus.textContent='自動読み取りは使えないよ。下の入力欄を長押しして「ペースト」してね。';gpxPasteField.focus();return;}
 try{
   const xml=await navigator.clipboard.readText();
   gpxPasteField.value=xml;
   await ingestClipboardText(xml,michinoPaste);michinoPaste=false;
 }catch(e){gpxPasteStatus.textContent='自動読み取りができなかったよ。入力欄を長押しして「ペースト」すれば読み込めるよ。';}
});
receiveShare();
})();
