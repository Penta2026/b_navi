const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('single calm basemap: the old standard toggle is removed, prior preferences ignored',()=>{
 const ui=read('index.html'),app=read('app.js'),style=read('style.css');
 assert.doesNotMatch(ui,/id="map-style-toggle"/);
 assert.match(app,/document\.body\.dataset\.mapStyle='simple'/);
 assert.doesNotMatch(app,/MAP_STYLE_KEY|setMapStyle\(/);
 assert.match(style,/body\[data-map-style="simple"\] #tile-layer\{opacity:\.62\}/);
 assert.doesNotMatch(style,/body\[data-map-style="standard"\]/);
});
test('live guidance hides editor but keeps GPS, target, heading toggle and stop reachable',()=>{
 const ui=read('index.html'),app=read('app.js'),css=read('style.css');
 for(const id of ['map-location','center-hiroshima','orientation-toggle','nav-stop-quick','navigation-hud'])assert.match(ui,new RegExp(`id="${id}"`));
 assert.match(app,/document\.body\.classList\.toggle\('navigation-active',state\.navActive\)/);
 assert.match(css,/body\.navigation-active \.mobile-toolbar/);
 assert.match(css,/body\.navigation-active #sidebar/);
 assert.match(css,/button:not\(#map-location\):not\(#center-hiroshima\):not\(#orientation-toggle\)/);
 assert.match(css,/body\.navigation-active #voice-test-quick\{display:none!important\}/);
 assert.match(app,/window\.BNaviCloseRouteSheet\?\.\(\)/);
});
test('navigation status displays existing GPX voice cues, not guessed intersections',()=>{
 const app=read('app.js');
 assert.match(app,/const step=raw\.match\(\/次：/);
 assert.match(app,/new MutationObserver\(syncNavigationHud\)/);
 assert.match(app,/function stopVoiceGuidance\(stopTracking=true\)/);
 assert.match(app,/state\.navActive=false;window\.speechSynthesis/);
});
