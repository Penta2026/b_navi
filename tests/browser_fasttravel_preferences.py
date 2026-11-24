"""Chromium: 126cc fasttravel can combine coast, backroad, scenic and cruise.
The BRouter route is a mock; this does not certify real sea views or motorway access.
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
  page=browser.new_page(viewport={'width':width,'height':850},locale='ja-JP')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.evaluate('''() => {
   const storage={};window.__saved=storage;
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
  page.locator('#vehicle').select_option('2')
  page.locator('#mode').select_option('3')
  panel=page.locator('#custom-route-panel')
  assert panel.is_visible(),('fasttravel option panel hidden',width)
  policy=page.locator('#route-policy').text_content()
  assert page.locator('#mode').input_value()=='3',('fast mode not selected',width)
  assert '高速' in policy,('fast policy not displayed',width,policy)
  page.locator('#route-coast').check()
  page.locator('#route-backroad').check()
  page.locator('input[name="route-view"][value="scenic"]').check()
  page.locator('input[name="route-ride"][value="cruise"]').check()
  summary=page.evaluate('''() => currentPreferences()''')
  assert summary=={'view':'scenic','ride':'cruise','backroad':True,'coast':True},(width,summary)
  page.evaluate('''() => {
   window.hostedOnPages=()=>true; // Test as a public GitHub Pages PWA, not about:blank.
   const start=document.querySelector('#start'),goal=document.querySelector('#goal');
   start.value='34.39734,132.45939';goal.value='34.40631,132.47600';
   window.__queries=[];
   BNaviPublicBrouter.query=async(points,vehicle,mode,net,progress,custom)=>{
    window.__queries.push({vehicle,mode,custom,points});
    return {
     profile:'fast-travel-mock',elapsedMs:100,
     track:{points:points.map(x=>x.slice()),cues:[],meters:2500},
     gpx:BNaviPublicBrouter.gpxFromTrack({points:points.map(x=>x.slice()),cues:[]},'test')
    };
   };
  }''')
  page.locator('#calculate').click()
  page.wait_for_timeout(150)
  query=page.evaluate('''() => ({
    calls:window.__queries,
    mode:state.activeRoutingMode,
    setting:state.activeRouteTuning,
    status:document.querySelector('#message').textContent
  })''')
  assert len(query['calls'])==1,('query not performed',width,query)
  assert query['calls'][0]['mode']==3 and str(query['calls'][0]['vehicle'])=='2',query
  assert query['calls'][0]['custom']['preferences']==summary,query
  assert query['setting']['preferences']==summary,query
  # Switching all four preferences off must restore the ORIGINAL fast BRF.
  page.locator('#route-coast').uncheck()
  page.locator('#route-backroad').uncheck()
  page.locator('input[name="route-view"][value="normal"]').check()
  page.locator('input[name="route-ride"][value="normal"]').check()
  page.locator('#calculate').click()
  page.wait_for_timeout(120)
  again=page.evaluate('''() => ({
    calls:window.__queries,
    tuning:state.activeRouteTuning,mode:state.activeRoutingMode
  })''')
  assert len(again['calls'])==2 and again['calls'][-1]['mode']==3,again
  assert again['calls'][-1]['custom'] is None,('fasttravel no-options should use base BRF',width,again)
  assert again['tuning'] is None,again
  page.locator('#vehicle').select_option('1')
  assert all(x.value!='3' for x in page.locator('#mode option').all()),width
  assert not errors,('page script errors',width,errors)
  print('PASS FAST 126cc extra preferences+water+backroad+cruise, no-options untouched:',width)
  page.close()
 browser.close()
