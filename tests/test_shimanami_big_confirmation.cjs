'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const big=require('../shimanami-big-router.js');
const tuning=require('../route-tuning.js');
const brouter=require('../public-brouter-client.js');
const refs=require('../shimanami-bridge-references.js');
const S=[34.404838,133.193008],M=[34.389,133.2],I=[34.32,133.17],K=[34.29,133.095],O=[34.157,133.06],G=[34.064,132.995];
const middle=i=>refs[i].points[Math.floor(refs[i].points.length/2)];
test('only 126cc+ routes actually crossing Shimanami island boundaries prompt',()=>{
 assert.equal(big.potential([S,I,K,O,G],2),true);
 assert.equal(big.potential([G,O,K,I,S],2),true);
 assert.equal(big.potential([S,I],1),false);
 assert.equal(big.potential([S,I],0),false);
 assert.equal(big.potential([S,M],2),false);
 assert.equal(big.potential([I,I],2),false);
 assert.equal(big.potential([[35.5,135],G],2),false);
 assert.deepEqual(big.bridgeIndices(0,3),[0,1,2]);
 assert.deepEqual(big.bridgeIndices(-1,0),[]);
});
test('only explicit 126cc+ crossing with preferences may unlock motorway and toll',()=>{
 const source=read('profiles/bn_big_general.brf');
 const defaultProfile=tuning.tuneProfile(source,{preferences:{ride:'cruise'}},2);
 assert.match(defaultProfile,/switch highway=motorway\|motorway_link 10000/);
 assert.match(defaultProfile,/switch motorroad=yes 10000/);
 assert.match(defaultProfile,/switch toll=yes 10000/);
 const crossing=tuning.tuneProfile(source,{preferences:{ride:'cruise'},allowMotorway:true,allowToll:true},2);
 assert.doesNotMatch(crossing,/switch highway=motorway\|motorway_link 10000/);
 assert.doesNotMatch(crossing,/switch motorroad=yes 10000/);
 assert.doesNotMatch(crossing,/switch toll=yes 10000/);
 assert.match(crossing,/switch highway=motorway\|motorway_link 1\.150/);
 for(const restricted of ['access=no|private','vehicle=no|private','motor_vehicle=no|private','motorcycle=no|private'])
  assert.ok(crossing.includes('switch '+restricted+' 10000'),restricted);
 assert.match(tuning.tuneProfile(read('profiles/bn_125_general.brf'),{preferences:{},allowMotorway:true,allowToll:true},1),
  /switch highway=motorway 10000\.00/);
});
test('road composer follows requested vias and keeps per-island permission scoped',async()=>{
 const p=[S,I,I.map((v,i)=>v+(i===0?.001:0)),K],calls=[];
 const result=await big.compose(p,2,{preferences:{view:'scenic',ride:'cruise',backroad:true}},{
  refs,query:async(pair,mode,opts,leg)=>{
   calls.push({mode,opts,leg});
   const points=[pair[0],...leg.bridges.map(middle),pair[1]];
   return{track:{points,cues:[{offset:0,point:points[0],desc:'straight'}]}};
  }
 });
 assert.equal(calls.length,3);
 assert.deepEqual(calls[0].leg.bridges,[0]);
 assert.deepEqual(calls[1].leg.bridges,[]);
 assert.deepEqual(calls[2].leg.bridges,[1]);
 assert.ok(calls[0].opts.allowMotorway&&calls[0].opts.allowToll);
 assert.equal(calls[1].opts.allowMotorway,false);
 assert.equal(calls[1].opts.allowToll,false);
 assert.ok(calls[2].opts.allowMotorway);
 assert.equal(calls[0].opts.preferences.ride,'cruise');
 assert.equal(result.crossingLegs,2);
 assert.equal(result.bridgeCount,2);
 assert.equal(result.track.cues[1].offset,3);
 assert.match(result.gpx,/<trkseg>/);
});
test('fast travel is replaced by motorcycle-general on scoped crossing; same-island uses no highway',async()=>{
 const calls=[];
 await big.compose([I,[34.321,133.1705],K],3,null,{refs,query:async(pair,mode,opts,leg)=>{
  calls.push({mode,opts,leg});
  const points=[pair[0],...leg.bridges.map(middle),pair[1]];
  return{track:{points,cues:[]}};
 }});
 assert.equal(calls[0].mode,1);
 assert.equal(calls[0].opts,null);
 assert.equal(calls[1].mode,1);
 assert.equal(calls[1].opts.allowMotorway,true);
 assert.equal(brouter.profileName(2,3),'bn_big_fasttravel_priority');
});
test('bridge references cannot substitute for disconnected or wrong BRouter road geometry',async()=>{
 const distantRefs=refs.map((ref,i)=>i===1?{...ref,points:[[35.2,135.2],[35.2,135.2]]}:ref);
 await assert.rejects(big.compose([I,K],1,null,{refs:distantRefs,query:async pair=>({track:{points:pair,cues:[]}})}),
  /付近を通る道路経路を確認できません/);
 await assert.rejects(big.compose([S,I,K],1,null,{refs,query:async(pair,mode,opts,leg)=>{
  if(leg.index===1)return{track:{points:[pair[0],middle(0),pair[1]],cues:[]}};
  return{track:{points:[[pair[0][0]+.001,pair[0][1]],middle(1),pair[1]],cues:[]}};
 }}),/道路接続が/);
});
test('B_Navi dialog requires explicit confirmation; offline restore remembers the selected mode',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 for(const id of ['shimanami-big-confirm-dialog','shimanami-big-confirm-close','shimanami-big-confirm-normal','shimanami-big-confirm-accept'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/島を渡る区間だけ高速・有料道路/);
 assert.match(app,/const choice=await askBigDecision\(\)/);
 assert.match(app,/if\(choice==='cross'\)\{await calculateBigShimanami/);
 assert.match(app,/state\.shimanamiBigMode=data\.shimanamiBigMode===true/);
 assert.match(app,/bindShimanamiBigDialog\(\);bindPresetUI/);
 assert.match(sw,/'\.\/shimanami-big-router\.js'/);
});
