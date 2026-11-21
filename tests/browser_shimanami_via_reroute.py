"""Mocked BRouter + GPS; verify two-stage same-island via pause and island reroute."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
raw=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^\"]+)" defer></script>',raw)
html=re.sub(r'<script src="\./[^\"]+" defer></script>','',raw)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=ctx.new_page();errs=[];page.on('pageerror',lambda x:errs.append(str(x)))
 page.set_content(html);page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''()=>{
  const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}});
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  window.__spoken=[];const synth={cancel(){},speak(u){window.__spoken.push(u.text);if(u.onend)setTimeout(()=>u.onend(),20)},getVoices(){return []}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(fn){window.__gpsOk=fn;return 42},clearWatch(){}}});
  window.__gps=(p)=>window.__gpsOk({coords:{latitude:p[0],longitude:p[1],accuracy:5,heading:30,speed:6},timestamp:Date.now()});
  window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
 }''')
 for name in names: page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(100)
 page.evaluate('''()=>{
  window.usePublicBrouter=()=>true;
  BNaviPublicBrouter.query=async (points)=>({track:{points:points.map(x=>x.slice()),cues:[]},gpx:'<gpx/>',profile:'mock',elapsedMs:1});
  document.getElementById('start').value='34.389000,133.200000';
  document.getElementById('goal').value='34.320000,133.170000';
  document.getElementById('vehicle').value='0';
  state.via=['34.375000,133.195000'];renderVia();
 }''')
 page.evaluate('calculate()')
 assert page.evaluate('state.routeType')=='shimanami'
 assert page.evaluate('state.islandLegs.length')==3
 assert page.evaluate('state.islandLegs[0].checkpointAfter')==1
 page.locator('#nav-start-quick').click()
 page.evaluate('window.__gps([34.375,133.195])');page.evaluate('window.__gps([34.375,133.195])')
 assert page.locator('#next-destination-dialog').is_visible()
 assert page.evaluate('state.navPaused')
 page.locator('#next-destination-continue').click()
 assert page.evaluate('state.targetIndex')==1
 assert page.evaluate('state.islandIndex')==1
 # Reroute island road to bridge entrance (without modifying bridge reference and future leg)
 page.evaluate('''async()=>{
   state.location=[34.368,133.184];
   const savedBridge=JSON.stringify(state.routes.filter(s=>s.type==='bridge'));
   window.__oldStart=state.islandLegs[state.islandIndex].points[0].slice();
   await rerouteShimanamiFromGps();
   window.__bridgeIntact=savedBridge===JSON.stringify(state.routes.filter(s=>s.type==='bridge'));
 }''')
 assert page.evaluate('window.__bridgeIntact'), 'bridge reference mutated by island reroute'
 assert page.evaluate('state.islandLegs[1].points[0][0]')==34.368
 assert page.evaluate('state.islandLegs[1].bridgeAfter')
 assert page.evaluate('!state.rerouting')
 assert not errs,errs
 print('PASS: waypoint prompt on same island, user confirmation advances road leg, only active island rerouted; bridge untouched')
 b.close()
