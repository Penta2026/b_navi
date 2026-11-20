'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app.js','utf8');
const start=src.indexOf('function bridgeGapPreview('),end=src.indexOf('async function calculateShimanami(',start);
assert(start>=0&&end>start);
const ctx={
 BNaviAndroidApproaches:require('../android-approaches.js'),
 BNaviShimanamiGeometry:JSON.parse(fs.readFileSync('tests/fixtures/shimanami_bridge_approaches.json','utf8')),
 console
};
vm.createContext(ctx);
vm.runInContext(`function km(a,b){const rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad;const t=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(t)));}\n${src.slice(start,end)}\nthis.preview=androidInnoshimaPreview`,ctx);
const reverse=ctx.preview({bridgeIndex:1,forward:false},[[34.354077,133.171454]],[[34.3599069,133.1865931]]);
assert(reverse&&reverse.source==='android_moped_shared_reference');
assert.equal(reverse.connectors.length,0);
assert(reverse.points.length>70);
assert(ctx.km(reverse.points.at(-1),[34.3599069,133.1865931])*1000<1);
const forward=ctx.preview({bridgeIndex:1,forward:true},[[34.360755,133.192877]],[[34.354101,133.171506]]);
assert(forward&&forward.points.length>100);
assert.equal(forward.connectors.length,0);
assert.equal(ctx.preview({bridgeIndex:6,forward:false},[[0,0]],[[0,0]]),null);
console.log('PASS: Innoshima Android moped-shared reference connects both directions; no 69m synthetic link; display only');
