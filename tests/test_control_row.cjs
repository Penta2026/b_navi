const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
test('single row: plus minus GPS crosshair radar heading', () => {
 const html = read('index.html');
 const top = html.match(/<div class="map-control-row map-control-row-top">([\s\S]*?)<\/div>/);
 assert.ok(top, 'control row present');
 const ids = [...top[1].matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(ids,['zoom-in','zoom-out','map-location','center-hiroshima','nav-radar-toggle','orientation-toggle','compass-reset']);
 assert.match(top[1],/id="nav-radar-toggle"[^>]*>📡<\/button>/);
 assert.doesNotMatch(top[1],/📡 レーダー/);
});
test('CSS keeps zoom buttons visible in active guidance and free ride', () => {
 const style=read('style.css');
 assert.match(style,/#map-controls\{position:absolute;left:12px;right:12px/);
 assert.match(style,/#map-controls \.map-control-row-top > #orientation-toggle/);
 assert.doesNotMatch(style,/body\.navigation-active \.map-controls button:not\(#map-location\)/);
 assert.doesNotMatch(style,/\.map-controls #zoom-in,\.map-controls #zoom-out\{display:none/);
});
test('new service worker cache name activates the new markup and CSS', () => {
 const sw=read('sw.js');
 assert.match(sw,/bnavi-pc-pwa-20261121-radar-voice-mute-v5/);
 assert.match(sw,/'.\/index.html'/);
 assert.match(sw,/'.\/style.css'/);
});

test('GPS notification below all six map buttons',()=>{
 const css=read('style.css');
 assert.match(css,/body\.navigation-active #map-gps-message,\s*body\.free-ride-active #map-gps-message\{/);
 assert.match(css,/top:calc\(max\(12px, env\(safe-area-inset-top, 0px\)\) \+ 62px\)/);
 assert.match(css,/pointer-events:none/);
});
