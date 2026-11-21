## 2026-11-21 Voice Settings v1 — 音声速度と設定UI
- 読み上げ既定値を0.85から **1.15倍**へ変更。
- `voice-settings.js`（端末内設定と声の設定値の検証）を追加。
- ⚙ 設定ダイアログに **音声ON/OFF・速度0.80〜1.60・音量0〜100%・高さ0.75〜1.25・声（端末にある日本語音声から選択）・試聴・初期化**。
- 変更は `bnavi.voice.v1` に保存。データ転送は行わず、GPS/地点/BRF/経路計算には触れない。
- 音声案内をOFFにしてもテスト音声は試聴可能。案内開始ボタンは明示設定OFFを上書きしない。
- UIから機種別の説明文を削除し、使い方とGPX案内を簡略化。走行中の全画面UIは維持。
- 更新したサービスワーカーに `voice-settings.js` をキャッシュ対象として追加。
- 回帰28テストPASS、390px Chromium模擬音声/UI PASS。端末実音は未検証。

# B_Navi — 実装履歴（このZIPでわかる範囲）

## 2026-11-20 / Search Parity Foundation v1（今回）
- 起点：`B_Navi_PWA_iPhone_Clipboard_GPX_2026-11-20.zip`。
- 場所検索を施設名＋指定地域の一致優先に変更。無関係な「その他の候補」を大量表示しない。Photonを手動検索時の二次補助として追加。
- キャッシュ更新、検索5件の回帰テスト、Android/旧GitHub/PWA差分の引継ぎを明文化。
- 未解決：一般企業検索の網羅性、iPhone/Androidの実機、Android Geocoderの同等性、正式POI API契約。

## 2026-11-20 / iPhone GPXクリップボード
- `GPXファイル読込` + XMLテキスト貼り付け入力と対応ブラウザの共有受信導線。
- iOS Safari PWAへ他アプリから直接GPXを渡す完全な共有先対応は未実装。

## 2026-11-20 / スマホUI改修群
- 下部メニュー、地図を長押しして出発地/目的地/経由地/お気に入りを設定、登録後は地図維持。
- 2本指の拡大縮小・回転感度調整、現在地の状態表示、座標を折りたたみ、GPX保存/読込、地図検索。
- 場所検索では候補の絞り込みを繰り返し調整したが、期待する施設が見つからず他県企業が出る不具合をユーザーが指摘。今回改修の理由。

## 2026-11-20 / Android vf1 から機能移植
- フリー走行、レーダー（距離レンジ・接近チャイム）をブラウザへ初期移植。道路制限速度表示は省略。
- 画面OFF中GPS、Android同等の地図回頭、通知/音声/位置精度の完全一致は未確認または未完成。

## 2026-11-20 / 経路・橋・探索
- しまなみ6橋×往復の表示接続処理、島間GPS音声再開、複数経由地の分割経路計算を追加。
- Android専用の原付共用道データとサイクリング参考線を区別。走行GPXへ未検証の橋線形を偽装連結しない。
- 50cc探索の過剰なジグザグを緩和。AndroidのBRFが正本であるが、探索チューニングにPWA独自差分がある。

## 2026-11-20 / 初期統合PWA
- Java BRouter、RD5、JavaローカルHTTP、車種別プロファイル、関門/しまなみ処理とPC地図UIを統合。
- PCローカル起動、スマホLAN試験、PWAキャッシュを整備。

## 継続ルール

変更ごとに「基準ZIP」「変更したコード」「結果」「ユーザー確認」「未確認」「次課題」を追記し、現在の完成度と昔の期待値を混同しない。

## 2026-11-20 — GitHub Pages PWA frontend + offline route restore
- Added remote BRouter API URL setting; will not pretend GitHub hosts routing Java.
- Added IndexedDB persistent last route/GPX geometry/turn metadata and offline re-open.
- Added Pages Actions workflow, `.nojekyll`, docs on known limitations.


## 2026-11-20 Cloudflare再利用の調査（ドキュメント更新）
- 旧GitHub Worker `bikenavigator-map-relay` が地図配信専用であることをソースで確認。
- 旧 `brouter-server` Docker構成を確認。新PWAの経路API契約に合わせた別コンテナ計画を文書化。
- `docs/CLOUDFLARE_REUSE_PLAN.md` を追加。実サーバーデプロイ・接続テストは未実施。


## 2026-11-20 — public BRouter legacy method trial
- Found actual previous PWA implementation: GitHub Pages -> public BRouter `https://brouter.de/brouter` `/profile` POST -> GeoJSON `timode=3` -> local route save, with Cloudflare dedicated to map data only.
- Added `public-brouter-client.js`, 10 latest B_Navi BRF profile texts, in-browser GeoJSON voicehint -> GPX conversion, and public service trial default for ordinary routing when on Pages and no private endpoint configured.
- Kept specialized Java endpoint support and blocked obvious Shimanami/Kanmon moped routes from being silently replaced by a generic public route.
- Note: no public live API end-to-end route or iPhone/Android GPS audio test verified.

- GitHub Pages Actions for commit `39e89c6` were confirmed success (public device HTTP and route API not tested). Cloudflare map relay is separate from BRouter public route service.


### 2026-11-20: smartphone map responsiveness and calm map presentation
- Route SVG cached during dragging, GPS tracking and rotation; reduced viewport raster request extent.
- Calm OSM-background display enabled by default (opacity only, to avoid heavy filters); single-tap original map toggle persists in localStorage.
- Public BRouter progress now distinguishes profile upload, route computation and automatic retry, and reports elapsed duration.
- No changes to BRF contents, Shimanami/Kanmon navigation, GPX turn metadata, search or local offline route storage.
- 17/17 offline Node tests pass; no real smartphone performance or production API timing proof.


### 2026-11-21 — Navigation heading and audio trial
- Compared Android vf1 orientation and GPS bearing handling. Replaced blue GPS dot with red GPS direction triangle (question mark when heading unknown). Added a single north-up/course-up action toggle.
- Added real "start voice guidance / stop voice guidance" and no-route speech test. Avoid automatic speech when navigation is off; preserve existing original GPX cue metadata. No fake turns.
- Map-floating controls remain usable after route calculation: route panel closes, avoids clipped controls on mobile. Free ride uses the same course-up handling.
- Did not change routes/BRF/map tile source/search. 21 Node tests PASS; Chromium phone-size mock GPS/TTS path PASS. Field audio unverified.


## 2026-11-21 navigation-focus-v1
- 音声案内を開始したら自動で地図全画面へ切替。終了で通常UI復帰。
- 淡色/標準の切替UIを撤去し、淡色固定（以前のユーザー設定は参照せず、保存データは消さない）。
- GPS現在地◎、地図位置十字、進行方向⇔北切替はそのまま維持。
- 案内中の余分なタブ/ヘッダー/ルート編集/音声テストを非表示にして案内終了ボタンは常時表示。
- 小型案内HUDは既存のGPX指示または残距離を表示。音声や経路の計算そのものは未変更。
- キャッシュ更新、Node 24テスト、Chromiumモバイル疑似GPS/疑似音声の表示試験を実施。

## 2026-11-21 フォローアップ（オフラインナビUI寄せ）
- 音声案内開始後はヘッダー・下部メニュー・ルートシートを隠し、地図を全画面化。
- 右上の操作は「◎ 現在地」「進行方向/北」「⌖ 中心」に絞り、オフラインナビ寄りの見た目に整理。
- 進行案内HUDを画面下の大きなカードへ変更し、次の曲がり角を大きな文字で表示。
- 通常時はルートシートのハンドル表示を強め、「メニューが消えた」印象を抑制。
- 長押し/検索/お気に入り共通の地点登録メニューを安全に再表示できるよう、dialog表示処理を堅牢化。

## 2026-11-21 — Tap-safe S/G/via editing (longpress-only-v1)
- Removed ordinary map-tap registration to prevent accidental relocation of S/G or via points while examining the map.
- Kept explicit map long-press (550ms) → action menu → set start/goal/via/favorite; search/favorites/manual coordinates still work.
- Fixed ghost click: on touch hardware, releasing a long press could hit the newly opened menu button by accident. Menu now opens only after finger release, with native touch context menu handled safely.
- Preserved previous mobile navigation HUD/route sheet improvements and updated help text, service worker cache version, automated/browser regression tests, and handoff docs.
