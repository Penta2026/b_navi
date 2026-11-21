"""Synthetic GPS & BRouter integration. Not a real server or field verification."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^\"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^\"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
 page=ctx.new_page(); errors=[];page.on('pageerror',lambda error: errors.append(str(error)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''()=>{
  const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}});
  Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
  window.__spoken=[];window.__watchCount=0;window.__routeCalls=[];
  const synth={cancel(){},speak(u){window.__spoken.push(u.text);if(u.onend)setTimeout(()=>u.onend(),20)},getVoices(){return []}};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
  window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok,err){window.__gpsOk=ok;window.__watchCount++;return 1},clearWatch(){}}});
  window.__gps=(lat,lon,accuracy=5)=>window.__gpsOk({coords:{latitude:lat,longitude:lon,accuracy,heading:120,speed:6},timestamp:Date.now()});
  window.fetch=async ()=>({ok:false,status:503,text:async()=>'',json:async()=>[],headers:{get:()=>''}});
 }''')
 for name in names: page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(200)
 page.evaluate('''()=>{
   window.usePublicBrouter=()=>true;
   BNaviPublicBrouter.query=async (points,vehicle,mode)=>{
     window.__routeCalls.push(points.map(x=>x.slice()));
     return {track:{points:points.map(x=>x.slice()),cues:[]},gpx:'<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="'+points[0][0]+'" lon="'+points[0][1]+'"/><trkpt lat="'+points[1][0]+'" lon="'+points[1][1]+'"/></trkseg></trk></gpx>',elapsedMs:1,profile:'test'};
   };
   document.getElementById('start').value='34.389000,133.200000';
   document.getElementById('goal').value='34.064000,132.995000';
   document.getElementById('vehicle').value='0';
   state.via=[];renderVia();
 }''')
 page.evaluate('calculate()')
 page.wait_for_timeout(200)
 assert page.evaluate('state.routeType')=='shimanami', page.locator('#message').inner_text()
 assert page.evaluate('state.islandLegs.length')==7
 assert page.evaluate('state.routes.filter(x=>x.type===\'bridge\').length')==6
 assert page.evaluate('window.__routeCalls.length')==7
 assert page.locator('#shimanami-desk-tools').is_visible()
 page.locator('#shimanami-desk-tools summary').click();page.locator('#shimanami-desk-verify').click()
 assert '参考線の接続確認OK' in page.locator('#shimanami-desk-report').inner_text()
 page.locator('#nav-start-quick').click()
 page.wait_for_timeout(100)
 assert page.evaluate('state.navActive')
 assert page.evaluate('window.__watchCount')==1
 # each bridge entrance triggers GPS pause and next road's island start resumes
 for i in range(6):
  a=page.evaluate('(i)=>state.islandLegs[i].points.at(-1)',i)
  b=page.evaluate('(i)=>state.islandLegs[i+1].points[0]',i)
  page.evaluate('p=>window.__gps(p[0],p[1])',a)
  assert page.evaluate('state.awaitingBridge'),f'bridge {i+1} not paused'
  page.evaluate('p=>window.__gps(p[0],p[1])',b)
  assert page.evaluate('state.islandIndex')==i+1, f'bridge {i+1} not resumed'
  assert not page.evaluate('state.awaitingBridge')
 # finish after 2 accurate fixes
 end=page.evaluate('state.islandLegs.at(-1).points.at(-1)')
 page.evaluate('p=>window.__gps(p[0],p[1])',end)
 page.evaluate('p=>window.__gps(p[0],p[1])',end)
 page.wait_for_timeout(120)
 assert not page.evaluate('state.navActive'), 'final destination must stop guidance'
 assert not errors,errors
 print('PASS: 7 web road segments + 6 Android bridges; desk check; 6 GPS bridge pauses/resumes; final GPS arrival')
 browser.close()
