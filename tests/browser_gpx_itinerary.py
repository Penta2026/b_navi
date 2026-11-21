"""End-to-end GPX itinerary import using generic synthetic test data (no private user route)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import re

BASE = Path(__file__).resolve().parents[1]
FIXTURE_XML = '''<?xml version="1.0" encoding="UTF-8"?><gpx xmlns="http://www.topografix.com/GPX/1/1" creator="MichiNoTochu" version="1.1"><rte><name>BikeNavigator ordered itinerary BNAV-ITINERARY-1</name><rtept lat="35.000000" lon="135.000000"><name>出発地点</name></rtept><rtept lat="35.100000" lon="135.400000"><name>立寄りA</name></rtept><rtept lat="35.200000" lon="135.100000"><name>立寄りB</name></rtept><rtept lat="35.300000" lon="135.300000"><name>目的地</name></rtept></rte></gpx>'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--disable-web-security'])
 page=browser.new_page(viewport={'width':390,'height':800},locale='ja-JP')
 errors=[]
 page.on('pageerror',lambda exc: errors.append(str(exc)))
 html=(BASE/'index.html').read_text(encoding='utf8')
 scripts=re.findall(r'<script\s+src="\./([^"\s]+)"\s+defer></script>',html)
 assert scripts,len(scripts)
 html=re.sub(r'<script\s+src="\./[^"\s]+"\s+defer></script>','',html)
 page.set_content(html,wait_until='load')
 page.evaluate('''() => { const store=new Map(); Object.defineProperty(window, 'localStorage', {configurable:true,value:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)}}); }''')
 for src in scripts:
   page.add_script_tag(content=(BASE/src).read_text(encoding='utf8'))
 page.wait_for_function("typeof BNaviGpxItinerary !== 'undefined' && typeof BNaviPublicBrouter !== 'undefined' && typeof calculate !== 'undefined'",timeout=15000)
 page.evaluate('''() => {
   window.__requested = [];
   usePublicBrouter = () => true;
   BNaviPublicBrouter.query = async (points) => {
     window.__requested.push(points.map(x=>x.slice()));
     return {profile:'test-profile',elapsedMs:1, track:{points:points.map(x=>x.slice()),cues:[{desc:'left',offset:1,point:points[1]}]},
       gpx:`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${points.map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"/>`).join('')}</trkseg></trk><rte><rtept lat="${points[1][0]}" lon="${points[1][1]}"><desc>left</desc><extensions><offset>1</offset></extensions></rtept></rte></gpx>`};
   };
 }''')
 page.locator('#gpx-file').set_input_files({'name':'generic_itinerary.gpx','mimeType':'application/gpx+xml','buffer':FIXTURE_XML.encode()})
 page.wait_for_function('window.__requested.length === 1',timeout=10000)
 data=page.evaluate('''() => ({
   calls:window.__requested, via:state.via, start:document.getElementById('start').value,
   goal:document.getElementById('goal').value,
   summary:document.getElementById('gpx-import-status').textContent,
   panel:!document.getElementById('gpx-itinerary-panel').hidden,
   list:[...document.querySelectorAll('#gpx-itinerary-list li')].map(x=>x.textContent),
   routeType:state.routeType,
   targetCoords:(beginTargetSequence(),state.activeTargets),
   labels:[document.getElementById('start-summary').textContent,document.getElementById('goal-summary').textContent]
 })''')
 assert len(data['calls'][0])==4,data
 assert len(data['via'])==2,data
 assert data['start']=='35.000000,135.000000' and data['goal']=='35.300000,135.300000',data
 assert data['panel'] and data['routeType']=='normal',data
 assert len(data['targetCoords'])==3,data
 assert data['list']==['S: 出発地点','経由1: 立寄りA','経由2: 立寄りB','G: 目的地'],data
 assert '立寄りA' in data['list'][1] and '目的地' in data['labels'][1],data
 assert not errors,errors
 # Recalculating continues to use the complete ordered S -> via -> G sequence.
 page.locator('#gpx-itinerary-calculate').click()
 page.wait_for_function('window.__requested.length === 2',timeout=10000)
 assert page.evaluate('window.__requested[1].length')==4
 print('PASS synthetic GPX: 2 intermediate stops, order, names, route auto calculation, retry, target sequence.')
 # Separate test: a real track GPX should remain a track and NOT be replaced by waypoint logic.
 track_gpx='''<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="34.4" lon="132.4"/><trkpt lat="34.41" lon="132.41"/></trkseg></trk></gpx>'''
 page.locator('#gpx-file').set_input_files({'name':'track.gpx','mimeType':'application/gpx+xml','buffer':track_gpx.encode()})
 page.wait_for_function("state.routeType==='normal' && document.getElementById('gpx-itinerary-panel').hidden")
 assert page.evaluate('window.__requested.length')==2
 print('PASS ordinary track GPX remains road-track import (no online recalculation).')
 # Remote response which bypasses the intermediate stop must not be accepted.
 page.evaluate('''() => {
   BNaviPublicBrouter.query = async (points) => ({profile:'test',elapsedMs:1,track:{points:[points[0],points.at(-1)],cues:[]},gpx:''});
 }''')
 page.locator('#gpx-file').set_input_files({'name':'generic_itinerary.gpx','mimeType':'application/gpx+xml','buffer':FIXTURE_XML.encode()})
 page.wait_for_function("document.getElementById('gpx-import-status').textContent.includes('経由地1')",timeout=10000)
 assert page.evaluate('state.routeType') is None
 assert page.evaluate('state.via.length')==2
 assert '経由地1' in page.locator('#gpx-import-status').inner_text()
 print('PASS remote route skipping a waypoint is rejected; all imported stops remain.')
 browser.close()
