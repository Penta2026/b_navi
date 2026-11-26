'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../track-recorder.js'),'utf8');
test('idle and stopped fixes are ignored; restart separates recorded segments without deleting old points',()=>{
 const store=new Map(),els=new Map(),win={};const el=id=>{if(!els.has(id))els.set(id,{dataset:{},addEventListener(){}});return els.get(id)};
 vm.runInNewContext(code,{window:win,document:{getElementById:el},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},Date});
 const api=win.BNaviTrack,p=(t,lat=34.4)=>({timestamp:t,coords:{latitude:lat,longitude:132.4,accuracy:5,altitude:10}});
 assert.equal(api.add(p(1000)),false);api.start('nav');assert.equal(api.add(p(2000)),true);api.stop();assert.equal(api.add(p(3000)),false);
 assert.equal(api.getState().count,1);assert.equal(api.getState().active,false);
 api.start('free');assert.equal(api.add(p(4000,35)),true);api.stop();
 assert.equal(api.getState().count,2);assert.equal((api.xml().match(/<trkseg>/g)||[]).length,2);assert.equal((api.xml().match(/<trkpt /g)||[]).length,2);
 const stored=JSON.parse(store.get('bnavi.actual-track.v1'));assert.equal(stored.points.length,2);assert.equal(stored.points[1].segmentStart,true);
});
