/* B_Navi Android v1.1.31 Shimanami approach-geometry parity preview.
 * Geometry source: unmodified app/src/main/assets/shimanami_bridge_approaches.json.
 * Reimplements ShimanamiAndroidPreview.appendApproach display validation.
 * These features NEVER yield navigation instructions or a runnable GPX.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BNaviAndroidApproaches = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // The exact FORWARD/DECK anchors of Android ShimanamiAndroidPreview.java.
  const FORWARD = [
    [[34.3607615,133.1928778],[34.354101,133.1715059]],
    [[34.3038736,133.1537068],[34.3054777,133.1464005]],
    [[34.2656934,133.0681229],[34.2574115,133.055613]],
    [[34.2174093,133.0525446],[34.2135766,133.0580807]],
    [[34.1989895,133.0774355],[34.1902928,133.0702686]],
    [[34.129604,133.0183411],[34.1112399,132.9759488]]
  ];
  const DECK = [
    [[34.3599069,133.1865931],[34.3545582,133.1741338]],
    [[34.3065243,133.1536115],[34.3009021,133.1466258]],
    [[34.2610701,133.0721392],[34.2577074,133.0547042]],
    [[34.2171425,133.0540463],[34.2141936,133.0586469]],
    [[34.1953516,133.0753432],[34.1888609,133.069389]],
    [[34.1275854,133.0166143],[34.1134595,132.9793712]]
  ];
  const NAMES = ['因島大橋','生口橋','多々羅大橋','大三島橋','伯方・大島大橋','来島海峡大橋'];
  function meters(a,b) {return Math.hypot((a[0]-b[0])*111000,(a[1]-b[1])*92000);}
  function pointOK(p) {return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>34&&p[0]<34.45&&p[1]>132.9&&p[1]<133.25;}
  function validateShape(geometry, name, start, end) {
    if(!geometry||typeof geometry!=='object'||!Array.isArray(geometry.points)||geometry.points.length<2||geometry.points.length>2000) throw new Error(name+': 形状点数が不正');
    if(!geometry.points.every(pointOK)) throw new Error(name+': 範囲外または不正座標');
    const a=meters(geometry.points[0],start), b=meters(geometry.points.at(-1),end);
    if(a>20||b>20) throw new Error(name+`: 橋の入口・出口の距離条件が一致しません (${a.toFixed(1)}m / ${b.toFixed(1)}m)`);
    if(!['moped_tagged_reference','cycling_reference'].includes(geometry.kind)) throw new Error(name+': 未知の形状種別');
    return {startGapMeters:a,endGapMeters:b};
  }
  function validateDeck(bridge,forward) {
    const s=bridge.moped_deck;
    if(!s||s.kind!=='moped_tagged_reference'||!Array.isArray(s.points)||s.points.length<3||s.points.length>2000||!s.points.every(pointOK))throw new Error('因島大橋: 原付タグ付き橋上形状なし');
    const start=DECK[0][0],end=DECK[0][1];
    if(meters(s.points[0],start)>8||meters(s.points.at(-1),end)>8)throw new Error('因島大橋: 橋上形状の両端が8m超');
    let distance=0;
    for(let i=1;i<s.points.length;i++){const gap=meters(s.points[i-1],s.points[i]);if(gap>1500)throw new Error('因島大橋: 橋上形状に断絶');distance+=gap;}
    if(distance<1100||distance>1800)throw new Error('因島大橋: 橋上形状の長さが想定外');
    return {type:'moped_deck_reference',bridgeIndex:1,name:'因島大橋',navigationEligible:false,points:forward?s.points:s.points.slice().reverse()};
  }
  function audit(data,bridgeSegments) {
    if(!data||data.schema_version!==1||!Array.isArray(data.bridges)||data.bridges.length!==6)throw new Error('橋の参考形状データの形式が一致しません');
    if(!Array.isArray(bridgeSegments))throw new Error('橋プレビュー区間がありません');
    const overlays=[],issues=[],perBridge=[];
    for(const segment of bridgeSegments){
      const i=Number(segment.bridgeIndex)-1;
      if(!Number.isInteger(i)||i<0||i>5||typeof segment.forward!=='boolean')throw new Error('走行方向・橋番号の指定が不正');
      const bridge=data.bridges[i];
      const direction=segment.forward?'forward':'reverse';
      const report={name:NAMES[i],direction,shapes:0,missing:0};
      if(!bridge||bridge.name!==NAMES[i]||!bridge.directions||!Array.isArray(bridge.directions[direction])||bridge.directions[direction].length!==2){
        issues.push(`${NAMES[i]}: 指定方向の橋の進入・退出形状が見つかりません`);report.missing+=2;perBridge.push(report);continue;
      }
      const access=segment.forward?FORWARD[i]:FORWARD[i].slice().reverse();
      const deck=segment.forward?DECK[i]:DECK[i].slice().reverse();
      const pieces=bridge.directions[direction];
      const specs=[['entrance_to_deck',access[0],deck[0]],['deck_to_exit',deck[1],access[1]]];
      for(let j=0;j<2;j++){
        const [role,start,end]=specs[j], part=pieces[j];
        try{
          if(part?.role!==role)throw new Error('橋の参考形状の区間種別が一致しません');
          const gaps=validateShape(part,`${NAMES[i]} ${role}`,start,end);
          overlays.push({type:part.kind==='moped_tagged_reference'?'moped_approach_reference':'cycling_approach_reference',bridgeIndex:i+1,name:NAMES[i],role,direction,navigationEligible:false,points:part.points, ...gaps});
          report.shapes++;
        }catch(e){issues.push(`${NAMES[i]} ${role}: ${e.message}`);report.missing++;}
      }
      if(i===0){
        try{overlays.push(validateDeck(bridge,segment.forward));report.shapes++;}
        catch(e){issues.push(e.message);report.missing++;}
      }
      perBridge.push(report);
    }
    return {overlays,issues,perBridge,source:'B_Navi Android v1.1.31 original shimanami_bridge_approaches.json',navigationReady:false};
  }
  return Object.freeze({audit,meters,NAMES});
});
