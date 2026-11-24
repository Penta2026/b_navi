'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('app.js');
function extract(from,to){const a=app.indexOf(from),b=app.indexOf(to,a);assert.ok(a>=0&&b>a,'missing function source '+from);return app.slice(a,b);}
const compatibility=extract('function storedRouteMismatch(', 'async function restoreOfflineRoute(');
const context={};vm.runInNewContext(compatibility+'\nthis.mismatch=storedRouteMismatch;',context);
const mismatch=context.mismatch;
test('restored 125cc moped route is NOT shown under 126cc or as fast travel',()=>{
 const older={activeRoutingVehicle:1,activeRoutingMode:1,type:'shimanami',sections:[{type:'bridge'}]};
 assert.match(mismatch(older,2,3),/51〜125cc用/);
 assert.match(mismatch({...older,activeRoutingVehicle:2},2,3),/原付用の橋参考線/);
 assert.match(mismatch({...older,activeRoutingVehicle:2,type:'normal'},2,3),/別の走り方/);
 assert.match(mismatch({...older,activeRoutingVehicle:undefined},2,3),/車種が確認できない/);
 assert.equal(mismatch({...older,activeRoutingVehicle:2,activeRoutingMode:3,type:'normal'},2,3),null);
 assert.equal(mismatch(older,1,1),null);
 assert.match(mismatch({...older,type:'normal',activeRoutingVehicle:2,activeRoutingMode:1,
  activeRouteTuning:{preferences:{view:'scenic',ride:'normal',backroad:false}}},2,1,
  {view:'normal',ride:'normal',backroad:false}),/異なる好みのオプション/);
 assert.equal(mismatch({...older,type:'normal',activeRoutingVehicle:2,activeRoutingMode:1,
  activeRouteTuning:{preferences:{view:'scenic',ride:'normal',backroad:false}}},2,1,
  {view:'scenic',ride:'normal',backroad:false}),null);
});
test('preference or engine selection always discards stale calculated lines but retains points and settings',()=>{
 assert.match(app,/invalidateDisplayedRoute\('排気量'\);updateModes\(\)/);
 assert.match(app,/invalidateDisplayedRoute\('走り方'\);chooseCustom\(false\)/);
 assert.match(app,/invalidateDisplayedRoute\('好みのオプション'\);updateCustomRouteUI/);
 assert.match(app,/invalidateDisplayedRoute\('裏道優先'\);updateCustomRouteUI/);
 const body=extract('function invalidateDisplayedRoute(', 'function freeRideInProgress(');
 assert.doesNotMatch(body,/state\.via\s*=|\$\('start'\)\.value\s*=|\$\('goal'\)\.value\s*=|BNaviMyRouteLibrary\.drop/);
 const actions=[];
 const state={routeType:'shimanami',routes:[{type:'bridge'}],navActive:true,via:['checkpoint']};
 const btn={disabled:true};
 const scope={state,$:id=>id==='calculate'?btn:null,
  settleBigDecision:()=>actions.push('dismiss'),
  offlineSaveTimer:123,
  clearTimeout:()=>actions.push('timer'),
  stopVoiceGuidance:()=>actions.push('stop'),
  clearResult:()=>{actions.push('clear');state.routeType=null;state.routes=[];},
  setMessage:message=>actions.push(message)};
 vm.runInNewContext('let routePlanVersion=5;\n'+body+
  '\nthis.invalidate=invalidateDisplayedRoute;this.version=()=>routePlanVersion;',scope);
 assert.equal(scope.invalidate('排気量'),true);
 assert.deepEqual(state.via,['checkpoint']);
 assert.equal(btn.disabled,false);
 assert.equal(scope.version(),6);
 assert.ok(actions.includes('stop')&&actions.includes('clear')&&actions.includes('dismiss'));
 assert.equal(scope.invalidate('排気量'),false);
});
test('offline startup checks saved profile before display and explains a restored route is not newly calculated',()=>{
 assert.match(app,/const mismatch=storedRouteMismatch\(data,Number\(\$\('vehicle'\)\.value\),routingMode\(\),currentPreferences\(\)\)/);
 assert.match(app,/if\(mismatch\)\{\$\('offline-status'\)\.textContent=mismatch;setMessage\(mismatch,true\);return;\}/);
 assert.match(app,/新規計算ではありません/);
 assert.match(app,/if\(data\.type==='shimanami'&&Number\(data\.activeRoutingVehicle\?\?\$\('vehicle'\)\.value\)===2\)/);
 assert.match(app,/if\(state\.routeType==='shimanami'&&Number\(\$\('vehicle'\)\.value\)===2\)/);
 assert.match(app,/state\.shimanamiBigMode=keepBig/);
 const sw=read('sw.js');
 assert.match(sw,/bnavi-pc-pwa-20261124-shimanami-road-detour-v1/);
});
