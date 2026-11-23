'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const router=require('../shimanami-web-router.js');
const refs=require('../shimanami-bridge-references.js');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const approaches=require('../android-approaches.js');
const src=fs.readFileSync('app.js','utf8');
const a=src.indexOf('function bridgeGapPreview('),b=src.indexOf('async function buildShimanamiPair(',a);
const ctx={BNaviAndroidApproaches:approaches,BNaviShimanamiGeometry:geometry,console,km:(x,y)=>router.meters(x,y)/1000};
vm.createContext(ctx);vm.runInContext(src.slice(a,b)+'\nthis.preview=androidBridgePreview;',ctx);
const mock=async pair=>({track:{points:pair.map(x=>x.slice()),cues:[{offset:1,desc:'left'}]},gpx:'<gpx version="1.1"/>'});
const options={geometry,refs,query:mock,bridgePreview:ctx.preview};
const from=[34.389,133.2],to=[34.064,132.995];

test('all six bridge overlays forward: 7 island road legs / 6 reference bridges, no fake rideable GPX',async()=>{
 const r=await router.compose([from,to],0,2,options);
 assert.equal(r.bridges,6);assert.equal(r.roadSegments,7);assert.equal(r.guidance.length,7);
 assert.deepEqual(r.sections.filter(s=>s.type==='bridge').map(s=>s.bridgeIndex),[1,2,3,4,5,6]);
 assert.equal(r.guidance.filter(s=>s.bridgeAfter).length,6);
 assert.equal(router.deskCheck(r,[from,to]).ok,true);
 assert(r.sections.filter(s=>s.type==='bridge').every(s=>!s.gpx&&s.referenceOnly));
 assert(r.sections.filter(s=>s.type==='road').every(s=>s.gpx&&s.points.length>=2));
});
test('all six bridges reverse: order is 6..1; islands rejoined',async()=>{
 const r=await router.compose([to,from],1,1,options);
 assert.deepEqual(r.sections.filter(s=>s.type==='bridge').map(s=>s.bridgeIndex),[6,5,4,3,2,1]);
 assert.equal(router.deskCheck(r,[to,from]).ok,true);
});
test('waypoint within same island, across 6 bridges, then reversing one bridge; checkpoints ordered',async()=>{
 const p=[from,[34.375,133.195],[34.25,133.045],to,[34.145,133.037]];
 const r=await router.compose(p,0,1,options);
 assert.equal(r.checkpoints,5);
 assert.deepEqual(r.guidance.filter(x=>x.checkpointAfter).map(x=>x.checkpointAfter),[1,2,3,4]);
 assert.deepEqual(r.sections.filter(s=>s.type==='bridge').map(s=>s.bridgeIndex),[1,2,3,4,5,6,6]);
 assert.equal(router.deskCheck(r,p).ok,true);
});
test('only guide endpoints, no bypass of missing reference or fabricated straight spans',async()=>{
 const mutated=refs.map((r,i)=>i===1?{...r,points:[[34.3,133.16],...r.points.slice(1)]}:r);
 assert.rejects(()=>router.compose([from,to],0,1,{...options,refs:mutated}),/入口・出口が合いません/);
 const wrongPreview=()=>({points:[[34.1,132.9],[34.2,133.1]]});
 await assert.rejects(()=>router.compose([from,to],0,1,{...options,bridgePreview:wrongPreview}),/接続できません/);
});
test('reject BRouter route with far-away road snap, no silent off-island detour',async()=>{
 const far=async pair=>({track:{points:[pair[0],[34.4,133.24],pair[1]],cues:[]},gpx:'<gpx/>'});
 await assert.rejects(()=>router.compose([from,to],0,1,{...options,query:far}),/道路が大きく遠回り/);
 const bad=async pair=>({track:{points:[[34.380,133.20],pair[1]],cues:[]},gpx:'<gpx/>'});
 await assert.rejects(()=>router.compose([from,to],0,1,{...options,query:bad}),/離れています/);
});
test('only special on cross-island trips with 50cc and <=125cc; normal local routing unaffected',()=>{
 assert(router.needsSpecialJourney([from,to],0));assert(router.needsSpecialJourney([to,from],1));
 assert(!router.needsSpecialJourney([from,to],2));assert(!router.needsSpecialJourney([from,[34.38,133.19]],0));
 assert(!router.needsSpecialJourney([[34.4,132.46],to],0));
});
test('Android bridge audit rejects tampering before the user can trust a route',()=>{
 const copy=JSON.parse(JSON.stringify(geometry));copy.bridges[0].directions.forward[0].points[0]=[35,133];
 assert.throws(()=>router.plan([from,to],0,copy,refs),/参考GPX|データ/);
});

test('parallel island-road requests share one BRF upload, not duplicate posts',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 const client=require('../public-brouter-client.js');let uploads=0,reads=0;
 const fetchMock=async (url,opts={})=>{
  const u=String(url);
  if(u.endsWith('.brf'))return {ok:true,text:async()=> '---context:way\n---context:node\n'};
  if(u.endsWith('/profile')){uploads++;await new Promise(resolve=>setTimeout(resolve,10));return {ok:true,text:async()=>JSON.stringify({id:'custom_shimanami_shared'})};}
  if(u.includes('/brouter?')){reads++;const coords=new URL(u).searchParams.get('lonlats').split('|').map(v=>v.split(',').map(Number));return {ok:true,json:async()=>({type:'FeatureCollection',features:[{geometry:{type:'LineString',coordinates:coords},properties:{voicehints:[]}}]})};}
  throw Error('unexpected '+u);
 };
 const pairs=[[[34.389,133.2],[34.38,133.19]],[[34.32,133.17],[34.31,133.16]],[[34.29,133.095],[34.28,133.08]]];
 const out=await Promise.all(pairs.map(pts=>client.query(pts,0,2,fetchMock)));
 assert.equal(out.length,3);assert.equal(uploads,1);assert.equal(reads,3);
});
