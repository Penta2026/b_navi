'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const t=require('../route-tuning.js');
const presets=require('../route-presets.js');
const root=path.join(__dirname,'..');
const base=v=>fs.readFileSync(path.join(root,'profiles',`bn_${['50','125','big'][v]}_general.brf`),'utf8');
test('three tuning sliders expose ±150 with step 10',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.equal(t.LIMIT,150);assert.equal(t.STEP,10);
 for(const id of ['tune-explore','tune-width','tune-scenic']){
  assert.match(html,new RegExp(`id="${id}" min="-150" max="150" step="10"`));
 }
});
test('clamp, quantization, legacy five-step settings and custom profile keys',()=>{
 for(const v of [0,1,2]){
  assert.deepEqual([t.normalize({explore:999,width:-999,scenic:65},v).explore,t.normalize({explore:999,width:-999,scenic:65},v).width,t.normalize({explore:999,width:-999,scenic:65},v).scenic],[150,-150,70]);
  assert.equal(t.normalize({explore:53},v).explore,50);
  assert.equal(t.normalize({explore:56},v).explore,60);
  assert.equal(t.normalize({explore:-55},v).explore,-50);
  assert.equal(t.tuneProfile(base(v),{explore:0,width:0,scenic:0},v),base(v));
  assert.notEqual(t.key({explore:100},v),t.key({explore:150},v));
 }
});
test('±150 extremes preserve hard access restrictions, and lane bias still changes',()=>{
 for(const v of [0,1,2]){
  const src=base(v);
  for(const conf of [{explore:150,width:-150,scenic:150},{explore:-150,width:150,scenic:-150}]){
   const brf=t.tuneProfile(src,conf,v);
   assert.match(brf,/switch motorcycle=no\|private 10000/);
   assert.match(brf,/switch toll=yes 10000/);
   assert.match(brf,/switch motorroad=yes 10000/);
   assert.match(brf,/switch highway=motorway(?:\|motorway_link)? 10000/);
   assert.match(brf,/switch service=alley\|driveway\|parking_aisle\|drive-through\|emergency_access 10000/);
   assert.match(brf,/assign initialcost[\s\S]*?180/); // prior main-road continuity penalty stays
   assert.ok(!brf.includes('NaN')&&!brf.includes('Infinity'));
  }
  const a=t.tuneProfile(src,{width:-100},v),b=t.tuneProfile(src,{width:-150},v);
  const lane=x=>Number(x.match(/switch lanes=1 ([0-9.]+)/)[1]);
  assert.ok(lane(b)<lane(a),`width -150 must differ from -100 for vehicle ${v}`);
 }
});
test('old preset backups remain importable, snapping five-step values to new ten-step grid',()=>{
 const doc={format:presets.FORMAT,version:1,items:[{name:'旧ルート',vehicle:1,tuning:{explore:55,width:-65,scenic:125}}]};
 const imported=presets.importBackup([],JSON.stringify(doc));
 assert.deepEqual([imported.items[0].tuning.explore,imported.items[0].tuning.width,imported.items[0].tuning.scenic],[60,-60,130]);
});
