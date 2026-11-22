## 2026-11-22 駅検索のユーザー表示を簡素化
- 「旧PWAのJR駅データから取得」「駅入口・乗車位置とは異なる場合があります」といった出典・精度の技術文言を検索結果から非表示に変更。
- 検索結果の駅カードは駅名だけ表示し、駅検索の見出しを「検索結果 n件」へ統一。検索欄は「施設名・駅名・住所から場所を探せるよ」と案内。
- 駅データの出典と位置の性格は開発資料 `docs/JR_STATION_SEARCH_20261122.md` に維持。駅データ本体・座標・駅名マッチング・地理院住所検索・Nominatim/Photon検索・ルート計算を変更しない。
- 比較：旧BikeNavigator `assets/user-library-v490.mjs` はNominatim単独（最大6件）。現B_NaviはNominatim＋Photon、住所は地理院、駅は内部データの検索を使用。

## 2026-11-22 JR駅の名称検索を旧PWAの駅データで補強
- 外部OSM施設検索で尾道駅が出ない問題に対し、旧PWA `Penta2026/michinotochu/data/jr_stations.json` のJR駅4,321件をそのままB_Naviに移植（元ファイルとGit SHA一致）。
- `尾道駅` / `JR尾道駅` / `ＪＲ 尾道駅` は外部検索よりローカル完全一致を優先。`東尾道駅` / `新尾道駅` を混同しない。駅名のない「尾道」は一般検索が見つからないとき駅データも試す。
- 駅の参考座標は目的地・出発地・経由地に登録可能。駅入口や道路上の正確な座標とは限らないので確認を表示。旧駅データの鮮度は未検証。
- PWAアプリシェルに駅名検索モジュールと駅データを追加。マップタイルの一括取得・ルート計算・GPXのコードは変更しない。
- ローカルNode 95件のうち94件合格・データ全件テスト1件をローカルだけスキップ（3駅の仮データ）。GitHubでは元データ全件を提供し、CIで検証予定。ブラウザでは検索サーバー503でも尾道駅を目的地にできることを確認。詳細：`docs/JR_STATION_SEARCH_20261122.md`。

## 2026-11-22 モバイル「ルート」「検索」タブの再タップで最小化
- ルートの下部タブを再タップするとルートパネルを閉じ、再度押すと開く。下部ハンドルも従来どおり。
- 検索はスマホでは下部タブが押せる非モーダルパネルとし、検索タブを再タップすると閉じ、再タップすると戻る。入力途中の検索語・検索結果は維持。
- お気に入りも同様に切り替え。別タブを開けば前のパネルを閉じ、「地図」で両方を閉じる。デスクトップの検索は従来どおりモーダル。
- GPS、S/G、経由地、ルート計算、カスタマイズ、保存済みマイルートや実走GPXには手を加えない。
- Node 90/90成功。Chromium 320/390/800pxのスマホとPCでタブ挙動を確認。既存ブラウザ試験18種成功。完全オフライン復元・実機タッチは未検証。詳細 `docs/TAB_TOGGLE_20261122.md`。

## 2026-11-22 フリー走行中の案内線を非表示に変更
フリー走行中は道路ルート線だけ描画しない。スタート・ゴール・経由地の印と計算済み経路の内部データは残す。開始直後からGPS追従中も線を非表示とし、終了後に元のルート線が戻る。保存済みGPX・マイルート集・走行記録は削除しない。Node 87件とスマホ幅2種を含むブラウザ試験18種類が合格。実走機は未検証。詳細は `docs/FREE_RIDE_ROUTE_VISIBILITY_20261122.md`。

## 2026-11-22 最新：フリー走行→実走GPX、通常音声案内↔レーダー
- ルート未設定の「🏍 走行」にはフリー走行だけを表示し、単独レーダー開始を削除。
- フリー走行を終了すると、既存のルートパネル最下部の「実走GPX」へ自動で移動。記録点がある場合に手動でGPX保存・共有できる。自動保存・破棄はしない。
- ルート検索／GPXから音声案内を始めた際は通常の地図＋音声画面。案内中だけ上部📡からレーダーへ切替、レーダー画面の「🔈 音声案内へ戻る」で復帰。
- レーダーはナビのGPS監視を共用し、新たな監視を開始しない。レーダー表示中は既存仕様どおり音声案内を抑制、戻ると以後の案内音声を利用できる。
- 地図・ルート計算・排気量別BRF・カスタム設定・マイルート集・GPX記録コアは変更なし。
- Node 85件成功、スマホ模擬含むブラウザ18種成功。実IndexedDB復元のブラウザ試験はlocalhostが環境からブロックされ未実施。実走GPS・音声は未検証。詳細 `docs/FREE_RIDE_NAV_RADAR_20261122.md`。

## 2026-11-22 カスタマイズ範囲 −150〜＋150・10刻み
- 排気量別「一般」を基準にする3スライダーを±150・10刻みに統一。0は一般BRFと完全に同じ。
- 過去の5刻み保存値・プリセット・マイルートの設定は読み込み時に近い10刻みへ丸める（55→60、65→70等）。経路線・実走GPXは変更しない。
- 100超の調整強度を使えるようにし、狭い道側の1車線ペナルティは−100以降も僅かに変化させた。
- 126cc未満の高速/有料禁止、安全規制、先に実装した側道接続路への180m初期コストを維持。
- ローカルNode 83件合格、Playwright画面模擬試験4件合格。公開BRouterと実機走行の効果確認は未実施。詳細は docs/TUNING_150_STEP10_20261122.md。

## 2026-11-22 走り方の復元＋カスタマイズ下段（GitHub Pages）
- 排気量の横に「ビギナー／一般／探索」を表示し、126cc以上は既存ファストトラベルも保持。
- 直下の「🎛 カスタマイズ」は独立のON/OFF。ON時だけ一般BRFを調整し、標準モード選択でOFF（調整値は保持）。
- 以前一般に固定されていた公開BRouter経路検索とGPSリルートを、選択モード・計算時設定で実行。既存GPX記録・レーダー・マイルートを保持。
- Nodeテスト79/79成功、スマホ模擬試験成功。公開BRouter実通信・実走は未検証。詳細：`docs/MODE_CUSTOM_LAYOUT_20261122.md`。

## 2026-11-22 最新：不要な側道接続路への出入りを抑制
- 一般3車種BRFで `trunk_link|primary_link|secondary_link|tertiary_link` を `initialclassifier=2`、それ以外を1とし、接続路進入時だけ `initialcost=180`（距離換算）を追加。必要な接続は通行可のまま。
- `service`／`tertiary` 等が側道の場合は直接対象ではない。地点・OSMタグが未取得のため、効果は未実走検証。
- 3軸カスタムは一般BRFから設定を継承。通行規制・車種の制限は維持。ローカルNode77件合格。
- 詳細 `docs/ROAD_CONTINUITY_20261122.md`。

# 最新の追加仕様：2026-11-22 実走GPX日時ファイル名

- `track-recorder.js` の `filename()` と `formatFilename()` を使用。最初のGPX保存またはWeb Share時に `record.exportedAt` をISO時刻で保存。出力名は端末ローカル時刻から `実走GPX-YYYY-MM-DD-HH-mm.gpx` を生成。再読み込みしても同一走行記録なら同名。
- 例：日本時間2026年11月22日08時25分 → `実走GPX-2026-11-22-08-25.gpx`。Windows上で無効な `:` を回避。
- GPX XML内部の `time` はこれまでどおりISO UTC。`record.started` や実走GPS点は変更しない。共有ファイルは受信アプリ側で名前を変更する可能性がある。
- `sw.js` のキャッシュ名変更。`tests/test_track_filename.cjs` でJST表示／保存と共有の一致／再読み込み後の同名を検証。Node 77/77 PASS。GitHub Pages配信と実機は別途確認。

---

# 2026-11-21 — 実走GPX待機表示をルートパネル最下段へ移動（公開版）

- 固定オーバーレイだった「📍 実走GPX記録／記録待機中」を **ルートパネル最下段（走行・音声案内より下）** へ移動し、通常のスクロール領域に収めた。地図・パネルの引き上げハンドル・下部タブを覆わない。
- GPS未記録時は控えめな1行のステータスだけを表示。走行後に軌跡が残ると「実走GPXを保存／GPXを共有（LINEなど）／記録を破棄」を表示する。走行中はナビ／レーダー画面を優先する。
- 実走軌跡の取得・端末への逐次保存・GPX XML・共有・リルート・車種別のルート計算・マイルート集は変更しない。
- `track-recorder.js` の `render()` が `data-state=idle|recording|ready` を設定。`style.css` は固定座標を廃止し、待機中の操作ボタンを非表示にする。PWAキャッシュ名を更新。
- Node.js `node --test tests/test_*.cjs` **74/74 PASS**、Chromium模擬（320px/390px）の待機→記録→保存待ち→破棄、新版プリセット、マイルート集、走行GPSを確認。
- **未検証**：Android/iPhone実機のタッチ操作と、LINEへの実際のファイル共有。GitHub Pagesは別途配信結果を確認する。

---

# 2026-11-21 — マイルート集（計算済み経路＋パラメータ）PWA統合版

この版は `B_Navi_PWA_Named_Route_Presets_2026-11-21.zip` を土台にした追加開発。**PWA実ソースへの実装とZIP化まで完了。GitHub Pages本番リポジトリへは未反映。**

- ルート検索またはGPX読み込みで表示した経路を、**名前・排気量・3軸パラメータ・高速/有料オプション・S/経由地/G・道路形状とGPX音声案内ヒント**をまとめた「マイルート」として端末内に保存できる。
- 「経路の結果」→「🗺 マイルート集」を開いて、名前入力→「☆ 今表示中の経路を保存」。一覧から「地図に読み込む」／「削除」。同車種・同名の保存は確認してから上書き。最大30件。
- 保存場所は `bnavi-my-route-library-v1` IndexedDB。名前付き**パラメータだけ**の保存は既存 `bnavi.routePresetLibrary.v1` localStorage（50件）として別に維持。実走GPX記録も別に維持。
- マイルートを読み込んでもBRouterへ自動再通信しない。保存した線・計算時の設定・経由地を復元。案内中は読み込みを拒否し、表示中の経路との入替は確認する。
- しまなみ橋参考線と関門押し歩きは元の区間種別を保ち、走行可能な道路GPXへ変換しない。
- Service Worker のキャッシュ名更新。Webサイト公開にはこのZIPを**解凍し、GitHub Pagesリポジトリのルートへ内容を配置**する必要がある（ZIPそのもののアップロードではない）。
- テスト：Node **74/74 PASS**。Chromium模擬で「マイルート集」保存→呼出→削除、旧プリセット・3軸・GPS/音声/レーダー・GPX地点順・320〜430px UI 等を確認。
- **未確認**：ブラウザの実IndexedDB（検証環境のローカルHTTPがブロックされるため保存機能はIndexedDB互換モックによる動作検証）、Android/iPhone実機、公開BRouter実通信、本番GitHub Pages配備、現地合法性。

---

# 現行正本：B_Navi PWA 名前付きカスタム調整プリセット（2026-11-21）

**最優先：このZIPの実コードを正とする。** 引継ぎ元 `B_Navi_PWA_Custom_Route_Tuning_2026-11-21.zip`。GitHubへのpushなし。

- `route-presets.js`: 名前付き調整プロファイル管理の純粋ロジック。キー `bnavi.routePresetLibrary.v1`、形式 `{version:1,items:[{id,name,vehicle,tuning,createdAt,updatedAt}]}`。総数50、名前40文字、車種ごとに同名判定、上書き明示、50/125ccの高速・有料ONを正規化で拒否。
- `app.js`: `bindPresetUI()` で保存/呼び出し/削除、JSONバックアップ出力・読み込み。保存確認前に `localStorage` へ書かない。読み込みは `tuningByVehicle` に反映し、ルート計算は既存のボタンから手動実施。アクティブなナビ/ルート線やGPXは書き換えない。既存のリルート時固定 `state.activeRouteTuning` を保持。
- `index.html`: スライダー詳細内にさらに折り畳めるプリセットパネル、別折り畳みバックアップ操作。`style.css`: 既存の固定「実走GPX保存」操作が設定を塞ぐ競合を回避。`sw.js`: 新スクリプトを事前キャッシュしバージョン更新。
- **プリセット保存≠計算済み経路の保存≠実走GPX**。ルート線の保存は従来の「GPX保存」「この経路を端末に保存」から。JSONバックアップには位置情報を入れない。
- 検証: `node --test tests/*.cjs` **70/70 PASS**。`tests/browser_route_presets.py` と既存 `browser_route_tuning.py`, `browser_smoke.py`, `browser_gpx_itinerary.py`, `browser_ride_integration.py`, `browser_radar_voice_mute.py`, `browser_control_row.py`, `browser_gps_message_layout.py`, `browser_voice_settings.py`, `browser_long_press.py`, `browser_shimanami_payload.py`, `browser_shimanami_via_reroute.py` は成功（模擬）。既存の手動スクリプト読込を `index.html` の実リストへ追従するよう改善。
- 未検証: 実機localStorage耐久性/バックアップの別端末読み込み、実BRouterネットワーク、実走およびLINE共有、しまなみフルWeb走行。GitHub Pagesへの公開は行っていない。

---

# 現行正本: B_Navi PWA 3軸カスタムルート調整 v1（2026-11-21）

**このZIPのソースとこの節を最優先**。ベースはユーザー提供 `B_Navi_PWA_Actual_Track_GPX_SHARE_2026-11-21.zip`。GitHub `Penta2026/b_navi` へのpushは行っていない。

- UIは「車種」+3本スライダー：距離/探索、道狭/道広、直線/景観。各車種の旧「一般」BRFが中央の完全一致基準。内部 `mode=1`。以前の10 BRFは上書きしない。
- `route-tuning.js` が中央以外の設定からBRF文字列を生成。`public-brouter-client.js` が設定別カスタムBRFを `/profile` にPOSTし、各設定固有のIDをBRouterで再利用する。法的通行制限のゲートは残す。別の設定のIDを誤再利用しない。
- `app.js` が車種別設定をローカルに保存し、検索時に `state.activeRouteTuning` / `state.activeRoutingVehicle` を固定。通常リルート・しまなみ分割道路計算/再探索へもその設定を渡す。保存済みルートメタデータに追加するが、既存形式も読み込める。
- 126cc以上の高速・有料は独立チェックで初期OFF。`motorroad=yes` / `motorway` の解禁は高速オプション時のみ、`toll=yes` の解禁は有料オプション時のみ。`motorcycle=no` 等を解除してはならない。
- 元の景観判定はない。新規に `estimated_forest_class` / `estimated_river_class` を利用。リアルな車の流れや車線幅は検知できず、道路属性からの推定に留まる。
- Java専用APIが設定されると動的BRF調整を受け付けないため、変更時は計算失敗として明示。公開BRouterのCORSとサーバ負荷・制限は実通信未確認。
- 実走GPX記録・共有は維持。`style.css`でナビ/フリー走行中の `#track-panel` を非表示にして操作競合を解消、終了後は復帰。
- テスト: Node 64/64 PASS。新規 `tests/test_route_tuning.cjs` (6件) と `tests/browser_route_tuning.py`、既存browser smoke/GPX/ride/radar/control/GPSを実行し成功。しまなみフルブラウザ試験は終了せず未検証。**実端末・公開BRouter本番通信は未確認**。
- 変更: `route-tuning.js`, `public-brouter-client.js`, `app.js`, `index.html`, `style.css`, `sw.js`, tests, 引継ぎドキュメント。`profiles/*.brf`, `shimanami-geometry.js`, `track-recorder.js` は未改変。

---

## 最新 2026-11-21: GPX中継地点の取り込み修正（道の途中形式を含む）
- 現行正本: `Penta2026/b_navi`。基準コミット: `49e112ee...`（レーダー音声ミュート）。
- 原因: `gpx-transfer.js` が道路軌跡のない `<rte><rtept>` を走行線として扱い、`state.via=[]` にしていた。そのためS→中継→Gが保存されなかった。
- 修正: `gpx-itinerary-core.js` を新設。`BNAV-ITINERARY-1`／名前付きの短いrtept列（トラック点なし）やwpt列を「地点順GPX」と判定し、順番を保持したままS・経由地・Gに登録。GPX地点名をUIに表示する。強制的な直線GPXは作らない。
- 読み込み後は既存の公開BRouter計算（車種・走行条件維持）を自動実行。失敗時も地点は残り、`この順番でルートを再計算` ボタンで再試行。普通の `<trk><trkseg><trkpt>` GPXの軌跡読み込みは維持。
- `app.js` で公開BRouterの道路結果が各中継地点から300m以内を通るか検証。通らなければ計算成功扱いにしない。通常リルートでも残りの中継地点を飛ばした結果は拒否。
- ユーザー提供の実GPX（起点＋中継2＋終点）をローカルChromium模擬試験で使用し、順序・名前・自動計算への4点引渡し・到着対象3件・再試行・中継を外す結果の拒否を確認。**ユーザーの元GPXや起点座標は公開テスト・ZIPに含めない**。
- 公開BRouterの実ネットワーク応答、端末からのGPX共有・実走音声は未検証。サービスが応答しない場合は道路ルート未計算を表示。出発前に結果の道路線・経由地を確認。
- 関連: `gpx-itinerary-core.js`, `gpx-transfer.js`, `index.html`, `style.css`, `app.js`, `sw.js`, `tests/test_gpx_itinerary.cjs`, `tests/browser_gpx_itinerary.py`。


## 2026-11-21 レーダー中の音声案内ミュート（最新版）
- ナビ中レーダー表示に切り替えた時点で再生中の読み上げを中断し、新しい案内音声を止める。
- レーダー表示中もGPS・経由地到着検知・再計算判定・目的地到着終了は動作する。
- 地図に戻ると次の案内音声から自然に再開。設定画面の音声ON/OFF、速度などは書き換えない。
- 単独レーダー使用中も読み上げを抑制。レーダー独自の接近チャイムは残す（音声読み上げとは別）。
- 到着終了処理はレーダー中に音声完了待ちにならない。経由地到着ポップアップはそのまま。
- 確認対象: `app.js`、`ride-radar.js`、`sw.js`、`tests/test_radar_voice_mute.cjs`、`tests/browser_radar_voice_mute.py`。
- 検証範囲は模擬GPS・模擬音声のみ。実機スピーカーは未確認。

## 2026-11-21 通知位置の追補（最新）
- `style.css` 末尾で `#map-gps-message` のtopを `calc(max(12px, safe-area-inset-top) + 62px)` に統一。これまでの案内時 `top:14px` とボタンの重なりを解消。
- 6ボタンUI、リルート判定、BRF、しまなみ6橋、長押し、保存/音声処理は変更なし。
- Nodeテストと、320〜430px × 3モードでのブラウザ幾何テストを行う。実機は未確認。

## 最新: 2026-11-21 一列操作＆移動判定
- `index.html`,`style.css`: 地図操作6ボタンを一列に配置。右端に進行方向切替。
- `ride-logic.js`: MotionGate追加。停止時はリルートしない。`app.js`でwatchPositionの位置と速度から判定。
- 車種別BRF, しまなみ橋形状, 関門, GPS島間切替ロジックは変更なし。
- 未検証: 実走の速度判定・リルートタイミング、公開BRouter通信。

## 2026-11-21 公開反映：地図コントロールの横並び
- 今回対象は `index.html`, `style.css`, `sw.js`, テスト、リリース文書。
- 前版はZIP作成のみでGitHubに反映できていなかった。今回はGitHubコミットとPages公開成功をそれぞれ確認する。
- 検証: 上段 `＋ / － / ◎ / ⌖ / 📡`、2段目右端 `進行方向 ⇔ 北を上`。旧CSSのズーム隠しルールを解消。
- レーダーは案内中のみ表示する既存動作を保持。GPS／検索／橋関連の処理は変更しない。
- 実機スクリーンショットの最終確認は必要。

- UI微調整: 地図上の操作ボタンを、上段「＋ / － / ◎ / ⌖ / 📡」、下段右端「進行方向」に変更。
# CURRENT — 2026-11-21 しまなみWeb経路組立版 / 引継ぎ正本

> **この節が最新。履歴の古い「しまなみは専用Java APIのみ」という記述より優先。** ベースGitHub `Penta2026/b_navi` commit `d98edad61137fd5e907c28ee71762ad5f025dea6`。原本は `B_Navi_Android vf1.zip` の `ShimanamiReferencePlan.java`・`ShimanamiJourneyPlan.java`・`ShimanamiIslandHandoff` と、保存済み橋参考GPX。今版はフロントだけを変更。

## 正本・運用構成
- GitHub Pages：静的PWA（`index.html`、`app.js`など）
- 通常オンラインルート：公開 `https://brouter.de/brouter` にBRFを送信しGPX+voicehintsを取得
- しまなみ50cc／125cc以下：`shimanami-web-router.js` がユーザー地点を7エリアで分類し、橋番号と進行方向を明示して島内道路を分割計算。橋形状は `shimanami-geometry.js`（無変更）+ `shimanami-bridge-references.js`（過去の実GPXから数値を再構成）で表示。現地の通行可否は保証しない。
- 島内GPS: `app.js` 内 `loadIslandGuidance`、`updateShimanamiGuidance`。橋入口65m以内かつ残距離160m以内に一時停止。次の島の開始点90m以内で再開。GPS精度35m以内で切替。既存約20mの直前案内を維持。
- 島内再探索: `rerouteShimanamiFromGps()` は `OffRoutePolicy` に基づき、**今いる島内道路の現在地→元の終点**だけを計算し直す。橋の走行GPXは作らない。
- 保存: `offlinePayload()` に `shimanamiPlanPoints`、`shimanamiWebBuilt`、各 `sectionIndex`・`checkpointAfter`・`bridgeAfter`・`turnCues`・参考線区別を格納し、旧データの読み込みにも対応。DB名・お気に入りキーは変更なし。

## 変更ファイル
- `app.js`: 公開BRouter上のしまなみ分割計算、机上検証ボタン、島内自動リルート、経由地確認、オフラインメタデータ
- `shimanami-web-router.js`: 7エリア順序／往復橋計画／道路・橋の接続監査／自動合成・机上検証
- `shimanami-bridge-references.js`: 過去の6個の参考GPXの座標と元ファイルハッシュ（**走行用ではない**）
- `public-brouter-client.js`: 同一BRFの同時アップロードを防ぐ通信中Promise共有
- `index.html`: 新JS読込と詳細内の「しまなみ机上検証」
- `sw.js`: 新JSのキャッシュとバージョン更新
- `tests/test_shimanami_web_router.cjs`、`tests/browser_shimanami_web_flow.py`、`tests/browser_shimanami_via_reroute.py`、`tests/browser_shimanami_payload.py`、`tests/browser_shimanami_offline_restore.py`
- `README.md`、`HANDOFF_CURRENT.md`、`CHANGELOG_B_Navi.md`、`NEXT_STEPS.md`、`RELEASE_INFO.json`、`RELEASE_VERIFICATION.txt`

## 検証結果と区別
- Node: 45/45 PASS。模擬スマホテスト: 8/8 PASS。新しい橋参考線の本数6・進行12方向、7島内道路と6橋の接続、経由地/島間/島内再探索を検証。
- **未確認**: 公開BRouterへの本番リクエストで7道路が全て解決するか（CORS/レート制限/ノードスナップ）、対象端末実機、GPSの橋出口捕捉、IndexedDB実保存再読込、法規適合性。
- ローカルHTTPは試験実行環境の `ERR_BLOCKED_BY_ADMINISTRATOR` により不可。IndexedDB APIを成功と偽らない。JSONの保存モデル往復は確認済み。

## 禁止事項
- 既存の `profiles/*.brf`、`shimanami-geometry.js` とAndroid原本・橋参考GPXは、根拠なく書き換えない。
- 参考線を走行ルートへ無断で混ぜない。原付の合法通行、公開BRouterの可用性、スマホでの画面OFF案内を保証しない。
- ルート連結を簡便な直線で偽装しない。25mシームNGなら計算失敗として明示。
- 公開済みGitHubへpushするときは `main` 取得→差分コミット→ `expected_sha` 付きref更新。失敗なら勝手に強制pushせず再確認。
- 毎回ソースとHANDOFF / NEXT_STEPS / CHANGELOG / 検証結果を含むZIPを作る。

---
## 旧引継ぎ履歴（最新版の根拠にはしない）

# 2026-11-21 実走フィードバック反映：走行ナビ・レーダー v1

> **この節が最新。** Android `B_Navi_Android vf1.zip` の `OffRoutePolicy.java`・`RouteGuidance.java` を確認し、現行GitHub `Penta2026/b_navi` (`d3028abd9...`) をベースに改修。旧内容に『未実装』の表現がある場合はこの節と実コードを優先。

## 追加・変更
- ルート案内中はGPSが約20m以内・精度25m以内を **連続2回** 満たして経由地／最終目的地へ到着。経由地ではアナウンス後「次の目的地を案内しますか？」の選択ダイアログ。次へ進む選択で対象地点を更新。最終目的地では到着アナウンス完了後に音声案内を自動終了。ループ（S≒G）では出発直後の誤到着を防ぐ。
- 右左折は従来の約130m前予告に加え、**20m以内で「右折です／左折です」**を再アナウンス（GPXに有効な右左折指示がある場合のみ）。
- `ride-logic.js` 新設。Android `OffRoutePolicy` と同等の閾値 `max(10m, 2×GPS精度+3m)`、逸脱位置3回・1.2秒以上、再試行12秒間隔。GPS精度35m以内で道路線からの逸脱を判定。GPSを始点に**残りの経由地→目的地**を同じ車種・走り方でオンライン再探索。元のS・G・経由地は書き換えない。再探索エラーは表示し、古い経路を残す。失敗後は45秒の待機でAPI連打を防ぐ。
- **制約：** 自動リルートは通常道路とGPXインポート経路が対象。しまなみ橋・関門の原付専用道路処理は公開BRouterだけでは再構築不可。専用APIがないケースでは特殊区間の安全な自動リルートを保証しない。経路再探索には通信が必要。道路の通行可否は現地の標識を優先。
- レーダー：単独起動時は経由地→Gを順番に表示し、20m到着で次へ進む確認。ナビ中は右上の「📡 レーダー」ボタンで地図⇔レーダー切替。ナビ中レーダーは**既存GPS監視を共有**し、音声ナビは継続。
- フリー走行：ナビ中と同じ地図全画面モード、余計なヘッダー・下部メニュー非表示、終了ボタンは残す。
- 地図画面の左上に `+` / `−` のズームボタンを追加（ピンチは維持）。右上には◎・方位切替・⌖・案内中のレーダー切替。

## 検証
- `node --test tests/test_*.cjs`：37テスト合格。
- `browser_address_search.py` / `browser_long_press.py` / `browser_smoke.py` / `browser_voice_settings.py` / **`browser_ride_integration.py`**：模擬スマホ試験で全PASS。最後の試験はGPS/音声を模擬して「経由地到着→継続→レーダー切替→20m右折→最終到着自動終了」「逸脱後のオンライン再探索1回」「フリー走行の全画面」「レーダー単独で経由地→最終到着」を確認。
- これは**モックGPS・音声・通信**の試験。実機スピーカー／実GPS精度・公道でのリルート成功は未確認。公開BRouterの負荷制限・応答や特殊海峡ルートは未検証。

## 変更していない重要部分
- `profiles/*.brf`、`public-brouter-client.js`、しまなみ6橋 `shimanami-geometry.js`、関門の既存コード、場所検索、お気に入り／端末保存形式。元データに変更なし。

## 次に確認
1. 実機で120〜130m前と20m前の右左折音声が2段階で鳴るか（GPS精度も記録）。
2. 逸脱時にモードが維持されたままリルートできるか、通信圏外で元ルートが残るか。
3. 経由地／最終到着の判定の精度・ポップアップ操作性。
4. しまなみ/関門の専用経路APIを復旧して、その区間用リルートを設計。

---

# 2026-11-21 最新引継ぎ：Voice Settings v1
**この節を現行正本として優先。** ベースGitHub commit `3d84bc20ee1955b57295208ef1bd06b519eacaec` のPWAへ音声設定を追加した。

## 今回
- `app.js` 内の読み上げ速度固定 `0.85` を廃止。既定は **1.15** (`voice-settings.js` 内の `DEFAULTS.rate`)。
- `index.html` の「⚙ 設定」から音声ON/OFF、速度・音量・声の高さ・日本語音声選択・テスト・標準に戻す操作が可能。ルートパネルにも設定への入口あり。
- `localStorage` のキーは `bnavi.voice.v1`。欠損・破損した場合は既定値へ。保存済みGPX/お気に入り/経路のDBは変更しない。
- 通常画面からiPhone/Androidの説明を撤去。GPS・ルート計算の制約は機種依存説明でなく機能単位で表示する。
- 指定済み`BNaviPublicBrouter`、しまなみ橋、関門、車種別プロファイル、赤▲・地図回転・案内中全画面は変更なし。

## 検証
- `node --test tests/*.cjs`：28 PASS。
- `python tests/browser_smoke.py`：390px UI/GPS/音声模擬 PASS。
- `python tests/browser_voice_settings.py`：390px 音量/速度/声/設定保持/音声OFF/試聴/初期化 PASS。
- これらは模擬音声・GPS。iPhone SafariとAndroid Chrome実機での音質/日本語の音量・レート反映/画面OFF継続は **未確認**。

## 次にすること
- iPhone/Android実機で「設定」→「試しに再生」→案内開始を実走前に確認する。
- 日本語の声が列挙されない端末のフォールバック、画面ロック時の挙動を確認する。
- 不具合修正時もルート計算や橋接続の既存テストを必ず実行し、引継ぎ書を更新する。

# B_Navi PWA — 引継ぎ正本 / CURRENT HANDOFF

> **最終更新・2026-11-20:** ユーザーがGitHub Pagesを有効化済み。`Penta2026/b_navi` で commit `39e89c6` の **pages build and deployment** が success。旧GitHub `BikeNavigator` の実装から、経路探索は公開 `https://brouter.de/brouter` に Android BRF を `POST /profile` していたと確定。今回、同じ方式を通常経路の試験用として追加（`public-brouter-client.js`＋10 BRF）。**Cloudflare Workers Paidへの変更はこの方式の試験には不要。** ただし実APIリクエストとiOS/Android GPS音声は未確認。しまなみ・関門の専用処理には従来どおり別Java APIが必要。この更新を、以下の古い『まだPages未設定』『Container前提』の記載より優先する。



**更新：2026-11-20**  
**配布版：`B_Navi_PWA_Search_Handoff_2026-11-20.zip` — Search Parity Foundation v1（旧版の正常動作を壊さず検索を見直すための統合版）**  
**次の作業者はこのファイルを最初に読むこと。** 古い `Handoff_Next_Chat.md` / README 中に残る旧段階の未実装表記より、本ファイルと実ソースを優先する。

## 0. 目的と絶対条件

- B_Navi は **iPhone / Android / PC でできるだけ同じ機能・同じ操作感**を提供するスマホ主役のPWA。PCは計算サーバーと開発・検証環境。
- **現に使用中のAndroid版 `B_Navi_Android vf1.zip` を機能仕様の第一基準**とする。旧GitHub Web版 `Penta2026/BikeNavigator` をWeb実装の参照、今回のZIP内ソースを移植先とする。
- すでに動作報告のあるしまなみ島渡り、因島大橋、GPS島間切替、関門、50cc探索プロファイル等は無闇に置換しない。
- 毎回 **統合版ZIP + 本引継ぎ書 + CHANGELOG_B_Navi.md + NEXT_STEPS.md + 実ソース + テスト**を配布する。別の診断専用アプリを作って検証をユーザーに押し付けない。
- ファイル名は半角英数字（ASCII）。画面と説明の日本語はそのままでよい。個人の仕事や個人的な施設名をUIの検索例・固定テスト値として公開しない。
- **できた / まだ未確認 / できていない**を混ぜない。経路・規制・施設位置の実在・合法性を根拠なく保証しない。

## 1. 基準ソースの所在

1. Android本物の利用版：会話添付 `B_Navi_Android vf1.zip`。主に `app/src/main/java/jp/bikenav/offline/MainActivity.java`。
2. 過去のAndroid参考：`B_Navi_Android(7).zip`、Android v1.1.31。現行vf1の方が新しい基準。
3. 旧GitHub：`https://github.com/Penta2026/BikeNavigator`。2026-11-20に `assets/user-library-v490.mjs` と `docs/ANDROID_TO_PWA_DATA_ROADMAP.md` を確認。旧Webの検索コードもNominatimだけなので **旧Web版が特定施設を検出していた理由までは未確定**。
4. 今回の修正前ZIP：`B_Navi_PWA_iPhone_Clipboard_GPX_2026-11-20.zip`。今回の変更はそこからの差分。
5. 新GitHub：`Penta2026/b_navi` は別リポジトリ。**このZIPの中身を公開・pushしたわけではない**。

## 2. ユーザーから確認できたこと

- しまなみ：片道は動作確認報告あり。経由地入りも後続版で改善を試験。全経由地パターンと実走は未保証。
- 一般/探索が同一になる経路の原因をBRFで確認し、50cc探索を調整。強すぎる小道旋回を緩和した版が今回もベース。
- 地図ピンチの感度は調整後にユーザーからOKを得た。
- 現在のオンライン施設検索は不適切。入力と無関係な全国の会社が10件表示されるスクリーンショットをユーザーが提示。
- PWAの機能移植はAndroidとの同等性が不足、特に検索・端末オフライン地図・GPS/音声・フリー走行/レーダー・お気に入りの同等性が未確定。

## 3. 2026-11-20 今回変更したもの

- `web/place-search-core.js` を新設。検索文字列を「地域」と「施設名」に分解、会社種別表記の軽い正規化、名前と地域の双方が一致した候補を評価。座標重複も排除。個別企業の座標・名称は一切埋め込まない。
- `web/mobile-ui.js`：従来の「名前だけ全国再検索 → その他の無関係な候補を10件表示」仕様を撤去。Nominatimの元クエリ→該当地域の施設名単独再検索（1.1秒間隔）→Photon補助検索（必要時）の順に、**手動検索1回につき最大3段階**を実行する。
- PhotonもOSMを原本とする検索エンジンで、Google等の網羅的な企業データに置き換えたものではない。公開デモAPIへの負荷・可用性・利用規約に本番運用を依存させない。
- 結果は「名称+指定地域が一致するもの」だけクリック可能候補として表示。それ以外を『その他の候補』に多数出さない。見つからない場合は理由を明示し、外部Googleマップ検索へのリンクを残すが、**そのリンクからPWAへ座標を自動で持ち帰れない**。
- `web/index.html`：検索の説明文を正確化し、`place-search-core.js` を読み込む。
- `web/sw.js`：キャッシュ名を更新、新JSを静的シェルに含める。iPhone/Android PWAの古いキャッシュによる検索コード混在を避ける。
- `tests/test_place_search_relevance.cjs` を追加して検索候補の採用条件をNode.jsでテスト。
- **経路エンジン・BRouterプロファイル・RD5・しまなみ・関門・GPS音声切替・GPX連携・レーダーの実装は今回変更していない。**

## 4. 実際に確認したこと

- `node --check web/mobile-ui.js`、`node --check web/place-search-core.js`：PASS。
- `node --test tests/*.cjs`：11テスト PASS（旧橋/GPS関連 + 検索5件）。
- ZIPのCRC検証と配布前のファイル名ASCII確認は実施する（詳細は `RELEASE_VERIFICATION.txt`）。
- ChromiumヘッドレスでUIを直接開く試み：実行環境が localhost と file URL を `net::ERR_BLOCKED_BY_ADMINISTRATOR` でブロック。**ブラウザUIテストは実施できていない**。
- Nominatim/Photon APIの **実検索応答・特定会社の表示・iPhone Safari/Android Chromeの実画面・Windowsでの起動**は未確認。ユーザーに実結果を検証してもらう必要がある。

## 5. Androidと現行Webの具体的な差

- Android `vf1` の `MainActivity.searchPlace` は Android 標準 `Geocoder` が先行し、未取得時にOSMへフォールバック。PWAでは標準Geocoderそのものが使えない。
- 旧GitHubの `assets/user-library-v490.mjs` は Nominatim 検索、端末内IndexedDBの場所/ルート保存などを実装していた。**過去Webの方が検索精度がよいというユーザー実感を否定しない**が、どの検索応答だったかはログ不在で断定不可。
- 現行PWAはAndroidのフリー走行/レーダーの一部のみ移植、GPS動作のOS別実走試験・完全オフラインは未完成。
- 既存JavaルーティングサーバーはPCローカル。LAN HTTPはGPS用の安全なコンテキストにならず、iOS/Androidの本番利用にはHTTPS配備が必要。

## 6. 次にやること（順序固定ではないが優先度順）

**最優先：場所検索の実測と検索基盤の選定**
- 本版の実検索結果を複数の一般施設名・都市で確認。Nominatim/Photon両方で見つからない施設は、候補表示処理をいじっても解決しない。
- Android Geocoder相当のカバレッジを得るため、許諾条件・APIキー・費用・OSM地図での表示可否を確認して検索提供元を選ぶ。Google Places API等には課金/鍵/使用条件があるため、契約前に完成扱いしない。公開デモAPIへ本番依存しない。
- 企業名等の私的テスト事例を検索欄プレースホルダやソース固定値として埋め込まない。

**優先2：機能移植の対応表を毎版更新**
- Android vf1 とPWAの差をフリー走行、レーダー、音声、GPS、通知、通行規制、お気に入り、端末内オフライン地図、GPX連携ごとに「実装/未実装/要実走」に分ける。
- GPX XMLの貼り付けとファイル読込は既存機能。iPhoneの共有先としての直接受信は未対応、AndroidのWeb Share Targetはインストール済みPWA/HTTPSなどの条件が必要。
- iPhone/Androidで同じ機能を検証し、画面OFF時のGPS継続はOS制約を踏まえて正直に明記。

**優先3：運用・クラウド**
- PC不要のHTTPS上のJava BRouterサーバーを別工程で設計。ユーザー10人未満の運用で過剰設備や制限付き無料ルーティングAPIを避ける。
- 現在のRD5は同梱。全国利用には必要RD5の導入、道路規制の定期更新、OSM/サードパーティ帰属、配布条件の確認が必要。

## 7. 再開手順

1. ZIPを解凍し `HANDOFF_CURRENT.md` と `CHANGELOG_B_Navi.md`、`NEXT_STEPS.md` を読む。
2. `web/mobile-ui.js` / `web/place-search-core.js` と `tests/test_place_search_relevance.cjs` を開く。旧版の検索候補を勝手に表示する方式へ戻さない。
3. `node --test tests/*.cjs` と JS構文チェックで回帰テスト。Javaエンジン/RD5に手を入れたらJava回帰テストも実施。
4. Windows `Start_B_Navi.bat`、LAN試験 `Start_B_Navi_LAN.bat`。LANの`http://192.168.x.x`ではGPS不可の制約を維持。
5. 新版ZIPへ**変更履歴・次の課題・未確認事項を同梱**し、前版名を明記すること。


## 2026-11-20 GitHub Pages / offline-voice branch
- Working source: B_Navi_PWA_Search_Handoff_2026-11-20.zip static `web` app; Android `B_Navi_Android vf1.zip` remains feature/routing reference; older GitHub `Penta2026/BikeNavigator` comparison source.
- GitHub project `Penta2026/b_navi` previously confirmed empty. Static assets can be published there; **GitHub Pages cannot execute BRouter Java**.
- New `offline-route-store.js` stores most recent GPX geometry, optional GPX turn cues, Shimanami island leg metadata in browser IndexedDB. Existing route import, long-press, route modes, and bridge geometry retained. Downloaded route does not require network for turn-by-turn cues, but map tiles do.
- New `route-api-base` setting accepts separately hosted HTTPS Java API. No backend URL configured or falsely presented as available. Local Java mode remains possible.
- iPhone/Android voice during screen-off, offline availability of voice files, and real GPS crossings remain unverified.
- Never publish the RD5 dataset (79MB), server JAR, or private Android source in GitHub Pages web root. Server deployment needs separate secure hosting and legal review.


## GitHub Pages status / first activation blocker (2026-11-20)
- Code uploaded to `Penta2026/b_navi` main (23 web/docs files), confirmed via GitHub tree.
- Two attempted Actions deployments failed at `actions/configure-pages`: initial Pages site not found; second `enablement: true` failed `Resource not accessible by integration` when creating the Pages site. This is a verified GitHub permission limit, not a frontend JS build error.
- Simplified deployment to **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Until user performs this GitHub admin action and site responds with HTTP 200, public URL is NOT verified.
- Java BRouter API is not deployed, so new online route computation is NOT operational. GPX import and local/offline navigation code are in repo but still require iOS/Android field tests.


## 2026-11-20 Cloudflare旧環境の再利用調査
- 旧GitHub `Penta2026/BikeNavigator/infra/cloudflare-map-relay` を直接確認。`bikenavigator-map-relay` は `/maps/*.zip` と `/health` の地図中継専用。ルートAPIは実装されていない。
- 旧 `brouter-server` にはJava BRouterのDocker案あり。新 `b_navi` の `api/status` / `api/route` / `api/shimanami/...` とはインターフェースが違うためそのまま差し替えできない。
- Cloudflareアカウントは未接続で、実際のデプロイ・有料プラン・URLは未確認。Cloudflare Containers（Workers Paid）を使った別ルートサービスが候補。
- ユーザーがGitHub Pages設定を保存したとの報告あり。公開HTTP実応答はまだ確認できていない。
- 詳細設計: `docs/CLOUDFLARE_REUSE_PLAN.md`。この更新は**調査・資料の追加のみ**。ルートAPIのクラウド公開、音声の実走検証を完了扱いしない。


## 2026-11-20 実際の旧PWA方式を再確認
- Source proof: old `Penta2026/BikeNavigator/motorcycle-map-v734.html` has hidden endpoint `https://brouter.de/brouter`. `assets/motorcycle-map-v660.mjs` posts custom BRF to `/profile` and GETs `?lonlats=...&profile=custom_...&format=geojson&timode=3`. **Cloudflare map relay is separate and does not route.**
- Public-brouter compatibility now in `public-brouter-client.js` for ordinary mainland routing in GitHub Pages when no private route API is configured. Vehicle/mode mapping taken from B_Navi `BikeNavServer.java`; used the latest 10 BRFs from previous PWA (including tuned `bn_50_explore`).
- BRouter public API's real response/CORS/limits/unrestricted access from the deployed iPhone/Android have NOT BEEN verified. No false 'working' claim. Public server cannot execute B_Navi `/api/shimanami/island-legs`, `/api/shimanami/preview` or Kanmon specific push-walk. Dedicated service is still future work.
- GPX from public GeoJSON voicehints may drive offline audio, but **no hints returned means no fabricated turns**. Browser device TTS voices/screen-off cannot be guaranteed.
- Do not replace B_Navi specialized routing with old generic BRouter for Shimanami or Kanmon; keep the same Java backend as an optional configured HTTPS endpoint.


## 2026-11-20 — smartphone smooth map / calmer tiles (current)
- Reported: public routing appears to calculate, but operation feels slow; standard OSM raster is visually busy. No end-user timing log supplied, so do not claim server speed or network throughput is fixed.
- `map-core.js`: cached road SVG line geometry across panning, map bearing changes and GPS updates. Rebuild only when path list, zoom, or viewport size changes. No GPS/GPX points are removed or reordered; bridge/walk lines are still distinct. Correct rotated viewport tile bounds reduce excess OSM tiles. Eager decoding for visible subset. No background map prefetch or bulk download.
- `app.js`, `index.html`, `style.css`: default **淡色（simple）** with reduced base-map opacity against a pale background. Button `標準へ` restores the prior full-color map; `淡色へ` switches back. The chosen display mode persists in localStorage. This **does not remove printed POI labels or provide true offline basemap**. No new tile provider introduced.
- `public-brouter-client.js` + `app.js`: visible API phases (BRF transmission, route calculation, retry) and reported elapsed duration. Cloud/server response time still depends on `brouter.de` and is not under this client's control. Never claim public API guaranteed availability.
- `tests/test_fast_map_render.cjs` + added public BRouter progress test: 17/17 Node tests PASS incl 6 bridge round trips, GPS handoff, ordering, raster coverage, cached GPX path redraw, and public API request mocks. Browser screenshot / real mobile frame rate / public BRouter real response NOT VERIFIED.
- Deployed frontend source to `Penta2026/b_navi`, GitHub Pages build must be checked separately after commit; last deployed status is not inferred from source upload.
- **Version source**: `B_Navi_PWA_Smooth_Map_2026-11-20.zip`. This supersedes the earlier experimental public BRouter ZIP for UI and rendering. Android `vf1` remains feature source; old `BikeNavigator` remains external BRouter implementation reference.


## 2026-11-21 最新正本 — Android vf1 方位表示・赤▲・案内開始
- **正本比較**: ユーザー添付 `B_Navi_Android vf1.zip` の `MainActivity.java` を再読込。Androidは `guidanceRotationButton.setText(headUp?"北↑":"進行方向↑")`、GPS bearing/speedを使用し停止中は直前の安定した方位を保持。フリー走行で2m/s、8度、1秒、通常案内で約9度/1.5秒の閾値。PWAでは共通値2m/s、精度35m以内、8度/1.2秒で初期実装。実機感度は未確定。
- `navigation-heading.js`：ブラウザ/Node両用のGPS方位フィルタ。`map-core.js`：現在地を赤い三角、方位不明時は `?` を表示。地図北上/進行方向上の回転と2本指手動回転を分離。
- `app.js`：方位ボタン（現在のモードでなく次のアクションを表す）、GPS位置追従、音声テスト・案内開始/終了・GPX案内指示のみの右左折通知。**音声を自動開始せず明示タップ時のみ開始**。GPS停止後の位置は消し、古い位置を現在地と誤認させない。
- `ride-radar.js`：フリー走行も同じGPS矢印/方位を使用。レーダーの距離ロジックは維持。道路制限速度の表示追加なし。
- `mobile-ui.js`：ルート表示後に下部編集シートを畳み、地図の案内ボタンを押せるように。`style.css`：スマホでスクロールにより操作ボタンが画面外へ出ないようclip。
- `sw.js`：アプリシェルキャッシュ更新。`navigation-heading.js` をオフラインキャッシュ対象へ追加。保存済み地図・経路・お気に入りDBの削除なし。
- **検証**: `node --check` 対象JSすべてPASS; `node --test tests/*.cjs` 21 PASS; モバイル画面（Chromium＋モックGPS/モックTTS）の操作フローPASS。実端末GPS/音声/画面OFF中は未確認。外部BRouterへの実オンライン計算は今回未試行（コードとBRFは変更なし）。
- **次版優先**: iPhone Safari/Android ChromeでGPS精度・停止時の方位保持、音声合成と画面ON中の案内、GPX指示正確さ、通信オフで保存ルート再案内。速度閾値は必要なら実機で調整。


## 2026-11-21 最新：音声案内中のシンプル全画面UI（navigation-focus-v1）
- 基準：前版 `B_Navi_PWA_Heading_RedArrow_Voice_2026-11-21.zip` / GitHub main `5ead969bbd29d2ac334f2f5a3e007f25dbe74cdd`。現行Android `B_Navi_Android vf1.zip` を音声・走行機能の正本とする。
- ユーザー要望：「音声案内開始後は画面をシンプルに」「地図は淡色のみ」「◎ / 十字付き◎ / 進行方向⇔北はそのまま」。
- `index.html`：淡色/標準切替ボタンを削除。小型案内HUD（状態・残り距離・次の右左折）を地図に追加。既存 `map-location`・`center-hiroshima`・`orientation-toggle` はID/動作とも変更なし。
- `app.js`：以前のlocalStorageの地図表示設定が `standard` でも淡色固定。音声案内開始時は通常パネルを閉じて `navigation-active` に移行。終了時は通常の画面へ戻る。状態HUDは既存のGPX案内情報を文字表示するだけで、未登録の交差点を捏造しない。
- `style.css`：案内中のみヘッダー/下部5タブ/ルート編集/説明文を非表示、地図を全画面化。GPSの◎、十字ボタン、進行方向/北、案内終了のみ常設。検索・お気に入り・経由地編集は案内終了後に通常メニューから再び使用可能。
- `sw.js`：アプリシェルのキャッシュ世代を更新。ブラウザの保存済みGPX・お気に入り・端末地図データは削除しない。
- 経路探索、専用BRF、しまなみ・関門、既存音声指示とGPS位置追従の数値処理は変更なし。
- 静的Nodeテスト24/24成功、Chromiumの390×844模擬スマホで案内開始/全画面/3ボタン残存/案内終了で画面復帰成功。実機GPS、スピーカー、屋外走行、iPhone Safariの背面継続は未確認。
- 注意：淡色表示はOSMラスタータイルの不透明度低下。地図タイルを独自軽量ベクタースタイルに変えたわけではない。

## 2026-11-21 フォローアップ（今回の追加）
### 実施内容
1. ナビ開始時の画面をオフラインAndroid版に近づけるため、全画面地図+下部大文字案内カードへ変更。
2. 画面上部の `B_Navi` ヘッダーは `navigation-active` 時に非表示。
3. 地点登録メニューは `safeShowModal()` を介して開くようにし、showModal失敗時も `open` 属性で表示させるフォールバックを追加。
4. ルートシートの見え方を調整し、閉じた状態でも「━ ルート」ハンドルが見えるようにした。

### 主な対象ファイル
- `app.js` : ナビHUD文言生成、クイックバー表示条件
- `mobile-ui.js` : 地点登録メニュー表示の堅牢化
- `style.css` : 全画面ナビUI、下部案内カード、ルートシートハンドル
- `index.html` : ルートシートハンドル文言

### 未確認
- 実機で「音声案内開始」押下後の縦画面レイアウト最終確認
- 長押し地点登録メニューの再発確認

## 2026-11-21 latest — S/G/waypoint registration is long-press only
- User field report: ordinary map taps moved S and G unexpectedly; must require deliberate long press. Do **not** use one-tap map selection for any S/G/via mutation.
- `app.js`: MapCore `onClick` intentionally `null` (not a no-op handler which might inadvertently mutate state). Old `handleMapClick` direct-write path removed. Map hint and waypoint instructions now say long press. Search/favorite and explicitly expanded coordinate fields remain supported.
- `map-core.js`: retain touch pan/pinch/rotation, long-press 550ms. IMPORTANT: on a touchscreen, opening a `<dialog>` before finger lift can let the release click fall on a dialog action under that finger and *silently overwrite S*. Now confirm the long press at 550ms but open the menu just after `pointerup` (30ms delay), never while finger is still touching. Suppress touch-native contextmenu while pressed; desktop right-click remains supported. Movement over 12px after hold cancels the pending menu. Explicit `pointercancel` does not open a menu.
- `mobile-ui.js`: previously added safe modal opening preserved, actual S/G/via values are updated only from `[data-apply]` controls in the dialog.
- `index.html`: map instructions reflect long-press, not tap. `sw.js`: unique new app shell cache version; no deletion of stored coordinates, GPX, favorites, or IndexedDB routes.
- Previous unpushed follow-up is bundled in THIS release as well: active guidance hides header/normal tabs, large bottom next-turn HUD, stronger normal-mode route sheet handle, modal robustness. Do not lose these edits when rebasing or packaging.
- Verification: `node --test tests/*.cjs` 31/31 PASS; Chromium 390x844 `tests/browser_long_press.py` PASS (short tap no mutation, 690ms hold then lift opens menu, menu action only updates G); `browser_smoke.py` and `browser_voice_settings.py` PASS with mocked GPS/speech.
- Not verified: actual Android Chrome/iOS Safari long press, real GPS/voice, live routing API availability. Do not describe as road-tested.

## 2026-11-21: 住所検索ルート追加 (GitHub Pages)
**目的**: POI未登録でも住所から出発地/目的地/経由地を登録できる入り口を用意する。施設検索を置き換えるのではなく併設。
**変更**: `address-search.js` を新規。`mobile-ui.js` は住所らしいクエリを自動判定し、外部住所検索→候補照合→同一地点登録メニューの経路を実装。「住所で探す」明示ボタン、「目的地にする」直接登録ボタン。`index.html`, `style.css`, `sw.js` を更新。
**位置精度**: 住所APIで得た位置は町丁目中心などの代表点の場合がある。返された結果の住所名は地図上で確認する。住所末尾の番地まで特定できたとは表示しない。入力住所と異なる地域は候補除外する。
**外部検索**: `https://msearch.gsi.go.jp/address-search/AddressSearch?q=...` を第一候補、町名まで再検索、Nominatim を二次候補。サービス側のCORS/安定性/利用条件は実機と公開サイトから未確認。**住所検索が実機で成功したとは記録しない。**
**既存保持**: S/Gを単純タップでは動かさない規則、長押し地点登録、地図移動、GPS、音声、BRF、しまなみ/関門の特別計算、GPX、localStorage/IndexedDB保存形式は不変。
**検証**: `node --test tests/*.cjs` 32件 PASS。Chromium の in-memory DOM + 模擬住所API でスマホ幅の検索結果、地域除外、G登録、共通メニュー開閉 PASS。外部地理院住所検索の実HTTPレスポンスは本環境から直接確認できず。
**GitHub**: `Penta2026/b_navi` main に expected SHA による 1コミットで反映し、Pages build の結果を別途確認する。
