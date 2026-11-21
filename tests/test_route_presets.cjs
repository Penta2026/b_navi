'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const presets=require('../route-presets.js');
const tuning=require('../route-tuning.js');

test('named presets: save multiple per displacement and preserve named values',()=>{
 let items=[];
 const x=presets.upsert(items,' 海沿いツーリング ',1,{explore:55,width:-30,scenic:75},{now:'2026-11-21T00:00:00.000Z',makeId:()=> 'one'});items=x.items;
 const y=presets.upsert(items,'街なか',1,{explore:-20,width:85,scenic:-50},{makeId:()=> 'two'});items=y.items;
 items=presets.upsert(items,'海沿いツーリング',2,{explore:20,allowMotorway:true,allowToll:true},{makeId:()=> 'three'}).items;
 assert.equal(items.length,3);
 assert.deepEqual(presets.forVehicle(items,1).map(x=>x.name).sort(),['海沿いツーリング','街なか']);
 assert.equal(items[0].tuning.explore,55);
 assert.equal(items[2].tuning.allowMotorway,true);
 assert.deepEqual(presets.read(presets.pack(items)),items);
});

test('preset overwrite is opt-in; does not mutate other entries; deleting does not alter active tuning',()=>{
 let items=presets.upsert([],'山道',0,{scenic:90},{makeId:()=> 'preset-001'}).items;
 assert.throws(()=>presets.upsert(items,' 山道 ',0,{width:50}),/同じ名前/);
 const updated=presets.upsert(items,'山道',0,{width:50},{overwrite:true}).items;
 assert.equal(updated.length,1);assert.equal(updated[0].id,'preset-001');assert.equal(updated[0].tuning.width,50);
 assert.equal(items[0].tuning.scenic,90);
 assert.equal(presets.remove(updated,'preset-001').length,0);
});

test('zeroed centre remains original general profile after saving/loading',()=>{
 const config=tuning.normalize(null,1),items=presets.upsert([],'一般そのまま',1,config).items;
 assert.equal(tuning.isDefault(presets.read(presets.pack(items))[0].tuning,1),true);
});

test('50cc/125cc may never inherit motorway/toll permission from edited backup',()=>{
 const doc=JSON.stringify({format:presets.FORMAT,version:1,items:[
  {name:'法律確認',vehicle:0,tuning:{allowMotorway:true,allowToll:true,explore:55}},
  {name:'法律確認',vehicle:1,tuning:{allowMotorway:true,allowToll:true,scenic:80}},
  {name:'高速OK',vehicle:2,tuning:{allowMotorway:true,allowToll:true}}
 ]});
 const result=presets.importBackup([],doc);
 assert.equal(result.added,3);
 assert.equal(result.items[0].tuning.allowMotorway,false);
 assert.equal(result.items[1].tuning.allowToll,false);
 assert.equal(result.items[2].tuning.allowMotorway,true);
});

test('backup roundtrip merges without replacing existing same-name settings',()=>{
 const old=presets.upsert([],'お気に入り',1,{width:60},{makeId:()=> 'original'}).items;
 const source=[...presets.upsert([],'お気に入り',1,{width:-60}).items,...presets.upsert([],'海沿い',1,{scenic:80}).items];
 const content=presets.backup(source);
 const res=presets.importBackup(old,content);
 assert.equal(res.added,1);assert.equal(res.skipped,1);
 assert.equal(res.items.find(x=>x.name==='お気に入り').tuning.width,60);
 assert.equal(res.items.find(x=>x.name==='海沿い').tuning.scenic,80);
 assert.throws(()=>presets.importBackup([],'{"version":1,"items":[]}'),/バックアップ/);
 assert.throws(()=>presets.importBackup([],'not-json'),/JSON/);
});

test('cap at 50 entries, sanitized names and invalid records skipped',()=>{
 let items=[];
 for(let i=0;i<50;i++)items=presets.upsert(items,'p'+i,1,{width:i},{makeId:()=> 'id-'+i}).items;
 assert.throws(()=>presets.upsert(items,'last',1,{}),/50件/);
 assert.equal(presets.nameOf(' '.repeat(3)+'a'.repeat(80)).length,40);
 const parsed=presets.read({version:1,items:[{vehicle:'9',name:'invalid'},{vehicle:1,name:'valid',tuning:{width:10}}]});
 assert.equal(parsed.length,1);
});
