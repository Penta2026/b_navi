/* Browser-local favorites + mobile controls. Does not alter routing profiles. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id), isMobile=()=>matchMedia('(max-width:800px)').matches;
 let picked=null, searchBusy=false, lastSearch=0;
 const sheet=$('sidebar'), placeDialog=$('place-dialog');
 let currentPlaceTab='search';
 function syncToolbar(){
   const placesOpen=placeDialog.open, routeOpen=!placesOpen&&sheet.classList.contains('sheet-open');
   const buttons={
     'mobile-route':routeOpen,
     'mobile-search':placesOpen&&currentPlaceTab==='search',
     'mobile-faves':placesOpen&&currentPlaceTab==='favorites',
     'mobile-map':!placesOpen&&!routeOpen
   };
   for(const [id,active] of Object.entries(buttons)){
     const button=$(id);button.classList.toggle('tool-active',active);
     if(id!=='mobile-map')button.setAttribute('aria-expanded',String(active));
   }
 }
 function closePlaces(){if(placeDialog.open)placeDialog.close();syncToolbar();}
 window.BNaviCloseRouteSheet=()=>toggleSheet(false);
 // On free-ride completion, expose the existing GPX save/share actions at the
 // bottom of the sheet. A failed/no-fix ride does not create a fake GPX.
 window.BNaviShowRecordedTrackActions=()=>{
   const track=$('track-panel');if(!track||track.dataset.state!=='ready')return;
   toggleSheet(true);
   requestAnimationFrame(()=>{sheet.scrollTop=sheet.scrollHeight;});
 };
 function toggleSheet(open){
   if(open)closePlaces();
   sheet.classList.toggle('sheet-open',open);
   syncToolbar();
   setTimeout(()=>{if(typeof map!=='undefined'&&map.resize)map.resize();},230);
 }
 document.querySelectorAll('.pick').forEach(btn=>btn.addEventListener('click',()=>{if(isMobile())toggleSheet(false)}));
 $('start-pick').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});$('goal-pick').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});$('add-via').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});
 $('mobile-route').onclick=()=>toggleSheet(!sheet.classList.contains('sheet-open')||placeDialog.open);
 $('mobile-map').onclick=()=>{closePlaces();toggleSheet(false)};
 $('sheet-handle').onclick=()=>toggleSheet(!sheet.classList.contains('sheet-open'));
 $('mobile-search').onclick=()=>showPlaces('search');$('mobile-faves').onclick=()=>showPlaces('favorites');$('open-search').onclick=()=>showPlaces('search');$('open-favorites').onclick=()=>showPlaces('favorites');
 $('go-location').onclick=()=>{startGps();toggleSheet(false)};
 $('swap-endpoints').onclick=()=>{const a=$('start').value;$('start').value=$('goal').value;$('goal').value=a;state.via.reverse();renderVia();refreshMap();fitMarkers();persist();updatePointSummaries();setMessage('出発地と目的地を交換したよ。経由地も逆順にしたよ。')};
 $('place-dialog-close').onclick=closePlaces;$('place-action-close').onclick=()=>$('place-action-dialog').close();
 placeDialog.addEventListener('close',syncToolbar);
 function safeShowModal(dialog){if(!dialog)return;try{if(dialog.open)dialog.close();dialog.showModal()}catch{dialog.setAttribute('open','open')}}
 function showPlaces(tab){
   // Mobile search is non-modal so the same bottom tab remains tappable.
   // Keep the dialog DOM alive while hidden: queries and results are preserved.
   if(isMobile()&&placeDialog.open&&currentPlaceTab===tab){closePlaces();return;}
   if(isMobile()){
     toggleSheet(false);
     if(!placeDialog.open){try{placeDialog.show()}catch{placeDialog.setAttribute('open','open')}}
   }else if(!placeDialog.open||!placeDialog.matches(':modal'))safeShowModal(placeDialog);
   switchTab(tab);
   if(tab==='search')setTimeout(()=>{if(placeDialog.open&&currentPlaceTab==='search')$('place-query').focus()},100);
 }
 function switchTab(tab){
   currentPlaceTab=tab;
   const fav=tab==='favorites';$('search-panel').hidden=fav;$('favorites-panel').hidden=!fav;
   $('tab-search').classList.toggle('selected',!fav);$('tab-favorites').classList.toggle('selected',fav);
   if(fav)renderFavorites();
   syncToolbar();
 }
 syncToolbar();
 $('tab-search').onclick=()=>switchTab('search');$('tab-favorites').onclick=()=>switchTab('favorites');
 function favorites(){try{const x=JSON.parse(localStorage.getItem('bnavi.favorites.v1')||'[]');return Array.isArray(x)?x.filter(f=>f&&typeof f.name==='string'&&typeof f.coord==='string').slice(0,300):[]}catch{return []}}
 function saveFavorites(data){try{localStorage.setItem('bnavi.favorites.v1',JSON.stringify(data));return true}catch{alert('端末への保存に失敗したよ。空き容量やブラウザの設定を確認してね。');return false}}
 function selectPlace(name,coord,meta={}){picked={name,coord,source:meta.source||'',licenses:Array.isArray(meta.licenses)?meta.licenses:[],attributions:Array.isArray(meta.attributions)?meta.attributions:[]};$('selected-place-name').textContent=name;$('selected-place-coord').textContent=coord;if($('place-dialog').open)$('place-dialog').close();safeShowModal($('place-action-dialog'))}
 // Share a single point-action menu between place search, favorites and map long-press.
 window.BNaviSelectMapPoint=(point)=>{
   if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return;
   const coord=point.lat.toFixed(6)+','+point.lon.toFixed(6);
   selectPlace('地図で選択した地点',coord);
 };
 function renderFavorites(){const el=$('favorite-list');el.replaceChildren();const list=favorites();if(!list.length){el.textContent='まだお気に入りはないよ。検索結果や地点を選んで登録してね。';return}list.forEach((f,i)=>{const row=document.createElement('div');row.className='place-result';const b=document.createElement('button');b.className='place-main';b.textContent='☆ '+f.name;const small=document.createElement('small');small.textContent=f.coord;b.append(small);b.onclick=()=>selectPlace(f.name,f.coord,f);const del=document.createElement('button');del.className='remove-favorite';del.textContent='削除';del.setAttribute('aria-label',f.name+'を削除');del.onclick=()=>{if(confirm('「'+f.name+'」をお気に入りから削除する？')){const a=favorites();a.splice(i,1);if(saveFavorites(a))renderFavorites()}};row.append(b,del);el.append(row)})}
 document.querySelectorAll('[data-apply]').forEach(btn=>btn.onclick=()=>applySelected(btn.dataset.apply));
 $('favorite-save').onclick=()=>{if(!picked)return;const name=prompt('お気に入りの名前',picked.name);if(name===null)return;const clean=name.trim().slice(0,90);if(!clean){alert('名前を入力してね');return}const a=favorites();if(a.length>=300){alert('お気に入りは300件までだよ');return}a.push({name:clean,coord:picked.coord,source:picked.source,licenses:picked.licenses,attributions:picked.attributions});if(saveFavorites(a)){$('place-action-dialog').close();setMessage('☆ '+clean+' をお気に入りに保存したよ')}};
 // One deliberate search action; do not show facilities from unrelated cities.
 const addressCore=window.BNaviAddressSearch;
 const searchCore=window.BNaviPlaceSearchCore;
 const mergeCore=window.BNaviPoiSearchMerge;
 const openPoiCore=window.BNaviOpenPoiSearch;
 let suggestionTimer=null,suggestionController=null,suggestionSerial=0;
  const stationCore=window.BNaviStationSearch;
  let stationIndexPromise=null;
  async function searchStations(q){
    if(!stationCore?.parse(q))return [];
    if(!stationIndexPromise){
      stationIndexPromise=fetch('./data/jr_stations.json',{cache:'force-cache'})
        .then(r=>{if(!r.ok)throw Error('駅データ HTTP '+r.status);return r.json()})
        .catch(err=>{stationIndexPromise=null;throw err});
    }
    return stationCore.rank(await stationIndexPromise,q);
  }
  function showStationResults(rows,el){
    el.replaceChildren();
    const summary=document.createElement('p');summary.className='search-summary';
    summary.textContent='検索結果 '+rows.length+'件';el.append(summary);
    rows.forEach(row=>showSearchResult(row,el,'station'));
  }
 async function searchOpenPoi(q,kind='suggest',signal){
   if(!openPoiCore)throw Error('施設検索プログラムを読み込めません');
   const response=await fetch(openPoiCore.makeURL(q,kind,25),{
     headers:{Accept:'application/json'},signal:signal||AbortSignal.timeout(12000)
   });
   if(!response.ok)throw Error('OpenPOI HTTP '+response.status);
   return openPoiCore.fromResponse(await response.json(),kind);
 }
 function renderOpenPoi(rows,el,live=false){
   el.replaceChildren();
   const summary=document.createElement('p');summary.className='search-summary';
   summary.textContent=(live?'入力候補 ':'検索結果 ')+rows.length+'件';el.append(summary);
   rows.forEach(row=>showSearchResult(row,el));
 }
 function cancelSuggestions(){
   suggestionSerial++;
   if(suggestionTimer!==null){clearTimeout(suggestionTimer);suggestionTimer=null}
   if(suggestionController){suggestionController.abort();suggestionController=null}
 }
 $('place-query').addEventListener('input',()=>{
   cancelSuggestions();
   const q=$('place-query').value.trim();
   if(q.length<3||searchBusy||!placeDialog.open||currentPlaceTab!=='search'||
       stationCore?.isExplicit(q)||addressCore.looksLikeAddress(q))return;
   const serial=suggestionSerial;
   suggestionTimer=setTimeout(async()=>{
     suggestionTimer=null;
     const controller=new AbortController();suggestionController=controller;
     try{
       const rows=await searchOpenPoi(q,'suggest',controller.signal);
       if(serial!==suggestionSerial||q!==$('place-query').value.trim()||
           searchBusy||!placeDialog.open||currentPlaceTab!=='search')return;
       if(rows.length){const filtered=mergeCore.combine(q,[{kind:'suggest',rows}]);if(filtered.length)renderOpenPoi(filtered,$('place-search-results'),true);}
     }catch(err){
       // Autocomplete is optional; manual search still tries every provider.
     }finally{if(suggestionController===controller)suggestionController=null}
   },550);
 });
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function searchNominatim(q){
   const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=20&countrycodes=jp&accept-language=ja&q='+encodeURIComponent(q);
   const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('Nominatim HTTP '+r.status);
   return searchCore.fromNominatim(await r.json());
 }
 async function searchPhoton(q,category=null){
   const url=new URL('https://photon.komoot.io/api/');
   url.searchParams.set('lang','ja');url.searchParams.set('limit','25');url.searchParams.set('q',q);
   if(category&&!searchCore.parts(q).region.length&&typeof map!=='undefined'&&Number.isFinite(map.lat)&&Number.isFinite(map.lon)){
     url.searchParams.set('lat',String(map.lat));url.searchParams.set('lon',String(map.lon));
   }
   const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('Photon HTTP '+r.status);
   return searchCore.fromPhoton(await r.json());
 }

 function applySelected(kind){
   if(!picked)return;
   if(kind==='via'){if(state.via.length>=50){alert('経由地は50件までだよ');return;}state.via.push(picked.coord);}
   else{$(kind).value=picked.coord}
   rememberPlaceLabel(picked.coord,picked.name);renderVia();refreshMap();fitMarkers();persist();setPick(kind);
   if($('place-action-dialog').open)$('place-action-dialog').close();
   setMessage('「'+picked.name+'」を'+(kind==='start'?'出発地':kind==='goal'?'目的地':'経由地')+'に設定したよ。');
 }
 function showSearchResult(row,el,kind='place'){
   const card=document.createElement('div');card.className='place-result';
   const button=document.createElement('button');button.type='button';button.className='place-main';
   button.textContent=row.name;
   if(kind!=='station'){
    const small=document.createElement('small');small.textContent=kind==='address'?'住所の候補・位置は概略（番地までの確定位置ではありません） · '+row.source:(row.address||'所在地の詳細なし');
    button.append(small);
   }
   button.onclick=()=>selectPlace(row.name,row.lat.toFixed(6)+','+row.lon.toFixed(6),row);
   card.append(button);
   if(kind==='address'){
     const goal=document.createElement('button');goal.type='button';goal.className='address-goal';goal.textContent='目的地にする';
     goal.onclick=()=>{picked={name:row.name,coord:row.lat.toFixed(6)+','+row.lon.toFixed(6)};if($('place-dialog').open)$('place-dialog').close();applySelected('goal');};
     card.append(goal);
   }
   el.append(card);
 }
 async function searchAddress(q){
   const candidates=[],errors=[];
   try{
     const r=await fetch(addressCore.makeGSIUrl(q),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
     if(!r.ok)throw Error('住所検索 HTTP '+r.status);
     candidates.push(...addressCore.fromGSI(await r.json()));
   }catch(err){errors.push('地理院住所検索: '+err.message);}
   let results=addressCore.rank(candidates,q);
   // Some datasets index only the town/chome. Retry the locality when a
   // full building number is unknown; results are always marked approximate.
   const locality=addressCore.core(q);
   if(!results.length&&locality.length>=5&&locality!==addressCore.normalize(q)){
     await sleep(800);
     try{
       const r=await fetch(addressCore.makeGSIUrl(locality),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
       if(!r.ok)throw Error('住所検索 HTTP '+r.status);
       results=addressCore.rank(addressCore.fromGSI(await r.json()),q);
     }catch(err){errors.push('丁目付近の再検索: '+err.message);}
   }
   if(!results.length){
     try{
       const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12&countrycodes=jp&accept-language=ja&q='+encodeURIComponent(q);
       const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
       if(!r.ok)throw Error('OSM住所検索 HTTP '+r.status);
       results=addressCore.rank(addressCore.fromNominatim(await r.json()),q);
     }catch(err){errors.push('OSM住所検索: '+err.message);}
   }
   const el=$('place-search-results');el.replaceChildren();
   if(results.length){
     const lead=document.createElement('p');lead.className='search-summary';lead.textContent='住所の候補 '+results.length+'件。地図上の位置を確認してね。';el.append(lead);
     results.forEach(x=>showSearchResult(x,el,'address'));
   }else{
     const msg=document.createElement('p');msg.className='search-no-match';msg.textContent='住所が見つかりませんでした。丁目までに短くするか、地図を長押しして指定してね。';el.append(msg);
     if(errors.length){const note=document.createElement('p');note.className='smallprint';note.textContent='検索サービスに接続できない場合もあるよ。';el.append(note);}
   }
   
 }

 async function runSearch(q,forcedAddress=false){
   if(searchBusy||!q)return;
   cancelSuggestions();
   const ext=$('online-map-search');if(ext)ext.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
   const el=$('place-search-results');
    const localStationQuery=!forcedAddress&&stationCore?.isExplicit(q);
    if(!localStationQuery&&Date.now()-lastSearch<1600){setMessage('続けて検索するときは少し間隔をあけてね。');return}
   lastSearch=Date.now();searchBusy=true;const addressMode=forcedAddress||addressCore.looksLikeAddress(q);
   el.textContent=addressMode?'住所を検索中…':'施設名と地域を照合して検索中…';
   try{
      if(addressMode){await searchAddress(q);return;}
      // Explicit station queries resolve locally first: no geocoder outage or
      // unrelated nearby railway station can hide an exact JR station match.
      if(localStationQuery){
        try{const matches=await searchStations(q);if(matches.length){showStationResults(matches,el);return;}}
        catch(err){/* Fall back to online geocoders when local data cannot load. */}
      }
     // Do not stop when OpenPOI finds one branch: another provider may know HQ.
      const parsed=searchCore.parts(q),cat=searchCore.category(q);
      const tasks=[
        (async()=>({kind:'suggest',rows:await searchOpenPoi(q,'suggest')}))(),
        (async()=>({kind:'search',rows:await searchOpenPoi(parsed.name||q,'search')}))(),
        (async()=>({kind:'geocoder',rows:await searchPhoton(q,cat)}))(),
        (async()=>({kind:'geocoder',rows:await searchNominatim(q)}))()
      ];
      const responses=await Promise.allSettled(tasks),groups=[],candidates=[];
      let providerSuccesses=0;
      for(const response of responses){
        if(response.status!=='fulfilled')continue;
        providerSuccesses++;
        const result=response.value;
        const rows=result.kind==='geocoder'
          ?result.rows.map(row=>({...row,categoryMatch:searchCore.categoryMatches(row,cat)}))
          :result.rows;
        groups.push({kind:result.kind,rows});
        if(result.kind==='geocoder')candidates.push(...rows);
      }
      let results=mergeCore.combine(q,groups);
      if(!results.length&&parsed.region.length&&parsed.name.length>=2){
        // Find companies indexed only without their city; keep locality filter.
        try{
          const rows=(await searchPhoton(parsed.name,cat)).map(row=>({...row,
            categoryMatch:searchCore.categoryMatches(row,cat)}));
          candidates.push(...rows);
          results=mergeCore.combine(q,[...groups,{kind:'geocoder',rows}]);
          providerSuccesses++;
        }catch(err){/* Do not invent unindexed places. */}
      }
      if(!results.length&&!localStationQuery){
        try{const matches=await searchStations(q);if(matches.length){showStationResults(matches,el);return;}}
        catch(err){/* Retain online results if station index fails. */}
      }
      const suggestions=results.length?[]:searchCore.related(candidates,q,results);
      el.replaceChildren();
      if(results.length){
        const h=document.createElement('p');h.className='search-summary';
        h.textContent='検索結果 '+results.length+'件';el.append(h);
        results.forEach(x=>showSearchResult(x,el));
      }else if(suggestions.length){
        const h=document.createElement('p');h.className='search-summary';
        h.textContent='関連候補 '+suggestions.length+'件（名称を確認してね）';el.append(h);
        suggestions.forEach(x=>showSearchResult(x,el));
      }else{
        const p=document.createElement('p');p.className='search-no-match';
        p.textContent=providerSuccesses===0?'検索サービスに接続できませんでした。通信状態を確認して再検索してね。':
          '該当する施設を検索データから見つけられませんでした。住所が分かる場合は「住所で探す」も試してね。';
        el.append(p);
      }
      if(results.length||suggestions.length){
        const note=document.createElement('p');note.className='smallprint';
        note.textContent='別の事業所は、それぞれの所在地を確認して選んでね。';el.append(note);
      }
    }catch(err){
     el.replaceChildren();const p=document.createElement('p');p.textContent='検索処理に失敗しました（'+err.message+'）。';el.append(p);
   }finally{searchBusy=false}
 }
 $('place-search-form').onsubmit=e=>{e.preventDefault();runSearch($('place-query').value.trim())};
 $('search-address-btn').onclick=()=>runSearch($('place-query').value.trim(),true);
 // Long-press map is not needed: use currently entered coordinates to save without reverse geocoding.
 for(const id of ['start','goal']){const target=$(id);const btn=document.createElement('button');btn.type='button';btn.className='mini';btn.textContent='☆';btn.title=id==='start'?'出発地をお気に入り':'目的地をお気に入り';btn.onclick=()=>{try{const c=fmt(parsePoint(target.value));selectPlace(id==='start'?'出発地':'目的地',c)}catch{alert('先に地点を登録してね')}};target.parentElement.append(btn)}
})();
