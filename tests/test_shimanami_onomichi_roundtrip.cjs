'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const router=require('../shimanami-web-router.js');
const refs=require('../shimanami-bridge-references.js');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const approaches=require('../android-approaches.js');
const app=fs.readFileSync('app.js','utf8');
const a=app.indexOf('function bridgeGapPreview('),b=app.indexOf('async function buildShimanamiPair(',a);
const ctx={BNaviAndroidApproaches:approaches,BNaviShimanamiGeometry:geometry,console,km:(p,q)=>router.meters(p,q)/1000};
vm.createContext(ctx);vm.runInContext(app.slice(a,b)+'\nthis.preview=androidBridgePreview;',ctx);
const station=[34.404838,133.193008],imabari=[34.064,132.995],home=[34.4050,133.1940];
const anchor=router.ONOMICHI_BRIDGE_ROAD_ANCHOR;
const fakeResult=points=>({track:{points:points.map(p=>p.slice()),cues:[]},gpx:'<gpx/>'});

test('station -> Imabari -> station requires 12 reference bridges plus BOTH ordinary R317 Onomichi road crossings',()=>{
 const pts=[station,imabari,home];
 assert(router.needsSpecialJourney(pts,0));
 assert(router.needsSpecialJourney(pts,1));
 assert(!router.needsSpecialJourney(pts,2));
 const stages=router.plan(pts,1,geometry,refs);
 const bridges=stages.filter(s=>s.type==='bridge'),roads=stages.filter(s=>s.type==='road');
 assert.equal(bridges.length,12);
 assert.deepEqual(bridges.map(b=>b.bridgeIndex),[1,2,3,4,5,6,6,5,4,3,2,1]);
 assert.equal(roads.length,14);
 assert.equal(roads[0].mainlandCrossing,'to_island');
 assert.equal(roads.at(-1).mainlandCrossing,'to_mainland');
 assert.deepEqual(roads[0].via,[anchor]);assert.deepEqual(roads.at(-1).via,[anchor]);
 assert.equal(roads.filter(r=>r.via).length,2,'only mainland crossing legs get a road bridge waypoint');
 assert.equal(roads.at(-1).checkpointEnd,true);
 assert.equal(roads.at(-1).checkpoint,2);
});
test('12-bridge round trip is composed without faking navigable bridge GPX',async()=>{
 const pts=[station,imabari,home];const calls=[];
 const result=await router.compose(pts,1,1,{
  geometry,refs,bridgePreview:ctx.preview,
  query:async pair=>{calls.push(pair);return fakeResult(pair);},
  concurrency:2
 });
 assert.equal(calls.length,14);
 assert.equal(result.roadSegments,14);
 assert.equal(result.bridges,12);
 assert.equal(result.checkpoints,3);
 assert.equal(calls[0].length,3);
 assert.equal(calls.at(-1).length,3);
 assert.deepEqual(calls[0][1],anchor);
 assert.deepEqual(calls.at(-1)[1],anchor);
 assert.equal(result.sections.filter(s=>s.type==='bridge').length,12);
 assert.equal(result.sections.filter(s=>s.type==='road').length,14);
 assert(result.sections.filter(s=>s.type==='bridge').every(s=>s.referenceOnly===true&&!s.gpx));
 assert(result.sections.filter(s=>s.type==='road').every(s=>s.gpx));
 assert.deepEqual(result.guidance.filter(x=>x.checkpointAfter).map(x=>x.checkpointAfter),[1,2]);
 assert.equal(router.verifyPlan(result,pts).ok,true);
 assert.equal(router.deskCheck(result,pts).ok,true);
});
test('a router response that skips the ordinary Onomichi Bridge is rejected, not connected across water',()=>{
 const stages=router.plan([station,imabari],1,geometry,refs);
 const first=stages.find(s=>s.type==='road');
 assert(first.via);
 const passing=router.validateRoad(first,{points:[first.from,anchor,first.to]});
 assert.equal(passing.warnings.length,0);
 const skipped={points:[first.from,first.to]};
 assert.throws(()=>router.validateRoad(first,skipped),/尾道大橋.*通っていません/);
});
test('ordinary R317 crossing is NOT forced for a purely mainland local road pair',()=>{
 const stages=router.plan([station,home],1,geometry,refs);
 assert.equal(stages.length,1);
 assert.equal(stages[0].type,'road');
 assert.equal(stages[0].mainlandCrossing,null);
 assert.equal(stages[0].via,null);
});
test('old bridge reference data remain untouched, with no ferry or motorway GPX fabrication',()=>{
 const source=fs.readFileSync('shimanami-web-router.js','utf8');
 assert.match(source,/ONOMICHI_BRIDGE_ROAD_ANCHOR=/);
 assert.match(source,/It never becomes a fabricated drivable GPX line/);
 assert.match(source,/MAX_BRIDGE_SEAM_METERS=25/);
 assert.match(source,/MAX_USER_WAYPOINT_SNAP_METERS=80/);
 assert.match(source,/stage\.via\?\[stage\.from,\.\.\.stage\.via,stage\.to\]/);
 assert.match(source,/尾道大橋（国道317号・一般道）/);
});
