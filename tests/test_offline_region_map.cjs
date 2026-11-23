'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('eight-region offline map settings, not a link to a separate application',()=>{
 const html=read('index.html');
 const chunk=html.slice(html.indexOf('<section class="offline-map-settings"'),html.indexOf('</section>',html.indexOf('<section class="offline-map-settings"')));
 assert.ok(chunk.includes('id="offline-map-region"'));
 for(const r of ['hokkaido','tohoku','kanto','chubu','kansai','chugoku','shikoku','kyushu'])assert.ok(chunk.includes('value="'+r+'"'),r);
 for(const id of ['offline-map-download','offline-map-cancel','offline-map-progress','offline-map-status','offline-map-display-status'])assert.ok(chunk.includes('id="'+id+'"'),id);
 for(const module of ['offline-map-bridge.mjs','offline-map-download.mjs'])assert.ok(html.includes('src="./'+module+'"'));
});

test('download follows old BikeNavigator regional PMTiles Cloudflare and OPFS design',()=>{
 const source=read('offline-map-download.mjs');
 assert.ok(source.includes('bikenavigator-map-relay.yasutaka5262.workers.dev'));
 assert.ok(source.includes("getDirectoryHandle('BikeNavigator'"));
 assert.ok(source.includes("getDirectoryHandle('maps'"));
 assert.match(source,/new Unzip\(/);
 assert.match(source,/new UnzipInflate/);
 assert.match(source,/new FileSource\(/);
 assert.ok(source.includes("getFileHandle('active.json'"));
 assert.ok(source.includes("createWritable()"));
 assert.ok(source.includes("signal:downloadAbort.signal"));
 assert.ok(source.includes('prepareOfflineRuntime()'));
 assert.ok(!source.includes('tile.openstreetmap.org'));
 assert.ok(!source.includes('data.bbbike.org/osm/pmtiles'));
});

test('local map reads saved PMTiles and preserves B_Navi touch, GPS and SVG overlays',()=>{
 const map=read('map-core.js'),bridge=read('offline-map-bridge.mjs'),layer=read('offline-map-layer.mjs'),sw=read('sw.js');
 assert.match(map,/this\.onMapFrame\?\.\(this\)/);
 assert.match(map,/if\(!this\.offlineBaseLayerAvailable\)/);
 assert.ok(bridge.includes('core.onMapFrame=sync'));
 assert.ok(bridge.includes("interactive:false"));
 assert.ok(bridge.includes('core.zoom-1'));
 assert.ok(layer.includes("getDirectoryHandle('BikeNavigator')"));
 assert.ok(layer.includes('new PMTiles(new FileSource'));
 assert.ok(layer.includes('window.__bnaviOfflineCoverage'));
 assert.ok(sw.includes('./offline-map-download.mjs'));
 assert.ok(sw.includes('./offline-map-bridge.mjs'));
 assert.ok(sw.includes('./offline-map-layer.mjs'));
 assert.ok(sw.includes('./offline-region-mosaic.mjs'));
 assert.ok(sw.includes('MAP_LIBRARY_CACHE'));
});
