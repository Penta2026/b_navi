"""Mobile route/search/favorites tabs toggle without destroying form state."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="./style.css">','<style>'+ (ROOT/'style.css').read_text() +'</style>',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,390,800):
  page=browser.new_page(viewport={'width':width,'height':760},is_mobile=True,has_touch=True,locale='ja-JP')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html)
  page.evaluate('''() => {
    const s={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=v},removeItem:k=>delete s[k]}});
    window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>''});
  }''')
  for fn in names:page.add_script_tag(content=(ROOT/fn).read_text())
  page.wait_for_timeout(150)
  is_open=lambda: page.locator('#sidebar').evaluate('(e)=>e.classList.contains("sheet-open")')
  places_open=lambda:page.locator('#place-dialog').evaluate('(e)=>e.open')
  assert is_open() and not places_open()
  route=page.locator('#mobile-route')
  route.click();assert not is_open()
  route.click();assert is_open()
  # Search takes over; the bottom tab remains pointer-accessible.
  page.locator('#mobile-search').click()
  assert places_open() and not is_open()
  assert not page.locator('#place-dialog').evaluate('(e)=>e.matches(":modal")')
  button=page.locator('#mobile-search')
  assert button.get_attribute('aria-expanded')=='true'
  xy=button.bounding_box();hit=page.evaluate('''({x,y})=>{
    let e=document.elementFromPoint(x,y);return e?.id||e?.closest('button')?.id||''
  }''',{'x':xy['x']+xy['width']/2,'y':xy['y']+xy['height']/2})
  assert hit=='mobile-search',f'mobile toolbar was blocked: {hit}'
  page.locator('#place-query').fill('保存中の検索キーワード')
  page.locator('#mobile-search').click()
  assert not places_open() and not is_open()
  assert page.locator('#mobile-map').evaluate('(e)=>e.classList.contains("tool-active")')
  page.locator('#mobile-search').click()
  assert places_open() and page.locator('#place-query').input_value()=='保存中の検索キーワード'
  page.locator('#mobile-faves').click()
  assert places_open() and page.locator('#favorites-panel').is_visible()
  assert page.locator('#mobile-faves').get_attribute('aria-expanded')=='true'
  page.locator('#mobile-faves').click()
  assert not places_open()
  page.locator('#mobile-search').click()
  page.locator('#mobile-route').click()
  assert is_open() and not places_open()
  page.locator('#mobile-map').click()
  assert not is_open() and not places_open()
  page.locator('#mobile-route').click();assert is_open()
  page.locator('#sheet-handle').click();assert not is_open()
  assert not errors,errors
  print(f'PASS {width}px mobile tab minimize/restore, search input persists, nonmodal bottom toolbar clickable')
  page.close()
 # Desktop retains modal search.
 page=browser.new_page(viewport={'width':1200,'height':850})
 page.set_content(html)
 page.evaluate('''() => {
    const s={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=v},removeItem:k=>delete s[k]}});
    window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>''});
 }''')
 for fn in names:page.add_script_tag(content=(ROOT/fn).read_text())
 page.locator('#open-search').click()
 assert page.locator('#place-dialog').evaluate('(e)=>e.matches(":modal")')
 page.locator('#place-dialog-close').click()
 assert not page.locator('#place-dialog').evaluate('(e)=>e.open')
 print('PASS desktop search still opens as modal dialog')
 browser.close()
