const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const prefs=require('../voice-settings.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('voice default is a slightly faster 1.15× and keeps reasonable ranges',()=>{
 assert.equal(prefs.DEFAULTS.rate,1.15);
 assert.deepEqual(prefs.normalize({rate:100,volume:-1,pitch:9,enabled:false}),{rate:1.6,volume:0,pitch:1.25,voice:'auto',enabled:false});
 assert.equal(prefs.normalize({rate:'bad'}).rate,1.15);
});
test('settings remain local and support recovery from corrupt storage',()=>{
 const values={};const storage={getItem:k=>values[k]||null,setItem:(k,v)=>values[k]=v};
 let a=prefs.load(storage);assert.equal(a.rate,1.15);
 a=prefs.save(storage,{rate:1.35,volume:.65,pitch:.9,voice:'ja-test',enabled:false});
 assert.deepEqual(prefs.load(storage),a);
 values[prefs.KEY]='{';assert.equal(prefs.load(storage).rate,1.15);
});
test('SpeechSynthesisUtterance uses stored rate, pitch, volume, Japanese voice',()=>{
 const u={};const voice={lang:'ja-JP',voiceURI:'ja-test',name:'Test Japanese'};
 prefs.apply(u,{rate:1.4,pitch:.95,volume:.7,voice:'ja-test'},[{lang:'en-US',voiceURI:'en'},voice]);
 assert.equal(u.rate,1.4);assert.equal(u.volume,.7);assert.equal(u.pitch,.95);assert.equal(u.lang,'ja-JP');assert.equal(u.voice,voice);
});
test('compact shared settings UI is available with no device-specific explanatory text',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 for(const id of ['settings-btn','settings-dialog','voice-rate','voice-volume','voice-pitch','voice-select','voice-on','voice-preview','voice-reset']) assert.match(html,new RegExp(`id="${id}"`));
 assert.match(app,/VOICE\.apply\(u,voiceOptions/);
 assert.match(app,/VOICE\.save\(localStorage/);
 assert.match(sw,/voice-settings\.js/);
 assert.doesNotMatch(html,/iPhone|Android|iOS|Safari/);
});
