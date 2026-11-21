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

# 最新の優先課題（2026-11-21 名前付きプリセット版）

1. 実機PWAで各車種の「名前付きルート設定」を2件以上保存→再起動→呼び出し→検索し、意図通りの車種・値・高速/有料条件になることを確認。
2. 保存済み設定のJSON書き出し、別端末での読み込みを確認。localStorageはブラウザ・OS側のデータ消去で失われるので、バックアップ案内を適宜追加。
3. 公開BRouterで同一S/Gについて基準（全部0）、カスタムA/Bを計算して経路形状・送信されたBRFを比較。`estimated_forest_class` 等の効果は実通信未検証。
4. ユーザーが「計算した独自ルートそのものを複数保存」したい場合は、現在の1件保存とは別に経路ライブラリ（名前・地点・GPX・調整値のスナップショット）を設計。今回の**プリセットはパラメータのみ**。
5. 実走GPX保存・LINE共有、GPS音声/リルート、しまなみ島間GPS切替の実機確認。Android/iPhoneの画面OFF時はOSの制限あり。
6. ソース差分と試験結果を承認後、GitHub Pages反映。今回ZIPは未公開。

---

# 最優先（2026-11-21 3軸カスタムルート調整版）

1. 公開BRouterの実通信で「各車種：中央＝一般」と、各スライダー ±100 を同じS/Gで比較し、道路が変わるか／エラーになるか検証。カスタムBRFアップロードとキャッシュ再利用も確認。
2. 直線/景観スライダーの景観推定値が日本のRD5に含まれるか確認し、森林・海岸沿いに期待通り近づくか検証。`estimated_*` が付かない道路は恩恵がない。通行可能性、実際の眺望、路面状態は保証できない。
3. 道狭/道広の強さと距離/探索の重みの相互作用を、幹線と地方道路が混ざる複数地域で比較。50ccの通行規制・二段階右折など標識優先で確認。
4. 126cc以上で高速/有料のON/OFF組合せを検証。高速が有料の場合は両方ONになること。二輪車通行禁止区間の案内を許容しないこと。
5. GPSリルート後も計算時点のスライダー条件を使うか、実機で確認。画面OFF/GPS連続性はPWAとOSの制限がある。
6. しまなみWeb複数島のカスタム設定の実通信、橋入口・出口のGPS切替、参考線と合法性を別途確認。今回のフルブラウザ試験は時間内に完了せず、成功とは報告しない。
7. GitHub公開は、内容・差分確認後に別作業で実施。このZIP作成時点でプッシュしていない。専用Java APIはBRFの動的選択に未対応、公開BRouterでは動作する設計。

---

## 最優先 2026-11-21: 地点順GPXの実機確認
1. B_NaviでGPXを読み込み、S・経由地2件・Gの順序が画面に残るか確認。
2. 自動オンライン道路計算でBRouterが4点を通すか、S→経由1→経由2→Gの線を拡大して確認。失敗時は案内を開始せず計算エラーと接続状態を確認。
3. 経由地点への実走GPS到着判定と「次の目的地を案内しますか？」確認ポップアップを確認。
4. PWA共有受信、貼り付け、手動GPXファイル選択の3経路で同じ地点列になるか実機確認。
5. 密なルート点だけを持つGPX（実軌跡なし）の種別判定を追加検証。公開BRouterのサービス制限・接続安定性を確認。

【次の確認】 実機で地図→レーダーの切替時に再生中の音声が止まり、レーダー中に読み上げず、地図に戻った後に案内が復帰するか確認する。経由地・最終目的地到着も確認。

## 2026-11-21 実機確認追加
- GPS通知が6つの操作ボタンの下に現れ、重ならないことをスマホで確認。

## 最新確認項目
1. 実機で6ボタンが一列に表示され、地図拡縮と方位切替が動くか。
2. 家でGPSが揺れてもリルートしないか。走行開始後、実際に逸脱したら再探索するか。
3. 公開BRouterでしまなみ島内区間を実計算し、GPS案内と再探索を確認。

## 2026-11-21 UI公開後の確認
- 最新GitHub Pagesのヘッダーなし全画面ナビで、上段に5ボタンが横並びになっているか実機確認。
- PWAの旧サービスワーカーが画面を残した場合、通常のページ再読み込みを試す。データ削除はしない。
- 橋の実走とGPS／音声確認は引き続き未実施。

# 次の課題 — しまなみWeb版 2026-11-21

1. **公開BRouter実接続**：GitHub Pagesから`/profile`へアップロード、各島内の `/brouter?timode=3` が成功するか短距離→全6橋の順に確認。失敗時はステータスを記録。架空の線へ置き換えない。
2. **実走前の机上検証**：50cc・125cc・片道/逆方向・途中の島に経由地・同じ島内で経由地を指定し、結果画面の「しまなみ机上検証」で接続警告がないか確認。
3. **実機GPSハンドオフ**：橋入口と次島のGPS位置精度を記録して65m/90mの閾値を調整。進行方向逆転・未捕捉・途中再起動時の復帰も確認する。
4. **保存済みルートの実IndexedDB**：公開HTTPS上で保存→PWA再起動→通信断→GPS案内再開ができるか検証。`tests/browser_shimanami_offline_restore.py`は検証実行環境のHTTPブロックで未実施。
5. **島内リルートの実接続**：橋上では再探索しない。再探索後の現在地/新道路始点、前の橋参考線の表示状態、GPS引継ぎを実端末で確認。問題が出た場合は元の計算済みルートを保持する。
6. **エリア外一括探索、関門**：現版はしまなみ7エリア内の出発地・目的地が対象。広島市から今治まで等のエリア外部分と、関門人道/トンネルの専用ルールは別フェーズで対応。
7. 公開BRouterの利用条件・プライバシー・負荷制限を確認。長期運用では個別のBRouterサーバーを検討。初期費用を勝手に増やさない。

> 古い「専用Javaサーバー必須」という記録は、しまなみについては分割計算を実装した現在の設計と異なる。今版では橋の参考線を**走行可能と認めたわけではない**。現地標識優先。

---
## 以前の課題記録（履歴）

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

# 2026-11-21 最新優先課題
1. **音声設定の端末実機確認**：標準1.15倍と1.30倍、音量、声の高さ、端末別日本語音声、ON/OFF・試聴の挙動。Web Speech APIによる速度・声の違いは端末音声エンジン依存。
2. **音声案内の走行確認**：取得済みGPXに右左折ヒントがあることを確認し、GPS追跡・発話タイミング・終了操作・通信断時の動作を試す。安全な場所で確認。
3. **地図とUI**：案内中は淡色地図、現在地◎、十字付き⌖、方位切替、案内終了だけを維持。不要な説明は増やさない。
4. **既存未解決**：場所検索の施設網羅性、外部BRouter依存、しまなみ・関門の専用HTTPS API未接続、完全なオフライン背景地図、iPhone画面OFF問題。
5. **引継ぎ**：毎回統合ZIP・CHANGELOG・HANDOFF・NEXT_STEPS・検証記録を更新する。

# Next steps / acceptance gates — 2026-11-20

1. **GitHub Pages was enabled and the Pages build/deployment Actions completed successfully** for `b_navi` commit `39e89c6`. Validate actual HTTPS responses and iPhone/Android display in a device browser. Publishing alone does not verify public BRouter routing.
2. Try the restored **public BRouter /profile + GET GeoJSON timode=3** ordinary routing first, as the previous PWA did. In parallel, plan a dedicated B_Navi Java BRouter engine + RD5 + vehicle BRF profiles on an HTTPS backend for special Shimanami/Kanmon logic (under 10 users). Must allow frontend origin CORS and enforce request limits, capacity, monitoring, and legal/OSM attribution. Do not swap in unrelated routing profiles.
3. Verify POST `api/route`, `api/shimanami/island-legs`, `api/shimanami/preview` and `api/status` through the public app. Test 50cc, 51-125cc, 126cc+, all modes and Shimanami/Kanmon. Bridge references remain separate from ride GPX.
4. Perform iPhone Safari and Android Chrome real-device tests. While online, calculate and save GPX. Disconnect network, reload PWA, load route, allow GPS, test audio and rerouting limitations. Screen OFF GPS/TTS NOT guaranteed; do not claim Android parity.
5. Improve online place search so Japanese company names, addresses, facilities are found reliably. OSM Nominatim/Photon only is insufficient; select legal affordable POI API after comparative test, avoid irrelevant nationwide matches.
6. Add full route navigation persistence/favorite sync, restore correct voice mode settings, accurate off-route/recalculation behavior. Offline recalculation currently not supported.
7. Keep `HANDOFF_CURRENT.md`, this document, `RELEASE_VERIFICATION.txt`, and `CHANGELOG_B_Navi.md` in every ZIP or repository revision.


## Cloudflare再利用の優先事項（2026-11-20）
- 旧地図Workerを経路計算用Workerと誤認しない。旧 `bikenavigator-map-relay` は地図中継専用。
- 新しくJava BRouterを動かせるContainers等を検討。Workers Paid料金・運用容量・RD5・BRFライセンス・アクセス制御を先に確認。
- 前回のDocker/Caddy構成と現行Java APIの違いを解消してからデプロイ。Cloudflare実サービスは未確認。
- 詳細: `docs/CLOUDFLARE_REUSE_PLAN.md`。


## 2026-11-20 次に実機で確認すること
1. On deployed GitHub Pages, calculate a normal short Hiroshima route using public BRouter. Verify CORS + `/profile` returns an ID + GeoJSON returns voicehints with timode=3. If public API refuses, do not hide or fake success.
2. Save the resulting GPX, disconnect network, load saved route, and test GPS/TTS in Android Chrome and iPhone Safari (screen on). Verify cues accurately.
3. Independently deploy the **same** Java B_Navi specialized API for Shimanami and Kanmon when required; do not trust public BRouter for bridge/push-walk permission.
4. Confirm traffic limits, terms, and privacy implications of public brouter.de before exposing to wider audience; public service is only a prototype.
5. Keep future handoff ZIP+GitHub docs current; never delete old routes or saved maps.


## Current UI/performance follow-up (2026-11-20)
1. On iPhone Safari and Android Chrome, compare pan and pinch smoothness on normal and long 8k+ point GPX with the pale and standard basemaps. Use actual user observation; no simulated benchmark can guarantee field performance.
2. Observe the public BRouter progress message. If most waiting time is at **BRF upload**, consider a safely invalidated session-only profile ID cache. If at **route calculation**, public service load may dominate; do not silently switch profiles or straight-line routes.
3. If a truly sparse map is desired (labels/POIs actually omitted), evaluate a licensed, adequately attributed low-detail vector or raster basemap respecting tile provider policy. This revision only reduces OSM raster contrast/visual emphasis.
4. Keep off-line saved route, GPS and TTS tests separate: no promise of screen-off background guidance or offline OSM base tiles.
5. Maintain identical 6 bridge route behavior, correct via ordering, Android vf1 BRF rules, and updated docs with each ZIP / GitHub revision.


## 2026-11-21 次の実機確認（最優先）
1. Android Chromeで既存ルート（BRouter実計算）を表示し、赤い▲の位置を確認。2本指拡大縮小、進行方向ボタン（走行時のみ回転）→「北を上」へ戻す→手動回転後の動作を確認。停車中に方向が振れないこと。
2. iPhone Safariでも同じ画面・GPX/地点編集・GPS許可・赤▲を確認。iPhoneの`coords.heading`が返らない場合は `?` のままでよい。方位センサー磁北を無断で代替しない。
3. まずルート無しの「音声テスト」で日本語音声を聞けるか、その後ルート検索→「音声案内開始」→案内終了を確認。外部GPXには右左折が入っていないこともある。明確に区別。
4. 通信ありでルート保存後、通信OFFで「保存済み経路を開く」→画面ON・GPS許可下でルート線と音声案内の試験。iPhoneの画面ロック中の継続や音声エンジンのオフライン可否は保証しない。
5. ルート計算自体は旧PWA準拠の公開BRouter。実サーバーの受け入れ可否/負荷/適法性は未確認のまま。しまなみ・関門の専用ルートを公開汎用BRouterへ置換しない。
6. 今後も統合ZIPへソース・CHANGELOG・HANDOFF_CURRENT・NEXT_STEPS・RELEASE_VERIFICATION・テストを同梱し、GitHubに同じファイルを反映する。


## 2026-11-21 案内全画面UIの次の検証
1. Android Chrome / iPhone SafariでGitHub Pages最新版を開き、実GPS・実スピーカーの「音声テスト→ルート計算→音声案内開始→案内終了」を確認する。画面OFF中のGPS/音声継続は保証しない。
2. 走行中の次の曲がり角・残距離のHUD表示が見やすいか、危険な操作なしで視認できるか確認する。GPS不正確時の案内保留と警告も実機検証。
3. 利用者が希望する場合にのみ追加の案内表示（次の右左折方向を大きく表示する等）を検討。現段階で速度制限表示や多機能な操作パネルは増やさない。
4. 通常施設検索の網羅性、しまなみ/関門の専用HTTPS経路計算サーバー未接続は従来の未解決課題。公開BRouterの試験利用制限も継続確認する。
5. すべてのZIPにHANDOFF_CURRENT、CHANGELOG、NEXT_STEPS、RELEASE_VERIFICATION、完全ソースとテストを引き続き同梱する。

## 次の優先課題（更新）
1. 実機で長押し地点登録メニューが安定して出るか再確認。
2. ナビ開始中の案内カード文言（例: 「120m先 右折です」）が好みに合うか確認。
3. 必要なら案内カードに道路名・到着予想到着側を追加。
4. ルート計算の体感速度改善、地図タイル簡素化の継続調整。

## Next steps after 2026-11-21 long-press-only update
1. Real Android Chrome and iPhone Safari: verify 0.55s hold opens action menu AFTER finger lift; ordinary tap/pan/pinch/rotation do not change S/G/via; accidental finger-release registration never occurs.
2. Confirm route sheet handle visibility and large bottom maneuver instruction in real riding UI, portrait/landscape. Preserve no header/no bottom 5 tabs during voice guidance.
3. Check GPS bearing and Japanese voice output from a real device; compare routing legality with current Android vf1, especially Shimanami/Kanmon and 50cc profiles.
4. Improve online place search coverage without relying on unrelated results; continue mobile performance profiling.
5. Deploy as a single atomic GitHub commit (avoid intermediate deployment workflows); confirm latest GitHub Pages build success and test smartphone refresh.

## 次回: 住所検索の現地検証
1. スマホから `東京都港区芝公園4-2-8` などの一般的な住所で実検索し、GSI検索APIのCORS/レスポンスと検索精度を確認。
2. 番地まで表示されても町丁目代表位置に設定されていないか地図で確認。必要なら正確な番地まで対応する住所ジオコーダを選定。
3. `広島市西区上天満町` 等も都道府県有無で試し、予想外の別地域候補が紛れないか確認。
4. 実機で長押し登録、GPX、ナビ音声、方位切替への回帰がないか確認。


2026-11-21: 実走GPXをWeb Share APIのファイル共有からLINE等へ渡すボタンを追加。非対応時は保存後にLINEのファイル送信を案内。実機共有未検証。
