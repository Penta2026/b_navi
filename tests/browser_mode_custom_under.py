"""Public B_Navi mode dropdown and independent customization: browser simulation."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
scripts=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html).replace('<link rel="stylesheet" href="./style.css">','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''()=>{
  const saved={};window.__saved=saved;
  Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=String(v),removeItem:k=>delete saved[k]}});
  window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>null}});
 }''')
 for js in scripts:page.add_script_tag(content=(ROOT/js).read_text())
 assert page.locator('#vehicle').is_visible() and page.locator('#mode').is_visible()
 assert page.locator('#vehicle').bounding_box()['y'] == page.locator('#mode').bounding_box()['y'] or abs(page.locator('#vehicle').bounding_box()['y']-page.locator('#mode').bounding_box()['y'])<3
 assert page.locator('#route-tuning-panel').bounding_box()['y']>page.locator('#mode').bounding_box()['y']
 assert page.locator('#route-tuning-panel').get_attribute('open') is None
 assert [x.strip() for x in page.locator('#mode option').all_text_contents()] == ['ビギナー','一般','探索']
 assert page.locator('#mode').input_value()=='1'
 assert not page.locator('#tuning-enabled').is_checked()
 # Route with all standard modes must pass distinct mode indexes and null custom payload.
 page.evaluate('''()=>{
  document.getElementById('start').value='34.400000,132.450000';
  document.getElementById('goal').value='34.410000,132.460000';
  usePublicBrouter=()=>true;
  window.__calls=[];
  BNaviPublicBrouter.query=async (points,vehicle,mode,netFetch,progress,custom)=>{
   __calls.push({vehicle,mode,custom});
   const gpx='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4" lon="132.45"/><trkpt lat="34.41" lon="132.46"/></trkseg></trk></gpx>';
   return {profile:'mock',track:{points,cues:[]},gpx,elapsedMs:1};
  };
 }''')
 for v in ['0','1','2']:
  page.locator('#mode').select_option(v)
  page.locator('#calculate').evaluate('(e)=>e.click()')
  page.wait_for_function('window.__calls.length === '+str(int(v)+1))
  call=page.evaluate('__calls.at(-1)')
  assert call['mode']==int(v) and call['custom'] is None,call
 # Explore route rerouting preserves explore even if user changes selection later.
 page.evaluate('''()=>{state.navActive=true;state.navPaused=false;state.location=[34.401,132.451];state.activeTargets=[[34.41,132.46]];state.targetIndex=0;}''')
 page.locator('#mode').select_option('0')
 page.evaluate('''async()=>{await rerouteFromGps()}''')
 assert page.evaluate('__calls.at(-1).mode')==2
 assert page.evaluate('__calls.at(-1).custom') is None
 page.evaluate('state.navActive=false')
 # Custom below the dropdown, active only once selected / slider touched.
 page.locator('#route-tuning-panel').evaluate('(e)=>e.open=true')
 page.locator('#tune-explore').evaluate('(e)=>{e.value="60";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 assert page.locator('#mode').input_value()=='1'
 assert page.locator('#tuning-enabled').is_checked()
 assert page.locator('#tuning-tag').inner_text().startswith('ON')
 page.locator('#calculate').evaluate('(e)=>e.click()')
 page.wait_for_function('window.__calls.length===5')
 call=page.evaluate('__calls.at(-1)')
 assert call['mode']==1 and call['custom']['explore']==60,call
 # Switching back to beginner leaves 55 in editing memory but calculates original beginner.
 page.locator('#mode').select_option('0')
 assert not page.locator('#tuning-enabled').is_checked()
 assert page.locator('#tune-explore').input_value()=='60'
 page.locator('#calculate').evaluate('(e)=>e.click()')
 page.wait_for_function('window.__calls.length===6')
 assert page.evaluate('__calls.at(-1)')=={'vehicle':'1','mode':0,'custom':None}
 assert not page.evaluate('JSON.parse(__saved["bnavi.pc.v1"]).customEnabled')
 # 126cc option retained, changing to it from beginner in 125cc selects general fallback when needed.
 page.locator('#vehicle').select_option('2')
 assert len(page.locator('#mode option').all_text_contents())==4
 page.locator('#mode').select_option('3')
 page.locator('#calculate').evaluate('(e)=>e.click()')
 page.wait_for_function('window.__calls.length===7')
 assert page.evaluate('__calls.at(-1).mode')==3
 page.locator('#vehicle').select_option('1')
 assert page.locator('#mode').input_value()=='1'
 assert len(page.locator('#mode option').all_text_contents())==3
 assert not errors,errors
 print('PASS browser: 3 restored standard modes; custom below, toggle, saved settings; 126 fast; reroute mode snapshot, 390px')
 browser.close()
