'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('route tab is a toggle and map tab minimizes both panels',()=>{
 const js=read('mobile-ui.js');
 assert.match(js,/\$\('mobile-route'\)\.onclick=\(\)=>toggleSheet\(!sheet\.classList\.contains\('sheet-open'\)\|\|placeDialog\.open\)/);
 assert.match(js,/\$\('mobile-map'\)\.onclick=\(\)=>\{closePlaces\(\);toggleSheet\(false\)\}/);
});
test('mobile search is nonmodal and active bottom tabs stay clickable',()=>{
 const js=read('mobile-ui.js'),css=read('style.css');
 assert.match(js,/placeDialog\.show\(\)/);
 assert.match(js,/placeDialog\.open&&currentPlaceTab===tab/);
 assert.match(css,/#place-dialog\[open\]:not\(:modal\)/);
 assert.match(css,/bottom:calc\(65px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(js,/placeDialog\.addEventListener\('close',syncToolbar\)/);
 assert.doesNotMatch(js,/placeDialog\.replaceChildren/);
});
test('route and search remain independent from routing/GPS data',()=>{
 const src=read('mobile-ui.js');
 assert.match(src,/window\.BNaviCloseRouteSheet/);
 assert.match(src,/window\.BNaviShowRecordedTrackActions/);
 assert.match(read('sw.js'),/const CACHE='bnavi-pc-pwa-[^']+'/);
 assert.doesNotMatch(src,/indexedDB\.deleteDatabase/);
});
