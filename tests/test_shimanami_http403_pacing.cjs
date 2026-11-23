'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const client=require('../public-brouter-client.js');
const router=require('../shimanami-web-router.js');
const refs=require('../shimanami-bridge-references.js');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const approaches=require('../android-approaches.js');
const source=fs.readFileSync('app.js','utf8');
const a=source.indexOf('function bridgeGapPreview('),b=source.indexOf('async function buildShimanamiPair(',a);
const vm=require('node:vm');
const ctx={BNaviAndroidApproaches:approaches,BNaviShimanamiGeometry:geometry,
 console,km:(p,q)=>router.meters(p,q)/1000};
vm.createContext(ctx);
vm.runInContext(source.slice(a,b)+'\nthis.preview=androidBridgePreview;',ctx);
const routeMock=async pair=>({track:{points:pair.map(x=>x.slice()),cues:[]},gpx:'<gpx/>'});

test('shared BRouter pacer puts POST/GET calls in a FIFO and spaces starts',async()=>{
 let clock=1000;const starts=[],delays=[];
 const pace=client.createPacer(2500,()=>clock,async ms=>{delays.push(ms);clock+=ms;});
 const outputs=await Promise.all(['profile','first road','next road'].map(x=>pace(async()=>{
  starts.push({phase:x,time:clock});return x;
 })));
 assert.deepEqual(outputs,['profile','first road','next road']);
 assert.deepEqual(starts.map(x=>x.time),[1000,3500,6000]);
 assert.deepEqual(delays,[2500,2500]);
 assert.equal(client.LIVE_REQUEST_SPACING_MS,2500);
});
test('BRouter HTTP 403/429 is clearly classified and never called a legal route',()=>{
 const mk=status=>({status});
 assert.match(client.errorFromResponse(mk(403),'Please, retry later!','経路計算').message,/HTTP 403.*しばらく間隔/);
 assert.match(client.errorFromResponse(mk(403),'Forbidden','経路計算').message,/拒否/);
 assert.match(client.errorFromResponse(mk(429),'rate limit','経路計算').message,/問い合わせが多すぎ/);
 assert.match(client.errorFromResponse(mk(503),'','経路計算').message,/一時的に応答できません/);
});
test('403 response aborts after one route request; no repeated profile upload or invented bridge',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 let uploads=0,requests=0;
 const fake=async (url,opts={})=>{
  const u=String(url);
  if(u.endsWith('.brf'))return {ok:true,text:async()=> '---context:way\n---context:node\n'};
  if(u.endsWith('/profile')){uploads++;return {ok:true,text:async()=> '{"id":"custom_shimanami_403_guard"}'};}
  if(u.includes('/brouter?')){requests++;return {ok:false,status:403,text:async()=> 'Please, retry later!'};}
  throw Error('Unexpected '+u);
 };
 await assert.rejects(client.query([[34.389,133.2],[34.375,133.195]],2,3,fake),/HTTP 403/);
 assert.equal(uploads,1);assert.equal(requests,1);
});
test('Shimanami composes public road legs one at a time and aborts on first HTTP 403',async()=>{
 const from=[34.389,133.2],to=[34.064,132.995];
 let active=0,peak=0,calls=0;
 const success=async pair=>{
  calls++;active++;peak=Math.max(peak,active);
  await Promise.resolve();active--;return routeMock(pair);
 };
 const result=await router.compose([from,to],1,1,{
  geometry,refs,bridgePreview:ctx.preview,query:success,concurrency:2
 });
 assert.equal(result.roadSegments,7);
 assert.equal(calls,7);assert.equal(peak,1);
 let rejectedCalls=0;
 await assert.rejects(router.compose([from,to],1,1,{
  geometry,refs,bridgePreview:ctx.preview,
  query:async()=>{rejectedCalls++;throw Error('HTTP 403: request refused');}
 }),/HTTP 403/);
 assert.equal(rejectedCalls,1);
});
test('main PWA delegates special Shimanami 50/125cc roads without falling back to motorway geometry',()=>{
 const s=fs.readFileSync('app.js','utf8');
 assert.match(s,/BNaviShimanamiWebRouter\.needsSpecialJourney\(points,\$\('vehicle'\)\.value\)/);
 assert.match(s,/BNaviPublicBrouter\.query\(pair,v,m,fetch,null,state\.activeRouteTuning\)/);
 assert.match(s,/routeView\('shimanami',result\.sections,null/);
 assert.match(fs.readFileSync('shimanami-web-router.js','utf8'),/const results=new Map\(\),snapWarnings=\[\],count=1/);
});
