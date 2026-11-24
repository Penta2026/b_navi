"""Actual Chromium tap on B_Navi voice guidance detour: success and safe rollback.
The BRouter network and geolocation are mocked, so NOT a road/traffic test.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
scripts=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<script\s+type="module"\s+src="\./[^"]+"\s*></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (390,1200):
  page=browser.new_page(viewport={'width':width,'height':880},locale='ja-JP')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.evaluate('''() => {
   const storage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=String(v),removeItem:k=>delete storage[k]
   }});
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:()=>1,clearWatch:()=>{}}});
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(){},getVoices(){return []}}});
   window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
   window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
  }''')
  for filename in scripts:page.add_script_tag(content=(ROOT/filename.split('?')[0]).read_text())
  page.evaluate('''() => {
   const pts=[[34.400,132.45],[34.410,132.45],[34.420,132.45]];
   document.querySelector('#vehicle').value='1';
   document.querySelector('#start').value='34.400000,132.450000';
   document.querySelector('#goal').value='34.420000,132.450000';
   state.via=['34.410000,132.450000'];renderVia();
   routeView('normal',[{type:'road',points:pts,gpx:'test',label:'original'}],BNaviPublicBrouter.gpxFromTrack({points:pts,cues:[]},'test'),'original');
   state.activeRoutingVehicle=1;state.activeRoutingMode=1;state.activeRouteTuning=null;
   window.__requests=[];window.__shouldFail=false;
   BNaviPublicBrouter.query=async(points,vehicle,mode,net,progress,tuning,options)=>{
    window.__requests.push({points,vehicle,mode,options});
    if(window.__shouldFail)throw Error('mock BRouter error');
    const geometry=[points[0],[34.4015,132.4525],[34.406,132.4525],[34.408,132.4515],...points.slice(1)];
    return{track:{points:geometry,cues:[]},gpx:BNaviPublicBrouter.gpxFromTrack({points:geometry,cues:[]},'detour')};
   };
  }''')
  page.locator('#nav-start-quick').click()
  page.evaluate('''() => {state.location=[34.401,132.45];state.gpsAccuracy=5;syncNavigationHud();}''')
  btn=page.locator('#nav-detour')
  assert btn.is_visible() and btn.is_enabled(),('button unusable',width)
  assert btn.evaluate('(e)=>getComputedStyle(e).pointerEvents')=='auto'
  assert btn.evaluate('(e)=>e.getBoundingClientRect().height')>=44
  btn.click();page.wait_for_timeout(150)
  v=page.evaluate('''() => ({
    calls:window.__requests,route:state.gpsPoints,avoid:state.manualDetour,active:state.navActive,
    targets:state.activeTargets,status:document.querySelector('#nav-status').textContent
  })''')
  assert len(v['calls'])==1,('manual route request not made',width,v)
  assert v['calls'][0]['options']['nogos'][0]['radius']==110,v
  assert len(v['calls'][0]['points'])==3,'via and goal must remain'
  assert v['avoid'] and v['active'] and len(v['targets'])==2,v
  assert '迂回ルート' in v['status'],v
  old=v['route'];page.evaluate('window.__shouldFail=true')
  btn.click();page.wait_for_timeout(150)
  failed=page.evaluate('''() => ({
    route:state.gpsPoints,status:document.querySelector('#nav-status').textContent,
    active:state.navActive
  })''')
  assert failed['route']==old,('failed detour overwrote existing route',width)
  assert '元のルート' in failed['status'] and failed['active'],failed
  page.locator('#nav-stop-quick').click()
  assert btn.is_hidden()
  assert not errors,('browser errors',width,errors)
  print('PASS voice-guidance detour tap, nogos, waypoint order, failure rollback:',width)
  page.close()
 browser.close()
