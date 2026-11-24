'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html'),app=read('app.js'),mobile=read('mobile-ui.js');
test('map point registration replaces old pick buttons without removing displayed points',()=>{
 assert.doesNotMatch(html,/class="pickbar"/);
 for(const id of ['start-pick','goal-pick','add-via'])assert.doesNotMatch(html,new RegExp('id="'+id+'"'));
 for(const id of ['start-summary','goal-summary','swap-endpoints','via-count','via-list','clear-vias','start','goal'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.doesNotMatch(app,/\$\('start-pick'\)|\$\('goal-pick'\)|\$\('add-via'\)/);
 assert.doesNotMatch(mobile,/\$\('start-pick'\)|\$\('goal-pick'\)|\$\('add-via'\)/);
});
test('map long press, search and favorites still support all point types',()=>{
 assert.match(app,/map\.onLongPress=point=>window\.BNaviSelectMapPoint\?\.\(point\)/);
 assert.match(mobile,/window\.BNaviSelectMapPoint=\(point\)=>/);
 assert.match(mobile,/document\.querySelectorAll\('\[data-apply\]'\)/);
 assert.match(mobile,/if\(kind==='via'\)\{if\(state\.via\.length>=50\)/);
 assert.match(mobile,/else\{\$\(kind\)\.value=picked\.coord\}/);
 assert.match(mobile,/renderVia\(\);refreshMap\(\);fitMarkers\(\);persist\(\);setPick\(kind\)/);
});
test('route example shortcuts remain available without the tester-only label',()=>{
 assert.match(html,/<div class="sample-row"><span>ルート例：<\/span>/);
 assert.doesNotMatch(html,/試験用：/);
 for(const id of ['sample-hiroshima','sample-shimanami','sample-kanmon'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/ルート例の地点を設定したよ/);
});