"""Verify native map point registration after removing duplicate sidebar pick buttons.
Desktop right click and mobile long press must still open the action menu.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<script\s+type="module"\s+src="\./[^"]+"\s*></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for width,mobile in [(390,True),(1200,False)]:
  context=browser.new_context(viewport={'width':width,'height':850},is_mobile=mobile,has_touch=mobile,locale='ja-JP')
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda error: errors.append(str(error)))
  page.set_content(html)
  page.evaluate('''() => {
    const s={};Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>s[k]||null,setItem:(k,v)=>{s[k]=v},removeItem:k=>delete s[k]
    }});
    window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>''});
  }''')
  for filename in names:page.add_script_tag(content=(ROOT/filename.split('?',1)[0]).read_text())
  page.wait_for_timeout(160)
  for id in ['start-pick','goal-pick','add-via']:assert page.locator('#'+id).count()==0,(id,width)
  assert page.locator('.pickbar').count()==0
  assert page.locator('.sample-row').inner_text().startswith('ルート例：')
  if mobile:
   page.locator('#mobile-map').click()
   page.wait_for_timeout(280)
  rect=page.locator('#map-container').bounding_box()
  assert rect is not None
  def choose(kind,offset):
   x=rect['x']+rect['width']*(.45+offset)
   y=rect['y']+rect['height']*(.46+offset)
   if mobile:
    cdp=context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':3}]})
    page.wait_for_timeout(690)
    assert not page.locator('#place-action-dialog').is_visible(),'menu must wait until finger release'
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(120)
   else:
    page.mouse.click(x,y,button='right')
    page.wait_for_timeout(80)
   assert page.locator('#place-action-dialog').is_visible(),('map menu did not open',width,kind)
   page.locator('[data-apply="'+kind+'"]').click()
   assert not page.locator('#place-action-dialog').is_visible()
  choose('start',-.08);choose('goal',0);choose('via',.08)
  values=page.evaluate('''() => ({start:document.querySelector('#start').value,
    goal:document.querySelector('#goal').value,via:state.via.length})''')
  assert values['start'] and values['goal'] and values['start']!=values['goal'],values
  assert values['via']==1,values
  if mobile:page.locator('#mobile-route').click()
  page.locator('#swap-endpoints').click()
  after=page.evaluate('''() => ({start:document.querySelector('#start').value,
    goal:document.querySelector('#goal').value,via:state.via.length})''')
  assert after['start']==values['goal'] and after['goal']==values['start'],(values,after)
  assert after['via']==0,after
  assert not errors,errors
  print('PASS mobile long press' if mobile else 'PASS desktop right click',
        '-> start/goal/via -> swap clears vias')
  context.close()
 browser.close()
