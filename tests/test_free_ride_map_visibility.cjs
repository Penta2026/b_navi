'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('free ride hides rendered guidance geometry without clearing planned routes or S/G',()=>{
 const a=read('app.js');
 assert.match(a,/const paths=document\.body\.classList\.contains\('free-ride-active'\)\?\[\]:state\.routes/);
 assert.match(a,/map\.setData\(paths,getMarkers\(\),state\.location\)/);
 assert.match(a,/symbol:'S'/);
 assert.match(a,/symbol:'G'/);
});
test('free ride hides the line immediately and restores it on end, not on each GPS fix',()=>{
 const r=read('ride-radar.js');
 assert.match(r,/document\.body\.classList\.add\('free-ride-active'\);\s*refreshMap\(\)/);
 assert.match(r,/document\.body\.classList\.remove\('free-ride-active'\);mode='off';\s*if\(wasFree\)refreshMap\(\)/);
 assert.match(r,/if\(wasFree\)window\.BNaviTrack\?\.stop\(\)/);
 assert.doesNotMatch(r,/state\.routes\s*=\s*\[\]/);
});
