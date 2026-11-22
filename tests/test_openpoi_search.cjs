'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../openpoi-search.js');
test('OpenPOI uses HTTPS correct API endpoint and two-word AND suggestions',()=>{
 const a=new URL(api.makeURL('尾道市 カフェ','suggest',25));
 assert.equal(a.origin,'https://api.openpoiapi.com');assert.equal(a.pathname,'/v1/suggest');
 assert.equal(a.searchParams.get('q'),'尾道市 カフェ');
 assert.equal(a.searchParams.get('limit'),'25');
 assert.equal(new URL(api.makeURL('イオンモール広島府中','search')).pathname,'/v1/search');
 assert.throws(()=>api.makeURL('x','suggest'));
 assert.throws(()=>api.makeURL('尾道','remove'));
});
test('OpenPOI preserves name and address without old scoring and valid japan coordinates',()=>{
 const results=api.fromResponse({suggestions:[
  {name:'珈琲専門店ふじ',address:'広島県尾道市東御所町',category:'cafe',lat:34.4035,lng:133.1925,licenses:['CC-BY-4.0'],attributions:['OpenPOI API']},
  {name:'尾道駅',address:'広島県尾道市',lat:34.404838,lng:133.193008},
  {name:'珈琲専門店ふじ',address:'広島県尾道市',lat:34.4035,lng:133.1925},
  {name:'誤った海外候補',lat:51,lng:-0.1},
  {name:'座標なし',lat:'',lng:''}
 ]});
 assert.deepEqual(results.map(x=>x.name),['珈琲専門店ふじ','尾道駅']);
 assert.equal(results[0].address,'広島県尾道市東御所町');
 assert.deepEqual(results[0].licenses,['CC-BY-4.0']);
 assert.deepEqual(results[0].attributions,['OpenPOI API']);
 assert.equal(results[1].lat,34.404838);
});
test('OpenPOI search payload also converts, refuses malformed response',()=>{
 const result=api.fromResponse({results:[{name:'尾道市役所',address:'広島県尾道市久保',lat:34.409,lng:133.201}]},'search');
 assert.equal(result.length,1);assert.equal(result[0].name,'尾道市役所');
 assert.deepEqual(api.fromResponse({results:[]},'suggest'),[]);
 assert.deepEqual(api.fromResponse(null),[]);
});
test('B_Navi searches OpenPOI before Photon/Nominatim and retains fallback',()=>{
 const root=path.join(__dirname,'..'),ui=fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.ok(ui.indexOf("const openPoiCore")>0);
 assert.ok(ui.indexOf("await searchOpenPoi(q,'suggest')")<ui.indexOf("await searchPhoton(q,cat)"));
 assert.match(ui,/openPoiCore\.fromResponse/);
 assert.match(ui,/addEventListener\('input'/);
 assert.match(ui,/clearTimeout\(suggestionTimer\)/);
 assert.match(ui,/searchStations\(q\)/);
 assert.match(ui,/searchPhoton\(q,cat\)/);
 assert.match(ui,/searchNominatim\(q\)/);
 assert.match(html,/openpoi-search\.js/);
 assert.match(html,/https:\/\/openpoiapi\.com\/attribution\.html/);
 assert.match(sw,/\.\/openpoi-search\.js/);
 assert.doesNotMatch(sw,/indexedDB\.deleteDatabase/);
});
