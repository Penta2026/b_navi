'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const part=src.slice(src.indexOf('async function calculateWaypointJourney('),src.indexOf('function setExample('));
const calls=[],p=[[34.4,133.2],[34.35,133.2],[34.06,133.0],[34.18,133.05]];
const state={islandLegs:[]};let displayed=null;
const ctx={state,routePlanVersion:0,setMessage:()=>{},postApi:async (_,pair)=>{calls.push(pair);if(calls.length===1)return {response:{headers:{get:()=> 'application/gpx+xml'}},text:'<gpx/>'};throw Error('しまなみ島渡り')},gpxPoints:()=>[[1,1],[2,2]],gpxTurnCues:()=>[],buildShimanamiPair:async (pair)=>({sections:[{type:'road',points:pair}],guidance:[{name:'島',points:pair,turnCues:[],bridgeAfter:true}],bridges:1}),routeView:(type,sections,_,message)=>{displayed={type,sections,message}},loadIslandGuidance:()=>{}};
vm.createContext(ctx);vm.runInContext(part,ctx);
ctx.calculateWaypointJourney(p,0).then(()=>{assert.equal(calls.length,3);for(let i=0;i<3;i++){assert.deepEqual(JSON.parse(JSON.stringify(calls[i])),[p[i],p[i+1]]);}assert.equal(displayed.type,'shimanami');assert.equal(state.islandLegs.length,3);assert.equal(state.islandLegs[0].bridgeAfter,false);assert.equal(state.islandLegs[1].bridgeAfter,true);assert(displayed.message.includes('経由地2件'));console.log('PASS: waypoint order respected across standard road + two island crossings');}).catch(e=>{console.error(e);process.exitCode=1});
