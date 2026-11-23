'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('displacement and normal modes share top row; independent custom section follows',()=>{
 const html=read('index.html');
 const row=html.indexOf('<div class="fieldrow">'),panel=html.indexOf('<details id="route-tuning-panel"');
 assert.ok(row>0&&panel>row);
 const rowHtml=html.slice(row,panel);
 assert.match(rowHtml,/<select id="vehicle"/);
 assert.match(rowHtml,/<select id="mode" aria-label="走り方"/);
 assert.doesNotMatch(rowHtml,/<select id="mode" hidden/);
 assert.match(html,/<input id="tuning-enabled" type="checkbox">/);
});
test('base modes and additive preferences are passed to BRouter and kept through re-routing',()=>{
 const app=read('app.js');
 // Existing normal modes still pass through unchanged; both custom entry points use general BRF.
 assert.match(app,/function routingMode\(\)\{return customEnabled\?1:selectedBaseMode\(\)\}/);
 assert.match(app,/const MODES=\[\['ビギナー','一般','探索'\]/);
 assert.doesNotMatch(app,/customOption\.value='custom'/);
 assert.match(app,/state\.activeRoutingMode=routingMode\(\)/);
 assert.match(app,/BNaviPublicBrouter\.query\(points,\$\('vehicle'\)\.value,state\.activeRoutingMode/);
 assert.match(app,/state\.activeRoutingMode\?\?1,fetch,null,state\.activeRouteTuning/);
 assert.match(app,/\$\('mode'\)\.addEventListener\('change',\(\)=>\{chooseCustom\(false\);\}\)/);
 assert.match(app,/BNaviRouteTuning\.normalize\(\{preferences:p\}/);
 assert.match(app,/customEnabled\?tuningNow\(\):null/);
 assert.match(app,/routePreferences:currentPreferences\(\)/);
});
