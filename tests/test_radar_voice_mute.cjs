'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const radar = fs.readFileSync(path.join(__dirname, '..', 'ride-radar.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

test('ordinary guidance voice is suppressed only while radar view is active', () => {
 assert.match(app, /function speak\(text,forced=false\)\{\s*\/\/[^\n]*\n[^\n]*\n\s*if\(!forced&&window\.BNaviRideMode\?\.isRadarVisible\?\.\(\)\)return false;/);
 assert.match(radar, /isRadarVisible:\(\)=>mode==='nav-radar'/);
 assert.doesNotMatch(radar, /start\('radar'\)/);
 assert.match(radar, /function closeNavRadar\(\)\{if\(mode!=='nav-radar'\)return;mode='off';screen.hidden=true;/);
});
test('entering navigation radar cancels already-playing TTS, no standalone radar', () => {
 assert.match(radar, /mode='nav-radar';[\s\S]*?window\.speechSynthesis\?\.cancel\?\.\(\);/);
 assert.doesNotMatch(radar, /ride-radar/);
});
test('arrival finalization in radar bypasses TTS and does not hang navigation', () => {
 assert.match(app, /function announceArrival\(message,onDone\)\{\s*\/\/[^\n]*\n\s*if\(window\.BNaviRideMode\?\.isRadarVisible\?\.\(\)\|\|/);
 assert.match(app, /\{onDone\(\);return;\}/);
});
test('PWA cache revision includes new radar voice control code without purging route data', () => {
 assert.match(sw, /const CACHE='bnavi-pc-pwa-[^']+'/);
 assert.match(sw, /'\.\/app\.js'/);
 assert.match(sw, /'\.\/ride-radar\.js'/);
 assert.doesNotMatch(sw, /indexedDB\.deleteDatabase/);
});
