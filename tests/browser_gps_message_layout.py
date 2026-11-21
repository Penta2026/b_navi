"""Mock DOM geometry test: GPS notice must not overlap one-row controls."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text(encoding='utf8')
html=re.sub(r'<script src="\./[^\"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
css=(root/'style.css').read_text(encoding='utf8')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for width in (320,360,390,430):
  page=browser.new_page(viewport={'width':width,'height':740},device_scale_factor=1,is_mobile=True,has_touch=True)
  page.set_content(html)
  page.add_style_tag(content=css)
  for mode in ('normal','navigation-active','free-ride-active'):
   page.evaluate('''() => {
     document.body.className='';
     const note=document.querySelector('#map-gps-message');
     note.hidden=false;note.textContent='現在地を取得したら音声案内を開始します';
     document.querySelector('#nav-radar-toggle').hidden=false;
   }''')
   if mode!='normal':page.evaluate('(mode)=>document.body.classList.add(mode)',mode)
   boxes=page.evaluate('''() => ({
     note:document.querySelector('#map-gps-message').getBoundingClientRect().toJSON(),
     buttons:[...document.querySelectorAll('#map-controls .map-control-row-top > button:not([hidden])')].map(b=>b.getBoundingClientRect().toJSON())
   })''')
   note=boxes['note']; buttons=boxes['buttons']
   assert len(buttons)==6,(width,mode,len(buttons))
   bottom=max(b['bottom'] for b in buttons)
   assert note['top']>=bottom+9,(width,mode,'overlap',round(note['top']),round(bottom))
   assert note['right']<=width-3,(width,mode,'out-of-bounds',note)
   assert note['width']>=120,(width,mode,'too-narrow',note)
   print('PASS',width,mode,'button-bottom',round(bottom),'notice-top',round(note['top']))
  page.close()
 browser.close()
