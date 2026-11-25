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
// New independent preferences always start from the SELECTED beginner/general/
// explore BRF, not general. They never touch hard routing/access prohibitions.
// The 20% enjoyable detour is a calibration TARGET, not a route-distance cap;
// a BRF cost profile alone cannot impose a relative-to-shortest-distance bound.
const PREFERENCE_CHOICES=Object.freeze({
  view:Object.freeze(['normal','scenic','distance']),
  ride:Object.freeze(['normal','cruise','efficient']),
  cruiseWidth:Object.freeze(['standard','two','onehalf','one'])
});
const SIGNAL_TRIAL_COST=850; // all three base modes, all vehicle classes (excluding fast travel)
const BACKROAD_BIAS=Object.freeze({
  // Beginner: broad, clearly understandable backroads; avoid narrow lanes and extra turns.
  0:Object.freeze({trunk:1.00,primary:.60,secondary:.12,tertiary:-.03,unclassified:.12,residential:.70,lanes1:1.20,lanes15:.60,turn:30}),
  // General: Tomita-style country through-roads; modest detours for fewer signals.
  1:Object.freeze({trunk:1.80,primary:1.15,secondary:.24,tertiary:-.06,unclassified:-.10,residential:.45,lanes1:.45,lanes15:.10,turn:-15}),
  // Explore: more adventurous connectors, but never alleys, driveways or forbidden roads.
  2:Object.freeze({trunk:2.15,primary:1.45,secondary:.28,tertiary:-.10,unclassified:-.16,residential:0,lanes1:-.25,lanes15:-.10,turn:-30})
});
function normalizePreferences(value){
 const raw=value&&typeof value==='object'?value:{};
 return {
  view:PREFERENCE_CHOICES.view.includes(raw.view)?raw.view:'normal',
  ride:PREFERENCE_CHOICES.ride.includes(raw.ride)?raw.ride:'normal',
  cruiseWidth:PREFERENCE_CHOICES.cruiseWidth.includes(raw.cruiseWidth)?raw.cruiseWidth:'standard',
  backroad:raw.backroad===true,
  coast:raw.coast===true
 };
}
function preferenceKey(value){
 const p=normalizePreferences(value);
 return 'base-options-v3:'+p.view+':'+p.ride+':'+(p.backroad?'1':'0')+':'+(p.coast?'1':'0')+':'+(p.ride==='cruise'?p.cruiseWidth:'standard');
}
function tunePreferences(base,prefs,vehicle,mode=1){
 const p=normalizePreferences(prefs),kind=Number(vehicle),baseMode=Number(mode);
 if(![0,1,2].includes(kind))throw Error('車種の指定が不正です');
 if(![0,1,2].includes(baseMode))throw Error('基本モードの指定が不正です');
 let out='# B_Navi base-mode additive preferences: '+preferenceKey(p)+
   ' / signal trial='+SIGNAL_TRIAL_COST+' / enjoyable detour target about +20%, not guaranteed\n'+base;
 const delta={trunk:0,primary:0,secondary:0,tertiary:0,unclassified:0,residential:0,lanes1:0,lanes15:0,turn:0};
 const apply=x=>{for(const [k,v] of Object.entries(x))delta[k]+=v;};
 if(p.backroad)apply(BACKROAD_BIAS[baseMode]);
 if(p.ride==='cruise'){
  apply({trunk:-.08,primary:-.08,unclassified:.38,residential:.55,lanes1:1.65,lanes15:.90,turn:125});
  // Trial soft biases, never exact road-width thresholds or access changes.
  const widthBias={
   standard:{},two:{lanes1:3.2,lanes15:1.8,unclassified:.20,residential:.30},
   onehalf:{lanes1:1.7,lanes15:-.65,unclassified:-.12,residential:-.08},
   one:{lanes1:-1.45,lanes15:-1.0,unclassified:-.24,residential:-.12}
  };
  apply(widthBias[p.cruiseWidth]);
 }
 if(p.ride==='efficient')apply({trunk:-.12,primary:-.12,unclassified:.34,residential:.65,lanes1:.55,lanes15:.35,turn:70});
 if(p.backroad&&p.ride==='cruise')apply({lanes1:.55,lanes15:.25,turn:25}); // comfy backroads
 if(p.backroad&&p.ride==='efficient')apply({trunk:.15,primary:.12}); // do not undo backroad preference
 if(p.view==='distance')apply({turn:-35}); // fewer imposed detours, without compromising signal priority
 if(p.view==='scenic')apply({turn:15}); // gentle continuous scenic routes
 const replaceUnique=(txt,regex,label,convert)=>{
  let hits=0;
  const changed=txt.replace(regex,(_,prefix,value,suffix)=>{
   hits++;const original=Number(value);return prefix+Number(convert(original)).toFixed(3)+suffix;
  });
  if(hits!==1)throw Error('BRF '+label+' が変更できません ('+hits+')');
  return changed;
 };
 const begin=out.indexOf('assign costfactor\n'),finish=out.indexOf('assign turncost',begin);
 if(begin<0||finish<begin)throw Error('BRF道路係数の範囲が不正です');
 let part=out.slice(begin,finish);
 const highwayNames={trunk:'trunk|trunk_link',primary:'primary|primary_link',secondary:'secondary|secondary_link',tertiary:'tertiary|tertiary_link',unclassified:'unclassified',residential:'residential'};
 for(const [key,name] of Object.entries(highwayNames)){
  const re=new RegExp('(^[ \\t]*switch highway='+name.split('|').join('\\|')+'[ \\t]+)([0-9]+(?:\\.[0-9]+)?)([ \\t]*$)','m');
  part=replaceUnique(part,re,key,n=>{
   // "Distance" flattens only SOFT road preferences, not access restrictions.
   const normalized=p.view==='distance'?1.01+(n-1.01)*.65:n;
   return Math.max(1.01,Math.min(9999,normalized+delta[key]));
  });
 }
 out=out.slice(0,begin)+part+out.slice(finish);
 for(const [key,name] of [['lanes1','1'],['lanes15','1\\.5']]){
  const re=new RegExp('(^[ \\t]*switch lanes='+name+'[ \\t]+)([0-9]+(?:\\.[0-9]+)?)([ \\t]*$)','m');
  out=replaceUnique(out,re,key,n=>Math.max(0,n+delta[key]));
 }
 out=replaceUnique(out,/^(\s*assign turncost\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m,'turncost',
  n=>Math.max(0,n+delta.turn));
 const nstart=out.indexOf('---context:node');
 if(nstart<0)throw Error('BRF信号評価が見つかりません');
 const head=out.slice(0,nstart);
 let nodes=out.slice(nstart);
 nodes=replaceUnique(nodes,/^(\s*switch highway=traffic_signals\s+)([0-9]+(?:\.[0-9]+)?)(\s*)$/m,
  'traffic_signals',n=>Math.max(n,SIGNAL_TRIAL_COST));
 out=head+nodes;
 if(p.view==='scenic'){
  const scenic=`assign additive_scenic_bias
    switch estimated_town_class=3|4|5|6 0
        switch estimated_forest_class=6 -0.240
        switch estimated_forest_class=5 -0.180
        switch estimated_forest_class=4 -0.120
        switch estimated_forest_class=3 -0.060
        switch estimated_river_class=6 -0.240
        switch estimated_river_class=5 -0.180
        switch estimated_river_class=4 -0.120
        switch estimated_river_class=3 -0.060 0

`;
  // Template literal avoids any implicit changes to the original town/forest/river tags.
  if(!out.includes('assign contextual_ride_bias\n')||!out.includes('    add traffic_route_bias ride_width_surface_bias'))throw Error('BRF景観評価を変更できません');
  out=out.replace('assign contextual_ride_bias\n',scenic+'assign contextual_ride_bias\n');
  out=out.replace('    add traffic_route_bias ride_width_surface_bias',
   '    add traffic_route_bias\n        add ride_width_surface_bias additive_scenic_bias');
 }
 // Experimental waterfront PROXY: estimated_river_class does not identify
 // an actual coastline or guarantee sea views. Separate from road suitability.
 if(p.coast){
  const water=`assign additive_coastal_water_bias
    switch estimated_river_class=6 -0.600
        switch estimated_river_class=5 -0.450
        switch estimated_river_class=4 -0.270
        switch estimated_river_class=3 -0.120 0

`;
  if(!out.includes('assign contextual_ride_bias\n'))throw Error('BRF水辺評価の組み込み先がありません');
  out=out.replace('assign contextual_ride_bias\n',water+'assign contextual_ride_bias\n');
  if(p.view==='scenic'){
   if(!out.includes('        add ride_width_surface_bias additive_scenic_bias'))throw Error('景観と水辺の評価を組み合わせられません');
   out=out.replace('        add ride_width_surface_bias additive_scenic_bias',
    '        add ride_width_surface_bias\n            add additive_scenic_bias additive_coastal_water_bias');
  }else{
   if(!out.includes('    add traffic_route_bias ride_width_surface_bias'))throw Error('水辺の評価を組み合わせられません');
   out=out.replace('    add traffic_route_bias ride_width_surface_bias',
    '    add traffic_route_bias\n        add ride_width_surface_bias additive_coastal_water_bias');
  }
 }
 if(!out.includes('    max 1.01'))throw Error('BRFコスト下限を維持できません');
 return out;
}

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
   const pattern=new RegExp('(^[ \\t]*switch highway='+expr.split('|').join('\\|')+'[ \\t]+)([0-9]+(?:\\.[0-9]+)?)([ \\t]*$)','m');
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
 if(obj.preferences&&typeof obj.preferences==='object')result.preferences=normalizePreferences(obj.preferences);
 if(obj.biwakoBridgeToll===true)result.biwakoBridgeToll=true;
 return result;
}
function isDefault(raw,vehicle){const v=normalize(raw,vehicle);return !v.preferences&&!v.style&&!v.explore&&!v.width&&!v.scenic&&!v.allowMotorway&&!v.allowToll&&!v.biwakoBridgeToll;}
function key(raw,vehicle){const v=normalize(raw,vehicle);return `${v.explore},${v.width},${v.scenic},${v.allowMotorway?1:0},${v.allowToll?1:0}`+(v.style?':'+v.style:'')+(v.preferences?':'+preferenceKey(v.preferences):'')+(v.biwakoBridgeToll?':biwako-toll':'');}
function unlockShimanamiBigRoads(src,options,vehicle){
 if(Number(vehicle)!==2||(!options.allowMotorway&&!options.allowToll))return src;
 let out=src;
 const change=(pattern,replacement,label)=>{
  if(!pattern.test(out))throw Error('BRF '+label+' の制限を安全に調整できません');
  out=out.replace(pattern,replacement);
 };
 if(options.allowToll)change(/^    switch toll=yes 10000\r?\n/m,'','有料道路');
 if(options.allowMotorway){
  change(/^    switch motorroad=yes 10000\r?\n/m,'','自動車専用道路');
  change(/^(\s*switch highway=motorway\|motorway_link\s+)10000(?:\.00)?(\s*)$/m,(_,a,b)=>a+'add againstOneway 1.150'+b,'高速道路');
 }
 return out;
}
// Kinematic fasttravel BRF differs from the normal motorcycle profiles.
// Keep original motorway/toll access and speed model; alter SOFT road costs only.
// estimated_river_class is a WATER proxy, not actual sea visibility.
function tuneFastTravelPreferences(base,prefs,vehicle){
 if(Number(vehicle)!==2||!base.includes('---model:btools.router.KinematicModel')||
    !base.includes('assign fasttravel_road_penalty ='))
  throw Error('ファストトラベル専用の道路プロファイルを確認できません');
 const p=normalizePreferences(prefs);
 if(p.view==='normal'&&p.ride==='normal'&&!p.backroad&&!p.coast)return base;
 let out='# B_Navi fasttravel additive preferences: '+preferenceKey(p)+' (no motorway/toll access changes)\n'+base;
 const delta={trunk:0,primary:0,secondary:0,tertiary:0,unclassified:0,residential:0};
 const add=obj=>{for(const [key,value] of Object.entries(obj))delta[key]+=value;};
 if(p.backroad)add({trunk:.12,primary:.10,secondary:-.04,tertiary:-.12,unclassified:-.14,residential:.12});
 if(p.ride==='cruise'){
  add({primary:-.025,secondary:.01,tertiary:.055,unclassified:.12,residential:.25});
  // Fast travel: coarse road-class proxy, no changes to legal access or motorway priority.
  const widthProxy={
   standard:{},two:{secondary:-.025,tertiary:.045,unclassified:.10,residential:.12},
   onehalf:{secondary:.005,tertiary:-.045,unclassified:-.035,residential:-.02},
   one:{secondary:.025,tertiary:-.07,unclassified:-.08,residential:-.045}
  };
  add(widthProxy[p.cruiseWidth]);
 }
 if(p.ride==='efficient')add({trunk:-.025,primary:-.025,tertiary:.065,unclassified:.09,residential:.16});
 if(p.view==='distance')add({secondary:-.025,tertiary:-.07,unclassified:-.10,residential:-.06});
 if(p.view==='scenic')add({secondary:-.015,tertiary:-.025,unclassified:-.025});
 const anchors={
  trunk:['trunk|trunk_link','0.05'],
  primary:['primary|primary_link','0.18'],
  secondary:['secondary|secondary_link','0.25'],
  tertiary:['tertiary|tertiary_link','0.38'],
  unclassified:['unclassified','0.55'],
  residential:['residential|living_street','1.1']
 };
 for(const [key,[names,number]] of Object.entries(anchors)){
  const original='  switch highway='+names+' '+number;
  if(out.split(original).length!==2)throw Error('高速優先の道路係数が一致しません：'+key);
  out=out.replace(original,'  switch highway='+names+' '+
   Math.max(0,Number(number)+delta[key]).toFixed(3));
 }
 const bias=[];
 if(p.coast)bias.push({name:'fasttravel_water_hint_bias',src:
  'assign fasttravel_water_hint_bias =\n'+
  '  switch estimated_river_class=6 0\n'+
  '  switch estimated_river_class=5 0.035\n'+
  '  switch estimated_river_class=4 0.105\n'+
  '  switch estimated_river_class=3 0.175\n'+
  '  0.260\n\n'});
 if(p.view==='scenic')bias.push({name:'fasttravel_green_hint_bias',src:
  'assign fasttravel_green_hint_bias =\n'+
  '  switch estimated_forest_class=6 0\n'+
  '  switch estimated_forest_class=5 0.030\n'+
  '  switch estimated_forest_class=4 0.080\n'+
  '  switch estimated_forest_class=3 0.120\n'+
  '  0.180\n\n'});
 if(bias.length){
  const anchor='assign fasttravel_road_penalty =',cost='  add fasttravel_road_penalty\n  add town_penalty';
  if(out.split(anchor).length!==2||out.split(cost).length!==2)
   throw Error('高速優先の水辺・景観評価を安全に追加できません');
  out=out.replace(anchor,bias.map(b=>b.src).join('')+anchor);
  out=out.replace(cost,'  add fasttravel_road_penalty\n'+
   bias.map(b=>'  add '+b.name+'\n').join('')+'  add town_penalty');
 }
 if(!out.includes('  switch highway=motorway|motorway_link 0')||
    !out.includes('assign avoid_toll          = false')||
    !out.includes('assign avoid_motorways     = false'))
  throw Error('高速・有料道路の既存条件が変わっているため停止しました');
 return out;
}

function allowRequestedBiwakoToll(src,options,mode){
 if(!options.biwakoBridgeToll)return src;
 if(Number(mode)===3){
  if(!src.includes('assign avoid_toll          = false'))throw Error('高速優先の有料道路条件を確認できません');
  return src;
 }
 // Only for this single explicit bridge route calculation. The base profile
 // still excludes all motorway/motorroad and illegal vehicle/access ways.
 const prohibited='    switch toll=yes 10000';
 if(!src.includes(prohibited)){
  if(options.allowToll&&src.includes('    switch motorroad=yes 10000'))return src;
  throw Error('橋の有料道路条件を安全に調整できません');
 }
 if(!src.includes('    switch motorroad=yes 10000')||!src.includes('    switch highway=motorway'))
  throw Error('橋の経由では高速・自動車専用道路の禁止を維持できません');
 return src.replace(prohibited+'\n','');
}
function tuneProfile(base,raw,vehicle,mode=1){
 if(typeof base!=='string'||!base.includes('---context:way')||!base.includes('---context:node'))throw Error('基本BRFファイルが不正です');
 const v=normalize(raw,vehicle);
 if(v.preferences){
  if(Number(mode)===3)return allowRequestedBiwakoToll(tuneFastTravelPreferences(base,v.preferences,vehicle),v,mode);
  return allowRequestedBiwakoToll(unlockShimanamiBigRoads(tunePreferences(base,v.preferences,vehicle,mode),v,vehicle),v,mode);
 }
 if(v.style)return allowRequestedBiwakoToll(tuneStyle(base,v.style),v,mode); // independent of the legacy three sliders
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
 return allowRequestedBiwakoToll(out,v,mode);
}
const api={DEFAULT,LIMIT,STEP,STYLE_SPECS,PREFERENCE_CHOICES,SIGNAL_TRIAL_COST,BACKROAD_BIAS,normalizePreferences,normalize,isDefault,key,tuneFastTravelPreferences,tuneProfile};
root.BNaviRouteTuning=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window==='undefined'?globalThis:window);
