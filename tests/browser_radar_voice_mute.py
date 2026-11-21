"""Radar speech mute browser mock; real speaker and GPS not tested."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
GPX='''<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4000" lon="132.4500"/><trkpt lat="34.4005" lon="132.4500"/><trkpt lat="34.4010" lon="132.4500"/><trkpt lat="34.4020" lon="132.4500"/></trkseg></trk><rte><rtept lat="34.401" lon="132.450"><desc>right</desc><extensions><offset>2</offset></extensions></rtept></rte></gpx>'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''() => {
    const ls={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>ls[k]||null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>delete ls[k]}});
    localStorage.setItem('bnavi.routeApiBase.v1','https://example.invalid/');
    Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
    window.__spoken=[];window.__cancels=0;window.__watchCount=0;
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){window.__cancels++},speak(u){window.__spoken.push(u.text)},getVoices(){return []}}});
    window.SpeechSynthesisUtterance=class{constructor(s){this.text=s}};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(success,error){window.__gpsOk=success;window.__watchCount++;return 7},clearWatch(){}}});
    window.fetch=async url=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
 }''')
 for name in names:page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(180)
 page.evaluate('''gpx=>{
   document.getElementById('start').value='34.400000,132.450000';
   document.getElementById('goal').value='34.402000,132.450000';
   routeView('normal',[{type:'road',points:[[34.4000,132.4500],[34.4005,132.4500],[34.4010,132.4500],[34.4020,132.4500]],gpx,label:'test'}],gpx,'test');
 }''',GPX)
 page.locator('#nav-start-quick').click()
 assert page.evaluate('state.navActive')
 assert page.evaluate('window.__watchCount')==1
 before=page.evaluate('window.__cancels')
 page.locator('#nav-radar-toggle').click()
 assert page.locator('#radar-screen').is_visible()
 assert page.evaluate('BNaviRideMode.isRadarVisible()')
 assert page.evaluate('window.__cancels')>before,'entering radar did not cancel voice'
 spoken=page.evaluate('window.__spoken.length')
 assert page.evaluate("speak('右折です')") is False
 assert page.evaluate('window.__spoken.length')==spoken,'radar read out turn announcement'
 page.evaluate("window.__arrivalDone=false;announceArrival('目的地に到着しました',()=>window.__arrivalDone=true)")
 assert page.evaluate('window.__arrivalDone'),'final arrival blocked by muted speech'
 assert page.evaluate('window.__spoken.length')==spoken,'radar read out arrival'
 assert page.evaluate('state.navActive'),'radar mute stopped guidance'
 assert page.evaluate('window.__watchCount')==1,'radar created second GPS watcher'
 page.locator('#radar-exit').click()
 assert not page.evaluate('BNaviRideMode.isRadarVisible()')
 assert page.evaluate("speak('地図に戻りました')") is True
 assert page.evaluate('window.__spoken.at(-1)')=='地図に戻りました','voice did not resume'
 page.locator('#nav-stop-quick').click()
 page.locator('#mobile-ride').click()
 page.locator('#ride-radar').click()
 assert page.evaluate('BNaviRideMode.getMode()')=='radar'
 assert page.evaluate("speak('左折です')") is False
 assert errors==[],errors
 print('PASS browser: nav radar cancels current speech, mutes turn/arrival, preserves GPS, returns voice on map, standalone radar silent')
 browser.close()
