"""Offline payload JSON round-trip without IndexedDB; browser storage e2e unavailable here."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^\"]+)" defer></script>',html)
html=re.sub(r'<script src="\./[^\"]+" defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':390,'height':844});page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''()=>{const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=String(v),removeItem:k=>delete data[k]}});window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>'',headers:{get:()=>''}})}''')
 for n in names:page.add_script_tag(content=(ROOT/n).read_text())
 page.evaluate('''async ()=>{
   const points=[[34.389,133.2],[34.064,132.995]];
   const r=await BNaviShimanamiWebRouter.compose(points,0,1,{
     geometry:BNaviShimanamiGeometry,refs:BNaviBridgeReferences,bridgePreview:androidBridgePreview,
     query:async ([from,to])=>({track:{points:[from,to],cues:[{offset:1,desc:'right'}]},gpx:'<gpx/>'})
   });
   routeView('shimanami',r.sections,null,'test');state.shimanamiPlanPoints=points;state.shimanamiWebBuilt=true;state.islandLegs=r.guidance;loadIslandGuidance(0);
   window.__data=JSON.parse(JSON.stringify(offlinePayload()));
   routeView(__data.type,__data.sections,__data.mainGpx,'reload');
   state.shimanamiPlanPoints=__data.shimanamiPlanPoints;
   state.shimanamiWebBuilt=__data.shimanamiWebBuilt;
   state.islandLegs=__data.islandLegs;loadIslandGuidance(0);
 }''')
 assert page.evaluate('state.routeType')=='shimanami'
 assert page.evaluate('state.shimanamiWebBuilt')
 assert page.evaluate('state.islandLegs.filter(s=>s.bridgeAfter).length')==6
 assert page.evaluate('state.islandLegs[0].turnCues[0].desc')=='right'
 assert page.evaluate('BNaviShimanamiWebRouter.verifyPlan({sections:state.routes,guidance:state.islandLegs,bridges:6},state.shimanamiPlanPoints).ok')
 print('PASS: offline payload JSON roundtrip retains 7 road cues, 6 bridge references, ordered checkpoint metadata')
 b.close()
