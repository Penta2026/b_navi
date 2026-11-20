'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app.js','utf8');
const a=src.indexOf('function bridgeGapPreview('),b=src.indexOf('async function calculateShimanami(',a);
const approaches=require('../android-approaches.js');
const geometry=JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8'));
const ctx={BNaviAndroidApproaches:approaches,BNaviShimanamiGeometry:geometry,console};vm.createContext(ctx);
vm.runInContext(`function km(a,b){const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;const t=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(t)));}\n${src.slice(a,b)}\nthis.preview=androidBridgePreview`,ctx);
const tracks=new Map();
for(const file of fs.readdirSync('tests/fixtures/shimanami_references')){
 const xml=fs.readFileSync(path.join('tests/fixtures/shimanami_references',file),'utf8');
 const pt=[...xml.matchAll(/<(?:trkpt|rtept)\s+lat="([\d.]+)"\s+lon="([\d.]+)"/g)].map(m=>[+m[1],+m[2]]);
 if(pt.length<3)continue;
 for(let i=0;i<6;i++){
  const bridge=geometry.bridges[i],ent=bridge.directions.forward[0].points[0],end=bridge.directions.forward[1].points.at(-1);
  if(approaches.meters(pt[0],ent)<140&&approaches.meters(pt.at(-1),end)<140)tracks.set(i+1,pt);
 }
}
let good=0;
for(let i=1;i<=6;i++){
 const points=tracks.get(i);assert(points,`missing cycling reference for bridge ${i}`);
 for(const forward of [true,false]){
  const parts=geometry.bridges[i-1].directions[forward?'forward':'reverse'];
  const from=parts[0].points[0],to=parts[1].points.at(-1);
  const res=ctx.preview({bridgeIndex:i,forward,points:forward?points:points.slice().reverse()},[from],[to]);
  const status=res?`JOIN ${res.points.length} pts`: 'UNJOINED';
  console.log(`${approaches.NAMES[i-1]} ${forward?'forward':'reverse'}: ${status}`);
  if(res){assert(ctx.km(from,res.points[0])*1000<25);assert(ctx.km(to,res.points.at(-1))*1000<25);good++;}
 }
}
console.log(`Connected ${good}/12 bridge directions. Unjoined are intentionally not fabricated.`);
