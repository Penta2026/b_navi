"""B_Navi real Chromium click regression for folding optional preferences.
The current mode and all preference flags must survive folding and reopening.
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
   const stored={};window.__stored=stored;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>stored[k]||null,setItem:(k,v)=>stored[k]=String(v),removeItem:k=>delete stored[k]
   }});
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:()=>1,clearWatch:()=>{}}});
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(){},getVoices(){return []}}});
   window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
   window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
  }''')
  for filename in scripts:page.add_script_tag(content=(ROOT/filename.split('?',1)[0]).read_text())
  page.locator('input[name="route-view"][value="distance"]').check()
  page.locator('input[name="route-ride"][value="cruise"]').check()
  page.locator('#route-coast').check()
  page.locator('#route-backroad').check()
  before=page.evaluate('''() => currentPreferences()''')
  assert before=={'view':'distance','ride':'cruise','backroad':True,'coast':True},before
  toggle=page.locator('#route-preference-toggle')
  assert toggle.is_visible() and toggle.get_attribute('aria-expanded')=='true'
  toggle.click()
  assert toggle.get_attribute('aria-expanded')=='false'
  assert page.locator('#route-preference-body').is_hidden()
  assert '海沿い優先' in page.locator('#route-preference-collapsed-summary').inner_text()
  assert '裏道優先' in page.locator('#route-preference-collapsed-summary').inner_text()
  assert '距離優先' in page.locator('#route-preference-collapsed-summary').inner_text()
  assert page.evaluate("localStorage.getItem('bnavi.routeOptionsCollapsed.v1')")=='1'
  after=page.evaluate('''() => currentPreferences()''')
  assert after==before,('options mutated by closing',width,after,before)
  toggle.click()
  assert toggle.get_attribute('aria-expanded')=='true'
  assert page.locator('#route-preference-body').is_visible()
  assert page.locator('#route-coast').is_checked() and page.locator('#route-backroad').is_checked()
  assert page.locator('input[name="route-view"][value="distance"]').is_checked()
  assert page.evaluate("localStorage.getItem('bnavi.routeOptionsCollapsed.v1')")=='0'
  assert not errors,('page errors',width,errors)
  print('PASS fold/unfold persisted UI, coast+backroad+ride+view unchanged:',width)
  page.close()
 browser.close()
