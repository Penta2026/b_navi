"""Real Chromium regression: start-goal swap and simulated old mobile script.
Both app.js and mobile-ui.js must load in the same browser page.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
names=re.findall(r'<script src="\./([^"]+)" defer></script>',html)
html=re.sub(r'<script\s+src="\./[^"]+"\s+defer></script>','',html)
html=re.sub(r'<script\s+type="module"\s+src="\./[^"]+"\s*></script>','',html)
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')

def read_values(page):
    return page.evaluate('''() => ({
        start:document.getElementById('start').value,
        goal:document.getElementById('goal').value,
        via:state.via.length,
        startSummary:document.getElementById('start-summary').textContent,
        goalSummary:document.getElementById('goal-summary').textContent
    })''')

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in (390,1200):
        page=browser.new_page(viewport={'width':width,'height':900},locale='ja-JP')
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.set_content(html)
        page.evaluate('''() => {
            const store={};
            Object.defineProperty(window,'localStorage',{configurable:true,value:{
                getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v},removeItem:k=>delete store[k]
            }});
            window.fetch=async()=>({ok:false,status:503,json:async()=>[],text:async()=>''});
        }''')
        for filename in names:
            page.add_script_tag(content=(ROOT/filename.split('?',1)[0]).read_text())
        page.evaluate('''() => {
            document.getElementById('start').value='34.404838,133.193008';
            document.getElementById('goal').value='34.064000,132.995000';
            state.via=['34.33,133.17','34.25,133.07'];
            renderVia();updatePointSummaries();
        }''')
        page.locator('#swap-endpoints').click()
        page.wait_for_timeout(200)
        got=read_values(page)
        assert got['start']=='34.064000,132.995000',('start not swapped',width,got)
        assert got['goal']=='34.404838,133.193008',('goal not swapped',width,got)
        assert got['via']==0,('via not cleared',width,got)
        assert '出発地' in got['startSummary'] and '目的地' in got['goalSummary']
        # Add the old handler after the new app.js listener to reproduce a stale
        # SW cache mixing an older mobile-ui.js with new app.js.
        page.evaluate('''() => {
            document.getElementById('start').value='34.404838,133.193008';
            document.getElementById('goal').value='34.064000,132.995000';
            state.via=['34.33,133.17'];
            const button=document.getElementById('swap-endpoints');
            button.onclick=()=>{
                const old=document.getElementById('start').value;
                document.getElementById('start').value=document.getElementById('goal').value;
                document.getElementById('goal').value=old;
                state.via.reverse();
            };
            renderVia();updatePointSummaries();
        }''')
        page.locator('#swap-endpoints').click()
        page.wait_for_timeout(200)
        mixed=read_values(page)
        assert mixed['start']=='34.064000,132.995000',('stale onclick swapped back',width,mixed)
        assert mixed['goal']=='34.404838,133.193008',('stale onclick swapped back',width,mixed)
        assert mixed['via']==0,('via not cleared after mixed script',width,mixed)
        assert not errors,('browser runtime errors',width,errors)
        print('PASS actual click / cached old onclick ignored:',width,'px')
        page.close()
    browser.close()
