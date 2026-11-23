'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const router=require('../shimanami-web-router.js');
const refs=require('../shimanami-bridge-references.js');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const shift=(p,m)=>[p[0]+m/111195,p[1]];
const road=(start,end)=>({points:[start,end],cues:[]});

test('JR Onomichi Station is on mainland, NOT categorized as Mukoshima road entrance',()=>{
 const onomichi=[34.404838,133.193008],mukoshima=[34.389,133.2];
 assert.equal(router.island(onomichi),0,'legacy nearest-island distance shows how it was mislabeled');
 assert.ok(router.onomichiMainlandPoint([onomichi,mukoshima]));
 assert.equal(router.onomichiMainlandPoint([mukoshima]),null);
 assert.equal(router.needsSpecialJourney([onomichi,[34.064,132.995]],1),true);
 assert.throws(()=>router.plan([onomichi,[34.064,132.995]],1,geometry,refs),
  /尾道駅周辺は本州側.*渡船・尾道大橋.*向島側/);
});

test('52m road snap for a USER point is allowed without inventing an off-road GPX connector',()=>{
 const start=[34.375,133.195],end=[34.376,133.19];
 const stage={island:0,from:start,to:end,fromRole:'user',toRole:'user'};
 const checked=router.validateRoad(stage,road(shift(start,52),end));
 assert.ok(checked.fromGap>50&&checked.fromGap<54);
 assert.equal(checked.warnings.length,1);
 assert.match(checked.warnings[0],/約52m先の道路上.*案内対象外/);
 assert.throws(()=>router.validateRoad(stage,road(shift(start,105),end)),/80m以内が必要/);
});

test('bridge road end gaps stay strictly <=25m even when the measured error is only 52m',()=>{
 const start=[34.375,133.195],end=[34.3607615,133.1928778];
 assert.throws(()=>router.validateRoad({island:0,from:start,to:end,fromRole:'user',toRole:'bridge'},
  road(start,shift(end,52))),/橋入口側.*52m.*25m以内/);
 assert.throws(()=>router.validateRoad({island:0,from:start,to:end,fromRole:'bridge',toRole:'user'},
  road(shift(start,52),end)),/橋出口側.*52m.*25m以内/);
});

test('single-island route may start 52m from a user pin with visible warning but no fabricated connecting line',async()=>{
 const start=[34.375,133.195],goal=[34.376,133.19],snap=shift(start,52);
 let pairs=0;
 const result=await router.compose([start,goal],1,1,{
  geometry,refs,bridgePreview:()=>null,
  query:async()=>{pairs++;return {track:road(snap,goal),gpx:'<gpx/>',profile:'test'};}
 });
 assert.equal(pairs,1);
 assert.equal(result.roadSegments,1);
 assert.equal(result.bridges,0);
 assert.equal(result.sections[0].points[0][0],snap[0]);
 assert.equal(result.sections[0].points[0][1],snap[1]);
 assert.equal(result.warnings.length,1);
 assert.equal(router.verifyPlan(result,[start,goal]).ok,true);
 const app=fs.readFileSync('app.js','utf8');
 assert.match(app,/result\.warnings\?\.length/);
});
