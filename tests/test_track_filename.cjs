'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../track-recorder.js'),'utf8');

function harness(initial=null){
 const handlers={},state={},store=new Map(initial?[["bnavi.actual-track.v1",JSON.stringify(initial)]]:[]);
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{dataset:{},disabled:false,textContent:'',addEventListener:(name,fn)=>{handlers[id+':'+name]=fn}});return elements.get(id)};
 const saved=[],shared=[];
 const fakeDocument={getElementById:el,createElement:()=>({click(){saved.push(this.download)},remove(){}}),body:{append(){}}};
 class MockFile{constructor(data,name,options){this.data=data;this.name=name;this.type=options.type}}
 const context={window:{},document:fakeDocument,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  navigator:{canShare:()=>true,share:async args=>{shared.push(args)}},File:MockFile,Blob,Date,URL:{createObjectURL:()=> 'blob:mock',revokeObjectURL(){}},setTimeout(){},alert(x){throw Error('Unexpected alert: '+x)},confirm:()=>true};
 vm.runInNewContext(code,context,{filename:'track-recorder.js'});
 return {api:context.window.BNaviTrack,handlers,store,saved,shared};
}
function addPoint(api,t){return api.add({timestamp:t,coords:{latitude:34.4,longitude:132.4,accuracy:6,altitude:12}})}

test('date-stamped GPX name is in device LOCAL time and safe on Windows',()=>{
 const old=process.env.TZ;
 try{
  process.env.TZ='Asia/Tokyo';
  const {api}=harness();
  assert.equal(api.formatFilename('2026-11-21T23:05:00Z'),'実走GPX-2026-11-22-08-05.gpx');
  assert.equal(api.formatFilename('2026-01-01T01:02:00+09:00'),'実走GPX-2026-01-01-01-02.gpx');
  assert.doesNotMatch(api.formatFilename('2026-11-21T23:05:00Z'),/:/);
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old}
});

test('save and LINE share use the identical named GPX file',async()=>{
 const h=harness(), {api}=h;
 api.start('フリー走行');
 assert.equal(addPoint(api,Date.now()),true);
 api.stop();
 h.handlers['track-save:click']();
 await h.handlers['track-share:click']();
 assert.match(h.saved[0],/^実走GPX-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.gpx$/u);
 assert.equal(h.shared[0].files[0].name,h.saved[0]);
 assert.equal(JSON.parse(h.store.get('bnavi.actual-track.v1')).exportedAt.length,24);
});

test('export time persists across reload, and new trip gets a new date source',()=>{
 const first=harness(),{api}=first;
 api.start('ナビ走行');addPoint(api,Date.now());api.stop();
 const fname=api.getFilename();
 const second=harness(JSON.parse(first.store.get('bnavi.actual-track.v1')));
 assert.equal(second.api.getFilename(),fname);
 assert.equal(second.api.getState().count,1);
 second.handlers['track-discard:click']();
 assert.equal(second.api.getState().count,0);
 second.api.start('レーダー走行');addPoint(second.api,Date.now());
 let doc=JSON.parse(second.store.get('bnavi.actual-track.v1'));
 assert.equal(doc.exportedAt,undefined); // new ride must not inherit the previous export timestamp
 assert.match(second.api.getFilename(),/^実走GPX-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.gpx$/u);
 doc=JSON.parse(second.store.get('bnavi.actual-track.v1'));
 assert.ok(doc.exportedAt && doc.mode==='レーダー走行');
});
