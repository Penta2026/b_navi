'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tune=require('../route-tuning.js'),client=require('../public-brouter-client.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const modes=['beginner','general','explore'],vehicles=['50','125','big'];
const immutable=s=>{
 const begin=s.indexOf('assign costfactor\n'),end=s.indexOf('    max 1.01',begin);
 return s.slice(begin,end).replace(/^.*?\n/,'');
};
test('the two independent switches are saved and normalized without forcing the other OFF',()=>{
 assert.deepEqual(tune.normalizePreferences({view:'distance',ride:'cruise',backroad:true,coast:true}),
  {view:'distance',ride:'cruise',backroad:true,coast:true});
 assert.equal(tune.normalizePreferences({backroad:true}).coast,false);
 assert.equal(tune.normalizePreferences({coast:true}).backroad,false);
 assert.deepEqual(tune.normalizePreferences({view:'scenic'}),{view:'scenic',ride:'normal',backroad:false,coast:false});
 assert.notEqual(tune.key({preferences:{backroad:true,coast:true}},1),
                 tune.key({preferences:{backroad:true,coast:false}},1));
 assert.notEqual(tune.key({preferences:{backroad:false,coast:true}},1),
                 tune.key({preferences:{backroad:true,coast:true}},1));
});
test('the waterfront preference only adds an honest water-class proxy, not fabricated sea/coastline data',()=>{
 const base=read('profiles/bn_125_general.brf');
 const normal=tune.tuneProfile(base,{preferences:{view:'distance',ride:'cruise',backroad:true,coast:false}},1,1);
 const nearWater=tune.tuneProfile(base,{preferences:{view:'distance',ride:'cruise',backroad:true,coast:true}},1,1);
 const forestWater=tune.tuneProfile(base,{preferences:{view:'scenic',ride:'cruise',backroad:true,coast:true}},1,1);
 assert.doesNotMatch(normal,/additive_coastal_water_bias/);
 assert.match(nearWater,/assign additive_coastal_water_bias\n/);
 assert.match(nearWater,/switch estimated_river_class=6 -0\.600/);
 assert.match(forestWater,/add additive_scenic_bias additive_coastal_water_bias/);
 assert.match(forestWater,/assign additive_scenic_bias\n/);
 assert.equal(immutable(normal),immutable(nearWater));
 assert.match(nearWater,/switch highway=traffic_signals 850\.000/);
 assert.match(nearWater,/switch access=no\|private 10000/);
 assert.match(nearWater,/switch motorcycle=no\|private 10000/);
 assert.match(nearWater,/switch toll=yes 10000/);
});
test('all vehicle classes and basic modes preserve routing legal gates with waterfront+backroad enabled',()=>{
 for(let v=0;v<3;v++)for(let m=0;m<3;m++){
  const base=read('profiles/bn_'+vehicles[v]+'_'+modes[m]+'.brf');
  const plain=tune.tuneProfile(base,{preferences:{view:'normal',ride:'normal',backroad:false,coast:false}},v,m);
  const both=tune.tuneProfile(base,{preferences:{view:'scenic',ride:'cruise',backroad:true,coast:true}},v,m);
  assert.equal(immutable(both),immutable(base));
  assert.match(both,/assign additive_coastal_water_bias/);
  assert.match(both,/assign additive_scenic_bias/);
  assert.ok(both.includes('switch highway=traffic_signals 850.000'));
  assert.match(both,/switch highway=footway\|pedestrian\|steps\|bridleway\|construction\|proposed\|abandoned 10000|switch highway=footway\|pedestrian\|cycleway\|steps\|path\|bridleway\|construction\|proposed\|abandoned 10000/);
  assert.doesNotMatch(plain,/additive_coastal_water_bias/);
 }
});
test('the UI exposes two separately toggleable checkboxes and explicitly does not claim verified coast views',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js'),css=read('style.css');
 assert.equal((html.match(/id="route-backroad"/g)||[]).length,1);
 assert.equal((html.match(/id="route-coast"/g)||[]).length,1);
 assert.match(html,/id="route-special-options"|class="route-special-options"/);
 assert.match(html,/海岸線そのものや実際に海が見えるかは判定できません/);
 assert.match(app,/\$\('route-backroad'\)\.checked=p\.backroad/);
 assert.match(app,/\$\('route-coast'\)\.checked=p\.coast/);
 assert.match(app,/coast:\$\('route-coast'\)\.checked/);
 assert.match(app,/backroad:\$\('route-backroad'\)\.checked/);
 assert.match(app,/routePreferences:currentPreferences\(\)/);
 assert.match(app,/backroad:x\?\.backroad===true,coast:x\?\.coast===true/);
 assert.match(app,/const nonDefaultOptions=[^\n]*\|\|p\.coast/);
 assert.match(css,/\.route-special-options\{display:grid/);
 assert.match(sw,/bnavi-pc-pwa-20261124-mainland-options-toggle-v1/);
});
test('BRouter receives two different complete profiles for coastline proxy ON/OFF and does not accidentally share one',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 let uploads=0;const bodies=[];
 const fetcher=async(url,options={})=>{
  const s=String(url);
  if(s.endsWith('.brf'))return{ok:true,text:async()=>read('profiles/bn_125_general.brf')};
  if(s.endsWith('/profile')){uploads++;bodies.push(options.body);return{ok:true,text:async()=>JSON.stringify({profileId:'custom_coast_test_'+uploads})};}
  if(s.startsWith('https://brouter.de/brouter?'))return{ok:true,json:async()=>({type:'FeatureCollection',features:[{geometry:{type:'LineString',coordinates:[[132.45,34.4],[132.46,34.41]]},properties:{voicehints:[]}}]})};
  throw Error(s);
 };
 const points=[[34.4,132.45],[34.41,132.46]];
 const a={preferences:{view:'distance',ride:'cruise',backroad:true,coast:false}};
 const b={preferences:{view:'distance',ride:'cruise',backroad:true,coast:true}};
 await client.query(points,1,1,fetcher,null,a);
 await client.query(points,1,1,fetcher,null,b);
 await client.query(points,1,1,fetcher,null,a);
 assert.equal(uploads,2);
 assert.doesNotMatch(bodies[0],/additive_coastal_water_bias/);
 assert.match(bodies[1],/additive_coastal_water_bias/);
});
