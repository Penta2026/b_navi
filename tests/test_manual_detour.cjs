'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const detour=require('../manual-detour.js'),publicRouter=require('../public-brouter-client.js');
const a=[34.4000,132.4500],b=[34.4100,132.4500],c=[34.4200,132.4500];
test('manual detour follows actual forward geometry, not a guessed bearing or a rearward point',()=>{
 const p=detour.plan([34.401,132.4500],[a,b,c],[b,c]);
 assert.ok(p.point[0]>34.402&&p.point[0]<34.405);
 assert.equal(p.point[1],132.4500);
 assert.equal(p.radius,110);assert.equal(p.aheadMeters,230);
 assert.ok(detour.meters([34.401,132.45],p.point)>180);
 const reverse=detour.plan([34.419,132.45],[c,b,a],[b,a]);
 assert.ok(reverse.point[0]<34.418);
});
test('invalid GPS, near goal, off-route, via in detour circle and tiny route all fail safely',()=>{
 assert.throws(()=>detour.plan([34.401,132.465],[a,b,c],[c]),/ルートから離れて/);
 assert.throws(()=>detour.plan([34.419,132.45],[a,b,c],[c]),/目的地が近い/);
 assert.throws(()=>detour.plan([34.401,132.45],[a,b,c],[[34.4032,132.45],c]),/経由地・目的地/);
 assert.throws(()=>detour.plan(null,[a,b,c],[c]),/GPS位置/);
 assert.throws(()=>detour.plan([34.401,132.45],[a],[]),/道路ルート/);
});
test('detour result must physically avoid the BRouter circular no-go before replacing the screen route',()=>{
 const avoided=detour.plan([34.401,132.45],[a,b,c],[c]);
 assert.throws(()=>detour.verify([a,b,c],avoided),/回避エリア/);
 assert.equal(detour.verify([[34.401,132.45],[34.401,132.452],[34.407,132.452],c],avoided),true);
});
test('BRouter encodes lon lat radius with a hard nogo, only when explicitly requested',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 let calcUrls=[],uploads=0;
 const fetcher=async url=>{
  const s=String(url);
  if(s.endsWith('.brf'))return{ok:true,text:async()=> '---context:global\n---context:way\n---context:node\n'};
  if(s.endsWith('/profile')){uploads++;return{ok:true,text:async()=>JSON.stringify({profileId:'custom_manualavoid'})};}
  if(s.startsWith('https://brouter.de/brouter?')){
   calcUrls.push(s);
   return{ok:true,json:async()=>({type:'FeatureCollection',features:[{
    geometry:{type:'LineString',coordinates:[[132.45,34.4],[132.45,34.42]]},properties:{voicehints:[]}
   }]})};
  }
  throw Error(s);
 };
 const loc=[a,c],avoid={point:[34.4032145,132.45019],radius:110};
 await publicRouter.query(loc,1,1,fetcher,null,null,{nogos:[avoid]});
 await publicRouter.query(loc,1,1,fetcher,null,null);
 assert.equal(calcUrls.length,2);
 assert.equal(new URL(calcUrls[0]).searchParams.get('nogos'),'132.450190,34.403214,110');
 assert.equal(new URL(calcUrls[1]).searchParams.has('nogos'),false);
 assert.equal(uploads,1);
});
test('public BRouter never accepts malformed hard no-go settings or a negative exclusion radius',()=>{
 for(const x of [{point:[NaN,132.45],radius:110},{point:[34.4,132.45],radius:-20},{point:[34.4,132.45],radius:12.5}]){
  assert.throws(()=>publicRouter.validateNogos({nogos:[x]}),/回避エリア/);
 }
 assert.deepEqual(publicRouter.validateNogos({}),[]);
});
test('one tappable detour control lives on active voice HUD, with no bridge-reference routing',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('style.css'),sw=read('sw.js');
 assert.match(html,/<div id="navigation-hud"[^>]*>[\s\S]*?id="nav-detour"/);
 assert.equal((html.match(/id="nav-detour"/g)||[]).length,1);
 assert.match(css,/#navigation-hud \.navigation-hud-actions #nav-detour\{pointer-events:auto/);
 assert.match(app,/!\['normal','shimanami'\]\.includes\(state\.routeType\)/);
 assert.match(app,/BNaviManualDetour\.plan\(origin,state\.gpsPoints,targets\)/);
 assert.match(app,/BNaviManualDetour\.verify\(response\.track\.points,avoid\)/);
 assert.match(app,/state\.manualDetour=avoid/);
 assert.match(app,/state\.manualDetour=keepDetour/);
 assert.match(app,/if\(version!==routePlanVersion\|\|!state\.navActive\|\|state\.navPaused\)return/);
 assert.match(sw,/'\.\/manual-detour\.js'/);
 assert.match(sw,/bnavi-pc-pwa-20261124-mainland-options-toggle-v1/);
 assert.ok(html.indexOf('./public-brouter-client.js')<html.indexOf('./manual-detour.js'));
 assert.ok(html.indexOf('./manual-detour.js')<html.indexOf('./app.js'));
});
