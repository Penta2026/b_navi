const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('GPX routepoint itinerary is interpreted as ordered S/V/G, not straight road track',()=>{
 const core=read('gpx-itinerary-core.js'),transfer=read('gpx-transfer.js');
 assert.match(core,/BNAV-ITINERARY-1/);
 assert.match(core,/via:points\.slice\(1,-1\)/);
 assert.match(transfer,/const itinerary=BNaviGpxItinerary\.parse\(doc\)/);
 assert.match(transfer,/state\.via=itinerary\.via\.map\(coords\)/);
 assert.match(transfer,/await calculateImportedItinerary\(\)/);
});
test('GPX named stops render and keep retry option; true tracks remain separate',()=>{
 const ui=read('index.html'),sw=read('sw.js');
 assert.match(ui,/id="gpx-itinerary-list"/);
 assert.match(ui,/id="gpx-itinerary-calculate"/);
 assert.ok(ui.indexOf('src="./gpx-itinerary-core.js"')<ui.indexOf('src="./gpx-transfer.js"'));
 assert.match(sw,/'.\/gpx-itinerary-core\.js'/);
 assert.match(read('gpx-transfer.js'),/if\(trks\.length\)/);
});
test('BRouter initial and reroute result is checked for bypassed intermediate stops',()=>{
 const app=read('app.js');
 assert.match(app,/経由地.*通る道路経路が取得できません/);
 assert.match(app,/リルートで経由地を通れません/);
 assert.match(app,/distanceToPolyline\(p,result\.track\.points\)/);
 assert.match(app,/distanceToPolyline\(p,r\.track\.points\)/);
});
