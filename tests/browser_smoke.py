from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
html=(base/'index.html').read_text()
html=re.sub(r'<script\s+src="[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="./style.css">', '<style>'+ (base/'style.css').read_text() +'</style>',html)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {
   const store = {}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v},removeItem:k=>delete store[k]}});
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   window.__spoken=[];
   window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){window.__spoken.push(u.text);},getVoices(){return [{lang:'ja-JP',name:'test'}]}}});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition(ok){setTimeout(()=>ok({coords:{latitude:34.41003,longitude:132.45006,accuracy:8,heading:90,speed:4}}),150);return 3},clearWatch(){}}});
 }''')
 for fn in ['navigation-heading.js','map-core.js','android-approaches.js','shimanami-geometry.js','offline-route-store.js','public-brouter-client.js','app.js','place-search-core.js','mobile-ui.js','ride-radar.js','gpx-transfer.js']:
  page.add_script_tag(content=(base/fn).read_text())
 page.wait_for_timeout(550)
 print('page title',page.title(),'JS errors',errs[:3]);print('initial orientation',page.locator('#orientation-toggle').inner_text())
 page.evaluate('''() => routeView('normal',[{type:'road',points:[[34.41,132.45],[34.41003,132.45006],[34.411,132.451],[34.412,132.452]],label:'TEST'}], `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.41" lon="132.45"/><trkpt lat="34.41003" lon="132.45006"/><trkpt lat="34.411" lon="132.451"/><trkpt lat="34.412" lon="132.452"/></trkseg></trk><rte><rtept lat="34.411" lon="132.451"><desc>right</desc><extensions><offset>2</offset></extensions></rtept></rte></gpx>`,'UI TEST ROUTE')''')
 assert page.locator('#navigation-quickbar').is_visible()
 assert not page.locator('#map-style-toggle').count()
 assert page.evaluate('document.body.dataset.mapStyle')=='simple'
 page.locator('#voice-test-quick').click()
 assert any('音声テスト' in s for s in page.evaluate('window.__spoken'))
 page.locator('#orientation-toggle').click()
 assert page.locator('#orientation-toggle').inner_text()=='北を上'
 page.locator('#nav-start-quick').click()
 page.wait_for_timeout(400)
 result=page.evaluate('''() => ({orientation:state.orientation,bearing:map.bearing,heading:map.gpsHeading,spoken:window.__spoken,gpsArrow:document.querySelectorAll('#gps-layer path').length,navActive:state.navActive})''')
 print('state',result)
 assert result['navActive'] and result['heading']==90 and result['bearing']==270 and result['gpsArrow']==1
 assert result['spoken']
 assert page.locator('#navigation-hud').is_visible()
 assert not page.locator('.topbar').is_visible()
 assert not page.locator('.mobile-toolbar').is_visible()
 assert not page.locator('#sidebar').is_visible()
 assert not page.locator('#voice-test-quick').is_visible()
 assert all(page.locator('#'+i).is_visible() for i in ('map-location','center-hiroshima','orientation-toggle','nav-stop-quick'))
 assert not page.locator('#zoom-in').is_visible()
 assert page.evaluate('''() => {const r=document.querySelector('#map-container').getBoundingClientRect();return r.width===390 && r.height===844}''')
 print('geometry',page.evaluate('''() => Object.fromEntries(['map-container','map-overlay','gps-layer','navigation-quickbar','orientation-toggle','sidebar','workspace'].map(id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return [id,{x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden,visibility:getComputedStyle(e).visibility,z:getComputedStyle(e).zIndex}]}))'''))
 print('scrolls',page.evaluate('''() => ({scrollY:window.scrollY,bodyY:document.body.scrollTop,htmlY:document.documentElement.scrollTop,layoutY:document.getElementById('layout').getBoundingClientRect().y,layoutScroll:document.getElementById('layout').scrollTop,bodyRect:document.body.getBoundingClientRect().y})'''))
 print('ctrl',page.evaluate('''() => [...document.querySelectorAll('.map-controls button')].map(x=>({id:x.id,hidden:x.hidden,y:x.getBoundingClientRect().y,visible:getComputedStyle(x).display}))'''))
 print('render',page.evaluate('''() => ({lat:map.lat,lon:map.lon,zoom:map.zoom,gps:map.gps,heading:map.gpsHeading,bearing:map.bearing,point:map.screenPos(state.location)})'''))
 # Screenshot is optional; do not write generated files into the source repo.
 page.locator('#nav-stop-quick').click()
 assert not page.evaluate('state.navActive')
 assert page.locator('.mobile-toolbar').is_visible()
 assert page.locator('.topbar').is_visible()
 assert not page.locator('#navigation-hud').is_visible()
 print('PASS browser simulated phone UI and voice lifecycle',errs[:10]);assert not errs
 browser.close()
