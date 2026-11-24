"""Actual Chromium clicks for B_Navi opt-in Biwako Bridge route.
Mock BRouter does not certify real road connections or bridge regulations.
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
  page=browser.new_page(viewport={'width':width,'height':860},locale='ja-JP')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.evaluate('''() => {
   const storage={};window.__storage=storage;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=String(v),removeItem:k=>delete storage[k]
   }});
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:()=>1,clearWatch:()=>{}}});
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(){},getVoices(){return []}}});
   window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
   window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
  }''')
  for filename in scripts:page.add_script_tag(content=(ROOT/filename.split('?',1)[0]).read_text())
  toggle=page.locator('#route-biwako-bridge')
  assert toggle.is_visible() and not toggle.is_checked()
  page.locator('#route-backroad').check()
  page.locator('#route-coast').check()
  toggle.check()
  assert toggle.is_checked() and page.locator('#route-backroad').is_checked() and page.locator('#route-coast').is_checked()
  assert page.evaluate("JSON.parse(localStorage.getItem('bnavi.pc.v1')).biwakoBridgeSelected") is True
  page.evaluate('''() => {
   window.hostedOnPages=()=>true;
   document.querySelector('#start').value='35.118000,135.905000';
   document.querySelector('#goal').value='35.124000,135.970000';
   window.__requests=[];
   window.__returnBad=false;
   BNaviPublicBrouter.query=async(points,vehicle,mode,net,progress,custom)=>{
    window.__requests.push({points,vehicle,mode,custom});
    const good=[points[0],[35.119,135.924],[35.120902,135.935418],
       [35.121,135.951],points.at(-1)];
    const track={points:window.__returnBad?[points[0],points.at(-1)]:good,cues:[]};
    return {profile:'mock',elapsedMs:10,track,gpx:BNaviPublicBrouter.gpxFromTrack(track,'mock')};
   };
  }''')
  page.locator('#calculate').click()
  page.wait_for_timeout(160)
  state=page.evaluate('''() => ({
   calls:window.__requests,active:state.biwakoBridgeActive,route:state.routeType,
   via:state.via,
   status:document.querySelector('#message').textContent
  })''')
  assert len(state['calls'])==1,(width,state)
  q=state['calls'][0]
  assert len(q['points'])==3 and q['points'][1]==[35.120902,135.935418],(width,q)
  assert q['custom']['biwakoBridgeToll'] is True,(width,q)
  assert state['active'] and state['route']=='normal' and not state['via'],(width,state)
  assert '琵琶湖大橋' in state['status'],(width,state)
  page.evaluate('window.__returnBad=true')
  page.locator('#calculate').click()
  page.wait_for_timeout(140)
  assert '横断したと確認できません' in page.locator('#message').inner_text(),width
  toggle.uncheck()
  page.locator('#calculate').click()
  page.wait_for_timeout(140)
  last=page.evaluate('''() => window.__requests.at(-1)''')
  assert len(last['points'])==2 and last['custom'].get('biwakoBridgeToll') is None,(width,last)
  assert not errors,('JS runtime errors',width,errors)
  print('PASS',width,'Biwako toggle / waypoint / toll profile / fake crossing rejection / off = legacy')
  page.close()
 browser.close()
