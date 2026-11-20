'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const s=require('../place-search-core.js');
const records=[
 {name:'新日本造機',address:'日本、群馬県、高崎市',lat:36.34,lon:139.02,source:'Nominatim'},
 {name:'株式会社 東京タワー',address:'日本、東京都、港区、芝公園',lat:35.6586,lon:139.7454,source:'Nominatim'},
 {name:'東京タワー',address:'日本、北海道、札幌市',lat:43.06,lon:141.35,source:'Nominatim'},
 {name:'サンプル工業株式会社',address:'日本、広島県、広島市西区',lat:34.41,lon:132.43,source:'Nominatim'},
 {name:'サンプル工業',address:'日本、島根県、松江市',lat:35.47,lon:133.05,source:'Nominatim'}
];
test('地域つき入力を施設と地域に分ける',()=>{
 assert.deepEqual(s.parts('東京都 東京タワー').region,['東京都']);
 assert.equal(s.parts('広島市 サンプル工業').name,'サンプル工業');
 assert.equal(s.parts('東京タワー').name,'東京タワー');
});
test('指定地域と施設名が合う候補だけを返す',()=>{
 const a=s.rank(records,'東京都 東京タワー');
 assert.equal(a.length,1);assert.equal(a[0].lat,35.6586);
 const b=s.rank(records,'広島市 サンプル工業');
 assert.equal(b.length,1);assert.equal(b[0].lat,34.41);
});
test('無関係な社名や別地方の候補を返さない',()=>{
 assert.equal(s.rank(records,'広島市 まだ登録されていない会社').length,0);
 assert.equal(s.rank(records,'広島市 新日本造機').length,0);
 assert.equal(s.rank(records,'東京タワー').length,2);
});
test('Photon/Nominatim候補を共通の採用判定へ変換',()=>{
 const photon=s.fromPhoton({features:[{properties:{name:'サンプル工業',city:'広島市',state:'広島県'},geometry:{coordinates:[132.43,34.41]}}]});
 assert.equal(s.rank(photon,'広島市 サンプル工業').length,1);
 const nom=s.fromNominatim([{name:'東京タワー',lat:'35.6586',lon:'139.7454',display_name:'東京タワー, 東京都, 日本'}]);
 assert.equal(s.rank(nom,'東京都 東京タワー').length,1);
});
test('重複座標と不正座標を除去',()=>{
 const x=[records[1],{...records[1],source:'Photon'},{name:'東京タワー',address:'東京都',lat:100,lon:999}];
 assert.equal(s.rank(x,'東京都 東京タワー').length,1);
});
