const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const map=fs.readFileSync(path.join(__dirname,'..','map-core.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','mobile-ui.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('single map tap never updates S, G, or waypoints',()=>{
  assert.match(app,/new BNaviMapCore\.MapCore\([^\n]+,null\);/);
  assert.doesNotMatch(app,/function handleMapClick\(/);
  assert.match(map,/this\.onClick\?\.\(point\(ev\)\)/);
});
test('long press still opens a menu and explicit action writes S, G or waypoint',()=>{
  assert.match(app,/map\.onLongPress=point=>window\.BNaviSelectMapPoint\?\.\(point\)/);
  assert.match(map,/this\.onLongPress\?\.\(this\.screenToLatLon/);
  assert.match(ui,/window\.BNaviSelectMapPoint=\(point\)=>/);
  assert.match(ui,/document\.querySelectorAll\('\[data-apply\]'\)/);
  assert.match(ui,/if\(kind==='via'\)/);
  assert.match(ui,/else\{\$\(kind\)\.value=picked\.coord\}/);
});
test('help texts describe long press rather than tap',()=>{
  assert.match(html,/地図の長押しで地点登録/);
  assert.doesNotMatch(html,/地図をクリックで地点指定|地図クリック時の登録先/);
  assert.match(app,/地図を長押しし、表示されたメニューから/);
});
