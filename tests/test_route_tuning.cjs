'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const tune=require('../route-tuning.js');
const client=require('../public-brouter-client.js');
function base(vehicle){return fs.readFileSync(path.join(root,'profiles',`bn_${['50','125','big'][vehicle]}_general.brf`),'utf8')}
function factor(brf,name){const part=brf.slice(brf.indexOf('assign costfactor'));const r=new RegExp('^\\s*switch highway='+name.replace(/\|/g,'\\|')+'\\s+([0-9.]+)\\s*$','m');return Number(part.match(r)?.[1]);}
test('centre preserves all three real original general BRFs EXACTLY',()=>{
 for(const v of [0,1,2]){assert.equal(tune.tuneProfile(base(v),tune.DEFAULT,v),base(v));assert.equal(tune.isDefault({},v),true)}
});
test('settings clamp and disallow 50/125 motorway and toll even when requested',()=>{
 for(const v of [0,1]){const n=tune.normalize({explore:999,width:-999,scenic:12,allowMotorway:true,allowToll:true},v);assert.equal(n.explore,150);assert.equal(n.width,-150);assert.equal(n.scenic,10);assert.equal(n.allowMotorway,false);assert.equal(n.allowToll,false);
  const output=tune.tuneProfile(base(v),n,v);assert.match(output,/switch toll=yes 10000/);assert.match(output,/switch motorroad=yes 10000/);assert.match(output,/switch highway=motorway 10000/);
 }
});
test('distance versus exploration changes base allowed-road costs, not legal gates',()=>{
 for(const v of [0,1,2]){
  const src=base(v),dist=tune.tuneProfile(src,{explore:-100},v),explore=tune.tuneProfile(src,{explore:100},v);
  assert.ok(factor(dist,'primary|primary_link')<factor(src,'primary|primary_link'));
  assert.ok(factor(explore,'primary|primary_link')>factor(src,'primary|primary_link'));
  assert.ok(factor(explore,'residential')<factor(src,'residential'));
  for(const o of [dist,explore]){
   assert.match(o,/switch access=no\|private 10000/);
   assert.match(o,/switch vehicle=no\|private 10000/);
   assert.match(o,/switch motor_vehicle=no\|private 10000/);
   assert.match(o,/switch motorcycle=no\|private 10000/);
   assert.match(o,/switch service=alley\|driveway\|parking_aisle\|drive-through\|emergency_access 10000/);
   assert.match(o,/switch highway=footway\|pedestrian\|(?:cycleway\|)?steps\|(?:path\|)?bridleway\|construction\|proposed\|abandoned 10000/);
   assert.match(o,/switch toll=yes 10000/);
  }
 }
});
test('width axis uses lanes and categories; scenery axis uses forest and river estimates + turncost',()=>{
 const b=base(1),narrow=tune.tuneProfile(b,{width:-100},1),wide=tune.tuneProfile(b,{width:100},1);
 assert.ok(factor(narrow,'residential')<factor(b,'residential'));
 assert.ok(factor(wide,'residential')>factor(b,'residential'));
 assert.match(wide,/switch lanes=1 3\.550/);
 assert.match(narrow,/switch lanes=1 0\.250/);
 const scenic=tune.tuneProfile(b,{scenic:100},1),straight=tune.tuneProfile(b,{scenic:-100},1);
 assert.match(scenic,/switch estimated_forest_class=6 -0\.680/);
 assert.match(scenic,/switch estimated_river_class=6 -0\.700/);
 assert.match(scenic,/assign turncost 40\.500/);
 assert.match(straight,/assign turncost 234\.000/);
 assert.doesNotMatch(straight,/assign scenic_route_bias/);
});
test('126cc+ highway / toll independent and never overrides motorcycle=no',()=>{
 const original=base(2);
 const highway=tune.tuneProfile(original,{allowMotorway:true},2);
 assert.match(highway,/switch toll=yes 10000/);
 assert.match(highway,/switch highway=motorway\|motorway_link 1\.150/);
 assert.doesNotMatch(highway,/^    switch motorroad=yes 10000$/m);
 const toll=tune.tuneProfile(original,{allowToll:true},2);
 assert.match(toll,/switch highway=motorway\|motorway_link 10000/);
 assert.doesNotMatch(toll,/^    switch toll=yes 10000$/m);
 for(const script of [highway,toll,tune.tuneProfile(original,{allowToll:true,allowMotorway:true},2)])assert.match(script,/switch motorcycle=no\|private 10000/);
});
test('different custom settings create isolated BRouter uploaded profiles; repeated one reuses upload',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 let uploads=0;let brfBodies=[];
 const coords=[[34.4,132.45],[34.41,132.46]];
 const network=async(url,opt={})=>{
  const u=String(url);
  if(u.includes('/profiles/'))return {ok:true,text:async()=>base(1)};
  if(u.endsWith('/profile')){uploads++;brfBodies.push(opt.body);return {ok:true,text:async()=>JSON.stringify({profileId:'custom_test_'+uploads})}};
  if(u.includes('/brouter?'))return {ok:true,json:async()=>({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[132.45,34.4],[132.46,34.41]]},properties:{voicehints:[]}}]})};
  throw Error('Unknown mock URL: '+u);
 };
 const x={explore:20,width:-30,scenic:70},y={explore:30,width:-30,scenic:70};
 const result=await client.query(coords,1,1,network,null,x);
 assert.match(result.profile,/カスタム/);
 await client.query(coords,1,1,network,null,x);
 await client.query(coords,1,1,network,null,y);
 assert.equal(uploads,2);
 assert.ok(brfBodies[0].includes('estimated_forest_class'));
 assert.notEqual(brfBodies[0],brfBodies[1]);
});
