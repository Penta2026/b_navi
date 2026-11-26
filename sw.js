/* Cache only local static app-shell files, NEVER .rd5, routes, or map tiles. */
const CACHE='bnavi-pc-pwa-20261126-poi-icons-v2';
const FILES=['./','./index.html','./style.css?v=20261126-poi-v1','./app.js?v=20261126-gps-double-tap-v1','./ride-logic.js','./navigation-heading.js','./voice-settings.js','./route-tuning.js?v=20261125-cruise-width-v1','./route-presets.js','./my-route-library.js','./offline-map-download.mjs','./offline-map-bridge.mjs?v=20261126-poi-icons-v2','./offline-map-layer.mjs?v=20261126-poi-icons-v2','./offline-region-mosaic.mjs','./public-brouter-client.js','./manual-detour.js','./biwako-bridge.js?v=20261124-bridge-prompt-v1','./manual-detour-local.js','./offline-route-store.js','./place-search-core.js?v=20261125-facility-v1','./openpoi-search.js','./poi-search-merge.js?v=20261125-facility-v1','./station-search.js','./michinotochu-spot-search.js','./verified-offices.js?v=20261125-offices-v1','./data/verified-offices.json','./data/michinotochu_spots.json','./data/jr_stations.json','./address-search.js','./mobile-ui.js?v=20261125-street-view-v1','./gpx-itinerary-core.js','./gpx-transfer.js?v=20261124-manual-import-v1','./ride-radar.js','./track-recorder.js?v=20261126-gpx-clipboard-v1','./android-approaches.js','./shimanami-geometry.js','./shimanami-bridge-references.js','./shimanami-web-router.js?v=20261124-mixed-v3','./shimanami-big-router.js?v=20261124-mixed-v3','./map-core.js?v=20261126-map-no-select-v1','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(path=>new Request(path,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bnavi-pc-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Third-party ESM modules required to show locally downloaded vector maps
// are cached separately. Their URLs are pinned; map DATA is never cached here.
const MAP_LIBRARY_CACHE='bnavimap-libs-v1';
const MAP_LIBRARY_HOSTS=new Set(['esm.sh','unpkg.com']);
const SHARED_CACHE='bnavi-gpx-inbox';
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method==='POST'&&url.pathname.endsWith('/share-gpx')){
  e.respondWith((async()=>{
   try{
    const form=await e.request.formData();const f=form.get('gpx');
    if(!f||typeof f.text!=='function'||f.size>12*1024*1024)return new Response('Invalid GPX',{status:400});
    const txt=await f.text();if(!/<(?:[A-Za-z0-9_]+:)?gpx(?:\s|>)/i.test(txt.slice(0,500)))return new Response('Not a GPX',{status:400});
    const cache=await caches.open(SHARED_CACHE);await cache.put(new Request(new URL('./__bnavi_shared_gpx__',self.registration.scope)),new Response(txt,{headers:{'Content-Type':'application/gpx+xml'}}));
    return Response.redirect(new URL('./?gpx_share=1',self.registration.scope),303);
   }catch(e){return new Response('Share failed',{status:400})}
  })());return;
 }
 if(e.request.method==='GET'&&url.pathname.endsWith('/__bnavi_shared_gpx__')){
  e.respondWith(caches.open(SHARED_CACHE).then(async c=>{const r=await c.match(new Request(e.request.url));if(r)await c.delete(new Request(e.request.url));return r||new Response('No GPX',{status:404})}));return;
 }
 const u=new URL(e.request.url);
 if(e.request.method==='GET'&&MAP_LIBRARY_HOSTS.has(u.hostname)){
   e.respondWith(caches.open(MAP_LIBRARY_CACHE).then(async c=>{
     const old=await c.match(e.request);if(old)return old;
     const response=await fetch(e.request);
     if(response.ok&&response.type!=='opaque')c.put(e.request,response.clone()).catch(()=>{});
     return response;
   }));
   return;
 }
 if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/api/')||u.pathname.endsWith('.rd5'))return;
 // App shell scripts and HTML must not be served from an outdated browser HTTP cache.
 // Keep CacheStorage offline fallback, but force a fresh network validation when online.
 const appShell=/\.(?:html|css|js|mjs)$/i.test(u.pathname)||u.pathname.endsWith('/b_navi/');
 const fresh=appShell?new Request(e.request,{cache:'no-store'}):e.request;
 e.respondWith(fetch(fresh).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));});
