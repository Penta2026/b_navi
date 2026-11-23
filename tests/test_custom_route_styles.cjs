/* Four additional route styles must not override existing beginner/general/explore or the legacy sliders. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const tuner=require('../route-tuning.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const styles=['scenic','efficient','backroad','cruise'];
const roads={trunk:/switch highway=trunk\|trunk_link ([\d.]+)/,primary:/switch highway=primary\|primary_link ([\d.]+)/};
for(const [vehicle,name] of [[0,'bn_50_general'],[1,'bn_125_general'],[2,'bn_big_general']]){
 const brf=read('profiles/'+name+'.brf');
 test(name+' retains byte-identical general routing with no style',()=>{
  assert.equal(tuner.tuneProfile(brf,null,vehicle),brf);
 });
 for(const style of styles)test(name+' '+style+' applies 11-style soft costs without access changes',()=>{
  const custom={style};const out=tuner.tuneProfile(brf,custom,vehicle);
  assert.equal(tuner.normalize(custom,vehicle).style,style);
  assert.equal(tuner.isDefault(custom,vehicle),false);
  assert.notEqual(out,brf);
  assert.match(out,/assign turncost [\d.]+/);
  assert.match(out,/switch highway=traffic_signals [\d.]+/);
  for(const forbidden of [
   'switch motorcycle=no|private 10000',
   'switch service=alley|driveway|parking_aisle|drive-through|emergency_access 10000',
   '    max 1.01'
  ])assert.ok(out.includes(forbidden),'removed a safety rule: '+forbidden);
  for(const [road,re] of Object.entries(roads))assert.notEqual(out.match(re)?.[1],undefined,road+' missing');
  if(style==='scenic'||style==='cruise')assert.ok(out.includes('assign custom_route_scenic_bias'));
  else assert.ok(!out.includes('assign custom_route_scenic_bias'));
 });
}
test('style keys are distinct and invalid style cannot silently weaken ordinary BRF',()=>{
 const brf=read('profiles/bn_125_general.brf');
 assert.equal(tuner.tuneProfile(brf,{style:'evil'},1),brf);
 assert.equal(new Set(styles.map(style=>tuner.key({style},1))).size,4);
 assert.equal(tuner.key({},1),'0,0,0,0,0');
});
test('mode UI preserves old 3-axis panel and adds independent custom route',()=>{
 const html=read('index.html'),app=read('app.js');
 for(const id of ['custom-route-panel','tuning-enabled','tune-explore','tune-width','tune-scenic'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(html,/name="custom-route-style"/);
 assert.ok(app.includes("customOption.value='custom'"));
 assert.ok(app.includes("state.customRouting=customEnabled||styleModeSelected()"));
});
