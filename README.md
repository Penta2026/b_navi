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
