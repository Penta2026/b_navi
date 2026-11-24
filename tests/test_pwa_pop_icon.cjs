'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('user-selected B_Navi pop icon is installed in exact PNG sizes with known fingerprints',()=>{
 const icons=[
  ['icon-192.png',192,17241,'9c37bc3ac34d0a8fa5b22ea0affd746ce24e3a83df3396550b9bb188f078b761'],
  ['icon-512.png',512,135388,'745318544eeba964d2c1765ab70653c5a4953fbb2a02d8a1ff344a8aeb4ff876'],
  ['apple-touch-icon.png',180,17111,'0a12844591eafa941a975c786675965e4b4c3e7718b7ff046c338f72335c4685']
 ];
 for(const [name,size,bytes,sha] of icons){
  const data=fs.readFileSync(path.join(root,name));
  assert.equal(data.length,bytes,name+' size');
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' PNG header');
  assert.equal(data.readUInt32BE(16),size,name+' width');
  assert.equal(data.readUInt32BE(20),size,name+' height');
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),sha,name+' exact selected artwork');
 }
});
test('PWA and iPhone launcher icons use versioned new artwork, not the old arrow favicon',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest'));
 const html=read('index.html'),sw=read('sw.js');
 assert.equal(manifest.icons.length,2);
 for(const [name,size] of [['icon-192.png','192x192'],['icon-512.png','512x512']]){
  const icon=manifest.icons.find(x=>x.sizes===size);
  assert.ok(icon,'manifest missing '+size);
  assert.equal(icon.src,'./'+name+'?v=pop-icon-20261124');
  assert.equal(icon.type,'image/png');
  assert.equal(icon.purpose,'any');
 }
 assert.match(html,/rel="apple-touch-icon" sizes="180x180" href="\.\/apple-touch-icon\.png\?v=pop-icon-20261124"/);
 assert.match(html,/rel="icon" type="image\/png" href="\.\/icon-192\.png\?v=pop-icon-20261124"/);
 assert.doesNotMatch(html,/rel="icon" href="\.\/icon\.svg"/);
 assert.match(html,/manifest\.webmanifest\?v=pop-icon-20261124/);
 assert.match(sw,/const CACHE='bnavi-pc-pwa-20261124-coast-backroad-v1'/);
 for(const f of ['icon-192.png','icon-512.png','apple-touch-icon.png'])
  assert.ok(sw.includes("'./"+f+"'"),'app shell pre-cache '+f);
});
