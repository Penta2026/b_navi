const assert=require('node:assert/strict');
const A=require('../address-search.js');
const cases=[
 ['東京都港区芝公園4-2-8',true],
 ['広島市西区上天満町',true],
 ['東京都 東京タワー',false],
 ['広島市 大田鋳造所',false],
 ['〒105-0011 東京都港区芝公園4丁目2番8号',true],
 ['大阪府大阪市北区梅田3-1-1',true]
];
for(const [q,expected] of cases)assert.equal(A.looksLikeAddress(q),expected,q);
const input=[
 {type:'Feature',properties:{title:'東京都港区芝公園四丁目'},geometry:{type:'Point',coordinates:[139.7454,35.6584]}},
 {type:'Feature',properties:{title:'北海道札幌市中央区北一条西'},geometry:{type:'Point',coordinates:[141.3508,43.0600]}},
 {type:'Feature',properties:{title:'東京都港区芝公園四丁目'},geometry:{type:'Point',coordinates:[139.7454,35.6584]}},
 {type:'Feature',properties:{title:'東京都港区芝公園四丁目'},geometry:{type:'Point',coordinates:[999,999]}},
 ];
const r=A.rank(A.fromGSI(input),'東京都港区芝公園4-2-8');
assert.equal(r.length,1,'exclude unrelated cities, duplicate locations and bad coordinates');
assert.equal(r[0].lat,35.6584);assert.equal(r[0].lon,139.7454);
assert.equal(r[0].precision,'area');
const h=A.rank(A.fromGSI([{type:'Feature',properties:{title:'広島県広島市西区上天満町'},geometry:{type:'Point',coordinates:[132.44,34.4]}}]),'広島市西区上天満町12-3');
assert.equal(h.length,1);assert.equal(h[0].lat,34.4);
assert.equal(A.rank(A.fromGSI(input),'大阪市北区梅田3-1-1').length,0);
const noBad=A.fromNominatim([{display_name:'東京都港区芝公園4丁目',lat:'35.658',lon:'139.745'}, {display_name:'bad',lat:'N/A',lon:'0'}]);
assert.equal(noBad.length,1);
const url=new URL(A.makeGSIUrl('東京都港区芝公園4-2-8'));
assert.equal(url.hostname,'msearch.gsi.go.jp');assert.equal(url.searchParams.get('q'),'東京都港区芝公園4-2-8');
console.log('Address search pure tests passed',cases.length+8);
