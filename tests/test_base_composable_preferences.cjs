'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const t=require('../route-tuning.js');
const client=require('../public-brouter-client.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const choices={view:['normal','scenic','distance'],ride:['normal','cruise','efficient'],backroad:[false,true]};
const extract=(src,re,label)=>{const n=src.match(re)?.[1];assert.ok(n!==undefined,label+' missing');return Number(n)};
const signal=src=>extract(src.slice(src.indexOf('---context:node')),/switch highway=traffic_signals ([\d.]+)/,'signal');
const lane=src=>extract(src,/switch lanes=1 ([\d.]+)/,'one lane');
const trunk=src=>extract(src.slice(src.indexOf('assign costfactor\n')),/switch highway=trunk\|trunk_link ([\d.]+)/,'trunk');
const immutable=src=>{
 const start=src.indexOf('assign costfactor\n'),end=src.indexOf('    max 1.01',start);
 assert.ok(start>=0&&end>start);
 return src.slice(start,end).replace(/^[^\n]*\n/,'');
};
test('18 preference keys, no invalid choices, and normal preferences still raise signal cost',()=>{
 const base=read('profiles/bn_125_general.brf');
 const keys=new Set();
 for(const view of choices.view)for(const ride of choices.ride)for(const backroad of choices.backroad){
  const raw={preferences:{view,ride,backroad}};
  keys.add(t.key(raw,1));
  assert.equal(t.isDefault(raw,1),false);
  assert.equal(signal(t.tuneProfile(base,raw,1)),850);
 }
 assert.equal(keys.size,18);
 assert.deepEqual(t.normalizePreferences({view:'bogus',ride:'bogus',backroad:'true'}),{view:'normal',ride:'normal',backroad:false,coast:false});
 assert.equal(t.tuneProfile(base,null,1),base); // preserve public API for older stored routes
 assert.equal(t.SIGNAL_TRIAL_COST,850);
});
for(const [v,kind] of ['50','125','big'].entries())for(const [mode,n] of ['beginner','general','explore'].entries()){
 const file='profiles/bn_'+kind+'_'+n+'.brf';
 const base=read(file);
 test(kind+' '+n+' all 18 options preserve restrictions, base identity and shared signals',()=>{
  assert.equal(client.profileName(v,mode),'bn_'+kind+'_'+n);
  const legalGates=immutable(base);
  for(const view of choices.view)for(const ride of choices.ride)for(const backroad of choices.backroad){
   const output=t.tuneProfile(base,{preferences:{view,ride,backroad}},v,mode);
   assert.equal(signal(output),850);
   assert.notEqual(output,base);
   assert.equal(immutable(output),legalGates);
   assert.match(output,/max 1\.01/);
   assert.equal(output.includes('assign additive_scenic_bias'),view==='scenic');
   assert.match(output,/switch motorcycle=no\|private 10000/);
   assert.match(output,/switch service=alley\|driveway\|parking_aisle\|drive-through\|emergency_access 10000/);
  }
 });
}
test('C-plan backroad bias is base-mode dependent: beginner restricts narrow lanes, explore tolerates',()=>{
 const b=['beginner','general','explore'].map(mode=>read('profiles/bn_125_'+mode+'.brf'));
 const normalized=b.map((src,i)=>lane(t.tuneProfile(src,{preferences:{backroad:true}},1,i))-lane(t.tuneProfile(src,{preferences:{backroad:false}},1,i)));
 assert.ok(normalized[0]>normalized[1]&&normalized[1]>normalized[2],normalized.join(','));
 const major=b.map(src=>trunk(t.tuneProfile(src,{preferences:{backroad:true}},1,b.indexOf(src)))-trunk(t.tuneProfile(src,{preferences:{backroad:false}},1,b.indexOf(src))));
 assert.ok(major[0]<major[1]&&major[1]<major[2],major.join(','));
});
test('scenic and distance, cruise and efficiency select distinct profile costs',()=>{
 const src=read('profiles/bn_125_general.brf');
 const other=p=>t.tuneProfile(src,{preferences:p},1);
 assert.ok(other({view:'scenic'}).includes('assign additive_scenic_bias'));
 assert.ok(!other({view:'distance'}).includes('assign additive_scenic_bias'));
 assert.ok(trunk(other({view:'distance'}))<trunk(other({view:'normal'})));
 assert.ok(lane(other({ride:'cruise'}))>lane(other({ride:'efficient'})));
 assert.equal(signal(other({view:'distance',ride:'efficient',backroad:true})),850);
});
test('126cc+ fast-travel remains a standalone, untouched base profile',()=>{
 assert.equal(client.profileName(2,3),'bn_big_fasttravel_priority');
 const base=read('profiles/bn_big_fasttravel_priority.brf');
 assert.equal(t.tuneProfile(base,null,2),base);
 const app=read('app.js');
 assert.match(app,/const isFast=state\.activeRoutingMode===3/);
 assert.match(app,/const wantsOptions=preferencesActive\(\)/);
});
test('settings are saved under the main mode and normal mode selection remains numeric',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.equal((html.match(/name="route-view"/g)||[]).length,3);
 assert.equal((html.match(/name="route-ride"/g)||[]).length,3);
 assert.ok(html.includes('id="route-backroad"'));
 assert.ok(app.includes('routePreferences:currentPreferences()'));
 assert.ok(app.includes("state.activeRoutingMode=routingMode()"));
 assert.ok(app.includes('preferences:p'));
 assert.ok(!app.includes("customOption.value='custom'"));
});
