'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('app.js');
const from=js.indexOf('async function clearFullRoutePlan(){');
const to=js.indexOf("const API_CONFIG_KEY=",from);
assert.ok(from>0&&to>from,'full plan reset function must be present');
const clearFn=js.slice(from,to);

function harness({confirm=true,freeRide=false,active=false,hasPlan=true,clearError=null}={}){
 const events=[],fields={
  start:{value:hasPlan?'34.41,133.2':''},goal:{value:hasPlan?'34.07,133.0':''},
  calculate:{disabled:false},'offline-status':{textContent:''},
  vehicle:{value:'1'},mode:{value:'2'}
 };
 const state={via:hasPlan?['34.30,133.10']:[],routes:hasPlan?[{type:'road'}]:[],
  routeType:hasPlan?'shimanami':null,navActive:active,activeTargets:[[1,2]],
  targetIndex:1,lastInputHash:'old-value',activeRouteTuning:'something',customRouting:true};
 let approve=confirm;
 const ctx={
  state,$:id=>fields[id],window:{
   BNaviRideMode:{isActive:()=>freeRide},
   confirm:msg=>{events.push(['confirm',msg]);return approve}
  },offlineSaveTimer:123, // referenced as lexical variable below
  setMessage:(msg,error=false)=>events.push(['message',msg,error]),
  clearTimeout:id=>events.push(['clearTimeout',id]),
  stopVoiceGuidance:flag=>{events.push(['stopVoiceGuidance',flag]);state.navActive=false},
  clearResult:()=>{events.push(['clearResult']);state.routes=[];state.routeType=null},
  renderVia:()=>events.push(['renderVia']),
  updatePointSummaries:()=>events.push(['updatePointSummaries']),
  setPick:val=>events.push(['setPick',val]),
  refreshMap:()=>events.push(['refreshMap']),
  persist:()=>events.push(['persist',fields.start.value,fields.goal.value,state.via.length]),
  BNaviOfflineRouteStore:{
   clear:async()=>{events.push(['offlineStore.clear']);if(clearError)throw Error(clearError);}
  }
 };
 vm.createContext(ctx);
 vm.runInContext("let routePlanVersion=7;let offlineSaveTimer=123;\n"+clearFn+
  "\nthis.runClear=clearFullRoutePlan;this.currentVersion=()=>routePlanVersion;",ctx);
 return {ctx,fields,state,events,setConfirm:x=>approve=x};
}
test('the visible route-clear button sits beside route search and retains result-only clear separately',()=>{
 const html=read('index.html'),css=read('style.css');
 assert.match(html,/<div class="actionrow route-quick"><button id="calculate"[^>]*>ルート検索<\/button><button id="clear-route-plan"[^>]*>↺ ルートクリア<\/button>/);
 assert.match(html,/id="clear-route" class="secondary" type="button">結果だけクリア<\/button>/);
 assert.match(css,/\.route-quick\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/\.route-quick \.route-plan-clear:focus-visible/);
 assert.ok(js.includes("$('clear-route-plan').addEventListener('click',clearFullRoutePlan)"));
});
test('accepted full reset wipes route inputs/result and autosave while preserving mode and named routes',async()=>{
 const h=harness();await h.ctx.runClear();
 assert.equal(h.fields.start.value,'');assert.equal(h.fields.goal.value,'');
 assert.equal(h.state.via.length,0);
 assert.equal(h.state.routes.length,0);assert.equal(h.state.routeType,null);
 assert.deepEqual(h.state.activeTargets,[]);
 assert.equal(h.state.targetIndex,0);assert.equal(h.state.lastInputHash,'');
 assert.equal(h.fields.mode.value,'2');assert.equal(h.fields.vehicle.value,'1');
 assert.equal(h.fields.calculate.disabled,false);
 assert.equal(h.ctx.currentVersion(),8);
 assert.ok(h.events.some(x=>x[0]==='offlineStore.clear'));
 assert.ok(h.events.some(x=>x[0]==='persist'&&x[1]===''&&x[2]===''&&x[3]===0));
 assert.ok(h.events.some(x=>x[0]==='setPick'&&x[1]==='start'));
 assert.ok(h.events.some(x=>x[0]==='clearTimeout'&&x[1]===123));
 const warning=h.events.find(x=>x[0]==='confirm')[1];
 assert.match(warning,/出発地・目的地・経由地と現在のルート/);
 assert.match(warning,/保存済みのマイルート・走行記録・走り方設定は消えません/);
 assert.ok(!js.slice(from,to).includes('BNaviMyRouteLibrary.delete'));
});
test('cancelling confirmation does not erase a single point or saved route',async()=>{
 const h=harness({confirm:false});await h.ctx.runClear();
 assert.equal(h.fields.start.value,'34.41,133.2');
 assert.equal(h.state.via.length,1);assert.equal(h.state.routes.length,1);
 assert.equal(h.ctx.currentVersion(),7);
 assert.ok(!h.events.some(x=>x[0]==='offlineStore.clear'||x[0]==='clearResult'));
});
test('during turn guidance, confirmation is explicit and GPS guidance is stopped',async()=>{
 const h=harness({active:true});await h.ctx.runClear();
 assert.match(h.events.find(x=>x[0]==='confirm')[1],/音声案内を終了/);
 assert.ok(h.events.some(x=>x[0]==='stopVoiceGuidance'&&x[1]===true));
 assert.equal(h.state.navActive,false);
});
test('an active free-ride recording is not interrupted and an empty plan needs no confirmation',async()=>{
 const ride=harness({freeRide:true});
 await ride.ctx.runClear();
 assert.ok(!ride.events.some(x=>x[0]==='confirm'||x[0]==='clearResult'));
 assert.match(ride.events.find(x=>x[0]==='message')[1],/フリー走行中/);
 const empty=harness({hasPlan:false});await empty.ctx.runClear();
 assert.ok(!empty.events.some(x=>x[0]==='confirm'||x[0]==='offlineStore.clear'));
 assert.match(empty.events.find(x=>x[0]==='message')[1],/まだない/);
});
test('deleting the device auto-restore route reports failure without erasing the visible reset',async()=>{
 const h=harness({clearError:'quota'});await h.ctx.runClear();
 assert.equal(h.fields.start.value,'');
 assert.match(h.fields['offline-status'].textContent,/一時保存ルートを消せませんでした：quota/);
 assert.ok(h.events.some(x=>x[0]==='message'&&x[2]===true));
});
test('stale async route calculations and the startup auto-restore cannot repopulate a cleared plan',()=>{
 assert.match(js,/async function calculate\(\)\{const version=\+\+routePlanVersion;/);
 assert.match(js,/if\(version!==routePlanVersion\)return;\s*routeView\('shimanami'/);
 assert.match(js,/if\(version!==routePlanVersion\)return;\s*const mime=response/);
 assert.match(js,/if\(version===routePlanVersion\)btn.disabled=false/);
 assert.match(js,/async function restoreOfflineRoute\(\)\{const version=routePlanVersion;/);
 assert.match(js,/const data=await BNaviOfflineRouteStore.load\(\);if\(version!==routePlanVersion\)return/);
 assert.match(js,/if\(offlineSaveTimer!==null\)\{clearTimeout\(offlineSaveTimer\);offlineSaveTimer=null;\}/);
});
test('the clear store removes only last-route and serializes against earlier autosave writes',()=>{
 const store=read('offline-route-store.js');
 assert.match(store,/const DB='bnavi-offline-routes-v1',KEY='last-route'/);
 assert.match(store,/tx\.objectStore\('routes'\)\.delete\(KEY\)/);
 assert.match(store,/let writeChain=Promise.resolve\(\)/);
 assert.match(store,/clear:\(\)=>enqueueWrite\(remove\)/);
 assert.match(store,/save:async data=>/);
 const sw=read('sw.js');
 assert.match(sw,/bnavi-pc-pwa-20261124-full-route-clear-v1/);
 assert.match(sw,/'\.\/offline-route-store.js'/);
});
