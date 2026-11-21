'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const part=src.slice(src.indexOf('function loadIslandGuidance('),src.indexOf('function stopDemo('));
const loc=[34.0,133.0],end=[34.001,133.0],next=[34.005,133.0];
const state={islandLegs:[{name:'first',points:[loc,end],turnCues:[],bridgeAfter:true},{name:'second',points:[next,[34.006,133]],turnCues:[]}],islandIndex:0,awaitingBridge:false,navActive:true,location:null,gpsAccuracy:5,cumKm:[],saidCues:new Set()};
const nodes={'nav-status':{textContent:''}};
const sandbox={state,km:(a,b)=>{const r=Math.PI/180,d=(b[0]-a[0])*r;return Math.abs(d)*6371;},$:id=>nodes[id],speak:t=>sandbox.spoken.push(t),spoken:[],window:{speechSynthesis:{cancel:()=>{}}},cueText:x=>x};
vm.createContext(sandbox);vm.runInContext(part,sandbox);
sandbox.loadIslandGuidance(0);
state.location=[34.0009,133];sandbox.updateShimanamiGuidance();assert.equal(state.awaitingBridge,true,'must pause at island end');
state.location=[34.003,133];sandbox.updateShimanamiGuidance();assert.equal(state.awaitingBridge,true,'must not navigate bridge');
state.location=[34.00495,133];sandbox.updateShimanamiGuidance();assert.equal(state.islandIndex,1,'must resume near next island');assert.equal(state.awaitingBridge,false);
assert.equal(sandbox.spoken.length,2,'pause and resume announcements');
// GPS may continue to track bridges with speech turned off.
state.navActive=false;state.islandIndex=0;state.awaitingBridge=false;sandbox.spoken.length=0;sandbox.loadIslandGuidance(0);state.location=[34.0009,133];sandbox.updateShimanamiGuidance();
assert.equal(sandbox.spoken.length,0,'bridge should not announce when guidance is stopped');
console.log('PASS: Shimanami GPS pause/resume (65m/160m/90m)');
