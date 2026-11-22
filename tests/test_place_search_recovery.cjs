'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../place-search-core.js');
const root=path.join(__dirname,'..');
const local=[
 {name:'珈琲専門店 ふじ',address:'広島県, 尾道市, 日本',lat:34.403,lon:133.193,osmKey:'amenity',osmValue:'cafe',source:'Photon'},
 {name:'ふじ珈琲',address:'広島県, 福山市, 日本',lat:34.48,lon:133.36,osmKey:'amenity',osmValue:'cafe',source:'Photon'},
 {name:'別の雑貨店',address:'広島県, 尾道市, 日本',lat:34.410,lon:133.194,osmKey:'shop',osmValue:'variety_store',source:'Photon'}
];
test('カテゴリで検索すると店名が「カフェ」でなくても実際のPOIタグから拾える',()=>{
 const results=core.rank(local,'尾道市 カフェ');
 assert.deepEqual(results.map(x=>x.name),['珈琲専門店 ふじ']);
 assert.equal(results[0].score,72);
});
test('別の市とカテゴリ違いは表示しない',()=>{
 assert.deepEqual(core.rank(local,'福山市 カフェ').map(x=>x.name),['ふじ珈琲']);
 assert.equal(core.rank(local,'尾道市 ガソリンスタンド').length,0);
});
test('PhotonとNominatimの施設種別を共通形式に変換',()=>{
 const ph=core.fromPhoton({features:[{properties:{name:'こもれび',city:'尾道市',state:'広島県',osm_key:'amenity',osm_value:'cafe'},geometry:{coordinates:[133.193,34.404]}}]});
 assert.equal(core.rank(ph,'尾道市 カフェ').length,1);
 const nom=core.fromNominatim([{name:'カフェ香',lat:'34.404',lon:'133.193',class:'amenity',type:'cafe',display_name:'カフェ香, 尾道市, 広島県'}]);
 assert.equal(nom[0].osmKey,'amenity');assert.equal(core.rank(nom,'尾道市 カフェ').length,1);
});
test('関連候補は同じ地域にあり、名称も部分的に関連するものだけ',()=>{
 const candidates=[
  {name:'尾道中央図書館',address:'尾道市',lat:34.40,lon:133.19,osmKey:'amenity',osmValue:'library'},
  {name:'広島県立図書館',address:'広島市',lat:34.40,lon:132.46,osmKey:'amenity',osmValue:'library'},
  {name:'尾道港',address:'尾道市',lat:34.41,lon:133.18,osmKey:'place',osmValue:'locality'},
  {name:'別の病院',address:'尾道市',lat:34.42,lon:133.17,osmKey:'amenity',osmValue:'hospital'}
 ];
 const q='尾道市 尾道図書館';
 assert.equal(core.rank(candidates,q).length,0);
 assert.deepEqual(core.related(candidates,q).map(x=>x.name),['尾道中央図書館']);
 assert.deepEqual(core.related(candidates,'尾道市 まだ登録されていない会社').map(x=>x.name),[]);
});
test('完全一致の名前はカテゴリより高優先',()=>{
 const items=[...local,{name:'カフェ',address:'尾道市',lat:34.401,lon:133.191,osmKey:'amenity',osmValue:'cafe'}];
 assert.equal(core.rank(items,'尾道市 カフェ')[0].name,'カフェ');
});
test('画面はPhoton/Nominatimを状況に応じて併用し、検索不能を誤って「未登録」と表示しない',()=>{
 const ui=fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8');
 assert.match(ui,/searchCore\.related\(candidates,q,results\)/);
 assert.match(ui,/searchCore\.category\(q\)/);
 assert.match(ui,/施設検索サービスに接続できませんでした/);
 assert.match(ui,/関連候補/);
 assert.match(ui,/検索結果/);
});
