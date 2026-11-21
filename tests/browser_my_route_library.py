"""Browser UI simulation: named route and tuning, using an IndexedDB-compatible mock."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^"]+" defer></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','')
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
  page=context.new_page()
  errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(html)
  page.add_style_tag(content=(ROOT/'style.css').read_text())
  page.evaluate('''() => {
   const storage={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v)},removeItem:k=>delete storage[k]}});
   window.fetch=async()=>({ok:false,status:503,text:async()=>'',json:async()=>null,headers:{get:()=>null}});
   const all=new Map();const records=new Map();
   Object.defineProperty(window,'indexedDB',{configurable:true,value:{open:(n,ver)=>{
    let db=all.get(n),fresh=!db,req={};
    if(!db){db={objectStoreNames:{contains:x=>records.has(n+':'+x)},createObjectStore:x=>{records.set(n+':'+x,new Map())},close:()=>{},transaction:(table,mode)=>{
     const t={};const map=records.get(n+':'+table);
     const action=fn=>{
      const r={};setTimeout(()=>{try{r.result=fn();r.onsuccess?.();setTimeout(()=>t.oncomplete?.(),0)}catch(err){r.error=err;r.onerror?.();t.onerror?.();}},0);return r;
     };
     t.objectStore=()=>({getAll:()=>action(()=>[...map.values()]),get:id=>action(()=>map.get(id)),put:v=>action(()=>map.set(v.id,v)),delete:id=>action(()=>map.delete(id))});return t;
    }};all.set(n,db)}
    setTimeout(()=>{req.result=db;if(fresh)req.onupgradeneeded?.();req.onsuccess?.()},0);return req;
   }}});
  }''')
  for script in names:page.add_script_tag(content=(ROOT/script).read_text())
  page.wait_for_function('typeof window.BNaviMyRouteLibrary !== "undefined" && typeof state !== "undefined"')
  page.evaluate('''()=>{
   document.getElementById('start').value='34.400000,132.450000';
   document.getElementById('goal').value='34.410000,132.460000';
   state.via=['34.405000,132.455000'];
   tuningByVehicle[1]={explore:65,width:-20,scenic:80,allowMotorway:false,allowToll:false};
   state.activeRoutingVehicle=1;state.activeRouteTuning=tuningNow();
   const gpx='<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4" lon="132.45"/><trkpt lat="34.41" lon="132.46"/></trkseg></trk></gpx>';
   routeView('normal',[{type:'road',points:[[34.4,132.45],[34.405,132.455],[34.41,132.46]],color:'#06799b',width:5,label:'保存経路',gpx}],gpx,'テスト');
  }''')
  page.locator('#my-route-panel').evaluate('(e)=>e.open=true')
  page.locator('#my-route-name').fill('125cc 海沿いツーリング')
  page.locator('#my-route-save').evaluate('(e)=>e.click()')
  page.wait_for_function("document.getElementById('my-route-count').textContent==='1件'",timeout=3500)
  route_id=page.locator('#my-route-select').input_value();assert route_id
  stored=page.evaluate('''async id=>await BNaviMyRouteLibrary.get(id)''',route_id)
  assert stored['route']['sections'][0]['points'][2]==[34.41,132.46]
  assert stored['tuning']['explore']==65 and stored['tuning']['scenic']==80
  assert stored['via']==['34.405000,132.455000']
  # Emulate reopening a saved route after the working map and parameters change.
  page.evaluate("()=>{state.routes=[];state.routeType=null;state.activeRouteTuning=null;tuningByVehicle[1].scenic=0;document.getElementById('tune-scenic').value='0'}")
  page.locator('#my-route-panel').evaluate('(e)=>e.open=true')
  page.locator('#my-route-select').select_option(route_id)
  page.locator('#my-route-load').evaluate('(e)=>e.click()')
  page.wait_for_function("document.getElementById('my-route-status').textContent.includes('復元しました')")
  assert page.evaluate('state.activeRouteTuning.explore')==65
  assert page.evaluate('state.routes[0].points.length')==3
  assert page.evaluate('state.via.length')==1
  assert page.locator('#tune-scenic').input_value()=='80'
  page.once('dialog',lambda dialog:dialog.accept())
  page.locator('#my-route-delete').evaluate('(e)=>e.click()')
  page.wait_for_function("document.getElementById('my-route-count').textContent==='0件'")
  assert page.evaluate('state.routes.length')==1
  assert not errors,errors
  print('PASS browser simulation: save/open/delete route+active tuning+waypoints with mocked IndexedDB (390px viewport)')
  browser.close()

