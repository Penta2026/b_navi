/* B_Navi adjustable ordinary routing (2026-11-21).
 * Starts from an ORIGINAL bn_*_general.brf. Never edits the legal access gates
 * except the two explicit options available only for 126cc+.
 * All three sliders are soft cost preferences, never legal guarantees.
 */
(function(root){
'use strict';
const DEFAULT=Object.freeze({explore:0,width:0,scenic:0,allowMotorway:false,allowToll:false});
const LIMIT=150, STEP=10; // three sliders, centred on each vehicle's general BRF
const CLASSES=Object.freeze(['trunk|trunk_link','primary|primary_link','secondary|secondary_link','tertiary|tertiary_link','unclassified','residential','living_street','service']);

// Four distinct routing styles. The figures are trial weights for the
// 125cc general BRF, NOT measured thresholds or real-time traffic estimates.
// Other vehicle classes preserve their own base restrictions and relative offsets.
const STYLE_SPECS=Object.freeze({
 scenic:Object.freeze({forest:-0.15,water:-0.15,turn:200,signal:850,trunk:8.5,primary:5.5,secondary:1.3,tertiary:1.15,unclassified:1.25,lanes1:1.5,lanes15:1}),
 efficient:Object.freeze({forest:0,water:0,turn:150,signal:850,trunk:1.25,primary:1.15,secondary:1.15,tertiary:1.15,unclassified:1.6,lanes1:3.5,lanes15:2}),
 backroad:Object.freeze({forest:0,water:0,turn:50,signal:850,trunk:12,primary:8,secondary:3,tertiary:1.15,unclassified:1.05,lanes1:1.5,lanes15:1}),
 cruise:Object.freeze({forest:-0.08,water:-0.08,turn:400,signal:850,trunk:5,primary:3,secondary:1.5,tertiary:1.1,unclassified:2.6,lanes1:3.5,lanes15:2})
});
const STYLE_REF125=Object.freeze({trunk:3.85,primary:2.8,secondary:1.28,tertiary:1.03,unclassified:1.26,lanes1:1.25,lanes15:.55,turn:90,signal:350});
function tuneStyle(base,style){
 const cfg=STYLE_SPECS[style];if(!cfg)throw Error('不明なカスタムルートです');
 let out='# B_Navi four-style routing (trial, no observed traffic): '+style+'\n'+base;
 const unique=(regex,label,transform)=>{
   let count=0;out=out.replace(regex,(...args)=>{count++;return transform(...args)});
   if(count!==1)throw Error('BRF更新不可：'+label+' ('+count+')');
 };
 const roadNames={trunk:'trunk|trunk_link',primary:'primary|primary_link',secondary:'secondary|secondary_link',tertiary:'tertiary|tertiary_link',unclassified:'unclassified'};
 const blockStart=out.indexOf('assign costfactor\n'),blockEnd=out.indexOf('assign turncost',blockStart);
 if(blockStart<0||blockEnd<=blockStart)throw Error('BRF道路係数を安全に変更できません');
 let block=out.slice(blockStart,blockEnd);
 for(const [key,expr] of Object.entries(roadNames)){
   const pattern=new RegExp('(^[ \\t]*switch highway='+expr.replace(/\\|/g,'\\|')+'[ \\t]+)([0-9]+(?:\\.[0-9]+)?)([ \\t]*$)','m');
   let hits=0;
   block=block.replace(pattern,(_,a,n,b)=>{
     hits++;const target=Math.max(1.01,Number(n)+cfg[key]-STYLE_REF125[key]);
     return a+target.toFixed(3)+b;
   });
   if(hits!==1)throw Error('BRF道路分類が見つかりません：'+key);
 }
 out=out.slice(0,blockStart)+block+out.slice(blockEnd);
 // Change ONLY soft-cost expressions, not any road or node access restriction.
 for(const [key,tag] of [['lanes1','1'],['lanes15','1\\.5']]){
   const re=new RegExp('(^[ \\t]*switch lanes='+tag+'[ \\t]+)([0-9]+(?:\\.[0-9]+)?)([ \\t]*$)','m');
   unique(re,key,(_,a,n,b)=>a+Math.max(0,Number(n)+cfg[key]-STYLE_REF125[key]).toFixed(3)+b);
 }
 unique(/^(\s*assign turncost\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m,'turncost',(_,a,n,b)=>a+Math.max(0,Number(n)+cfg.turn-STYLE_REF125.turn).toFixed(3)+b);
 const nodeStart=out.indexOf('---context:node');if(nodeStart<0)throw Error('BRFノード設定がありません');
 let head=out.slice(0,nodeStart),node=out.slice(nodeStart),hits=0;
 node=node.replace(/^(\s*switch highway=traffic_signals\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m,(_,a,n,b)=>{hits++;return a+Math.max(0,Number(n)+cfg.signal-STYLE_REF125.signal).toFixed(3)+b});
 if(hits!==1)throw Error('BRF信号コストを変更できません');
 out=head+node;
 // Natural-feature estimates are optional OSM pseudo tags: no claim of actual views.
 // Urban sections are excluded; forest precedes water so the two do not stack.
 if(cfg.forest<0||cfg.water<0){
  const fmt=v=>Number(v).toFixed(3);
  const scene='assign custom_route_scenic_bias\n'+
    '    switch estimated_town_class=3|4|5|6 0\n'+
    '        switch estimated_forest_class=6 '+fmt(cfg.forest)+'\n'+
    '        switch estimated_forest_class=5 '+fmt(cfg.forest*.70)+'\n'+
    '        switch estimated_forest_class=4 '+fmt(cfg.forest*.40)+'\n'+
    '        switch estimated_forest_class=3 '+fmt(cfg.forest*.20)+'\n'+
    '        switch estimated_river_class=6 '+fmt(cfg.water)+'\n'+
    '        switch estimated_river_class=5 '+fmt(cfg.water*.70)+'\n'+
    '        switch estimated_river_class=4 '+fmt(cfg.water*.40)+'\n'+
    '        switch estimated_river_class=3 '+fmt(cfg.water*.20)+' 0\n\n';
  if(!out.includes('assign contextual_ride_bias\n')||!out.includes('    add traffic_route_bias ride_width_surface_bias'))throw Error('BRF景観設定に互換性がありません');
  out=out.replace('assign contextual_ride_bias\n',scene+'assign contextual_ride_bias\n');
  out=out.replace('    add traffic_route_bias ride_width_surface_bias','    add traffic_route_bias\n        add ride_width_surface_bias custom_route_scenic_bias');
 }
 if(!out.includes('    max 1.01'))throw Error('BRF最小コストの保護がありません');
 return out;
}

function normalize(raw,vehicle){
 const obj=raw&&typeof raw==='object'?raw:{};
 const level=k=>{const n=Number(obj[k]);return Number.isFinite(n)?Math.max(-LIMIT,Math.min(LIMIT,Math.round(n/STEP)*STEP)):0};
 const big=Number(vehicle)===2;
 const result={explore:level('explore'),width:level('width'),scenic:level('scenic'),allowMotorway:big&&obj.allowMotorway===true,allowToll:big&&obj.allowToll===true};
 if(typeof obj.style==='string'&&Object.hasOwn(STYLE_SPECS,obj.style))result.style=obj.style;
 return result;
}
function isDefault(raw,vehicle){const v=normalize(raw,vehicle);return !v.style&&!v.explore&&!v.width&&!v.scenic&&!v.allowMotorway&&!v.allowToll;}
function key(raw,vehicle){const v=normalize(raw,vehicle);return `${v.explore},${v.width},${v.scenic},${v.allowMotorway?1:0},${v.allowToll?1:0}`+(v.style?':'+v.style:'');}
function tuneProfile(base,raw,vehicle){
 if(typeof base!=='string'||!base.includes('---context:way')||!base.includes('---context:node'))throw Error('基本BRFファイルが不正です');
 const v=normalize(raw,vehicle);
 if(v.style)return tuneStyle(base,v.style); // independent of the legacy three sliders
 if(isDefault(v,vehicle))return base; // exact, byte-identical general route at the centre.
 const header='# B_Navi route-tuning v1: '+key(v,vehicle)+' (approximate OSM preferences; legal gates unchanged except explicit 126cc options)\n';
 let out=header+base;
 const need=(before,after,label)=>{if(before===after)throw Error('BRF形式が更新され、'+label+'を安全に調整できません');return after};
 const replaceCost=(name,calc)=>{
   const start=out.indexOf('assign costfactor\n');
   const end=out.indexOf('assign turncost',start);
   if(start<0||end<0)throw Error('BRF道路コスト設定が見つかりません');
   const original=out.slice(start,end);
   const pattern=new RegExp('(^[ \t]*switch highway='+name.replace(/\|/g,'\\|')+'[ \t]+)([0-9]+(?:\\.[0-9]+)?)([ \t]*$)','m');
   const match=original.match(pattern);
   if(!match)throw Error('BRF道路分類が見つかりません：'+name);
   const value=calc(Number(match[2]));
   const revised=original.replace(pattern,(_,before,num,after)=>before+Math.max(1.01,Math.min(9999,value)).toFixed(3)+after);
   out=out.slice(0,start)+revised+out.slice(end);
 };
 const d=v.explore/100,w=v.width/100,s=v.scenic/100; // ±150 is 1.5× the former ±100 preference strength
 // Distance<->explore: moving left flattens legal-road cost differences,
 // moving right rewards tertiary/unclassified and deters trunk/primary.
 // Narrow<->wide: OSM highway class + lanes as imperfect width proxies.
 const changes={
  'trunk|trunk_link':(b)=>b+(d>0?1.05*d:-(b-1.01)*.70*-d)+(w<0?.85*-w:-(b-1.01)*.70*w),
  'primary|primary_link':(b)=>b+(d>0?.72*d:-(b-1.01)*.72*-d)+(w<0?.56*-w:-(b-1.01)*.64*w),
  'secondary|secondary_link':(b)=>b+(d>0?.20*d:-(b-1.01)*.60*-d)+(w<0?.13*-w:-(b-1.01)*.34*w),
  'tertiary|tertiary_link':(b)=>b+(d>0?-.08*d:-(b-1.01)*.40*-d)+(w>0?.25*w:-.015*-w),
  'unclassified':(b)=>b+(d>0?-.12*d:-(b-1.01)*.60*-d)+(w>0?.70*w:-.18*-w),
  'residential':(b)=>b+(d>0?-1.10*d:-(b-1.01)*.48*-d)+(w>0?2.40*w:-2.30*-w),
  'living_street':(b)=>b+(d>0?-.50*d:-(b-1.01)*.28*-d)+(w>0?2.10*w:-1.40*-w),
  'service':(b)=>b // Never encourage parking/driveways (those gates stay hard).
 };
 for(const name of CLASSES)replaceCost(name,changes[name]);
 // The straight/right-hand side does not force a scenic route. It adjusts
 // both turn aversion and natural-feature preference where RD5 has the tags.
 const turnMatch=/^(\s*assign turncost\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m;
 const turnHit=out.match(turnMatch);
 if(!turnHit)throw Error('基本BRFの曲がりコストが見つかりません');
 const baseTurn=Number(turnHit[2]);
 const turn=baseTurn*(s<0?1+1.6*-s:1-.55*s);
 out=out.replace(turnMatch,(_,before,num,after)=>before+turn.toFixed(3)+after);
 // Lane penalty is a proxy: measured widths and actual flowing traffic are
 // not available from RD5. Keep all restrictions and surface penalties.
 const laneMatch=/^(\s*switch lanes=1\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m;
 const laneHit=out.match(laneMatch);
 if(!laneHit)throw Error('基本BRFの車線幅推定コストが見つかりません');
 // At -100 preserve the former strength, then ease the last 50 points so
 // the narrow-road end remains meaningful instead of flattening at zero.
 const narrowReduction=-w<=1?-w:1+.20*(-w-1);
 const lane=Math.max(0,Number(laneHit[2])+(w>0?2.3*w:-narrowReduction));
 out=out.replace(laneMatch,(_,before,num,after)=>before+lane.toFixed(3)+after);
 if(s>0){
   // Higher pseudo classes signal forest coverage / proximity to water, not
   // a guarantee of views. Empty tags get zero bonus, not invented scenery.
   const scenery=`assign scenic_route_bias\n    add\n        switch estimated_forest_class=6 ${(-.68*s).toFixed(3)}\n        switch estimated_forest_class=5 ${(-.50*s).toFixed(3)}\n        switch estimated_forest_class=4 ${(-.32*s).toFixed(3)}\n        switch estimated_forest_class=3 ${(-.14*s).toFixed(3)} 0\n        switch estimated_river_class=6 ${(-.70*s).toFixed(3)}\n        switch estimated_river_class=5 ${(-.50*s).toFixed(3)}\n        switch estimated_river_class=4 ${(-.30*s).toFixed(3)}\n        switch estimated_river_class=3 ${(-.10*s).toFixed(3)} 0\n\n`;
   out=need(out,out.replace('assign contextual_ride_bias\n',scenery+'assign contextual_ride_bias\n'),'景観評価');
   out=need(out,out.replace('    add traffic_route_bias ride_width_surface_bias','    add traffic_route_bias\n        add ride_width_surface_bias scenic_route_bias'),'景観評価の加算');
 }
 // The two allow options are independent. Only 126cc+ may unlock them;
 // motorcycle/vehicle/access=no restrictions remain untouched. Motorway
 // still stays forbidden when allowMotorway is false, toll roads when allowToll false.
 if(Number(vehicle)===2&&v.allowToll){
   out=need(out,out.replace(/^    switch toll=yes 10000\r?\n/m,''),'有料道路オプション');
 }
 if(Number(vehicle)===2&&v.allowMotorway){
   out=need(out,out.replace(/^    switch motorroad=yes 10000\r?\n/m,''),'自動車専用道路オプション');
   out=need(out,out.replace(/^(\s*switch highway=motorway\|motorway_link\s+)10000(?:\.00)?(\s*)$/m,(_,a,b)=>a+'1.150'+b),'高速道路・ランプ');
 }
 // BRouter requires costfactor >= 1.01; the stock outer max 1.01 is retained.
 if(!/max 1\.01/.test(out))throw Error('基本BRFのコスト下限ガードが見つかりません');
 return out;
}
const api={DEFAULT,LIMIT,STEP,STYLE_SPECS,normalize,isDefault,key,tuneProfile};
root.BNaviRouteTuning=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
