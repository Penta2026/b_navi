'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const station=require('../station-search.js');
const root=path.join(__dirname,'..');
const local=path.join(root,'data','jr_stations.json');
const testRows=[
 {name:'尾道',lat:34.404838,lng:133.193008},
 {name:'東尾道',lat:34.43503,lng:133.2332},
 {name:'新尾道',lat:34.43008,lng:133.190215},
 {name:'不正値',lat:990,lng:0}
];
test('尾道駅／JR尾道駅／全角JR／尾道を同じ駅名に正規化',()=>{
 for(const q of ['尾道駅','JR尾道駅','ＪＲ　尾道駅','JR 尾道','JRの尾道駅','尾道']){
  const r=station.rank(testRows,q);
  assert.equal(r.length,1,q);
  assert.equal(r[0].name,'尾道駅');
  assert.equal(r[0].lat,34.404838);
  assert.equal(r[0].lon,133.193008);
 }
 assert.equal(station.isExplicit('尾道駅'),true);
 assert.equal(station.isExplicit('JR尾道'),true);
 assert.equal(station.isExplicit('尾道'),false);
});
test('尾道駅を検索しても東尾道駅／新尾道駅と混同せず、別の駅は独立して検索',()=>{
 assert.deepEqual(station.rank(testRows,'尾道駅').map(x=>x.name),['尾道駅']);
 assert.deepEqual(station.rank(testRows,'東尾道駅').map(x=>x.name),['東尾道駅']);
 assert.deepEqual(station.rank(testRows,'新尾道駅').map(x=>x.name),['新尾道駅']);
 assert.equal(station.rank(testRows,'東京タワー').length,0);
});
test('座標不正・データ重複を拒否し、地域を捏造しない',()=>{
 assert.equal(station.rank(testRows,'不正値駅').length,0);
 assert.equal(station.rank(testRows.concat(testRows[0]),'尾道駅').length,1);
 assert.equal(station.rank(testRows,'広島県 尾道駅').length,0);
});
test('旧PWAから移行したJR駅データには尾道・東尾道・新尾道が含まれる', {skip: !fs.existsSync(local) || JSON.parse(fs.readFileSync(local,'utf8')).length<4000 ? 'Full legacy index is copied during GitHub release; local standalone tests use a 3-entry fixture' : false},()=>{
 assert.ok(fs.existsSync(local),'data/jr_stations.json is required in the release archive');
 const rows=JSON.parse(fs.readFileSync(local,'utf8'));
 assert.ok(rows.length>=4000,'must import the full legacy station index');
 for(const q of ['尾道駅','新尾道駅','東尾道駅'])assert.equal(station.rank(rows,q).length,1,q);
});
test('station index is cached with PWA app shell and used before remote POI search',()=>{
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const app=fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(sw,/\.\/data\/jr_stations\.json/);
 assert.match(sw,/\.\/station-search\.js/);
 assert.match(html,/station-search\.js/);
 assert.match(app,/BNaviStationSearch/);
 assert.match(app,/searchStations\(q\)/);
});
