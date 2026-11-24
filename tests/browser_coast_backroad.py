"""Chromium integration test: route-backroad + route-coast remain individually toggleable.
Coastal scoring uses an estimated-water proxy and is NOT evidence of a sea view.
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
   const saved={};window.__saved=saved;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
    getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=String(v),removeItem:k=>delete saved[k]
   }});
   Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition:()=>1,clearWatch:()=>{}}});
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(){},getVoices(){return []}}});
   window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
   window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}});
  }''')
  for filename in scripts:page.add_script_tag(content=(ROOT/filename.split('?',1)[0]).read_text())
  back=page.locator('#route-backroad');coast=page.locator('#route-coast')
  assert back.is_visible() and coast.is_visible(),('controls missing',width)
  assert not back.is_checked() and not coast.is_checked(),width
  back.check()
  assert back.is_checked() and not coast.is_checked(),'backroad unexpectedly toggled coast'
  coast.check()
  assert back.is_checked() and coast.is_checked(),'coast must not turn backroad OFF'
  page.locator('input[name="route-view"][value="distance"]').check()
  page.locator('input[name="route-ride"][value="cruise"]').check()
  saved=page.evaluate('''() => JSON.parse(localStorage.getItem('bnavi.pc.v1')).routePreferences''')
  assert saved=={'view':'distance','ride':'cruise','backroad':True,'coast':True},saved
  current=page.evaluate('''() => currentPreferences()''')
  assert current==saved,('current preferences differ from saved',width,current,saved)
  back.uncheck()
  assert coast.is_checked() and not back.is_checked(),'coast unexpectedly toggled backroad'
  coast.uncheck()
  assert not back.is_checked() and not coast.is_checked()
  assert '海沿い優先' in page.locator('#route-preference-help-dialog').inner_text()
  assert not errors,('page JS errors',width,errors)
  print('PASS independent backroad and coast checkbox combination, mode retention, persistence:',width)
  page.close()
 browser.close()
