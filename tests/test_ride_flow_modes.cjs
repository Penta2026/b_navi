'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const src=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');

test('pre-navigation ride panel offers free ride only; radar returns to voice guidance',()=>{
 const html=src('index.html');
 const ride=html.slice(html.indexOf('<div id="ride-panel"'),html.indexOf('<dialog id="next-destination-dialog"'));
 assert.match(ride,/id="ride-free"/);
 assert.doesNotMatch(ride,/id="ride-radar"/);
 assert.match(ride,/id="radar-exit"[^>]*>🔈 音声案内へ戻る/);
 assert.match(html,/id="nav-radar-toggle"[^>]*hidden>📡/);
 assert.match(ride,/id="ride-stop"[^>]*>終了・GPX保存へ/);
});
test('free ride end exposes the original GPX save panel, while nav radar shares GPS without recording own ride',()=>{
 const ride=src('ride-radar.js'),mobile=src('mobile-ui.js'),app=src('app.js');
 assert.match(ride,/if\(which!=='free'\)return;/);
 assert.doesNotMatch(ride,/start\('radar'\)/);
 assert.match(ride,/const wasFree=mode==='free';/);
 assert.match(ride,/if\(wasFree\)window\.BNaviTrack\?\.stop\(\);/);
 assert.match(ride,/if\(wasFree&&!silent\)/);
 assert.match(ride,/window\.BNaviShowRecordedTrackActions\?\.\(\)/);
 assert.match(mobile,/window\.BNaviShowRecordedTrackActions=\(\)=>/);
 assert.match(mobile,/toggleSheet\(true\)/);
 assert.match(ride,/mode='nav-radar'/);
 assert.match(ride,/if\(mode!=='nav-radar'\|\|!at\|\|state\.navPaused/);
 assert.match(app,/\$\('nav-radar-toggle'\)\.hidden=!state\.navActive/);
 assert.match(ride,/if\(!visible&&mode==='free'\)/);
 assert.match(ride,/if\(mode==='nav-radar'\)\$\('radar-readout'\)\.textContent=s/);
});
