/* Voice guidance preferences; shared by voice test and live navigation. */
(function(root){
'use strict';
const KEY='bnavi.voice.v1';
const DEFAULTS=Object.freeze({rate:1.15,volume:1,pitch:1,voice:'auto',enabled:true});
const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
function normalize(p){
 p=p&&typeof p==='object'&&!Array.isArray(p)?p:{};
 return {rate:Math.round(clamp(p.rate,.8,1.6,DEFAULTS.rate)*100)/100,
   volume:Math.round(clamp(p.volume,0,1,DEFAULTS.volume)*100)/100,
   pitch:Math.round(clamp(p.pitch,.75,1.25,DEFAULTS.pitch)*100)/100,
   voice:typeof p.voice==='string'&&p.voice.length<200?p.voice:'auto',
   enabled:typeof p.enabled==='boolean'?p.enabled:DEFAULTS.enabled};
}
function load(storage){try{return normalize(JSON.parse(storage.getItem(KEY)||'null'))}catch{return normalize(null)}}
function save(storage,options){const p=normalize(options);try{storage.setItem(KEY,JSON.stringify(p))}catch{}return p}
function apply(utterance,options,availableVoices){const p=normalize(options);utterance.lang='ja-JP';utterance.rate=p.rate;utterance.volume=p.volume;utterance.pitch=p.pitch;
 const japanese=(availableVoices||[]).filter(v=>/^ja(?:-|_)/i.test(v.lang||''));
 const selected=p.voice!=='auto'?japanese.find(v=>v.voiceURI===p.voice):null;
 const choice=selected||japanese[0];if(choice)utterance.voice=choice;
 return utterance;
}
const api={KEY,DEFAULTS,normalize,load,save,apply};
root.BNaviVoiceSettings=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
