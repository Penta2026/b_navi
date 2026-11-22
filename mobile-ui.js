/* Browser-local favorites + mobile controls. Does not alter routing profiles. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id), isMobile=()=>matchMedia('(max-width:800px)').matches;
 let picked=null, searchBusy=false, lastSearch=0;
 const sheet=$('sidebar');
 window.BNaviCloseRouteSheet=()=>toggleSheet(false);
 // On free-ride completion, expose the existing GPX save/share actions at the
 // bottom of the sheet. A failed/no-fix ride does not create a fake GPX.
 window.BNaviShowRecordedTrackActions=()=>{
   const track=$('track-panel');if(!track||track.dataset.state!=='ready')return;
   toggleSheet(true);
   requestAnimationFrame(()=>{sheet.scrollTop=sheet.scrollHeight;});
 };
 function toggleSheet(open){sheet.classList.toggle('sheet-open',open);$('mobile-route').classList.toggle('tool-active',open);$('mobile-map').classList.toggle('tool-active',!open);setTimeout(()=>{if(typeof map!=='undefined'&&map.resize)map.resize();},230)}
 document.querySelectorAll('.pick').forEach(btn=>btn.addEventListener('click',()=>{if(isMobile())toggleSheet(false)}));
 $('start-pick').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});$('goal-pick').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});$('add-via').addEventListener('click',()=>{if(isMobile())toggleSheet(false)});
 $('mobile-route').onclick=()=>toggleSheet(true);$('mobile-map').onclick=()=>toggleSheet(false);$('sheet-handle').onclick=()=>toggleSheet(!sheet.classList.contains('sheet-open'));
 $('mobile-search').onclick=()=>showPlaces('search');$('mobile-faves').onclick=()=>showPlaces('favorites');$('open-search').onclick=()=>showPlaces('search');$('open-favorites').onclick=()=>showPlaces('favorites');
 $('go-location').onclick=()=>{startGps();toggleSheet(false)};
 $('swap-endpoints').onclick=()=>{const a=$('start').value;$('start').value=$('goal').value;$('goal').value=a;state.via.reverse();renderVia();refreshMap();fitMarkers();persist();updatePointSummaries();setMessage('出発地と目的地を交換したよ。経由地も逆順にしたよ。')};
 $('place-dialog-close').onclick=()=>$('place-dialog').close();$('place-action-close').onclick=()=>$('place-action-dialog').close();
 function safeShowModal(dialog){if(!dialog)return;try{if(dialog.open)dialog.close();dialog.showModal()}catch{dialog.setAttribute('open','open')}}
 function showPlaces(tab){safeShowModal($('place-dialog'));switchTab(tab);if(tab==='search')setTimeout(()=>$('place-query').focus(),100)}
 function switchTab(tab){const fav=tab==='favorites';$('search-panel').hidden=fav;$('favorites-panel').hidden=!fav;$('tab-search').classList.toggle('selected',!fav);$('tab-favorites').classList.toggle('selected',fav);if(fav)renderFavorites()}
 $('tab-search').onclick=()=>switchTab('search');$('tab-favorites').onclick=()=>switchTab('favorites');
 function favorites(){try{const x=JSON.parse(localStorage.getItem('bnavi.favorites.v1')||'[]');return Array.isArray(x)?x.filter(f=>f&&typeof f.name==='string'&&typeof f.coord==='string').slice(0,300):[]}catch{return []}}
 function saveFavorites(data){try{localStorage.setItem('bnavi.favorites.v1',JSON.stringify(data));return true}catch{alert('端末への保存に失敗したよ。空き容量やブラウザの設定を確認してね。');return false}}
 function selectPlace(name,coord){picked={name,coord};$('selected-place-name').textContent=name;$('selected-place-coord').textContent=coord;if($('place-dialog').open)$('place-dialog').close();safeShowModal($('place-action-dialog'))}
 // Share a single point-action menu between place search, favorites and map long-press.
 window.BNaviSelectMapPoint=(point)=>{
   if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return;
   const coord=point.lat.toFixed(6)+','+point.lon.toFixed(6);
   selectPlace('地図で選択した地点',coord);
 };
 function renderFavorites(){const el=$('favorite-list');el.replaceChildren();const list=favorites();if(!list.length){el.textContent='まだお気に入りはないよ。検索結果や地点を選んで登録してね。';return}list.forEach((f,i)=>{const row=document.createElement('div');row.className='place-result';const b=document.createElement('button');b.className='place-main';b.textContent='☆ '+f.name;const small=document.createElement('small');small.textContent=f.coord;b.append(small);b.onclick=()=>selectPlace(f.name,f.coord);const del=document.createElement('button');del.className='remove-favorite';del.textContent='削除';del.setAttribute('aria-label',f.name+'を削除');del.onclick=()=>{if(confirm('「'+f.name+'」をお気に入りから削除する？')){const a=favorites();a.splice(i,1);if(saveFavorites(a))renderFavorites()}};row.append(b,del);el.append(row)})}
 document.querySelectorAll('[data-apply]').forEach(btn=>btn.onclick=()=>applySelected(btn.dataset.apply));
 $('favorite-save').onclick=()=>{if(!picked)return;const name=prompt('お気に入りの名前',picked.name);if(name===null)return;const clean=name.trim().slice(0,90);if(!clean){alert('名前を入力してね');return}const a=favorites();if(a.length>=300){alert('お気に入りは300件までだよ');return}a.push({name:clean,coord:picked.coord});if(saveFavorites(a)){$('place-action-dialog').close();setMessage('☆ '+clean+' をお気に入りに保存したよ')}};
 // One deliberate search action; do not show facilities from unrelated cities.
 const addressCore=window.BNaviAddressSearch;
 const searchCore=window.BNaviPlaceSearchCore;
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function searchNominatim(q){
   const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=20&countrycodes=jp&accept-language=ja&q='+encodeURIComponent(q);
   const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error('Nominatim HTTP '+r.status);
   return searchCore.fromNominatim(await r.json());
 }
 async function searchPhoton(q){
   const url='https://photon.komoot.io/api/?lang=ja&limit=20&q='+encodeURIComponent(q);
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
   const small=document.createElement('small');small.textContent=kind==='address'?'住所の候補・位置は概略（番地までの確定位置ではありません） · '+row.source:(row.address||'所在地の詳細なし')+' · '+row.source;
   button.append(small);
   button.onclick=()=>selectPlace(row.name,row.lat.toFixed(6)+','+row.lon.toFixed(6));
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
   addExternalSearch(el,q);
 }
 function addExternalSearch(el,q){
   const a=document.createElement('a');a.className='external-place-search';
   a.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
   a.target='_blank';a.rel='noopener noreferrer';a.textContent='Googleマップでも探す（外部サイト） ↗';el.append(a);
 }
 async function runSearch(q,forcedAddress=false){
   if(searchBusy||!q)return;
   const ext=$('online-map-search');if(ext)ext.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
   const el=$('place-search-results');
   if(Date.now()-lastSearch<1600){el.textContent='続けて検索するときは少し間隔をあけてね。';return}
   lastSearch=Date.now();searchBusy=true;const addressMode=forcedAddress||addressCore.looksLikeAddress(q);
   el.textContent=addressMode?'住所を検索中…':'施設名と地域を照合して検索中…';
   try{
     if(addressMode){await searchAddress(q);return;}
     const parsed=searchCore.parts(q);let candidates=[];const errors=[];
     try{candidates=await searchNominatim(q)}catch(err){errors.push(err.message)}
     let results=searchCore.rank(candidates,q);
     if(!results.length && parsed.region.length && parsed.name.length>=2){
       // Nominatim free-form parsing of Japanese name + region is inconsistent.
       // Keep region as a strict result filter even when searching by name alone.
       await sleep(1100);
       try{candidates.push(...await searchNominatim(parsed.name));results=searchCore.rank(candidates,q)}
       catch(err){errors.push(err.message)}
     }
     if(!results.length){
       // Photon also relies on OSM data; it can find differently indexed names,
       // but cannot create POIs absent from OSM. It is a secondary manual-query fallback.
       try{candidates.push(...await searchPhoton(parsed.name||q));results=searchCore.rank(candidates,q)}
       catch(err){errors.push(err.message)}
     }
     el.replaceChildren();
     if(results.length){
       const h=document.createElement('p');h.className='search-summary';
       h.textContent=results.length+'件見つかったよ（施設名と指定地域を照合）';el.append(h);
       results.forEach(x=>showSearchResult(x,el));
       const note=document.createElement('p');note.className='smallprint';
       note.textContent='OpenStreetMap由来の検索です。表示された施設の場所は地図上でも確認してね。';el.append(note);
     }else{
       const p=document.createElement('p');p.className='search-no-match';
       p.textContent='施設名と地域が一致する候補は見つかりませんでした。無関係な会社は表示しません。';el.append(p);
       const sub=document.createElement('p');sub.className='smallprint';
       sub.textContent=errors.length===3?'検索サービスへの接続にも失敗しました。':'地図への施設登録がない場合は、別の施設検索基盤が必要です。';el.append(sub);
     }
     addExternalSearch(el,q);
   }catch(err){
     el.replaceChildren();const p=document.createElement('p');p.textContent='検索処理に失敗しました（'+err.message+'）。';el.append(p);addExternalSearch(el,q);
   }finally{searchBusy=false}
 }
 $('place-search-form').onsubmit=e=>{e.preventDefault();runSearch($('place-query').value.trim())};
 $('search-address-btn').onclick=()=>runSearch($('place-query').value.trim(),true);
 // Long-press map is not needed: use currently entered coordinates to save without reverse geocoding.
 for(const id of ['start','goal']){const target=$(id);const btn=document.createElement('button');btn.type='button';btn.className='mini';btn.textContent='☆';btn.title=id==='start'?'出発地をお気に入り':'目的地をお気に入り';btn.onclick=()=>{try{const c=fmt(parsePoint(target.value));selectPlace(id==='start'?'出発地':'目的地',c)}catch{alert('先に地点を登録してね')}};target.parentElement.append(btn)}
})();
