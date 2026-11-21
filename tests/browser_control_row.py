"""Visual geometry regression for the two-row map controls. Mock layout only, no real GPS/network."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
BASE=Path(__file__).resolve().parents[1]
markup=(BASE/'index.html').read_text()
markup=re.sub(r'<script src="\./[^\"]+" defer></script>','',markup)
markup=re.sub(r'<link rel="stylesheet"[^>]*>','',markup)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,360,390,430):
  page=browser.new_page(viewport={'width':width,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  page.set_content(markup)
  page.add_style_tag(content=(BASE/'style.css').read_text())
  page.evaluate('''() => {
    document.body.classList.add('navigation-active');
    document.getElementById('nav-radar-toggle').hidden=false;
    document.getElementById('navigation-hud').hidden=false;
  }''')
  first=['zoom-in','zoom-out','map-location','center-hiroshima','nav-radar-toggle','orientation-toggle']
  buttons=[page.locator('#'+i) for i in first]
  boxes=[b.bounding_box() for b in buttons]
  assert all(b is not None and b['width']>=34 and b['height']>=44 for b in boxes),('missing or small button',width,boxes)
  ys=[b['y'] for b in boxes]; assert max(ys)-min(ys)<2,('not one row',width,ys)
  assert all(boxes[i]['x']+boxes[i]['width']<=boxes[i+1]['x']+0.1 for i in range(5)),('overlap',width,boxes)
  heading=page.locator('#orientation-toggle').bounding_box()
  assert heading and abs(heading['y']-ys[0])<2,('heading not on the same row',width,heading,ys)
  assert heading['x']+heading['width']>=width-14,('heading not right-aligned',width,heading)
  assert page.locator('#nav-radar-toggle').inner_text().strip()=='📡'
  assert page.locator('.topbar').is_hidden()
  print('PASS',width,[(i,round(b['x']),round(b['y'])) for i,b in zip(first,boxes)],'heading',round(heading['x']),round(heading['y']))
  page.close()
 browser.close()
