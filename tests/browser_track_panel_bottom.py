"""Regression: idle GPX lives below route controls, never intercepts sheet drag, and saved tracks retain actions."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text(encoding='utf-8')
scripts=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (390,320):
  page=browser.new_page(viewport={'width':width,'height':780},is_mobile=True,has_touch=True,locale='ja-JP')
  errors=[]
  page.on('pageerror',lambda error: errors.append(str(error)))
  page.set_content(html)
  page.add_style_tag(content=(ROOT/'style.css').read_text())
  page.evaluate('''()=>{
    const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=String(v)},removeItem:k=>{delete data[k]}}});
    window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>null}});
  }''')
  for script in scripts:page.add_script_tag(content=(ROOT/script).read_text())
  assert page.locator('#track-panel').evaluate('(e)=>e.parentElement.classList.contains("side-inner")')
  assert page.locator('#track-panel').evaluate('(e)=>getComputedStyle(e).position')=='static'
  assert page.locator('#track-panel').get_attribute('data-state')=='idle'
  assert '記録待機中' in page.locator('#track-status').inner_text()
  assert not page.locator('#track-save').is_visible()
  assert not page.locator('#track-share').is_visible()
  # Its rect is part of the route sheet; no floating GPX can obscure the bottom sheet handle.
  assert page.locator('#sheet-handle').evaluate('(e)=>getComputedStyle(e).pointerEvents')!='none'
  page.evaluate('''()=>{
    BNaviTrack.start('フリー走行');
    BNaviTrack.add({timestamp:Date.now(),coords:{latitude:34.4,longitude:132.45,accuracy:5,altitude:10}});
    BNaviTrack.stop();
  }''')
  assert page.locator('#track-panel').get_attribute('data-state')=='ready'
  assert page.locator('#track-save').is_enabled()
  assert page.locator('#track-share').is_enabled()
  assert page.locator('#track-discard').is_enabled()
  page.locator('#sidebar').evaluate('(e)=>e.classList.add("sheet-open")')
  page.locator('#track-panel').evaluate('(e)=>e.scrollIntoView({block:"end"})')
  assert page.locator('#track-save').is_visible()
  assert page.locator('#track-share').is_visible()
  page.once('dialog',lambda dialog:dialog.accept())
  page.locator('#track-discard').click()
  assert page.locator('#track-panel').get_attribute('data-state')=='idle'
  assert not page.locator('#track-save').is_visible()
  assert not errors,errors
  page.close()
 print('PASS: 390px/320px idle GPX at sheet bottom, unobstructed handle, track save/share state, discard')
 browser.close()
