'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bridge=require('../biwako-bridge.js'),tuner=require('../route-tuning.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const WEST=[35.118,135.905],EAST=[35.124,135.970];
const realistic=[WEST,[35.119,135.924],bridge.CENTER,[35.121,135.951],EAST];
test('The user can force a Biwako Ohashi waypoint with original user via order preserved',()=>{
 const points=[WEST,[35.121,135.915],EAST];
 const result=bridge.plan(points);
 assert.equal(result.points.length,4);
 assert.deepEqual(result.points[0],WEST);
 assert.deepEqual(result.points.at(-1),EAST);
 assert.deepEqual(result.points[1],points[1]);
 assert.deepEqual(result.points[2],bridge.CENTER);
 assert.deepEqual(points,[WEST,[35.121,135.915],EAST]);
 assert.equal(bridge.plan([WEST,bridge.CENTER,EAST]).inserted,false);
});
test('Biwako route requires a REAL crossing, cannot be an invented reference line',()=>{
 assert.ok(bridge.verify(realistic).distanceMeters<=150);
 assert.throws(()=>bridge.verify([WEST,bridge.CENTER,[35.118,135.91]]),/横断したと確認できません/);
 assert.throws(()=>bridge.verify([WEST,EAST]),/横断したと確認できません/);
 assert.throws(()=>bridge.verify([[35.1,135.92],[35.1,135.96]]),/横断したと確認できません/);
 assert.throws(()=>bridge.plan([[34.4,132.46],[34.42,132.49]]),/大きく離れています/);
 assert.throws(()=>bridge.plan([WEST]),/地点/);
});
test('If GPS auto-reroutes before bridge, the bridge constraint remains active, but is dropped after crossing',()=>{
 assert.equal(bridge.isAhead(WEST,realistic),true);
 assert.equal(bridge.isAhead(EAST,realistic),false);
 assert.equal(bridge.isAhead(null,realistic),true);
});
test('Biwako toll request generates distinct moped BRF without lifting motorway/motorroad/one-way/access restrictions',()=>{
 for(const [file,v] of [['bn_50_general',0],['bn_125_general',1],['bn_big_general',2]]){
  const original=read('profiles/'+file+'.brf');
  const changed=tuner.tuneProfile(original,{biwakoBridgeToll:true},v,1);
  assert.match(original,/switch toll=yes 10000/);
  assert.doesNotMatch(changed,/switch toll=yes 10000/);
  assert.match(changed,/switch motorroad=yes 10000/);
  assert.match(changed,/switch highway=motorway/);
  assert.match(changed,/switch oneway=yes\|true\|1 10000/);
  assert.match(changed,/switch access=no\|private 10000/);
  assert.equal(tuner.tuneProfile(original,null,v,1),original);
  assert.notEqual(tuner.key({biwakoBridgeToll:true},v),tuner.key({},v));
 }
});
test('Bridge toll gate must compose with selected scenic/cruise/backroad preferences',()=>{
 const base=read('profiles/bn_125_general.brf');
 const p={preferences:{view:'scenic',ride:'cruise',backroad:true,coast:true},biwakoBridgeToll:true};
 const tuned=tuner.tuneProfile(base,p,1,1);
 assert.match(tuned,/assign additive_coastal_water_bias/);
 assert.match(tuned,/additive_scenic_bias/);
 assert.doesNotMatch(tuned,/switch toll=yes 10000/);
 assert.match(tuned,/switch highway=motorway 10000/);
});
test('UI and routing only apply special waypoint on explicit user choice, no bridge in normal defaults',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 assert.equal((html.match(/id="route-biwako-bridge"/g)||[]).length,1);
 assert.match(html,/琵琶湖大橋を通る（試験）/);
 assert.match(app,/biwakoBridgeSelected=x\.biwakoBridgeSelected===true/);
 assert.match(app,/biwakoBridgeSelected:\s*?[^}\n]*|biwakoBridgeSelected}\)\)/);
 assert.match(app,/BNaviBiwakoBridge\.plan\(userPoints\)/);
 assert.match(app,/BNaviBiwakoBridge\.verify\(result\.track\.points\)/);
 assert.match(app,/biwakoBridgeToll:true/);
 assert.match(app,/const bridgePending=state\.biwakoBridgeActive/);
 assert.match(app,/state\.biwakoBridgeActive=keepBridge/);
 assert.match(sw,/'\.\/biwako-bridge\.js'/);
 assert.match(sw,/bnavi-pc-pwa-20261124-biwako-bridge-v1/);
 assert.ok(html.indexOf('./biwako-bridge.js')<html.indexOf('./app.js'));
});
