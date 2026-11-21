"""IndexedDB round trip through a local HTTPS-equivalent trusted localhost origin; network routing mocked."""
from pathlib import Path
import contextlib,functools,http.server,threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Quiet)
t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=context.new_page();page.route('https://tile.openstreetmap.org/**',lambda route:route.abort())
  page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
  page.wait_for_function('typeof window.BNaviShimanamiWebRouter !== "undefined" && typeof window.BNaviPublicBrouter !== "undefined"')
  result=page.evaluate('''async ()=>{
   document.getElementById('start').value='34.389000,133.200000';document.getElementById('goal').value='34.064000,132.995000';
   document.getElementById('vehicle').value='0';state.via=[];
   const points=getRequestPoints();
   const r=await BNaviShimanamiWebRouter.compose(points,0,1,{
    geometry:BNaviShimanamiGeometry,refs:BNaviBridgeReferences,bridgePreview:androidBridgePreview,
    query:async ([a,b])=>({track:{points:[a,b],cues:[{offset:1,desc:'right'}]},gpx:'<gpx/>'})
   });
   routeView('shimanami',r.sections,null,'test');state.shimanamiPlanPoints=points;state.islandLegs=r.guidance;loadIslandGuidance(0);
   await BNaviOfflineRouteStore.save(offlinePayload());
   return [r.bridges,r.guidance.length];
  }''')
  assert result==[6,7],result
  # Reload while blocking all external routing and maps: the route must survive.
  page.reload(wait_until='domcontentloaded')
  page.wait_for_function('state.routeType === "shimanami" && state.islandLegs.length === 7',timeout=10000)
  assert page.evaluate('state.shimanamiPlanPoints.length')==2
  assert page.evaluate('state.islandLegs.filter(x=>x.bridgeAfter).length')==6
  assert page.evaluate('state.islandLegs[0].turnCues.length')==1
  assert page.evaluate('state.routes.filter(s=>s.type==="bridge").every(s=>!s.gpx)')
  report=page.evaluate('''()=>BNaviShimanamiWebRouter.deskCheck({sections:state.routes,guidance:state.islandLegs,bridges:6},state.shimanamiPlanPoints).ok''')
  assert report,'saved route failed full seam verification'
  print('PASS IndexedDB: shimanami 7 legs, 6 bridge refs and voice cues survive reload without backend')
  browser.close()
finally:server.shutdown();server.server_close()
