'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const m=require('../poi-search-merge.js');
const branch={name:'株式会社 大田鋳造所',lat:34.65,lon:132.45,address:'広島県山県郡北広島町舞綱157-1',source:'OpenPOI API'};
const hq={name:'大田鋳造所',lat:34.401,lon:132.446,address:'広島県広島市西区上天満町3-23',source:'Nominatim'};
test('generic company name keeps distinct headquarters and factory from different sources',()=>{
 const actual=m.combine('大田鋳造所',[{kind:'suggest',rows:[branch]},{kind:'geocoder',rows:[hq]}]);
 assert.equal(actual.length,2);assert.equal(actual[0].name,'株式会社 大田鋳造所');
});
test('requested Hiroshima City excludes KITAhiroshima Town but keeps its real HQ',()=>{
 const data=m.combine('広島市 大田鋳造所',[{kind:'suggest',rows:[branch]},{kind:'search',rows:[hq]}]);
 assert.deepEqual(data.map(x=>x.source),['Nominatim']);
 assert.equal(m.combine('広島市 大田鋳造所',[{kind:'suggest',rows:[branch]}]).length,0);
});
test('no false building invented if providers only return factory',()=>{
 assert.equal(m.combine('大田鋳造所',[{kind:'suggest',rows:[branch]}]).length,1);
});
test('duplicate nearby same business is collapsed, distant branch kept',()=>{
 const same={...hq,name:'株式会社大田鋳造所',lat:34.4011,lon:132.44601,source:'Photon'};
 assert.equal(m.combine('大田鋳造所',[{rows:[hq,branch,same]}]).length,2);
});
test('OpenPOI OR endpoint does not accept unrelated facility name',()=>{
 const unrelated={...hq,name:'別会社'};
 assert.equal(m.combine('大田鋳造所',[{kind:'search',rows:[unrelated]}]).length,0);
});
test('generic category suggestions still work even if shop name lacks category word',()=>{
 const c={name:'珈琲専門店ふじ',address:'尾道市東御所町',lat:34.4,lon:133.19};
 assert.equal(m.combine('尾道市 カフェ',[{kind:'suggest',rows:[c]}]).length,1);
 assert.equal(m.combine('福山市 カフェ',[{kind:'suggest',rows:[c]}]).length,0);
});

test('search UI has one external Google Maps link and no dynamic duplicate',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const ui=fs.readFileSync(path.join(root,'mobile-ui.js'),'utf8');
 assert.equal((html.match(/id="online-map-search"/g)||[]).length,1);
 assert.doesNotMatch(ui,/function addExternalSearch\(/);
 assert.doesNotMatch(ui,/addExternalSearch\(el,q\)/);
 assert.match(ui,/BNaviPoiSearchMerge/);
 assert.match(ui,/Promise\.allSettled/);
});

test('app shell loads the result merge module',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(html,/poi-search-merge\.js/);
 assert.match(sw,/\.\/poi-search-merge\.js/);
});
