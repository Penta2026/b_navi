"""Phone smoke: free ride -> recorded GPX actions; route -> normal voice -> radar -> voice.
GPS and speech are mocked. This is NOT an outdoor/real GPS validation.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf8')
modules=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','')
GPX='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.40" lon="132.45"/><trkpt lat="34.405" lon="132.455"/></trkseg></trk><rte><rtept lat="34.403" lon="132.453"><desc>right</desc><extensions><offset>1</offset></extensions></rtept></rte></gpx>'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (390,320):
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=True,has_touch=True,locale='ja-JP',accept_downloads=True)
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.add_style_tag(content=(ROOT/'style.css').read_text(encoding='utf8'))
  page.evaluate('''()=>{
    const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}});
    localStorage.setItem('bnavi.routeApiBase.v1','https://example.invalid/');
    Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
    window.__watchCount=0;window.__clearCount=0;window.__spoken=[];
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
      watchPosition(fn,err){window.__gpsOk=fn;window.__watchCount++;return window.__watchCount;},
      clearWatch(id){window.__clearCount++}
    }});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){window.__spoken.push(u.text)},getVoices(){return []}}});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
    window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>''}});
    window.__gps=(lat,lon,t=Date.now())=>window.__gpsOk({timestamp:t,coords:{latitude:lat,longitude:lon,accuracy:5,heading:30,speed:6,altitude:8}});
  }''')
  for name in modules:
   page.add_script_tag(content=(ROOT/name).read_text(encoding='utf8'))
  page.wait_for_timeout(90)
  assert page.locator('#ride-radar').count()==0
  assert page.locator('#nav-radar-toggle').is_hidden()
  # A previously calculated route must disappear only from the screen in free mode.
  # S/G coordinates and markers, and the underlying route geometry, all survive.
  page.evaluate('''gpx=>{
    document.getElementById('start').value='34.4,132.45';
    document.getElementById('goal').value='34.405,132.455';
    routeView('normal',[{type:'road',points:[[34.4,132.45],[34.405,132.455]],gpx,label:'planned-route'}],gpx,'route loaded');
  }''',GPX)
  page.wait_for_timeout(80)
  assert page.evaluate('map.pathLayer.children.length')==1, 'planned route missing before free ride'
  assert set(page.evaluate('map.markers.map(x=>x.symbol)'))=={'S','G'}
  page.locator('#mobile-ride').click()
  assert page.locator('#ride-free').is_visible()
  page.locator('#ride-free').click()
  assert page.evaluate('BNaviRideMode.getMode()')=='free'
  assert page.evaluate('window.__watchCount')==1
  page.wait_for_timeout(80)
  assert page.evaluate('map.paths.length')==0, 'free ride must hide route geometry immediately'
  assert page.evaluate('map.pathLayer.children.length')==0, 'guidance line still visible'
  assert set(page.evaluate('map.markers.map(x=>x.symbol)'))=={'S','G'}, 'S/G markers disappeared'
  assert page.evaluate('state.routes.length')==1, 'free ride erased planned route'
  assert page.locator('#start').input_value()=='34.4,132.45'
  assert page.locator('#goal').input_value()=='34.405,132.455'
  page.evaluate('window.__gps(34.4,132.45,1700000000000)')
  page.evaluate('window.__gps(34.4002,132.4502,1700000003000)')
  assert page.evaluate('BNaviTrack.getState().count')==2
  page.wait_for_timeout(80)
  assert page.evaluate('map.pathLayer.children.length')==0, 'GPS fix restored unwanted route'
  page.locator('#ride-stop').click()
  page.wait_for_timeout(150)
  assert page.evaluate('BNaviRideMode.getMode()')=='off'
  assert not page.evaluate('document.body.classList.contains("free-ride-active")')
  page.wait_for_timeout(80)
  assert page.evaluate('map.pathLayer.children.length')==1, 'planned route not restored after free ride'
  assert set(page.evaluate('map.markers.map(x=>x.symbol)'))=={'S','G'}
  assert page.locator('#track-panel').get_attribute('data-state')=='ready'
  assert page.locator('#sidebar').evaluate('(e)=>e.classList.contains("sheet-open")')
  assert page.locator('#track-save').is_visible()
  assert page.locator('#track-share').is_enabled()
  assert page.evaluate('BNaviTrack.xml().split("<trkpt").length-1')==2
  with page.expect_download(timeout=5000) as download_info:
   page.locator('#track-save').click()
  assert download_info.value.suggested_filename.endswith('.gpx')
  # A route is required for navigation. Even with a route, radar stays hidden until voice starts.
  page.evaluate('''gpx=>{
    document.getElementById('start').value='34.4,132.45';
    document.getElementById('goal').value='34.405,132.455';
    state.via=[];
    routeView('normal',[{type:'road',points:[[34.4,132.45],[34.405,132.455]],gpx,label:'route'}],gpx,'ready');
  }''',GPX)
  assert page.locator('#nav-radar-toggle').is_hidden()
  page.locator('#nav-start-quick').click()
  assert page.evaluate('state.navActive')
  assert not page.locator('#radar-screen').is_visible()
  assert page.locator('#nav-radar-toggle').is_visible()
  assert page.evaluate('window.__watchCount')==2
  page.locator('#nav-radar-toggle').click()
  assert page.locator('#radar-screen').is_visible()
  assert page.evaluate('BNaviRideMode.getMode()')=='nav-radar'
  assert page.locator('#radar-exit').inner_text().startswith('🔈')
  assert page.evaluate('window.__watchCount')==2
  page.evaluate('window.__gps(34.401,132.451)')
  assert '直線' in page.locator('#radar-readout').inner_text()
  assert page.evaluate("speak('左折です')") is False
  page.locator('#radar-exit').click()
  assert page.evaluate('state.navActive')
  assert page.evaluate('BNaviRideMode.getMode()')=='off'
  assert page.evaluate("speak('左折です')") is True
  assert not page.locator('#radar-screen').is_visible()
  page.locator('#nav-stop-quick').click()
  assert not page.evaluate('state.navActive')
  assert page.evaluate('window.__watchCount')==2
  assert not errors,(width,errors)
  page.close();context.close()
 print('PASS: 320px/390px free ride->real GPX download, navigation default voice->radar->voice, single GPS watcher')
 browser.close()
