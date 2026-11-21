'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {meters,distanceToPolyline,MotionGate,OffRoutePolicy,ArrivalPolicy}=require('../ride-logic.js');
const src=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('point-to-polyline distance is based on segments, not distant track vertices',()=>{
 const p=[34.4005,132.4005],segment=[[34.4,132.4],[34.401,132.401]];
 assert.ok(distanceToPolyline(p,segment)<2);
 assert.ok(meters(p,segment[0])>50);
});
test('Android-style reroute is accuracy-aware, 3 independent fixes, 1.2s, 12s cooldown',()=>{
 const s=new OffRoutePolicy();
 assert.equal(OffRoutePolicy.threshold(8),19);
 assert.equal(s.observe(30,8,1000),false);
 assert.equal(s.observe(30,8,1650),false);
 assert.equal(s.observe(30,8,2400),true);
 assert.equal(s.observe(30,8,2800),false);
 assert.equal(s.observe(30,8,4200),false);
 assert.equal(s.observe(30,8,5100),false);
 assert.equal(s.observe(30,8,15000),true);
 assert.equal(s.observe(30,30,29000),false); // threshold 63 m
});
test('waypoint and destination arrival require two precise samples within 20m',()=>{
 const a=new ArrivalPolicy();
 assert.equal(a.observe(18,28),false);
 assert.equal(a.observe(19,10),false);
 assert.equal(a.observe(27,8),false);
 assert.equal(a.observe(16,8),false);
 assert.equal(a.observe(14,10),true);
 assert.equal(a.observe(10,5),false);
 a.reset();assert.equal(a.observe(11,6),false);assert.equal(a.observe(10,6),true);
});
test('app integrates live route recovery and end-of-trip without changing original S/G',()=>{
 const app=src('app.js');
 assert.match(app,/function rerouteFromGps\(/);
 assert.match(app,/const points=\[state\.location\.slice\(\),\.\.\.dest\]/);
 assert.match(app,/state\.offRoutePolicy\?\.observe/);
 assert.match(app,/function observeDestination\(/);
 assert.match(app,/announceArrival\('目的地に到着しました/);
 assert.match(app,/onDone\(\)/);
 assert.match(app,/until<=20&&until>=0/);
 assert.match(app,/id='?'now-|'now-'\+next\.offset/);
 assert.match(app,/next-destination-continue/);
 assert.doesNotMatch(app,/\$\('start'\)\.value=state\.location/);
});
test('radar switching uses navigation GPS without duplicate watcher; free ride hides chrome',()=>{
 const radar=src('ride-radar.js'),css=src('style.css'),html=src('index.html');
 assert.match(radar,/function openNavRadar\(/);
 assert.match(radar,/function updateNavigationRadar\(/);
 assert.match(radar,/mode='nav-radar'/);
 assert.match(radar,/window\.BNaviObserveDestination/);
 assert.match(css,/body\.free-ride-active \.topbar/);
 for(const id of ['nav-radar-toggle','map-controls','zoom-in','zoom-out','next-destination-dialog'])assert.ok(html.includes(`id="${id}"`));
});

test('MotionGate blocks stationary jitter, then permits sustained speed fixes',()=>{
 const g=new MotionGate();
 const p=[34.4,132.45];
 for(let i=0;i<6;i++)assert.equal(g.observe([p[0]+(i%2)*.00005,p[1]+(i%2)*.00006],7,0,i*1000),false);
 assert.equal(g.observe([34.4,132.45],7,4,6000),false);
 assert.equal(g.observe([34.4,132.45],7,4,7000),true);
 assert.equal(g.isMoving(12000),true);
 assert.equal(g.isMoving(14001),false);
});
test('MotionGate permits coherent GPS travel when speed is missing',()=>{
 const g=new MotionGate();
 const p=(dy)=>[34.4+dy,132.45];
 assert.equal(g.observe(p(0),5,null,0),false);
 assert.equal(g.observe(p(.00025),5,null,1000),false);
 assert.equal(g.observe(p(.0005),5,null,2000),false);
 assert.equal(g.observe(p(.00075),5,null,3000),true);
});
