"""OpenPOI integration smoke using mocked API; no external network or GPS required."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
scripts=re.findall(r'<script\s+src="./([^"]+)"\s+defer></script>',html)
html=re.sub(r'<script\s+src="./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},locale='ja-JP')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate("""() => {
   const records={};Object.defineProperty(window,'localStorage',{configurable:true,value:{
     getItem:k=>records[k]||null,setItem:(k,v)=>{records[k]=String(v)},removeItem:k=>delete records[k]
   }});
   window.__poiCalls=[];window.__fallbackCalls=[];
   window.fetch=async (url,opts) => {
     const u=new URL(String(url),location.href);
     if(u.host==='api.openpoiapi.com'){
       window.__poiCalls.push(u.pathname);
       if(u.pathname==='/v1/suggest')return {ok:true,json:async()=>({suggestions:[
         {name:'珈琲専門店ふじ',address:'広島県尾道市東御所町',lat:34.4035,lng:133.1925,
          category:'cafe',licenses:['CC-BY-4.0'],attributions:['OpenPOI API']}
       ]})};
       return {ok:true,json:async()=>({results:[]})};
     }
     if(u.pathname.endsWith('/data/jr_stations.json'))
       return {ok:true,json:async()=>[{name:'尾道',lat:34.404838,lng:133.193008}]};
     window.__fallbackCalls.push(u.host);
     return {ok:false,status:503,json:async()=>[],text:async()=>''};
   };
 }""")
 for name in scripts:page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(150)
 page.locator('#mobile-search').click()
 page.locator('#place-query').fill('尾道市 カフェ')
 page.locator('#place-search-results .place-main').first.wait_for(timeout=4500)
 assert '珈琲専門店ふじ' in page.locator('#place-search-results').inner_text()
 page.locator('#place-search-results .place-main').first.click()
 assert page.locator('#selected-place-name').inner_text()=='珈琲専門店ふじ'
 page.locator('[data-apply="goal"]').click()
 assert page.locator('#goal').input_value()=='34.403500,133.192500'
 page.locator('#mobile-search').click()
 page.locator('#place-query').fill('尾道市 カフェ')
 page.locator('#place-search-form button[type=submit]').click()
 page.locator('#place-search-results .place-main').first.wait_for(timeout=3500)
 assert page.locator('#place-search-results .place-main').count()==1
 assert page.evaluate('window.__fallbackCalls.length')==0
 assert page.evaluate('window.__poiCalls.length')>=1
 assert not errors,errors
 print('PASS OpenPOI suggestion and manual search, select destination, no legacy calls for match')
 browser.close()
