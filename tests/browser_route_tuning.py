"""Phone-width synthetic tuning UI + query propagation. No real BRouter network or GPS."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
BASE=Path(__file__).resolve().parents[1]
html=(BASE/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet" href="\./style.css">','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
 errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html)
 page.add_style_tag(content=(BASE/'style.css').read_text())
 page.evaluate('''() => {
 const store={};window.__localStore=store;
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]}});
 window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>null}});
 }''')
 for name in names:page.add_script_tag(content=(BASE/name).read_text())
 assert page.locator('#mode').input_value()=='1'
 page.locator('#route-tuning-panel').evaluate('(e)=>e.open=true')
 assert page.locator('#tune-explore').input_value()=='0'
 assert page.locator('#tuning-status').inner_text()=='カスタマイズOFF（調整値は保持）'
 assert not page.locator('#tune-big-options').is_visible()
 page.evaluate('''() => {const x=document.getElementById('tune-explore');x.value='65';x.dispatchEvent(new Event('input',{bubbles:true}));}''')
 assert page.locator('#tune-explore-value').inner_text()=='+65'
 assert '65' in page.locator('#tuning-status').inner_text()
 assert 'bnavi.routeTuningByVehicle.v1' in page.evaluate('window.__localStore')
 page.locator('#vehicle').select_option('2')
 assert page.locator('#tune-explore').input_value()=='0'
 assert page.locator('#tune-big-options').is_visible()
 page.locator('#tune-motorway').check()
 page.locator('#tune-toll').check()
 assert '高速' in page.locator('#tuning-status').inner_text()
 page.locator('#vehicle').select_option('1')
 assert page.locator('#tune-explore').input_value()=='65'
 page.evaluate('''() => {
 document.getElementById('start').value='34.400000,132.450000';
 document.getElementById('goal').value='34.410000,132.460000';
 usePublicBrouter=()=>true;
 window.__queryCalls=[];
 BNaviPublicBrouter.query=async (points,vehicle,mode,netFetch,onProgress,config)=>{
   __queryCalls.push({points,vehicle,mode,config});
   const gpx='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4" lon="132.45"/><trkpt lat="34.41" lon="132.46"/></trkseg></trk></gpx>';
   return {profile:'mock-general-tuned',track:{points:points,cues:[]},gpx,elapsedMs:1};
 };
 }''')
 page.locator('#calculate').click(force=True)
 page.wait_for_function('window.__queryCalls.length===1')
 q=page.evaluate('__queryCalls[0]')
 assert q['vehicle']=='1' and q['mode']==1 and q['config']['explore']==65,q
 assert page.evaluate('state.activeRouteTuning.explore')==65
 page.evaluate('''() => {state.navActive=true;state.location=[34.401,132.451];state.activeTargets=[[34.41,132.46]];state.targetIndex=0;state.navPaused=false;}''')
 page.evaluate('''async()=>{await rerouteFromGps();}''')
 page.wait_for_function('window.__queryCalls.length===2')
 assert page.evaluate('__queryCalls[1].config.explore')==65
 page.evaluate("() => {const e=document.getElementById('vehicle');e.value='2';e.dispatchEvent(new Event('change',{bubbles:true}));}")
 page.evaluate("() => document.getElementById('tuning-reset').click()")
 assert page.locator('#tuning-status').inner_text()=='現在：一般ルート（変更なし）'
 assert not page.locator('#tune-motorway').is_checked()
 assert not page.locator('#tune-toll').is_checked()
 assert not errors,errors
 print('PASS browser: three independent sliders, per-displacement storage, 126cc options, original general mode, query + reroute snapshot, reset')
 browser.close()
