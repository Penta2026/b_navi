const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const heading=require('../navigation-heading.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('course arrow rotates relative to north and heading-up map',()=>{
 assert.equal(heading.mapBearing('north',100),0);
 assert.equal(heading.mapBearing('head',90),-90);
 assert.equal(heading.mapBearing('head',270),-270);
 assert.equal(heading.wrap(-10),350);
 assert.equal(heading.difference(355,5),10);
 assert.equal(heading.difference(5,355),-10);
});
test('only reliable moving GPS bearings update, stationary holds previous heading',()=>{
 let a=heading.acceptFix({heading:null,at:-Infinity},{heading:120,speed:3,accuracy:5},3000);
 assert.equal(a.heading,120);assert.equal(a.accepted,true);
 a=heading.acceptFix(a,{heading:200,speed:0,accuracy:5},5000);
 assert.equal(a.heading,120);assert.equal(a.accepted,false);
 a=heading.acceptFix(a,{heading:140,speed:3,accuracy:60},6000);
 assert.equal(a.heading,120);assert.equal(a.accepted,false);
 a=heading.acceptFix(a,{heading:132,speed:3,accuracy:5},6200);
 assert.equal(a.heading,132);assert.equal(a.accepted,true);
 a=heading.acceptFix(a,{heading:190,speed:3,accuracy:5},6600);
 assert.equal(a.heading,132);assert.equal(a.accepted,false);
 a=heading.acceptFix(a,{heading:null,speed:null,accuracy:5},9000);
 assert.equal(a.heading,132);assert.equal(a.accepted,false);
});
test('offline voice is started only by user action and GPS update cannot talk with guidance off',()=>{
 const app=read('app.js'),ui=read('index.html'),sw=read('sw.js');
 assert.match(app,/function startVoiceGuidance\(\)/);
 assert.match(app,/speak\(hasHints\?\s*'音声案内を開始します。'/);
 assert.match(app,/\(state\.navActive\|\|demo\)/);
 assert.match(app,/state\.navActive&&goodFix/);
 assert.match(ui,/id="nav-start-quick"/);
 assert.match(ui,/id="voice-test"/);
 assert.match(ui,/id="orientation-toggle"/);
 assert.match(sw,/navigation-heading\.js/);
});
test('red GPS course arrow rotates inside map and touch rotation disables head-up auto',()=>{
 const map=read('map-core.js'),app=read('app.js');
 assert.match(map,/fill:'#e33b32'/);
 assert.match(map,/this\.gpsHeading/);
 assert.match(map,/onManualRotate/);
 assert.match(app,/state\.orientation='manual'/);
 assert.match(app,/updateHeadingFromPosition\(pos\)/);
});
