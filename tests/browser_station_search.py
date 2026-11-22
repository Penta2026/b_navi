"""Mobile station lookup regression with geocoders intentionally unavailable.
Uses page.set_content so the test runs without a network or local HTTP server.
"""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
scripts=re.findall(r'<script\s+src="\./([^"]+)"\s+defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<link rel="stylesheet"[^>]*>','',html)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},locale='ja-JP')
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.set_content(html)
    page.add_style_tag(content=(ROOT/'style.css').read_text())
    page.evaluate('''() => {
      const cache={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem(k){return Object.prototype.hasOwnProperty.call(cache,k)?cache[k]:null},
        setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}
      }});
      window.__stationRequests=0;
      window.__remoteRequests=0;
      window.fetch=async url=>{
        const u=String(url);
        if(u.includes('jr_stations.json')){
          window.__stationRequests++;
          return {ok:true,json:async()=>[
            {name:'尾道',lat:34.404838,lng:133.193008},
            {name:'東尾道',lat:34.435030,lng:133.233200},
            {name:'新尾道',lat:34.430080,lng:133.190215}
          ]};
        }
        window.__remoteRequests++;
        return {ok:false,status:503,json:async()=>[],text:async()=>''};
      }
    }''')
    for name in scripts:
        page.add_script_tag(content=(ROOT/name).read_text())
    page.wait_for_timeout(120)
    page.locator('#mobile-search').click()
    page.locator('#place-query').fill('尾道駅')
    page.locator('#place-search-form button[type=submit]').click()
    page.locator('.place-main').first.wait_for(timeout=3500)
    assert page.locator('#place-search-results .place-main').count()==1
    assert '尾道駅' in page.locator('#place-search-results').inner_text()
    assert '東尾道駅' not in page.locator('#place-search-results').inner_text()
    assert page.evaluate('window.__remoteRequests')==0
    page.locator('.place-main').first.click()
    assert page.locator('#selected-place-name').inner_text()=='尾道駅'
    page.locator('[data-apply="goal"]').click()
    assert page.locator('#goal').input_value()=='34.404838,133.193008'
    # Immediate repeat on the same phone must bypass remote-geocoder throttle.
    page.locator('#mobile-search').click()
    page.locator('#place-query').fill('ＪＲ　新尾道駅')
    page.locator('#place-search-form button[type=submit]').click()
    page.locator('.place-main').first.wait_for(timeout=3000)
    assert page.locator('#place-search-results .place-main').count()==1
    assert page.locator('#place-search-results .place-main').first.inner_text().startswith('新尾道駅')
    assert page.evaluate('window.__stationRequests')==1
    assert page.evaluate('window.__remoteRequests')==0
    assert not errors,errors
    print('PASS 尾道駅/ＪＲ新尾道駅 search without geocoder, exact station, set goal, cached local index')
    browser.close()
