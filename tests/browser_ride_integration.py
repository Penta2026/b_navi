"""Android/phone-like GPS integration smoke. All GPS/TTS/network mocked; NOT a field test."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^\"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^\"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
GPX='''<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4000" lon="132.4500"/><trkpt lat="34.4005" lon="132.4500"/><trkpt lat="34.4009" lon="132.4500"/><trkpt lat="34.4013" lon="132.4500"/><trkpt lat="34.4018" lon="132.4500"/></trkseg></trk><rte><rtept lat="34.4013" lon="132.4500"><desc>right</desc><extensions><offset>3</offset></extensions></rtept></rte></gpx>'''
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
 page=ctx.new_page()
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''() => {
   const ls={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>ls[k]||null,setItem:(k,v)=>{ls[k]=String(v)},removeItem:k=>delete ls[k]}});
   localStorage.setItem('bnavi.routeApiBase.v1','https://example.invalid/');
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   window.__spoken=[];window.__watchCount=0;
   const synth={cancel(){},speak(u){window.__spoken.push(u.text); if(u.onend)setTimeout(()=>u.onend(),15)},getVoices(){return []}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
   window.SpeechSynthesisUtterance=class{constructor(s){this.text=s}};
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(success,error){window.__gpsOk=success;window.__gpsErr=error;window.__watchCount++;return 7},clearWatch(){}}});
   window.fetch=async url=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
   window.__gps=(lat,lon,accuracy=5)=>window.__gpsOk({coords:{latitude:lat,longitude:lon,accuracy,heading:0,speed:7},timestamp:Date.now()});
 }''')
 for name in names:page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(180)
 page.evaluate('''gpx=>{
    document.getElementById('start').value='34.400000,132.450000';
    document.getElementById('goal').value='34.401800,132.450000';
    state.via=['34.400900,132.450000']; renderVia();
    routeView('normal',[{type:'road',points:[[34.4,132.45],[34.4005,132.45],[34.4009,132.45],[34.4013,132.45],[34.4018,132.45]],gpx,label:'test'}],gpx,'test');
 }''',GPX)
 page.locator('#nav-start-quick').click()
 page.wait_for_timeout(80)
 assert page.evaluate('state.navActive'), 'nav not started'
 assert page.evaluate('document.body.classList.contains("navigation-active")')
 assert page.locator('.topbar').evaluate('(e)=>getComputedStyle(e).display')=='none'
 assert page.locator('#map-controls #zoom-in').is_visible() and page.locator('#map-controls #zoom-out').is_visible()
 assert page.locator('#nav-radar-toggle').is_visible()
 # First accurate fix near via and 2nd fix to confirm arrival
 page.evaluate('window.__gps(34.40082,132.45,5)')
 page.evaluate('window.__gps(34.40084,132.45,5)')
 page.wait_for_timeout(80)
 assert page.locator('#next-destination-dialog').is_visible(), 'missing waypoint prompt'
 assert page.evaluate('state.navPaused')
 assert '経由地' in page.locator('#next-destination-title').inner_text()
 page.locator('#next-destination-continue').click()
 assert page.evaluate('state.targetIndex')==1
 assert not page.evaluate('state.navPaused')
 # Switch to nav radar, not second GPS watch.
 page.locator('#nav-radar-toggle').click()
 assert page.locator('#radar-screen').is_visible(), 'radar not showing'
 assert page.evaluate('BNaviRideMode.getMode()')=='nav-radar'
 assert page.evaluate('window.__watchCount')==1, 'opened redundant GPS watch'
 page.locator('#radar-exit').click()
 assert not page.locator('#radar-screen').is_visible()
 # 20m turn prompt must speak short immediate instruction on approach
 page.evaluate('window.__gps(34.40120,132.45,5)')
 page.wait_for_timeout(80)
 assert any(x=='右折です' for x in page.evaluate('window.__spoken')), page.evaluate('window.__spoken')
 # At final destination, two GPS fixes and TTS completion end guidance.
 page.evaluate('window.__gps(34.40174,132.45,5)')
 page.evaluate('window.__gps(34.40177,132.45,5)')
 page.wait_for_timeout(200)
 assert not page.evaluate('state.navActive'), 'did not auto-end after arrival'
 assert '目的地に到着しました。案内を終了します。' in page.evaluate('window.__spoken')
 # Simulated road deviation: 3 GPS fixes separated by 1.2s lead to one online reroute request.
 page.evaluate('''gpx=>{
   state.via=[];renderVia();
   window.__routeCalls=0;
   window.fetch=async (url,opts)=>{
     if(String(url).includes('/api/route')){window.__routeCalls++;return {ok:true,status:200,headers:{get:()=> 'application/gpx+xml'},text:async()=>gpx}}
     return {ok:false,status:503,headers:{get:()=>''},text:async()=>''};
   };
   routeView('normal',[{type:'road',points:[[34.4,132.45],[34.4005,132.45],[34.4009,132.45],[34.4013,132.45],[34.4018,132.45]],gpx,label:'old route'}],gpx,'before reroute');
 }''',GPX)
 page.locator('#nav-start-quick').click()
 # At home, stationary GPS drift must not trigger rerouting.
 page.evaluate('window.__gpsOk({coords:{latitude:34.4003,longitude:132.4550,accuracy:5,heading:0,speed:0},timestamp:Date.now()})')
 page.wait_for_timeout(680)
 page.evaluate('window.__gpsOk({coords:{latitude:34.4003,longitude:132.4550,accuracy:5,heading:0,speed:0},timestamp:Date.now()})')
 page.wait_for_timeout(680)
 page.evaluate('window.__gpsOk({coords:{latitude:34.4003,longitude:132.4550,accuracy:5,heading:0,speed:0},timestamp:Date.now()})')
 assert page.evaluate('window.__routeCalls')==0,'reroute while stationary'
 # Sustained GPS speed re-enables rerouting only after several off-route fixes.
 for i in range(4):
  page.evaluate('window.__gps(34.4003,132.4550,5)')
  page.wait_for_timeout(670)
 page.wait_for_timeout(200)
 assert page.evaluate('window.__routeCalls')==1, f"reroute requests: {page.evaluate('window.__routeCalls')}"
 assert page.evaluate('state.navActive'), 'reroute stopped guidance'
 page.locator('#nav-stop-quick').click()
 # Free-ride fullscreen still allows map buttons
 page.locator('#mobile-ride').click()
 page.locator('#ride-free').click()
 assert page.evaluate('document.body.classList.contains("free-ride-active")')
 assert page.locator('.topbar').evaluate('(e)=>getComputedStyle(e).display')=='none'
 assert page.locator('#map-controls #zoom-in').is_visible() and page.locator('#map-controls #zoom-out').is_visible()
 page.evaluate('window.__gps(34.4008,132.45,5)')
 page.locator('#ride-stop').click()
 assert not page.evaluate('document.body.classList.contains("free-ride-active")')
 assert page.locator('#track-panel').get_attribute('data-state')=='ready'
 assert page.locator('#track-save').is_enabled()
 # A free ride now owns the only pre-navigation ride mode. Ending it shows GPX actions.
 assert page.locator('#ride-radar').count()==0
 assert page.locator('#track-panel').get_attribute('data-state') in ('ready','idle')
 assert page.locator('#sidebar').evaluate('(e)=>e.classList.contains("sheet-open")')
 # Previous route navigation radar is still available only during guidance.
 assert page.locator('#nav-radar-toggle').is_hidden()
 assert not errors,errors
 print('PASS phone GPS: waypoint prompt, continuing, single GPS radar toggle, 20m right turn, final TTS end, free-ride full-screen')
 browser.close()
