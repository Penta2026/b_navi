"""Smartphone mock test for named tuning presets, no live network/GPS."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
BASE=Path(__file__).resolve().parents[1]
html=(BASE/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP',accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html)
 page.add_style_tag(content=(BASE/'style.css').read_text())
 page.evaluate('''() => {
   const storage={};window.__localStore=storage;
   Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v)},removeItem:k=>delete storage[k]}});
   window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>null}});
 }''')
 for name in names: page.add_script_tag(content=(BASE/name).read_text())
 assert page.locator('#mode').input_value()=='1'
 page.locator('#route-preset-panel').evaluate('(el)=>el.open=true')
 page.locator('#tune-explore').evaluate('(e)=>{e.value="55";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.locator('#tune-scenic').evaluate('(e)=>{e.value="70";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.locator('#preset-name').fill('海沿いツーリング')
 page.locator('#preset-save').click()
 assert '保存したよ' in page.locator('#preset-status').inner_text()
 assert page.locator('#preset-count').inner_text()=='1件'
 a=page.locator('#preset-select').input_value()
 assert a
 page.locator('#tune-explore').evaluate('(e)=>{e.value="-30";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.locator('#tune-width').evaluate('(e)=>{e.value="85";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.locator('#preset-name').fill('通勤優先')
 page.locator('#preset-save').click()
 assert page.locator('#preset-count').inner_text()=='2件'
 page.locator('#vehicle').select_option('2')
 assert page.locator('#preset-count').inner_text()=='0件'
 page.locator('#tune-motorway').check()
 page.locator('#tune-toll').check()
 page.locator('#preset-name').fill('高速ロングツーリング')
 page.locator('#preset-save').click()
 assert page.locator('#preset-count').inner_text()=='1件'
 page.locator('#vehicle').select_option('1')
 assert page.locator('#preset-count').inner_text()=='2件'
 # Loading restores only preference fields; no automatic routing request.
 page.locator('#preset-select').select_option(a)
 page.locator('#preset-load').click()
 assert page.locator('#tune-explore').input_value()=='55'
 assert page.locator('#tune-width').input_value()=='0'
 assert page.locator('#tune-scenic').input_value()=='70'
 assert page.locator('#tuning-status').inner_text().startswith('カスタム +55')
 page.evaluate('''() => {
 document.getElementById('start').value='34.400000,132.450000';
 document.getElementById('goal').value='34.410000,132.460000';
 usePublicBrouter=()=>true;
 window.__presetQueries=[];
 BNaviPublicBrouter.query=async (points,vehicle,mode,netFetch,onProgress,config)=>{
  __presetQueries.push({vehicle,mode,config});
  const gpx='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4" lon="132.45"/><trkpt lat="34.41" lon="132.46"/></trkseg></trk></gpx>';
  return {profile:'preset-mock',track:{points,cues:[]},gpx,elapsedMs:1};
 };
 }''')
 page.locator('#calculate').click(force=True)
 page.wait_for_function('window.__presetQueries.length===1')
 assert page.evaluate('window.__presetQueries[0].config')=={'explore':55,'width':0,'scenic':70,'allowMotorway':False,'allowToll':False}
 # Export includes presets for ALL displacement categories.
 page.locator('.preset-backup').evaluate('(e)=>e.open=true')
 with page.expect_download() as dl:
  page.locator('#preset-export').click()
 download=dl.value
 content=Path(download.path()).read_text()
 assert '高速ロングツーリング' in content and '海沿いツーリング' in content
 # Duplicate name prompts confirmation, not an unsafe silent overwrite.
 page.locator('#preset-name').fill('海沿いツーリング')
 page.locator('#tune-explore').evaluate('(e)=>{e.value="25";e.dispatchEvent(new Event("input",{bubbles:true}))}')
 page.once('dialog',lambda dialog:dialog.dismiss())
 page.locator('#preset-save').click()
 assert page.locator('#preset-count').inner_text()=='2件'
 assert page.evaluate("savedRoutePresets.find(x=>x.name==='海沿いツーリング').tuning.explore")==55
 page.once('dialog',lambda dialog:dialog.accept())
 page.locator('#preset-save').click()
 assert page.evaluate("savedRoutePresets.find(x=>x.name==='海沿いツーリング').tuning.explore")==25
 # Deletion does not alter the current active tuning.
 page.locator('#preset-select').select_option(a)
 page.once('dialog',lambda dialog:dialog.accept())
 page.locator('#preset-delete').click()
 assert page.locator('#preset-count').inner_text()=='1件'
 assert page.locator('#tune-explore').input_value()=='25'
 # Import skips same names and restores deleted entry.
 page.locator('#preset-import-file').set_input_files({'name':'bnavi.json','mimeType':'application/json','buffer':content.encode('utf-8')})
 page.wait_for_function("document.getElementById('preset-status').textContent.includes('追加1件')")
 assert page.locator('#preset-count').inner_text()=='2件'
 assert page.evaluate("savedRoutePresets.find(x=>x.name==='海沿いツーリング').tuning.explore")==55
 assert not errors,errors
 print('PASS browser: save multiple names, vehicle scoping, load into route, duplicate confirmation, delete, JSON export/import; 390px phone')
 browser.close()
