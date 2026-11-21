"""Smoke-test phone tap vs. long-press registration without network/GPS."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

base = Path(__file__).resolve().parents[1]
html = (base/'index.html').read_text(encoding='utf-8')
html = re.sub(r'<script\s+src="[^"]+"\s+defer></script>', '', html)
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>' + (base/'style.css').read_text(encoding='utf-8') + '</style>')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(html, wait_until='domcontentloaded')
    page.evaluate('''() => {
      const db={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>db[k]||null,setItem:(k,v)=>db[k]=v,removeItem:k=>delete db[k]}});
      Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(){},getVoices(){return []}}});
      window.SpeechSynthesisUtterance=class{constructor(s){this.text=s}};
    }''')
    for filename in ['navigation-heading.js','map-core.js','android-approaches.js','shimanami-geometry.js','offline-route-store.js','public-brouter-client.js','voice-settings.js','app.js','place-search-core.js','mobile-ui.js','ride-radar.js','gpx-transfer.js']:
        page.add_script_tag(content=(base/filename).read_text(encoding='utf-8'))
    page.wait_for_timeout(260)
    # The normal mode route sheet is closed during map interaction.
    page.locator('#mobile-map').click()
    page.evaluate('''() => {
      document.getElementById('start').value='34.415000,132.450000';
      document.getElementById('goal').value='34.412000,132.455000';
      document.getElementById('start').dispatchEvent(new Event('input'));
      document.getElementById('goal').dispatchEvent(new Event('input'));
    }''')
    def points():
        return page.evaluate('''() => ({start:document.querySelector('#start').value,goal:document.querySelector('#goal').value,via:state.via.length})''')
    initial=points()
    rect=page.locator('#map-container').bounding_box()
    assert rect is not None
    x,y=rect['x']+rect['width']*.48,rect['y']+rect['height']*.42
    page.touchscreen.tap(x,y)
    page.wait_for_timeout(140)
    assert points()==initial,('tap changed points',points(),initial)
    assert not page.locator('#place-action-dialog').is_visible(),'tap erroneously opened menu'

    cdp=context.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':3}]})
    page.wait_for_timeout(690)
    assert not page.locator('#place-action-dialog').is_visible(), 'menu should open after finger lift, not beneath it'
    assert points()==initial,'long press before choice changed points'
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(120)
    assert page.locator('#place-action-dialog').is_visible(), 'long press menu did not stay open on release'
    assert points()==initial, 'finger lift triggered unintended registration'
    page.locator('[data-apply="goal"]').click()
    after=points()
    assert after['start']==initial['start']
    assert after['goal']!=initial['goal'], 'explicit menu choice did not change goal'
    assert after['via']==initial['via']
    page.touchscreen.tap(x+30,y+24)
    page.wait_for_timeout(100)
    assert points()==after,'later tap moved start/goal'
    assert not errors,errors
    print('PASS: phone tap leaves S/G/vias untouched; long press opens explicit action menu; only choice changes G')
    browser.close()
