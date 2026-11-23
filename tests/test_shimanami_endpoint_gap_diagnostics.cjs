'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const router=require('../shimanami-web-router.js');
const refs=require('../shimanami-bridge-references.js');
const fs=require('node:fs');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const from=[34.389,133.2],to=[34.064,132.995];

test('50m bridge approach snap reports exact affected bridge and coordinates, without inventing a drivable link',async()=>{
 let calls=0;
 const query=async pair=>{
  calls++;
  const at=pair[1],rad=52/111000;
  return {track:{points:[pair[0],[at[0]+rad,at[1]]],cues:[]},gpx:'<gpx/>'};
 };
 await assert.rejects(
   router.compose([from,to],1,1,{geometry,refs,bridgePreview:()=>null,query}),
   e=>{
     assert.match(e.message,/向島：到着側（橋の入口・因島大橋）/);
     assert.match(e.message,/52mずれています/);
     assert.match(e.message,/目標 [0-9.]+,[0-9.]+／計算終点/);
     assert.match(e.message,/未確認区間を直線接続せず停止しました/);
     return true;
   });
 assert.equal(calls,1);
});
test('a 52m user-selected waypoint gap is not falsely blamed on cycle bridge geometry',async()=>{
 const query=async pair=>{
   const x=[pair[0][0]+52/111000,pair[0][1]];
   return {track:{points:[x,pair[1]],cues:[]},gpx:'<gpx/>'};
 };
 await assert.rejects(router.compose([from,to],1,1,{geometry,refs,bridgePreview:()=>null,query}),
   e=>{assert.match(e.message,/向島：出発側（指定地点）/);assert.match(e.message,/道路中心線から離れている可能性/);return true;});
});
