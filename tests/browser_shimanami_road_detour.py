"""Real Chromium tests for safe local detours in a mixed Shimanami itinerary.
Fake network and GPS; does NOT prove BRouter road access or real riding safety.
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
  for setup in ('big_mainland','moped_island'):
   page=browser.new_page(viewport={'width':width,'height':900},locale='ja-JP')
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
    window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>''});
   }''')
   for filename in scripts:page.add_script_tag(content=(ROOT/filename.split('?')[0]).read_text())
   page.evaluate('''(mode) => {
    window.hostedOnPages=()=>true;
    const big=mode==='big_mainland';
    const points=Array.from({length:25},(_,i)=>[big?34.397:34.320,
     (big?132.45:133.14)+i*(big?.004:.0022)]);
    const vehicle=big?2:1;
    document.querySelector('#vehicle').value=String(vehicle);
    document.querySelector('#start').value=points[0].join(',');
    document.querySelector('#goal').value=points.at(-1).join(',');
    state.via=[];renderVia();
    const originalTrack={points,cues:[]},gpx=BNaviPublicBrouter.gpxFromTrack(originalTrack,'original');
    if(big){
     routeView('normal',[{type:'road',points,gpx,label:'original'},{
      type:'road',points:[[34.4,133.18],[34.3,133.17]],gpx:null,label:'upcoming protected bridge'}],gpx,'original');
     state.shimanamiBigMode=true;
    }else{
     routeView('shimanami',[{type:'road',points,gpx,label:'island road'},{
      type:'bridge',points:[[34.31,133.18],[34.33,133.2]],label:'bridge reference'}],null,'original');
     state.islandLegs=[{points,turnCues:[],name:'因島',bridgeAfter:true,sectionIndex:0}];
     state.islandIndex=0;loadIslandGuidance(0);
    }
    state.activeRoutingVehicle=vehicle;state.activeRoutingMode=1;state.activeRouteTuning=null;
    window.__originalSuffix=points.slice(-3);
    window.__bridgeSnapshot=state.routes.at(-1).points.slice();
    window.__calls=[];window.__fail=false;
    BNaviPublicBrouter.query=async(points,vehicle,mode,net,progress,tuning,options)=>{
     window.__calls.push({points,vehicle,mode,options});
     if(window.__fail)throw Error('network is unavailable');
     const [origin,rejoin]=points;
     const shifted=.003;
     const path=!options?[origin,rejoin]:
      [origin,[origin[0]+shifted,origin[1]+.002],
       [rejoin[0]+shifted,rejoin[1]-.002],rejoin];
     return{track:{points:path,cues:[]},
       gpx:BNaviPublicBrouter.gpxFromTrack({points:path,cues:[]},'partial')};
    };
    window.__startFix=points[2];
   }''',setup)
   page.locator('#nav-start-quick').click()
   page.evaluate('''() => {state.location=window.__startFix.slice();state.gpsAccuracy=5;syncNavigationHud();}''')
   btn=page.locator('#nav-detour')
   assert btn.is_visible() and btn.is_enabled(),('disabled',setup,width,btn.get_attribute('title'))
   btn.click();page.wait_for_timeout(160)
   outcome=page.evaluate('''() => ({
    calls:window.__calls,active:state.navActive,navType:state.routeType,
    big:state.shimanamiBigMode,road:state.routeType==='shimanami'
      ?state.islandLegs[0].points:state.gpsPoints,
    bridge:state.routes.at(-1).points,avoid:state.manualDetour,
    message:document.querySelector('#nav-status').textContent,
    originalSuffix:window.__originalSuffix,bridgeSnapshot:window.__bridgeSnapshot
   })''')
   expected_calls=2 if setup=='big_mainland' else 1
   assert len(outcome['calls'])==expected_calls,('no detour BRouter call',setup,width,outcome)
   assert all(len(call['points'])==2 for call in outcome['calls']),'should only replan to a rejoin point'
   if setup=='big_mainland':assert outcome['calls'][0]['options'] is None,('general-road probe missing',width,outcome)
   assert outcome['calls'][-1]['options']['nogos'][0]['radius']==110,outcome
   assert outcome['road'][-3:]==outcome['originalSuffix'],('future route lost',setup,width,outcome)
   assert outcome['bridge']==outcome['bridgeSnapshot'],('bridge changed',setup,width)
   assert outcome['avoid'] and outcome['active'] and '一般道' in outcome['message'],outcome
   assert outcome['big'] is (setup=='big_mainland'),outcome
   old=outcome['road'];page.evaluate('window.__fail=true')
   btn.click();page.wait_for_timeout(150)
   second=page.evaluate('''() => ({
    road:state.routeType==='shimanami'?state.islandLegs[0].points:state.gpsPoints,
    message:document.querySelector('#nav-status').textContent,
    active:state.navActive
   })''')
   assert second['road']==old and second['active'],('old route lost after failure',setup,width)
   assert not errors,('uncaught browser errors',setup,width,errors)
   print('PASS',width,setup,'local detour, nogo, bridge preservation, rollback')
   page.close()
 browser.close()
