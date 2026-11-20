'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const client=require('../public-brouter-client.js');
const {profileName,trackFromGeoJSON,gpxFromTrack,query}=client;
test('Android B_Navi profile mapping matches Java server vehicle/mode indices',()=>{
 const expected=[['bn_50_beginner','bn_50_general','bn_50_explore'],['bn_125_beginner','bn_125_general','bn_125_explore'],['bn_big_beginner','bn_big_general','bn_big_explore','bn_big_fasttravel_priority']];
 expected.forEach((list,v)=>list.forEach((name,m)=>{assert.equal(profileName(v,m),name);const f=path.join(__dirname,'../profiles/'+name+'.brf');const t=fs.readFileSync(f,'utf8');assert.match(t,/---context:way/);assert.match(t,/---context:node/)}));
});
test('parses BRouter timode 3 voicehints from server, does not fabricate unmatched turns',()=>{
 const data={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[132.45,34.4],[132.46,34.405],[132.47,34.41]]},properties:{voicehints:[[1,2,0,45,-70],[2,5,0,10,78],[2,777,0,0,0]]}}]};
 const tr=trackFromGeoJSON(data);
 assert.deepEqual(tr.points[0],[34.4,132.45]);assert.equal(tr.cues.length,2);assert.equal(tr.cues[0].desc,'left');assert.equal(tr.cues[1].desc,'right');
 const xml=gpxFromTrack(tr,'bn_50_general');assert.match(xml,/<trkpt lat="34.405" lon="132.46"\/>/);assert.match(xml,/<desc>left<\/desc><extensions><offset>1<\/offset>/);assert.doesNotMatch(xml,/777/);
});
test('sends original /profile POST and BRouter geojson + timode=3 GET, with via order',async()=>{
 global.location={href:'https://penta2026.github.io/b_navi/'};
 const calls=[];
 const points=[[34.4,132.45],[34.405,132.46],[34.41,132.47]];
 const fn=async (url,opts={})=>{
  const u=String(url);calls.push({url:u,opts});
  if(u.endsWith('.brf'))return {ok:true,text:async()=> '---context:global\n---context:way\n---context:node\n'};
  if(u.endsWith('/profile'))return {ok:true,text:async()=>JSON.stringify({profileId:'custom_abcDEF11'})};
  if(u.startsWith('https://brouter.de/brouter?'))return {ok:true,json:async()=>({type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'LineString',coordinates:[[132.45,34.4],[132.46,34.405],[132.47,34.41]]},properties:{voicehints:[[1,2,0,10,40]]}}]})};
  throw Error('Unexpected '+u);
 };
 const r=await query(points,0,1,fn);
 assert.equal(r.profile,'bn_50_general');assert.equal(calls[1].opts.method,'POST');
 const p=new URL(calls[2].url);assert.equal(p.searchParams.get('lonlats'),'132.45,34.4|132.46,34.405|132.47,34.41');assert.equal(p.searchParams.get('profile'),'custom_abcDEF11');assert.equal(p.searchParams.get('timode'),'3');assert.equal(p.searchParams.get('format'),'geojson');
 assert.match(r.gpx,/<offset>1<\/offset>/);
});
