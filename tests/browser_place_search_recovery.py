"""Regression: category POIs work even when their real shop name does not contain the query word."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
js_files=re.findall(r'<script\s+src="\./([^"]+)"\s+defer></script>',html)
html=re.sub(r'<script\s+src="\./[^\"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},locale='ja-JP')
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''() => {
  const db={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>db[k]||null,setItem:(k,v)=>db[k]=String(v),removeItem:k=>delete db[k]}});
  window.__photonCount=0;window.__nomCount=0;
  window.fetch=async url=>{
   const s=String(url);
   if(s.includes('photon.komoot.io')){
    window.__photonCount++;
    if(s.includes('missing'))return {ok:false,status:503,json:async()=>({features:[]})};
    return {ok:true,status:200,json:async()=>({features:[
      {properties:{name:'珈琲専門店ふじ',city:'尾道市',state:'広島県',osm_key:'amenity',osm_value:'cafe'},geometry:{coordinates:[133.193,34.404]}},
      {properties:{name:'別の珈琲店',city:'福山市',state:'広島県',osm_key:'amenity',osm_value:'cafe'},geometry:{coordinates:[133.36,34.48]}},
      {properties:{name:'無関係な雑貨店',city:'尾道市',state:'広島県',osm_key:'shop',osm_value:'variety_store'},geometry:{coordinates:[133.18,34.41]}}
    ]})};
   }
   if(s.includes('nominatim.openstreetmap.org')){window.__nomCount++;return {ok:false,status:503,json:async()=>[]};}
   return {ok:false,status:503,json:async()=>[],text:async()=>''};
  };
 }''')
 for name in js_files:page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(120)
 page.locator('#mobile-search').click()
 page.locator('#place-query').fill('尾道市 カフェ')
 page.locator('#place-search-form button[type=submit]').click()
 page.locator('#place-search-results .place-main').first.wait_for(timeout=10000)
 assert page.locator('#place-search-results .place-main').count()==1,page.locator('#place-search-results').inner_text()
 assert '珈琲専門店ふじ' in page.locator('#place-search-results').inner_text()
 assert '福山市' not in page.locator('#place-search-results').inner_text()
 assert page.evaluate('window.__photonCount')>=1
 page.locator('#place-search-results .place-main').first.click()
 assert page.locator('#selected-place-name').inner_text()=='珈琲専門店ふじ'
 page.locator('[data-apply="goal"]').click()
 assert page.locator('#goal').input_value()=='34.404000,133.193000'
 assert not errors,errors
 print('PASS mobile category search yields different-named cafe POI in correct city and can select goal')
 page.close();browser.close()
