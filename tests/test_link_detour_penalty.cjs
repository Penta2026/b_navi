'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tune=require('../route-tuning.js');
const profileDir=path.join(__dirname,'..','profiles');
const linkTypes='trunk_link|primary_link|secondary_link|tertiary_link';
const normalTypes='trunk|primary|secondary|tertiary';
const originalTypes=['50','125','big'];
const settings=[{}, {explore:0,width:0,scenic:0},{explore:60,width:-20,scenic:70},{explore:-75,width:50,scenic:-25}];
function general(vehicle){return fs.readFileSync(path.join(profileDir,`bn_${originalTypes[vehicle]}_general.brf`),'utf8');}
function gates(text){return ['switch access=no|private 10000','switch vehicle=no|private 10000', 'switch motor_vehicle=no|private 10000','switch motorcycle=no|private 10000','switch service=alley|driveway|parking_aisle|drive-through|emergency_access 10000'];}
test('50cc/125cc/126cc ordinary general profiles apply a one-time 180m soft cost when entering OSM *_link roads',()=>{
  for (const v of [0,1,2]){
    const script=general(v);
    assert.match(script,/assign initialclassifier\s+switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 2 1/);
    assert.match(script,/assign initialcost\s+switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 180 0/);
    assert.match(script,/assign turncost 90\.000/);
    for(const gate of gates(script))assert.ok(script.includes(gate),`vehicle=${v} gate=${gate}`);
    for (const tuned of settings){
      const output=tune.tuneProfile(script,tuned,v);
      assert.match(output,/assign initialclassifier\s+switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 2 1/);
      assert.match(output,/assign initialcost\s+switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 180 0/);
      assert.equal((output.match(/assign initialclassifier/g)||[]).length,1);
      assert.equal((output.match(/switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 180 0/g)||[]).length,1);
    }
  }
});
test('no prohibited road gates are loosened and only the three ordinary general profiles change',()=>{
  for(const name of ['bn_50_beginner.brf','bn_50_explore.brf','bn_125_beginner.brf','bn_125_explore.brf','bn_big_beginner.brf','bn_big_explore.brf','bn_big_fasttravel_priority.brf']){
    assert.doesNotMatch(fs.readFileSync(path.join(profileDir,name),'utf8'),/2026-11-22: prefer staying on the main road/);
  }
});
test('126cc motorway and toll options keep existing exclusions and the link-entry rule',()=>{
  const script=general(2);
  for(const opts of [{allowMotorway:true},{allowToll:true},{allowMotorway:true,allowToll:true}]){
    const tuned=tune.tuneProfile(script,opts,2);
    assert.match(tuned,/assign initialclassifier\s+switch highway=trunk_link\|primary_link\|secondary_link\|tertiary_link 2 1/);
    assert.match(tuned,/switch motorcycle=no\|private 10000/);
  }
});
