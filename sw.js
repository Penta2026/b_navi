/* Cache only local static app-shell files, NEVER .rd5, routes, or map tiles. */
const CACHE='bnavi-pc-pwa-20261122-route-modes-custom-below-v1';
const FILES=['./','./index.html','./style.css','./app.js','./ride-logic.js','./navigation-heading.js','./voice-settings.js','./route-tuning.js','./route-presets.js','./my-route-library.js','./public-brouter-client.js','./offline-route-store.js','./place-search-core.js','./address-search.js','./mobile-ui.js','./gpx-itinerary-core.js','./gpx-transfer.js','./ride-radar.js','./track-recorder.js','./android-approaches.js','./shimanami-geometry.js','./shimanami-bridge-references.js','./shimanami-web-router.js','./map-core.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bnavi-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
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
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/api/')||u.pathname.endsWith('.rd5'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));});
