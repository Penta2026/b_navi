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

# 最新：名前付きカスタムルート設定保存（2026-11-21）

このZIPは `B_Navi_PWA_Custom_Route_Tuning_2026-11-21.zip` を土台に追加開発したもの。GitHub未公開。

- 🎛 調整パネルの「☆ 自分のルート設定を保存・呼び出し」から、現在の車種・距離/探索・道狭/道広・直線/景観・126cc以上の高速/有料チェックを**名前付きプリセット**として保存、呼び出し、削除可能。計50件まで。車種別の一覧を表示。
- 同じ車種の同名プリセットは**確認後にのみ上書き**。読み込みでは現在の編集値だけを変更し、ルート検索までは既存の経路を無断で再計算しない。削除でも編集中の値は消さない。
- 端末内 localStorage に `bnavi.routePresetLibrary.v1` で保存。従来の `bnavi.routeTuningByVehicle.v1`（編集中の値）とは別。データ消去や別端末では自動移行しない。
- 全車種の保存済みプリセットをJSONバックアップに書き出し／読み込み可能。同名は既存を保護してスキップ。バックアップには位置・ルート線・GPX・GPS軌跡を含まない。
- **保存するのは経路計算の条件**。実際に通った道のGPX保存・共有は既存機能、計算済み経路は既存のGPX出力／「この経路を端末に保存」を使う。プリセット単体では既存のルート線や走行記録は保存しない。
- GPS、音声、レーダー、実走GPX共有、リルート、しまなみ橋形状、既存BRFは変更しない。設定パネル展開中は画面下の実走GPX操作パネルを一時非表示にしてタップを妨げない。
- 確認：**Node 70/70 PASS**、スマホ模擬で名前保存→呼び出し→経路計算・上書き/削除・JSON入出力、既存ナビ/音声/レーダー/GPX取り込み、画面操作を確認。**公開BRouter実通信・Android/iPhone実機・GitHub Pages公開は未検証／未実施**。

---

# 最新: B_Navi 排気量別・3軸カスタムルート調整（2026-11-21）

この版は `B_Navi_PWA_Actual_Track_GPX_SHARE_2026-11-21.zip` を土台にした統合更新。**GitHubへ未公開**（ZIP引渡し）。

- 車種: 50cc・新基準原付 / 51〜125cc / 126cc以上。各車種の **`bn_*_general.brf`** を初期値とする。
- `距離↔探索` / `道狭↔道広` / `直線↔景観` の3スライダー（-100〜+100、5刻み）。中央はBRFの内容が元の一般ルートとバイト単位で一致する。
- 126cc以上でのみ高速道路・自動車専用道路、および有料道路を独立して許容可能。**初期状態はどちらもOFF**。料金のある高速は通常両方ONが必要。
- スライダーの値をもとに、公開BRouterへ送るカスタム `.brf` をその場で組み立てる。設定ごとのアップロードIDを分離して使う。専用Java APIへはパラメータを渡せないため、詳細調整時はエラー表示して偽の計算成功を避ける。
- 調整値は車種ごとにlocalStorage保存。**計算済みルートのリルートは、そのルートを計算した時点の設定**で実行。しまなみ島内分割計算の道路区間にも適用（橋参考線や通行可否は変更しない）。
- 道幅・交通の流れ・景観は観測値ではない。道路種別、OSM `lanes`、BRouter `estimated_forest_class`・`estimated_river_class` を目安にしたソフトコスト評価。道路標識と法令は最優先。
- 路線評価をどれだけ動かしても、`access=no/private`、一方通行や歩道・路地等の基本ゲートを緩めない。高速・有料の許容だけ126cc以上の明示チェックで変更。
- 旧ビギナー/探索/ファストトラベルのBRFファイルは削除していないが、一般基準の詳細調整を主画面にしたため旧プルダウンは非表示。元のBRFはそのまま残る。
- 実走GPX記録・保存ボタン・LINE等への共有ボタンは維持。走行中は保存パネルを隠し、案内終了ボタンを操作できるようにした。終了後に保存・共有が再表示される。
- 検証：**Node 64/64 PASS**、Chromium模擬で3軸UI/各車種保存/計算・リルート引継ぎ、既存音声案内、GPX地点順、レーダー切替、画面幅320-430px等を確認。実BRouter通信や実走での経路差、iPhone/Android端末、しまなみWeb全シナリオは未検証。

---

## 2026-11-21 GPXの経由地（中継地点）取り込み
- `GPX読み込み`から、地点列を含むGPXを選択するとS→中継→Gの順で登録し、オンライン道路経路を計算します。
- `BNAV-ITINERARY-1`形式（道の途中。など）は道路軌跡を含まないため、B_Naviでの再計算が必要です。経由地点は最大50件。
- インポート結果に中継地の順番と`この順番でルートを再計算`が表示されます。通信や経路計算に失敗しても地点情報は消しません。
- 通常の軌跡GPXは従来どおり表示。保存済みルートやお気に入りは消去しません。
- 中継地点を通らない計算結果（地点から300mを超過）は拒否します。出発前に地図で確認してください。

レーダーを開くと音声案内は一時ミュートされ、地図へ戻すと復帰します。GPSと案内ルートは継続します。

## 2026-11-21 GPS通知の位置
- 操作ボタンと重なっていたGPS通知をボタン直下へ移動。通常/案内/フリー走行で共通。再読み込みして確認できます。

最新: 6つの地図操作を一列に配置し、停止中のGPS揺れによるリルートを抑制。

## 2026-11-21 横並びボタン反映版
- 上段: ＋ / － / ◎ / ⌖ / 📡（レーダーは案内中だけ表示）。
- 2段目右端: 進行方向 / 北を上。
- 旧CSSのズーム非表示競合を除去し、キャッシュ更新。
- 検証: Node 48件合格、スマホ模擬GPS経由地/音声/レーダー統合試験合格、360/390/430pxレイアウト検査合格。
- 実機での画面確認と現地GPS/音声は未確認。

# B_Navi PWA — しまなみWeb組立・GPS島間切替強化版（2026-11-21）

**正本リポジトリ**：`Penta2026/b_navi` ／公開：`https://penta2026.github.io/b_navi/`

## できること（今版）
- **50cc・125cc以下のしまなみ7エリア内の島間ルート**は、GitHub Pagesから公開BRouterへ島内道路を区間ごとに問い合わせて組み立てる。橋6本はAndroid実ソースのアプローチ形状と保管済み参考GPXを照合して参考線として表示。中継用Javaサーバーはこの計算では不要。
- **経由地の指定順序**、片道・逆方向・引き返す経路まで実装。島内の道路形状が橋入口・出口に25m以内で接続しなければ、架空の直線でつながず明示的に失敗する。
- **音声案内は島内道路のBRouter右左折指示のみ**。橋の入口で島内音声を一時停止し、GPSで次の島内道路開始点から90m以内に入ると自動再開。次の橋入口または目的地まで案内する。
- 島内のルート逸脱は**オンラインの場合、現在の島内道路だけ**再探索し、次の橋の参考線・その先の島内経路は変更しない。橋上では再探索しない。
- `しまなみ机上検証`（経路結果の詳細を展開）で道路・橋・経由地の接続順を確認。保存データには島内のGPS音声指示・橋切替・元の地点順を保持する。

## 重要な制約
- **橋の線は通行可能な経路の保証ではない**。サイクリング参考GPXを原付の走行GPXに変換しない。現地の原付専用道標識・規制を必ず優先。Androidで保管した橋アプローチ形状を表示にのみ使用。
- **実際の公開BRouterへの通信成功は未確認**（検証では模擬APIを使用）。対象の端末・通信・地点によって計算を拒否される場合があり、無理に直線で補わずエラー表示する。
- 対象は既存仕様どおり**しまなみ7エリア内で始まり終わるルート**。広島市内などエリア外からの一括縦断、関門の原付専用処理は未対応のまま。
- **オフラインでは事前保存した島内ルートの追従・音声再開のみ**。新規計算とリルートはオンラインが必要。iPhone/Android実走や画面OFF中の継続、IndexedDBへの本番保存・再読込は未確認。

## 確認済み
- Node **45テストPASS**。6橋すべての往復、経由地、引き返し、橋の接続チェック、BRF・長押し・既存GPS/音声の回帰。
- ブラウザ模擬 **8種類PASS**（既存5＋しまなみ3）。6橋のGPS一時停止→再開、経由地到着・続行・島内リルート・到着終了、GPX/音声ヒントの保存モデル往復。
- ローカルHTTPでのIndexedDB実保存テストは、検証実行環境のHTTPブロックで試験不能。スクリプトは `tests/browser_shimanami_offline_restore.py` に残した。

## 引継ぎ
必ず `HANDOFF_CURRENT.md`、`NEXT_STEPS.md`、`CHANGELOG_B_Navi.md`、`RELEASE_VERIFICATION.txt`、`RELEASE_INFO.json` をセットで更新。前作の歴史は下部に保持し、この節を現在の実装状態として優先する。

---

## 以前の開発履歴（現時点と異なる記載あり）

# B_Navi PWA — 2026-11-21 走行機能強化版

オンライン経路計算／保存済みGPXの音声案内／経由地とレーダー。GitHub Pages: https://penta2026.github.io/b_navi/

## 更新ポイント
- 20m直前の右左折音声、経由地到着時の次地点確認、最終到着での自動終了。
- Android準拠のGPS逸脱判定とオンライン自動リルート（通常道路・GPX用）。
- フリー走行の全画面化、レーダーと地図のナビ中切替、地図左上 + / −。
- 既存の車種別BRF、しまなみ橋参考線、関門処理は変更なし。

## 検証と制約
37件のNodeテストと5種類のブラウザ模擬テスト通過。実走・iPhone Safari実機・公開BRouterのリアル応答は未検証。オフラインは保存済みの音声案内が対象で**自動リルートには通信が必要**。公開BRouterは特殊な原付橋ルートを代替しない。

引継ぎ: `HANDOFF_CURRENT.md`、`NEXT_STEPS.md`、`CHANGELOG_B_Navi.md`、`RELEASE_VERIFICATION.txt` を参照。

---

# B_Navi：音声設定つきPWA（2026-11-21）
スマホ向けのバイクナビ。出発地と目的地を決めて、ルート検索→案内開始。

**⚙ 設定** で音声のON/OFF・速度・音量・声の高さ・日本語音声を変更できる。既定の読み上げは **1.15倍**。設定は端末に保存される。音声の試聴と初期化も可能。

案内中は淡色地図の全画面表示を維持。案内終了すると通常画面に戻る。

実機音声/GPSは未確認。公開BRouterは第三者サービスで応答と継続性を保証しない。しまなみ・関門の専用計算には別途APIが必要。

→ [HANDOFF_CURRENT.md](HANDOFF_CURRENT.md)、[NEXT_STEPS.md](NEXT_STEPS.md) を参照。

# B_Navi PWA — Online route calculation / offline voice navigation

**Status (2026-11-20): GitHub Pages build & deployment workflow SUCCESS for commit `39e89c6`. Public URL HTTP response and smartphone E2E not directly verified. Public BRouter method is an experimental online routing fallback.**

- Open `https://penta2026.github.io/b_navi/`. GitHub Pages Actions reported a successful build/deployment for commit `39e89c6`; an external HTTP 200 fetch was unavailable in this environment.
- GitHub Pages hosts a static, HTTPS mobile PWA, **not** the Java BRouter route engine.
- **Ordinary online routes:** the same public `brouter.de` API path as the previous PWA is configured by default on Pages when no dedicated API is set. The public server is third-party and not verified to serve our custom BRFs/CORS today. **Shimanami/Kanmon specialized routes:** still require a separately deployed HTTPS B_Navi Java API, with `/api/status`, `/api/route`, `/api/shimanami/island-legs`, `/api/shimanami/preview`. No such dedicated API is deployed in this release.
- Online map tiles and place search require internet. Cached application assets + IndexedDB-stored GPX/route geometry + client-side GPS and speech synthesis can operate without network while the browser tab remains active and the system voice is available.
- iOS Safari background/screen-off GPS/TTS are *not guaranteed*. Route lines are still visible offline, but the OSM basemap tiles are not offline-cached.
- GPX with `<rtept>` turn offsets supports local right/left cues. GPX without turn cues only shows the track; never fabricate instructions.
- Cycling bridge references and Kanmon push-walk lines are not exported as riding tracks.

See [HANDOFF_CURRENT.md](HANDOFF_CURRENT.md) and [NEXT_STEPS.md](NEXT_STEPS.md).

## Deployment

Pages has been enabled by the user. GitHub Actions **pages build and deployment** for `39e89c6` completed successfully. Do not publish Java RD5 or Android source as public website files.


## Cloudflare backend reuse investigation
Old `BikeNavigator` Cloudflare Worker `bikenavigator-map-relay` is a map-data streaming relay, **not** the Java BRouter engine. See [Cloudflare reuse plan](docs/CLOUDFLARE_REUSE_PLAN.md). No hosted routing endpoint is currently verified; the existing app UI's HTTPS API setting is not yet configured.


## 2026-11-20 — Previous-PWA-compatible public BRouter trial
- `Penta2026/BikeNavigator/motorcycle-map-v734.html` set its endpoint to `https://brouter.de/brouter`; `assets/motorcycle-map-v660.mjs` POSTed the BRF to `/profile`, then GET `/brouter` with `lonlats`, `profile=custom_...`, `format=geojson`, `timode=3`. Its Cloudflare Worker was **map data relay only**.
- The **current GitHub Pages `b_navi` frontend now supports that same public routing method for ordinary routes if no private HTTPS API is configured**. Ten profile files are sourced from the immediately preceding integrated PWA (`engine/data/profiles2`), including the user-adjusted 50cc explore profile. No local Java engine/RD5 is installed on Pages.
- BRouter is a public third-party server: availability, quotas and long-term permission for third-party apps are not verified. This is a pilot, not a guaranteed production backend.
- For Shimanami and Kanmon, **public routing is NOT equivalent to the B_Navi specialized island/human-push behavior**. The dedicated Java API is still required. No bridge reference lines are silently added to a GPX.
- When server returns `voicehints` with `timode=3`, the PWA converts supported BRouter hints to GPX `<rtept><desc>...<offset>` metadata and saves the GPX locally. Unknown maneuvers are omitted; iPhone/Android actual offline GPS/audio and screen-off use remain unverified.


## Latest: smoother map and simple background (2026-11-20)
- Default map view is **淡色** (muted OSM raster). Tap **標準へ** on the map to see the original vivid background. The choice is remembered.
- GPX geometry is no longer rebuilt every time the map pans, rotates, or a new GPS location arrives. Visible OSM tile requests better match the viewport; no bulk caching has been added.
- If route calculation feels slow, the display now reports whether it is uploading a profile or waiting for public BRouter, and reports the network/compute elapsed time after success. This is diagnostic; third-party server latency remains beyond our control.
- The original OSM text is still embedded in raster tiles. For an actually low-label basemap a separate licensing/provider decision is needed.


## 2026-11-21 — Android vf1 course-up, red GPS ▲ and voice trial
- **Current position** is a red ▲ on the map. On GPS devices reporting reliable speed/course, ▲ points in the actual direction of travel. Unknown heading is shown with a **?**, rather than pretending that north is the motorcycle direction.
- The map's one orientation button is **進行方向** in north-up mode (tap to follow course), **北を上** in course-up mode (tap to return to north). A deliberate two-finger manual rotation temporarily pauses course-up until the user selects it again. GPS course requires speed at least 2 m/s and accuracy at most 35 m. It updates for meaningful changes (at least 8° and about 1.2 s); stationary holds the last reliable course, based on Android `vf1`.
- On a calculated normal route, or an imported GPX with a road track, the map shows **▶ 音声案内開始 / ■ 案内終了 / 🔈 テスト**. The route sheet also has the same control. After calculating a route the phone UI returns to the map instead of keeping the route sheet over the start button.
- **音声テスト** can be used without a route and triggers Japanese speech from a direct button tap. **音声案内開始** turns on speech and requests GPS, using only GPX voice cues (including native BRouter `timode=3` voicehints). GPX without turn metadata does *not* invent turn-by-turn instructions. Existing simulation button provides a browser-only route playback test.
- GPS map tracking + speech happen client side, without contacting BRouter for each turn. Saving and reopening a route without connectivity is supported in code; map background tiles, realtime rerouting and offscreen/background iOS audio are not guaranteed offline.
- **Tests:** `node --test tests/*.cjs` → 21 passing; Chromium mobile-size smoke test (mock GPS and mock TTS) passed navigation start, switch, direction transform, stop, voice test. *This does not prove real iPhone or Android speech sounds or heading sensor accuracy.*
- These changes do not edit BRF profiles, public BRouter parameters, Kanmon/Shimanami route geometry, location search or user favorites.


## 2026-11-21: シンプル音声案内画面
- 走行ルート計算・GPX読み込み → 「音声案内を開始」：淡色固定の全画面地図に移行。
- 地図右側は現在地◎、十字ボタン、進行方向/北の切替を維持。小さな案内情報と「案内終了」のみを見せる。
- 「案内終了」を押すと検索・お気に入り・経由地編集を含む通常メニューが戻る。
- 実機のGPS・日本語音声・端末バックグラウンド継続は未検証。走行時は現地の標識・周囲の安全を優先。


### 2026-11-21 点の登録：長押し方式
- 地図を軽くタップしても、S（出発地）・G（目的地）・経由地は動かない。
- 地図を約0.55秒長押し → 指を離す → 地点操作メニューで「出発地」「目的地」「経由地」等を選択する。
- 地図の移動、ピンチ拡大縮小、2本指回転は引き続き使用可能。検索結果・お気に入りからの明示的な地点登録も従来どおり。
- 長押しメニューは指を離してから開く（メニューの誤タップを防止）。
- ナビ中は淡色の全画面地図と大きな右左折案内カード。音声設定や保存済みルートは維持する。

## 2026-11-21: 住所検索 → 出発地 / 目的地 / 経由地
- 検索欄は施設名に加えて日本語の住所を受け付ける。住所らしい入力は住所検索へ自動切替。「住所で探す」ボタンでも明示切替できる。
- 住所検索は GSI 地名・住所検索エンドポイントを試し、見つからなければ丁目などに縮めて再試行。その後、Nominatim 住所検索へフォールバック。
- 検索結果から「目的地にする」で直接 G に登録、または候補名をタップして共通メニューから S/G/経由地/お気に入りへ登録可能。
- 住所検索サービスから返る座標は町丁目などの**概略位置**の場合がある。建物・番地レベルの一致を保証しない。
- サービスの実応答/CORS/利用制限は未確認。最新ブラウザの模擬結果で UI と登録処理をテスト済み。
- 施設名検索や長押し安全操作、音声ナビ、しまなみ固有処理、BRF は変更していない。
