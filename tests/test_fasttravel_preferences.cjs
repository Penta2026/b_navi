'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tuning=require('../route-tuning.js'),client=require('../public-brouter-client.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const fast=read('profiles/bn_big_fasttravel_priority.brf'),general=read('profiles/bn_big_general.brf');
const prefs=(opt)=>({preferences:{view:'normal',ride:'normal',backroad:false,coast:false,...opt}});
const numberFor=(src,name)=>{
 const needle='  switch highway='+name+' ';
 const row=src.split('\n').find(x=>x.startsWith(needle));
 assert.ok(row,'missing penalty '+name);
 return Number(row.slice(needle.length).trim());
};
test('No extra preference preserves byte-exact original fasttravel BRouter BRF and profile name',()=>{
 assert.equal(tuning.tuneProfile(fast,null,2,3),fast);
 assert.equal(tuning.tuneProfile(fast,prefs({}),2,3),fast);
 assert.equal(client.profileName(2,3),'bn_big_fasttravel_priority');
});
test('coast plus backroad plus cruise are really combined in the FAST kinematic BRF',()=>{
 const compiled=tuning.tuneProfile(fast,prefs({coast:true,backroad:true,ride:'cruise'}),2,3);
 assert.match(compiled,/assign fasttravel_water_hint_bias =/);
 assert.match(compiled,/switch estimated_river_class=6 0/);
 assert.match(compiled,/add fasttravel_water_hint_bias\n  add town_penalty/);
 assert.ok(numberFor(compiled,'trunk|trunk_link')>numberFor(fast,'trunk|trunk_link'));
 assert.ok(numberFor(compiled,'unclassified')<numberFor(fast,'unclassified')+.12);
 assert.equal(compiled.includes('assign fasttravel_green_hint_bias'),false);
 assert.equal(compiled.includes('---model:btools.router.KinematicModel'),true);
});
test('view scenic and distance remain independent, both retaining original motorway/toll access conditions',()=>{
 const scenic=tuning.tuneProfile(fast,prefs({coast:true,view:'scenic'}),2,3);
 const distance=tuning.tuneProfile(fast,prefs({view:'distance'}),2,3);
 assert.match(scenic,/assign fasttravel_green_hint_bias =/);
 assert.match(scenic,/assign fasttravel_water_hint_bias =/);
 assert.doesNotMatch(distance,/fasttravel_green_hint_bias|fasttravel_water_hint_bias/);
 assert.ok(numberFor(distance,'unclassified')<numberFor(fast,'unclassified'));
 for(const x of [scenic,distance]){
  assert.match(x,/assign avoid_toll\s+= false/);
  assert.match(x,/assign avoid_motorways\s+= false/);
  assert.match(x,/switch highway=motorway\|motorway_link 0/);
  assert.match(x,/else if is_avoided_toll_road then 10000/);
  assert.match(x,/else if is_avoided_motorway then 10/);
  assert.match(x,/---context:node/);
  assert.match(x,/assign maxspeed =/);
 }
 assert.throws(()=>tuning.tuneProfile(general,prefs({coast:true}),2,3),/専用/);
 assert.throws(()=>tuning.tuneProfile(fast,prefs({coast:true}),1,3),/専用/);
});
test('BRouter network upload has a different custom profile with fastwater preference, and none without options',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 const bodies=[],requests=[];
 const fetchMock=async (url,options={})=>{
  const s=String(url);
  if(s.endsWith('.brf'))return{ok:true,text:async()=>fast};
  if(s.endsWith('/profile')){bodies.push(options.body);return{ok:true,text:async()=>JSON.stringify({profileId:'custom_fast_opts_'+bodies.length})};}
  if(s.startsWith('https://brouter.de/brouter?')){requests.push(new URL(s));return{ok:true,json:async()=>({type:'FeatureCollection',features:[{geometry:{type:'LineString',coordinates:[[132.46,34.39],[132.47,34.40]]},properties:{voicehints:[]}}]})};}
  throw Error(s);
 };
 const points=[[34.39,132.46],[34.40,132.47]];
 await client.query(points,2,3,fetchMock);
 await client.query(points,2,3,fetchMock,null,prefs({coast:true,backroad:true,ride:'cruise'}));
 assert.equal(bodies.length,2);
 assert.equal(bodies[0],fast,'no-options BRF must be exact baseline');
 assert.match(bodies[1],/fasttravel_water_hint_bias/);
 assert.match(bodies[1],/---model:btools.router.KinematicModel/);
 assert.equal(requests.length,2);
});
test('Fasttravel preference panel and guidance are available only on 126cc and never permit 125cc motorway',()=>{
 const app=read('app.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(app,/selectedBaseMode\(\)<=2\|\|\(Number\(\$\('vehicle'\)\.value\)===2&&selectedBaseMode\(\)===3\)/);
 assert.match(app,/const useExtraPreferences=wantsOptions&&usePublicBrouter\(\)&&\(!isFast\|\|nonDefaultOptions\)/);
 assert.match(app,/state\.activeRouteTuning=useExtraPreferences/);
 assert.match(html,/ファストトラベルは独立したモードのまま、追加オプションを併用できる/);
 assert.match(sw,/bnavi-pc-pwa-20261124-fasttravel-preferences-v1/);
 const moped=tuning.tuneProfile(read('profiles/bn_125_general.brf'),prefs({coast:true,backroad:true}),1,1);
 assert.match(moped,/switch toll=yes 10000/);
 assert.match(moped,/switch highway=motorway 10000/);
});
