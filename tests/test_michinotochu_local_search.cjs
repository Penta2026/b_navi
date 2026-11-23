'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
const search=require('../michinotochu-spot-search.js');
const data=JSON.parse(read('data/michinotochu_spots.json'));
const spots=data.spots;
test('MichinoTochu frozen 2.8.23 index contains only published/candidate spots with valid Japan coordinates',()=>{
 assert.equal(data.meta.source,'道の途中。');
 assert.equal(data.meta.sourceVersion,'PWA 1.5.43');
 assert.equal(data.meta.dbVersion,'2.8.23');
 assert.equal(spots.length,4983);
 assert.equal(spots.filter(x=>x.group==='道の駅').length,1234);
 assert.equal(spots.filter(x=>x.group==='定番スポット').length,1432);
 assert.equal(spots.filter(x=>x.group==='寄り道スポット').length,2316);
 assert.equal(spots.filter(x=>x.group==='ライダーズカフェ').length,1);
 for(const p of spots){
  assert.ok(search.pointOk(p),'invalid coordinate '+p.id);
  assert.ok(p.id&&p.name&&p.group,'missing name/group '+p.id);
  assert.ok(!('gacha' in p),'do not copy excluded audit state into public search index');
 }
 assert.ok(data.meta.filteredExcluded['除外（二輪アクセス不可）']>0);
 assert.ok(spots.some(x=>x.caution&&x.arrivalPointType));
});
test('local search is exact-first, Japanese locality-aware, and category-filtered',()=>{
 const all=search.rank(data,'三笠');
 assert.equal(all[0].name,'三笠');
 assert.ok(all.length>=2,'other names remain separate');
 const station=search.rank(data,'道の駅 三笠',{group:'road_station'});
 assert.equal(station.length,1);
 assert.equal(station[0].id,'RS0001');
 const landmark=search.rank(data,'宗谷岬',{group:'standard'});
 assert.equal(landmark[0].name,'宗谷岬');
 assert.equal(search.rank(data,'宗谷岬',{group:'road_station'}).length,0);
 const cafe=search.rank(data,'GOLDEN VALLEY',{group:'rider_cafe'});
 assert.equal(cafe.length,1);
 assert.equal(cafe[0].source,'道の途中。');
 assert.equal(cafe[0].municipality,'広島市安佐北区');
 assert.equal(search.rank(data,'宮城県 GOLDEN VALLEY').length,0);
 const locality=search.rank(data,'北海道 三笠',{group:'road_station'});
 assert.equal(locality[0].name,'三笠');
});
test('external search stays as independent source with duplicate removal only on same named location',()=>{
 const local=[{name:'宗谷岬',lat:45.5228,lon:141.936}];
 const remote=[{name:'宗谷岬',lat:45.5228,lon:141.936},
  {name:'宗谷岬',lat:34.52,lon:132.936},{name:'他の観光地',lat:45.5228,lon:141.936}];
 assert.equal(search.distinctExternal(local,remote).length,2);
 assert.equal(search.distinctExternal(local,[{name:'伽羅',lat:0,lon:0}]).length,0);
});
test('B_Navi uses the same search dialog; new results enter the old start/goal/via/favorites actions',()=>{
 const mobile=read('mobile-ui.js'),html=read('index.html'),sw=read('sw.js');
 assert.match(mobile,/searchRegistered\(q\)/);
 assert.match(mobile,/showGroupedResults\(localRows,/);
 assert.match(mobile,/showSearchResult\(row,el,kind\)/);
 assert.match(mobile,/kind==='michino'/);
 assert.match(mobile,/selectPlace\(row\.name,row\.lat\.toFixed\(6\)/);
 assert.match(mobile,/document\.querySelectorAll\('\[data-apply\]'\)/);
 assert.match(mobile,/rememberPlaceLabel\(picked\.coord,picked\.name\)/);
 assert.match(mobile,/searchOpenPoi/);
 assert.match(mobile,/searchPhoton/);
 assert.match(mobile,/searchNominatim/);
 assert.ok(html.includes('id="registered-category"'));
 assert.ok(html.includes('michinotochu-spot-search.js" defer'));
 for(const name of ['all','road_station','standard','detour','rider_cafe'])
  assert.ok(html.includes('value="'+name+'"'),'missing filter '+name);
 assert.ok(sw.includes("'./data/michinotochu_spots.json'"));
 assert.ok(sw.includes("'./michinotochu-spot-search.js'"));
});
