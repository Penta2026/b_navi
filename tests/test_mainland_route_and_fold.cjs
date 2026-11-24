'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const router=require('../shimanami-web-router.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const start=[34.39734,132.45939];
test('Hiroshima city -> western Onomichi / Mihara northern mainland must be a single ordinary road leg, not three imagined Shimanami road legs',()=>{
 for(const goal of [[34.405,133.10],[34.399,133.09],[34.407,133.155],[34.409,133.184]]){
  assert.equal(router.isWesternMainlandApproach(goal),true,String(goal));
  assert.equal(router.journeyRegion(goal),-1,String(goal));
  assert.equal(router.needsSpecialJourney([start,goal],1),false,String(goal));
  const stages=router.plan([start,goal],1,
   JSON.parse(read('tests/fixtures/shimanami_bridge_approaches.json')),
   require('../shimanami-bridge-references.js'));
  assert.equal(stages.length,1,String(goal));
  assert.equal(stages[0].type,'road');
  assert.equal(stages[0].via??null,null);
  assert.equal(stages[0].wide,true);
 }
});
test('mainland approach fix must not enable false land roads across the Shimanami chain',()=>{
 const islands=[[34.389,133.20],[34.320,133.170],[34.290,133.095],[34.239,133.033],[34.205,133.070],[34.157,133.060],[34.064,132.995]];
 for(const p of islands){
  assert.equal(router.isWesternMainlandApproach(p),false,String(p));
  assert.equal(router.needsSpecialJourney([start,p],1),true,String(p));
 }
 assert.equal(router.needsSpecialJourney([start,[34.405,133.10]],2),false);
});
test('option panel folds without removing its controls or altering route settings',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('style.css'),sw=read('sw.js');
 assert.match(html,/id="route-preference-toggle"[^>]*aria-controls="route-preference-body"[^>]*aria-expanded="true"/);
 assert.match(html,/<div id="route-preference-body" class="route-preference-body">/);
 assert.match(html,/id="route-preference-collapsed-summary"[^>]*hidden/);
 assert.match(html,/id="route-backroad"/);
 assert.match(html,/id="route-coast"/);
 assert.match(app,/getItem\('bnavi\.routeOptionsCollapsed\.v1'\)/);
 assert.match(app,/setItem\('bnavi\.routeOptionsCollapsed\.v1'/);
 assert.match(app,/body\.hidden=!body\.hidden/);
 assert.match(app,/bindCustomRouteUI\(\);bindRoutePreferenceHelp\(\);bindRoutePreferenceToggle\(\)/);
 assert.match(css,/\.route-preference-body\[hidden\]/);
 assert.match(sw,/bnavi-pc-pwa-20261124-biwako-bridge-v1/);
});
