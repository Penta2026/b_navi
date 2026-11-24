'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const local=require('../manual-detour-local.js'),manual=require('../manual-detour.js');
const pts=(lat,lon,n=25,delta=.004)=>Array.from({length:n},(_,i)=>[lat,lon+i*delta]);
const road=pts(34.397,132.45);
test('mainland Hiroshima-to-Onomichi road is eligible for a short local detour even when later Shimanami bridges are planned',()=>{
 const p=local.prepare(road[2],road,[road.at(-1)],{refs:[]});
 assert.equal(p.group,-1);
 assert.ok(p.index>2&&p.index<road.length-3);
 assert.ok(manual.meters(road[2],p.avoid.point)>150);
 const patchPoints=[road[2],[34.400,road[2][1]+.002],[34.400,p.rejoin[1]-.002],p.rejoin];
 const cues=[{offset:p.index+3,desc:'left'}];
 const merged=local.merge(p,{points:patchPoints,cues:[{offset:2,desc:'right'}]},cues);
 assert.deepEqual(merged.points.at(-1),road.at(-1));
 assert.deepEqual(merged.points[patchPoints.length-1],p.rejoin);
 assert.equal(merged.cues[0].offset,2);
 assert.equal(merged.cues.at(-1).offset,patchPoints.length-1+3);
 assert.equal(merged.cues.at(-1).desc,'left');
 assert.equal(local.region([34.4,132.46]),-1);
});
test('126cc crossing route requires ordinary motorcycle BRouter to reproduce the current road before the patch',()=>{
 const prepared=local.prepare(road[2],road,[road.at(-1)],{refs:[]});
 assert.equal(local.validateGeneralRoad(prepared,{points:[road[2],prepared.rejoin]}),true);
 assert.throws(()=>local.validateGeneralRoad(prepared,{points:[
   road[2],[road[2][0]+.01,road[2][1]+.004],
   [prepared.rejoin[0]+.01,prepared.rejoin[1]-.004],prepared.rejoin
 ]}),/元の道路を一般道として確認できません/);
 assert.throws(()=>local.validateGeneralRoad(prepared,{points:[[35,135],prepared.rejoin]}),/一般道の再探索|一般道の道路区間/);
});
test('Inland island-road leg can be detoured without touching its following bridge',()=>{
 const island=pts(34.320,133.140,24,.0022);
 const p=local.prepare(island[1],island,[island.at(-1)],{bridgeAfter:true,refs:[]});
 assert.equal(p.group,1);
 assert.ok(island.length-p.index>4);
 const track={points:[island[1],[34.322,island[1][1]+.001],[34.322,p.rejoin[1]-.001],p.rejoin],cues:[]};
 const res=local.merge(p,track,[]);
 assert.deepEqual(res.points.at(-1),island.at(-1));
 assert.ok(res.points.length<island.length+8);
});
test('real-road sections cannot cross the island/mainland boundary, bridge proximity or overrun the active leg',()=>{
 const island=pts(34.320,133.140,24,.0022);
 assert.throws(()=>local.prepare(island[1],island,[island.at(-1)],{refs:[{points:[island[5],island[6],island[7]]}]}),/橋の接続付近/);
 assert.throws(()=>local.prepare(road[road.length-4],road,[road.at(-1)],{refs:[]}),/区間終端|目的地が近い/);
 const mixed=[...road.slice(0,5),[34.32,133.17],...road.slice(5)];
 assert.equal(local.stageAllowed([road[2],[34.32,133.17]],-1),false);
 assert.throws(()=>local.prepare(mixed[2],mixed,[mixed.at(-1)],{refs:[]}),/島・本州の境界|橋をまたぐ|区間終端/);
});
test('waypoint on the proposed detour section must never be silently skipped',()=>{
 const p=local.prepare(road[2],road,[road.at(-1)],{refs:[]});
 assert.throws(()=>local.prepare(road[2],road,[road[p.index-1],road.at(-1)],{refs:[]}),/経由地/);
});
test('refuse fake road geometry, too-wide rejoin, an island-crossing substitute or a route through the no-go circle',()=>{
 const p=local.prepare(road[2],road,[road.at(-1)],{refs:[]});
 assert.throws(()=>local.merge(p,{points:[road[2],road[3],road[4]],cues:[]},[]),/合流位置/);
 assert.throws(()=>local.merge(p,{points:[road[2],[34.320,133.170],p.rejoin],cues:[]},[]),/同一区間/);
 assert.throws(()=>local.merge(p,{points:[road[2],road[3],p.rejoin],cues:[]},[]),/回避エリア|回避範囲/);
});
test('PWA connects normal and Shimanami itineraries to leg-only detour and keeps bridge references unchanged',()=>{
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(app,/state\.routeType==='shimanami'\|\|state\.shimanamiBigMode/);
 assert.match(app,/requestShimanamiRoadLegDetour\(origin,targets,version\)/);
 assert.match(app,/BNaviRoadLegDetour\.prepare\(origin,original,targets/);
 assert.match(app,/BNaviRoadLegDetour\.merge\(prepared,response\.track,originalCues/);
 assert.match(app,/leg\.points=merged\.points;leg\.turnCues=merged\.cues/);
 assert.match(app,/state\.manualDetourLegIndex=isIslandLeg\?islandIndex:null/);
 assert.match(app,/if\(state\.shimanamiBigMode&&state\.manualDetour\)/);
 assert.match(app,/state\.manualDetour=null;state\.manualDetourLegIndex=null/);
 assert.match(html,/<script src="\.\/manual-detour-local\.js" defer><\/script>/);
 assert.match(sw,/'\.\/manual-detour-local\.js'/);
 assert.match(sw,/bnavi-pc-pwa-20261124-fasttravel-preferences-v1/);
 assert.ok(html.indexOf('./manual-detour.js')<html.indexOf('./manual-detour-local.js'));
 assert.ok(html.indexOf('./manual-detour-local.js')<html.indexOf('./app.js'));
});
