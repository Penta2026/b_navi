"""Headless DOM smoke with mocked address API; no external network needed.
Uses in-memory page content because navigation to local HTTP/file is blocked here.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
scripts=re.findall(r'<script\s+src="\./([^"]+)"\s+defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},locale='ja-JP')
 errs=[]
 page.on('pageerror',lambda err:errs.append(str(err)))
 page.set_content(html)
 page.add_style_tag(content=(ROOT/'style.css').read_text())
 page.evaluate('''() => {
   const cache={};
   Object.defineProperty(window,'localStorage',{configurable:true,value:{
     getItem(k){return Object.prototype.hasOwnProperty.call(cache,k)?cache[k]:null},
     setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}
   }});
   window.fetch=async (url,options) => {
     const u=String(url);
     if(u.includes('msearch.gsi.go.jp'))return {ok:true,status:200,json:async()=>[
       {type:'Feature',properties:{title:'東京都港区芝公園四丁目'},geometry:{type:'Point',coordinates:[139.7454,35.6584]}},
       {type:'Feature',properties:{title:'北海道札幌市中央区'},geometry:{type:'Point',coordinates:[141.35,43.05]}}
     ]};
     return {ok:false,status:503,json:async()=>[],text:async()=>''};
   }
 }''')
 for name in scripts:
  page.add_script_tag(content=(ROOT/name).read_text())
 page.wait_for_timeout(150)
 page.locator('#mobile-search').click()
 page.locator('#place-query').fill('東京都港区芝公園4-2-8')
 page.locator('#place-search-form button[type=submit]').click()
 page.locator('.address-goal').wait_for(timeout=3000)
 assert page.locator('.address-goal').count()==1
 assert '北海道' not in page.locator('#place-search-results').inner_text()
 page.locator('.address-goal').click()
 assert page.locator('#goal').input_value()=='35.658400,139.745400'
 assert '芝公園' in page.locator('#goal-summary').inner_text()
 assert not page.locator('#place-dialog').evaluate('(el)=>el.open')
 page.locator('#mobile-search').click()
 page.locator('#place-query').fill('東京都港区芝公園')
 page.wait_for_timeout(1700)
 page.locator('#search-address-btn').click()
 page.locator('.address-goal').wait_for(timeout=3000)
 page.locator('.place-main').first.click()
 assert page.locator('#place-action-dialog').evaluate('(el)=>el.open')
 page.locator('#place-action-close').click()
 assert not errs,errs
 print('PASS browser mocked address lookup, destination assignment, common place dialog')
 browser.close()
