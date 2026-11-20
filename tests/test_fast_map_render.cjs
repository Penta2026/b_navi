'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function fakeNode(){return {style:{},children:[],attributes:{},replaceCount:0,addEventListener(){},setAttribute(k,v){this.attributes[k]=v},append(n){this.children.push(n)},replaceChildren(){this.children=[];this.replaceCount++},remove(){this.removed=true}}}
function testMap(){
 const tasks=[];const nodes={};const mk=()=>fakeNode();
 const element=Object.assign(mk(),{clientWidth:390,clientHeight:780,getBoundingClientRect(){return {left:0,top:0,width:390,height:780}},setPointerCapture(){}});
 const context={window:{},Math,Map,Set,document:{createElement:mk,createElementNS:mk,getElementById(id){if(!nodes[id])nodes[id]=Object.assign(mk(),{hidden:false});return nodes[id]}},ResizeObserver:class{observe(){}},requestAnimationFrame:cb=>{tasks.push(cb);return tasks.length},navigator:{vibrate(){}},setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','map-core.js'),'utf8'),context);
 const flush=()=>{while(tasks.length)tasks.shift()()};
 const map=new context.window.BNaviMapCore.MapCore(element,mk(),mk(),mk(),mk(),mk(),()=>{});flush();
 return {map,flush};
}
test('GPS and panning translate cached route SVG instead of regenerating each GPX point',()=>{
 const {map,flush}=testMap();
 const pathPoints=Array.from({length:8000},(_,i)=>[34.35+i*0.000001,132.44+i*0.000001]);
 const paths=[{type:'road',points:pathPoints,width:5}];
 map.setData(paths,[],null);flush();
 const pathLayer=map.pathLayer;
 const before=pathLayer.replaceCount;
 assert.equal(pathLayer.children.length,1);
 map.center(34.402,132.467);flush();
 map.center(34.401,132.469);flush();
 map.setBearing(28);flush();
 map.setData(paths,[],[34.4,132.46]);flush();
 assert.equal(pathLayer.replaceCount,before,'panning, GPS, and rotation must not rebuild SVG paths');
 assert.match(String(pathLayer.attributes.transform),/translate\(/);
 assert.equal(pathPoints.length,8000,'source GPX coordinates remain untouched');
 map.setZoom(map.zoom+1);flush();
 assert.equal(pathLayer.replaceCount,before+1,'zoom must redraw correctly');
});
test('viewport tile requests are bounded for phone portrait at north-up',()=>{
 const {map,flush}=testMap();
 map.center(34.4,132.46,13);flush();
 assert.ok(map.tileNodes.size<=30,'excessive raster tiles requested: '+map.tileNodes.size);
});
