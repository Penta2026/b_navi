'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const app=read('app.js'),html=read('index.html');
const a=app.indexOf('async function swapEndpointsAndClearVias(){'),b=app.indexOf('function hasRoutePlan(){',a);
assert.ok(a>=0&&b>a,'swap handler must be present');
const handler=app.slice(a,b);
function harness({start='34.4,133.2',goal='34.0,133.0',via=['34.2,133.1','34.1,133.02'],active=false,free=false,fail=false,empty=false}={}){
 const log=[],fields={
  start:{value:empty?'':start},goal:{value:empty?'':goal},
  calculate:{disabled:false},'swap-endpoints':{disabled:false},'offline-status':{textContent:''}
 },state={via:[...via],routeType:'normal',routes:[{type:'road'}],navActive:active};
 const ctx={$:id=>fields[id],state,
  freeRideInProgress:()=>free,
  setMessage:(msg,error)=>log.push(['message',msg,!!error]),
  settleBigDecision:()=>log.push(['dismiss']),
  clearTimeout:id=>log.push(['cancel-timer',id]),
  stopVoiceGuidance:stop=>{log.push(['stop-voice',stop]);state.navActive=false;},
  clearResult:()=>{log.push(['clearResult']);state.routeType=null;state.routes=[];},
  renderVia:()=>log.push(['renderVia',state.via.length]),
  updatePointSummaries:()=>log.push(['summaries']),
  setPick:p=>log.push(['pick',p]),
  refreshMap:()=>log.push(['refreshMap']),
  fitMarkers:()=>log.push(['fitMarkers']),
  persist:()=>log.push(['persist',fields.start.value,fields.goal.value,[...state.via]]),
  BNaviOfflineRouteStore:{clear:async()=>{log.push(['clear-autosave']);if(fail)throw Error('db busy');}}
 };
 vm.runInNewContext('let routePlanVersion=8;let offlineSaveTimer=246;\n'+handler+'\nthis.swap=swapEndpointsAndClearVias;this.version=()=>routePlanVersion;',ctx);
 return {ctx,fields,state,log};
}
test('visible route exchange sits between start and goal, with a clear waypoints warning',()=>{
 const atStart=html.indexOf('id="start-summary"'),atSwap=html.indexOf('id="swap-endpoints"'),atGoal=html.indexOf('id="goal-summary"');
 assert.ok(atStart<atSwap&&atSwap<atGoal);
 assert.equal((html.match(/id="swap-endpoints"/g)||[]).length,1);
 assert.match(html,/aria-label="出発地と目的地を交換し、経由地をすべてクリア"/);
 assert.match(app,/\$\('swap-endpoints'\)\.addEventListener\('click'/);
 const mobile=read('mobile-ui.js');
 // Both source files are loaded by the browser; swap must be owned by app.js alone.
 assert.doesNotMatch(mobile,/\$\('swap-endpoints'\)\.onclick\s*=/);
 assert.doesNotMatch(mobile,/\$\('swap-endpoints'\)\.addEventListener\(/);
 assert.equal((app.match(/\$\('swap-endpoints'\)\.addEventListener\('click'/g)||[]).length,1);
 assert.match(read('sw.js'),/bnavi-pc-pwa-20261124-swap-handler-once-v2/);
});
test('one click exchanges only start and goal, clears all vias, invalidates route and preserves choice settings',async()=>{
 const h=harness({active:true});
 assert.equal(await h.ctx.swap(),true);
 assert.equal(h.fields.start.value,'34.0,133.0');
 assert.equal(h.fields.goal.value,'34.4,133.2');
 assert.equal(h.state.via.length,0);
 assert.equal(h.state.routes.length,0);
 assert.equal(h.fields.calculate.disabled,false);
 assert.equal(h.fields['swap-endpoints'].disabled,false);
 assert.equal(h.ctx.version(),9);
 assert.ok(h.log.some(x=>x[0]==='renderVia'&&x[1]===0));
 assert.ok(h.log.some(x=>x[0]==='stop-voice'&&x[1]===true));
 assert.ok(h.log.some(x=>x[0]==='cancel-timer'&&x[1]===246));
 assert.ok(h.log.some(x=>x[0]==='clear-autosave'));
 assert.ok(h.log.some(x=>x[0]==='persist'&&x[1]==='34.0,133.0'&&x[2]==='34.4,133.2'&&x[3].length===0));
 assert.match(h.log.at(-1)[1],/ルート検索/);
});
test('reversing twice restores start/goal but never resurrects waypoints',async()=>{
 const h=harness();
 await h.ctx.swap();await h.ctx.swap();
 assert.equal(h.fields.start.value,'34.4,133.2');
 assert.equal(h.fields.goal.value,'34.0,133.0');
 assert.equal(h.state.via.length,0);
});
test('missing endpoints and active free ride do not alter any fields',async()=>{
 for(const options of [{empty:true},{free:true}]){
  const h=harness(options),before=h.fields.start.value;
  assert.equal(await h.ctx.swap(),false);
  assert.equal(h.fields.start.value,before);
  assert.equal(h.state.via.length,2);
  assert.equal(h.log.filter(x=>x[0]==='persist').length,0);
 }
});
test('failure removing temporary autosave is reported and does not roll back swapped points',async()=>{
 const h=harness({fail:true});
 assert.equal(await h.ctx.swap(),true);
 assert.equal(h.fields.start.value,'34.0,133.0');
 assert.equal(h.state.via.length,0);
 assert.equal(h.fields.calculate.disabled,false);
 assert.ok(h.log.some(x=>x[0]==='message'&&x[2]===true&&x[1].includes('db busy')));
});
test('swap never calls a route computation or touches the named My Route collection',()=>{
 assert.doesNotMatch(handler,/calculatePublicRoute\(|calculateBigShimanami\(|BNaviMyRouteLibrary\./);
 assert.match(handler,/state\.via=\[\]/);
 assert.match(handler,/await BNaviOfflineRouteStore\.clear\(\)/);
});
