'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('tester-facing app descriptions do not presume knowledge of previous navigator',()=>{
 const html=read('index.html');
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.match(html,/保存した地図は、この端末のアプリ専用領域に保管されるよ/);
 assert.doesNotMatch(html,/旧BikeNavigator|旧バイクナビゲータ|旧PWA|前作/);
 assert.match(manifest.description,/B_Navi バイク向けルート検索/);
 assert.doesNotMatch(manifest.description,/旧|継承|Android版|前作|以前/);
});
test('map download uses standalone B_Navi wording, while OPFS compatibility is untouched',()=>{
 const download=read('offline-map-download.mjs');
 const layer=read('offline-map-layer.mjs');
 assert.match(download,/地図はこの端末内のアプリ専用領域に保存されます/);
 assert.doesNotMatch(download,/旧BikeNavigatorと同じ/);
 assert.match(download,/getDirectoryHandle\('BikeNavigator',\{create:true\}\)/);
 assert.match(layer,/getDirectoryHandle\('BikeNavigator'\)/);
 assert.match(download,/MAP_DELIVERY_BASE='https:\/\/bikenavigator-map-relay/);
});
test('routing labels, failures, and bridge diagnostics avoid old-generation terminology',()=>{
 const app=read('app.js');
 const shimanami=read('shimanami-web-router.js');
 const approaches=read('android-approaches.js');
 assert.match(app,/label:'BRouterで計算した道路ルート'/);
 assert.match(app,/経路計算プログラムを読み込めません/);
 assert.match(app,/保存済みの詳細ルート調整は、現在の経路サーバーに対応していません/);
 assert.doesNotMatch(app,/旧PWAのBRouter|公開BRouter・旧PWA方式|旧カスタム調整|旧設定を復元中/);
 assert.doesNotMatch(shimanami,/Androidの6橋データ|Android確認済みの橋形状/);
 assert.doesNotMatch(approaches,/Android入口出口の距離|Android橋形状データのスキーマ|Android原本の方向別|Android role不一致/);
 assert.match(shimanami,/橋の参考線を道路経路に接続できません/);
});
test('PWA shell changes version without removing existing application modules',()=>{
 const sw=read('sw.js');
 assert.match(sw,/const CACHE='bnavi-pc-pwa-20261124-map-point-menu-cleanup-v1'/);
 for(const file of ['offline-map-download.mjs','offline-map-layer.mjs','michinotochu-spot-search.js','public-brouter-client.js'])
  assert.ok(sw.includes("'./"+file+"'"),file);
});
