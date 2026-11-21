from pathlib import Path
import re
from playwright.sync_api import sync_playwright
base=Path(__file__).resolve().parents[1]
html=(base/'index.html').read_text()
html=re.sub(r'<script\s+src="[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="./style.css">', '<style>'+ (base/'style.css').read_text() +'</style>',html)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.evaluate('''() => {
   const store={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]}});
   window.__spoken=[];
   window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
   Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){},speak(u){window.__spoken.push({text:u.text,rate:u.rate,volume:u.volume,pitch:u.pitch,voiceURI:u.voice?.voiceURI})},getVoices(){return [{lang:'ja-JP',name:'Japanese A',voiceURI:'voice1'},{lang:'ja-JP',name:'Japanese B',voiceURI:'voice2'}]}}});
 }''')
 for name in ['ride-logic.js','navigation-heading.js','map-core.js','android-approaches.js','shimanami-geometry.js','offline-route-store.js','public-brouter-client.js','voice-settings.js','app.js','place-search-core.js','mobile-ui.js','ride-radar.js','gpx-transfer.js']:
  page.add_script_tag(content=(base/name).read_text())
 page.wait_for_timeout(180)
 assert page.locator('#settings-btn').is_visible()
 page.locator('#settings-btn').click()
 assert page.locator('#settings-dialog').is_visible()
 assert page.locator('#voice-rate-value').inner_text()=='1.15倍'
 page.locator('#voice-preview').click()
 assert page.evaluate('window.__spoken.at(-1).rate')==1.15
 page.evaluate('''() => {for (const [id,value] of [['voice-rate','1.40'],['voice-volume','0.65'],['voice-pitch','0.9']]){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}const sel=document.getElementById('voice-select');sel.value='voice2';sel.dispatchEvent(new Event('change',{bubbles:true}));}''')
 page.locator('#voice-preview').click()
 result=page.evaluate('window.__spoken.at(-1)')
 assert result['rate']==1.4 and result['volume']==.65 and result['pitch']==.9 and result['voiceURI']=='voice2',result
 page.locator('#settings-close').click()
 page.locator('#settings-btn').click()
 assert page.locator('#voice-rate-value').inner_text()=='1.40倍'
 assert page.evaluate('BNaviVoiceSettings.load(localStorage).rate')==1.4
 page.locator('#voice-on').uncheck()
 before=page.evaluate('window.__spoken.length')
 assert page.evaluate("speak('Should be muted')")==False
 assert page.evaluate('window.__spoken.length')==before
 page.locator('#voice-preview').click()
 assert page.evaluate('window.__spoken.length')==before+1
 page.locator('#voice-reset').click()
 assert page.locator('#voice-rate-value').inner_text()=='1.15倍'
 assert page.locator('#voice-on').is_checked()
 assert not errors,errors
 print('PASS: settings open, playback 1.15× -> 1.40×, volume/pitch/voice, persistence, preview, mute and reset; 390px mobile')
 b.close()
