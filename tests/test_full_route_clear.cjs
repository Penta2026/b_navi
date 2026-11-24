'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const js=read('app.js');
const from=js.indexOf('function freeRideInProgress(){');
const to=js.indexOf("const API_CONFIG_KEY=",from);
assert.ok(from>0&&to>from,'PWA route clear handlers must be present');
const clearFns=js.slice(from,to);

function harness({freeRide=false,active=false,hasPlan=true,clearError=null}={}){
 const events=[],handlers={},fields={
  start:{value:hasPlan?'34.41,133.2':''},goal:{value:hasPlan?'34.07,133.0':''},
  calculate:{disabled:false},'offline-status':{textContent:''},
  vehicle:{value:'1'},mode:{value:'2'},
  'route-clear-confirm-description':{textContent:''}
 };
 const dialog={open:false,
  showModal(){this.open=true;events.push(['dialog.showModal'])},
  close(){this.open=false;events.push(['dialog.close'])}};
 fields['route-clear-confirm-dialog']=dialog;
 for(const id of ['clear-route-plan','route-clear-dialog-cancel','route-clear-dialog-confirm']){
  fields[id]={addEventListener:(type,fn)=>{handlers[id+':'+type]=fn}};
 }
 const state={via:hasPlan?['34.30,133.10']:[],routes:hasPlan?[{type:'road'}]:[],
  routeType:hasPlan?'shimanami':null,navActive:active,activeTargets:[[1,2]],
  targetIndex:1,lastInputHash:'old-value',activeRouteTuning:'something',customRouting:true};
 const ctx={
  state,$:id=>fields[id],
  window:{BNaviRideMode:{getMode:()=>freeRide?'free':'off'},
   confirm(){throw Error('Browser confirm must not be called inside installed PWA')}},
  document:{body:{classList:{contains:key=>key==='free-ride-active'&&freeRide}}},
  setMessage:(msg,error=false)=>events.push(['message',msg,error]),
  clearTimeout:id=>events.push(['clearTimeout',id]),
  stopVoiceGuidance:flag=>{events.push(['stopVoiceGuidance',flag]);state.navActive=false},
  clearResult:()=>{events.push(['clearResult']);state.routes=[];state.routeType=null},
  renderVia:()=>events.push(['renderVia']),
  updatePointSummaries:()=>events.push(['updatePointSummaries']),
  setPick:val=>events.push(['setPick',val]),
  refreshMap:()=>events.push(['refreshMap']),
  persist:()=>events.push(['persist',fields.start.value,fields.goal.value,state.via.length]),
  BNaviOfflineRouteStore:{clear:async()=>{events.push(['offlineStore.clear']);if(clearError)throw Error(clearError)}}
 };
 vm.createContext(ctx);
 vm.runInContext("let routePlanVersion=7;let offlineSaveTimer=123;\n"+clearFns+
  "\nthis.bindClear=bindFullRouteClear;this.currentVersion=()=>routePlanVersion;",ctx);
 ctx.bindClear();
 const click=id=>{const fn=handlers[id+':click'];assert.equal(typeof fn,'function','missing listener '+id);fn()};
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 return {ctx,fields,state,dialog,events,tick,
  clickClear:()=>click('clear-route-plan'),
  clickCancel:()=>click('route-clear-dialog-cancel'),
  clickConfirm:()=>click('route-clear-dialog-confirm')};
}
test('route-clear button remains beside search, opens explicit accessible app modal',()=>{
 const html=read('index.html'),css=read('style.css');
 assert.match(html,/<div class="actionrow route-quick"><button id="calculate"[^>]*>ルート検索<\/button><button id="clear-route-plan"[^>]*>↺ ルートクリア<\/button>/);
 assert.match(html,/id="clear-route" class="secondary" type="button">結果だけクリア<\/button>/);
 assert.match(html,/<dialog id="route-clear-confirm-dialog"[^>]*aria-labelledby="route-clear-confirm-title"[^>]*aria-describedby="route-clear-confirm-description"/);
 assert.match(html,/id="route-clear-dialog-cancel" class="secondary">キャンセル/);
 assert.match(html,/id="route-clear-dialog-confirm" class="route-clear-confirm-accept">クリアする/);
 assert.match(html,/保存済みのマイルート、走行記録、地図データは消えません/);
 assert.match(css,/\.route-quick\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
 assert.match(css,/\.route-clear-confirm-dialog\{box-sizing:border-box/);
 assert.match(js,/bindFullRouteClear\(\);/);
 assert.doesNotMatch(clearFns,/window\.confirm\(/);
});
test('real button click -> dialog -> confirm clears input, routes and autosaved last route',async()=>{
 const h=harness();
 h.clickClear();
 assert.equal(h.dialog.open,true,'clear button should open a visible app dialog');
 assert.equal(h.fields.start.value,'34.41,133.2','dialog itself must not remove points');
 assert.match(h.fields['route-clear-confirm-description'].textContent,/出発地・目的地・経由地/);
 h.clickConfirm();
 await h.tick();
 assert.equal(h.dialog.open,false);
 assert.equal(h.fields.start.value,'');assert.equal(h.fields.goal.value,'');
 assert.equal(h.state.via.length,0);assert.equal(h.state.routes.length,0);
 assert.equal(h.state.routeType,null);assert.equal(h.state.activeTargets.length,0);
 assert.equal(h.state.targetIndex,0);assert.equal(h.state.lastInputHash,'');
 assert.equal(h.fields.mode.value,'2');assert.equal(h.fields.vehicle.value,'1');
 assert.equal(h.fields.calculate.disabled,false);assert.equal(h.ctx.currentVersion(),8);
 assert.ok(h.events.some(x=>x[0]==='offlineStore.clear'));
 assert.ok(h.events.some(x=>x[0]==='persist'&&x[1]===''&&x[2]===''&&x[3]===0));
 assert.ok(h.events.some(x=>x[0]==='setPick'&&x[1]==='start'));
 assert.ok(h.events.some(x=>x[0]==='clearTimeout'&&x[1]===123));
 assert.ok(!clearFns.includes('BNaviMyRouteLibrary.delete'));
});
test('cancel from dialog does not clear or persist changes',async()=>{
 const h=harness();h.clickClear();assert.equal(h.dialog.open,true);
 h.clickCancel();await h.tick();
 assert.equal(h.dialog.open,false);assert.equal(h.fields.start.value,'34.41,133.2');
 assert.equal(h.state.via.length,1);assert.equal(h.state.routes.length,1);
 assert.equal(h.ctx.currentVersion(),7);
 assert.ok(!h.events.some(x=>x[0]==='offlineStore.clear'||x[0]==='clearResult'));
});
test('navigation mode warns before clearing and stops GPS/voice after confirmation',async()=>{
 const h=harness({active:true});h.clickClear();
 assert.match(h.fields['route-clear-confirm-description'].textContent,/音声案内とGPS追従を終了/);
 assert.equal(h.state.navActive,true,'opening confirmation may not stop guidance');
 h.clickConfirm();await h.tick();
 assert.ok(h.events.some(x=>x[0]==='stopVoiceGuidance'&&x[1]===true));
 assert.equal(h.state.navActive,false);
});
test('active free ride is preserved, and pressing clear on empty route gives feedback',async()=>{
 const h=harness({freeRide:true});h.clickClear();
 assert.equal(h.dialog.open,false);
 assert.match(h.events.find(x=>x[0]==='message')[1],/フリー走行中/);
 assert.ok(!h.events.some(x=>x[0]==='clearResult'));
 const empty=harness({hasPlan:false});empty.clickClear();
 assert.equal(empty.dialog.open,false);
 assert.match(empty.events.find(x=>x[0]==='message')[1],/まだない/);
});
test('error while deleting autosave still clears screen and reports error',async()=>{
 const h=harness({clearError:'quota'});h.clickClear();h.clickConfirm();await h.tick();
 assert.equal(h.fields.start.value,'');
 assert.match(h.fields['offline-status'].textContent,/一時保存ルートを消せませんでした：quota/);
 assert.ok(h.events.some(x=>x[0]==='message'&&x[2]===true));
});
test('stale route calculation and startup restore are guarded after clearing',()=>{
 assert.match(js,/async function calculate\(\)\{const version=\+\+routePlanVersion;/);
 assert.match(js,/if\(version!==routePlanVersion\)return;\s*routeView\('shimanami'/);
 assert.match(js,/if\(version!==routePlanVersion\)return;\s*const mime=response/);
 assert.match(js,/if\(version===routePlanVersion\)btn.disabled=false/);
 assert.match(js,/async function restoreOfflineRoute\(\)\{const version=routePlanVersion;/);
 assert.match(js,/const data=await BNaviOfflineRouteStore.load\(\);if\(version!==routePlanVersion\)return/);
 assert.match(js,/if\(offlineSaveTimer!==null\)\{clearTimeout\(offlineSaveTimer\);offlineSaveTimer=null;\}/);
});
test('clear deletes only temporary last-route and serializes earlier autosave writes',()=>{
 const store=read('offline-route-store.js');
 assert.match(store,/const DB='bnavi-offline-routes-v1',KEY='last-route'/);
 assert.match(store,/tx\.objectStore\('routes'\)\.delete\(KEY\)/);
 assert.match(store,/let writeChain=Promise.resolve\(\)/);
 assert.match(store,/clear:\(\)=>enqueueWrite\(remove\)/);
 const sw=read('sw.js');
 assert.match(sw,/bnavi-pc-pwa-20261124-route-clear-dialog-v2/);
 assert.match(sw,/'\.\/offline-route-store.js'/);
});
