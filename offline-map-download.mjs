// BikeNavigator v5.8.1 — same-origin browser and installed PWA may both save to their OPFS.
// All map data is stored on the USER DEVICE, not GitHub or relay.
import {PMTiles,FileSource} from 'https://esm.sh/pmtiles@4.5.0';
import {Unzip,UnzipInflate} from 'https://esm.sh/fflate@0.8.2';
const MAP_DELIVERY_BASE='https://bikenavigator-map-relay.yasutaka5262.workers.dev';
const $=id=>document.getElementById(id);
const names={chugoku:'中国',shikoku:'四国',kyushu:'九州',kansai:'関西',chubu:'中部',kanto:'関東',tohoku:'東北',hokkaido:'北海道'};
const selected=()=>$('offline-map-region').value;
const runMode=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true?'アプリ':'ブラウザ';
const set=s=>{$('offline-map-status').textContent=s;};
const deliveryReady=()=>/^https:\/\/[^/]+/.test(MAP_DELIVERY_BASE);
const MAP_MODULES=[
 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs',
 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css',
 'https://esm.sh/pmtiles@4.5.0',
 'https://esm.sh/fflate@0.8.2'
];
// Cross-origin JS dependencies must be available when the downloaded maps are
// rendered offline. Populate the exact same cache as our service worker.
// No map data is stored here: PMTiles remain solely in OPFS.
async function prepareOfflineRuntime(){
 if(!('caches' in window))return false;
 const cache=await caches.open('bnavimap-libs-v1');
 const seen=new Set();let failures=0;
 async function grab(url,depth=0){
  if(seen.has(url)||seen.size>30||depth>5)return;
  seen.add(url);
  try{
   const request=new Request(url,{mode:'cors'});
   let response=await cache.match(request);
   if(!response){
    response=await fetch(request);
    if(!response.ok)throw Error('HTTP '+response.status);
    await cache.put(request,response.clone());
   }
   if(!url.includes('.css')){
    const source=await response.clone().text();
    const imports=Array.from(source.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g),m=>m[1]);
    for(const spec of imports){
     const next=new URL(spec,url).href;
     const u=new URL(next);
     if((u.hostname==='esm.sh'||u.hostname==='unpkg.com')&&/^https:$/.test(u.protocol))await grab(next,depth+1);
    }
   }
  }catch{failures++}
 }
 for(const url of MAP_MODULES)await grab(url);
 return failures===0;
}

async function dir(r){
 if(!navigator.storage?.getDirectory)throw Error('この端末でアプリ専用保存領域を利用できません');
 const root=await navigator.storage.getDirectory();
 const app=await root.getDirectoryHandle('BikeNavigator',{create:true});
 const maps=await app.getDirectoryHandle('maps',{create:true});
 return maps.getDirectoryHandle(r,{create:true});
}
async function active(r){
 const d=await dir(r);
 try{
  const cfg=JSON.parse(await(await d.getFileHandle('active.json')).getFile().then(f=>f.text()));
  if(!/^map-[a-zA-Z0-9_-]+\.pmtiles$/.test(cfg.file))throw Error('地図メタデータが不正です');
  return await(await d.getFileHandle(cfg.file)).getFile();
 }catch(e){if(e.name!=='NotFoundError')throw e}
 try{return await(await d.getFileHandle('map.pmtiles')).getFile()}catch(e){if(e.name==='NotFoundError')return null;throw e}
}
async function status(){
 $('offline-map-install-note').textContent='✅ '+runMode()+'：旧BikeNavigatorと同じ端末内地図保存領域を使用';
 $('offline-map-download').disabled=!deliveryReady();
 try{
  await dir(selected()); // prepare before networking
  const file=await active(selected());
  const detail=file?'端末保存済み '+(file.size/1048576).toFixed(1)+' MiB':'未保存。保存領域は準備済み';
  set(deliveryReady()?detail:detail+'。地図配信サーバーの接続設定待ちです。');
  if(deliveryReady()&&navigator.onLine!==false){
    try{
      const check=await fetch(MAP_DELIVERY_BASE+'/health',{cache:'no-store'});
      const info=check.ok?await check.json():null;
      if(info?.ready===false){$('offline-map-download').disabled=true;set(detail+'。地図配信サーバーは現在停止中です。既存の保存地図は使えるよ。');}
    }catch{set(detail+'。配信サーバーの状態は未確認です。');}
  }
 }catch(e){set('保存領域エラー：'+e.message);$('offline-map-download').disabled=true}
}
async function transfer(response,region){
 const directory=await dir(region);
 const filename='map-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)+'.pmtiles';
 const staging=await directory.getFileHandle(filename,{create:true});
 const writer=await staging.createWritable();
 let received=0,written=0,found=false,finished=false,streamErr=null;
 let pending=Promise.resolve();
 const unzip=new Unzip(file=>{
  if(!/\.pmtiles$/i.test(file.name))return;
  if(found){streamErr=new Error('ZIP内に複数のPMTilesが存在します');return}
  found=true;
  file.ondata=(err,chunk,final)=>{
   if(err){streamErr=err;return}
   if(chunk?.length){
    written+=chunk.length;
    // Ordered OPFS writes with backpressure; retain only one output chunk at a time.
    pending=pending.then(()=>writer.write(chunk));
   }
   if(final)finished=true;
  };
  file.start();
 });
 unzip.register(UnzipInflate);
 const total=Number(response.headers.get('content-length'))||0;
 try{
  const reader=response.body?.getReader();
  if(!reader)throw Error('ストリーミング受信に対応していません');
  while(true){
   const {done,value}=await reader.read();if(done)break;
   received+=value.length;
   unzip.push(value);
   await pending; // stop network consumption while OPFS writes catch up
   if(streamErr)throw streamErr;
   $('offline-map-progress').value=total?Math.min(.9,received/total*.9):.1;
   set('中国地方など選択した地図を取得・保存中：'+(received/1048576).toFixed(1)+' MiB');
  }
  unzip.push(new Uint8Array(0),true);
  await pending;
  if(streamErr)throw streamErr;
  if(!found||!finished||written<1000000)throw Error('ZIPからPMTilesを完全に抽出できませんでした');
  await writer.close();
  const file=await staging.getFile();
  if(file.size!==written)throw Error('保存した地図の容量が一致しません');
  set('保存データを検証中…');
  const header=new PMTiles(new FileSource(new File([file],filename))).getHeader();
  const h=await header;
  if(h.tileType!==1||h.minZoom>14||h.maxZoom<10)throw Error('正常な道路ベクター地図ではありません');
  // Active pointer changes only after full extraction + header verification.
  const meta=await directory.getFileHandle('active.json',{create:true});
  const mw=await meta.createWritable();
  await mw.write(JSON.stringify({file:filename,region,source:'BBBike PMTiles Shortbread',installedAt:new Date().toISOString(),bytes:written}));
  await mw.close();
  window.dispatchEvent(new Event('bnavi:offline-maps-changed'));
  return written;
 }catch(e){
  try{await writer.abort()}catch{}
  try{await directory.removeEntry(filename)}catch{}
  throw e;
 }
}
let downloadAbort=null;
$('offline-map-region').onchange=status;
$('offline-map-cancel').onclick=()=>downloadAbort?.abort();
window.addEventListener('pageshow',()=>status());
$('offline-map-download').onclick=async()=>{
 if(!deliveryReady())return status();
 const r=selected(),btn=$('offline-map-download');downloadAbort=new AbortController();btn.disabled=true;$('offline-map-region').disabled=true;
 const cancel=$('offline-map-cancel');if(cancel)cancel.disabled=false;
 $('offline-map-progress').value=0;
 try{
  await dir(r);
  // Best-effort persistent storage: browser may still enforce quota and eviction.
  try{if(navigator.storage?.persist)await navigator.storage.persist()}catch{}
  const estimate=await navigator.storage?.estimate?.();
  if(estimate?.quota&&estimate.quota-(estimate.usage||0)<300000000)
   throw Error('空き容量が300MB未満です。地図を安全に保存する容量を確保してください');
  const url=MAP_DELIVERY_BASE.replace(/\/$/,'')+'/maps/'+r+'.zip';
  set(names[r]+'地方の地図を配信サーバーから取得中…');
  const response=await fetch(url,{mode:'cors',cache:'no-store',signal:downloadAbort.signal});
  if(!response.ok)throw Error('地図配信サーバー HTTP '+response.status);
  const bytes=await transfer(response,r);
  $('offline-map-progress').value=1;
  const runtimeReady=await prepareOfflineRuntime();
  set(names[r]+'地方：'+(bytes/1048576).toFixed(1)+' MiBを端末内に保存しました。'+(runtimeReady?'オフライン描画用プログラムも保存しました。':'地図本体は保存済み。ただし描画用プログラムのオフライン保存が不完全な可能性があります。Wi-Fi中に一度PWAを再起動して確認してね。'));
  window.__bnaviMapCore?.schedule?.();
 }catch(e){set((e.name==='AbortError'?'ダウンロードを中断しました':'取得・保存未完了：'+e.message)+'。保存済みの地図は変更しません。')}
 finally{$('offline-map-region').disabled=false;btn.disabled=!deliveryReady();downloadAbort=null;$('offline-map-cancel').disabled=true;}
};
status();
