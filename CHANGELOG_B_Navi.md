## 2026-11-22 企業の本社・支店の施設名検索とGoogleマップリンクを改善
- 以前はOpenPOIで1件見つかると検索を中断。OpenPOI suggest/search、Photon、Nominatimの候補を照合し、別地点の同名施設は残す。
- 地域を指定した検索では、所在地が指定地域に合う候補だけ採用。地域込みの検索で0件ならPhotonへ施設名だけで再検索し、地域照合を維持。
- 近接の同名施設は重複統合。「大田鋳造所」の広島市本社と北広島町事業所は公式サイトで存在確認。ただし検索サービス側に本社情報がなければ検索結果を作らない。
- 検索欄に表示されるGoogleマップ外部リンクは元の1つだけ残し、検索結果下部への重複追加を削除。
- Nodeで候補統合・地域判定などを検証。実APIの当日の検索結果、現地GPS確認は未検証。

## 2026-11-22 OpenPOIによる日本の施設名検索を第一候補に
- OpenPOI API `GET /v1/suggest`（複数語はAND、表記ゆれ対応）を第一検索先として追加。候補は名称・住所・座標から既存の出発地・目的地・経由地へ設定可能。返却順を尊重し、従来の厳格なOSM名称スコアでは棄却しない。
- 施設名1語で候補0件の場合は `GET /v1/search` も試す。2語以上のOR検索は無関係な地域や店を混在させるため行わない。
- どちらも使えない・0件の場合は既存のPhoton／Nominatim検索へフォールバック。JR駅のローカルインデックスや地理院住所検索も維持。
- 入力中は550ms静止後に3文字以上を検索し、古い通信を中止。ユーザーが明示的に検索を押した際は候補検索をキャンセルし、その検索結果のみ表示。
- OpenPOI出典を検索画面の小さいリンクに集約。お気に入りへ登録する場合は提供元の `licenses` / `attributions` を一緒に保持。
- 地図・GPX・ルート計算・レーダーは変更しない。実APIでの尾道エリア検索実績と実機動作は未検証。OpenPOIの品質や配信可用性は保証しない。
- 参考 `https://docs.openpoiapi.com/` / `https://openpoiapi.com/attribution.html`。

## 2026-11-22 施設検索の取りこぼし軽減
- 施設名に「カフェ」がなくても、OSMの実際の施設分類が一致する候補を表示。カテゴリ別POI・完全名称一致の優先・他市除外を維持。
- Photonを優先し、不足分のみ従来のNominatimへ補完。地域付きで見つからない場合は施設名だけで再検索し、地域チェックを維持。
- 名称の一部が重なる同地域の施設は「関連候補」として分離し、正解と混同しない。サーバ障害と0件を区別、早すぎる再検索で前回結果を消さない。
- JR駅4,321件の既存検索・地理院住所検索・ルート・GPX等は維持。
- Node/Chromium模擬テスト追加。実際の外部検索網羅率は未確認。詳細 `docs/POI_SEARCH_RECOVERY_20261122.md`。

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


## 2026-11-22 本線継続優先・側道リンク抑制（一般3車種）
- 50cc／51〜125cc／126cc以上の一般BRFに `initialclassifier` と `initialcost=180` を追加。OSM `*_link` への不要な進入を抑えるソフトコストで、接続路は禁止しない。
- ビギナー/探索/ファストトラベル、通行制限、3軸調整、実走GPXなどのコードは従来通り。
- 実走地点のOSM道路分類および公開BRouterでの経路形状は未検証。詳細 `docs/ROAD_CONTINUITY_20261122.md`。
## 2026-11-22 — 実走GPXを保存日時付きファイル名へ変更
- GPXダウンロードとWeb Share APIの `File.name` を `実走GPX-YYYY-MM-DD-HH-mm.gpx` に統一。
- UTCの走行開始時刻をファイル名へ直書きする旧方式から、最初の保存/共有時の端末ローカル日時を使う方式に変更。`exportedAt` は記録とともに保存し、再読み込み後も同じ名前にする。記録を破棄して新しい走行を開始すると新しい日時になる。
- ファイル名にWindows非対応の半角コロンを入れず、時分は `08-25` と記載。GPX 1.1 XMLの測位日時・内容は変更しない。
- Node自動テスト：77/77 PASS（追加3件を含む）。実機のGPS/LINE共有は未検証。

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

# 2026-11-21：名前付きカスタムルート設定（プリセット）

- 追加 `route-presets.js`：車種ごとに調整値を50件まで名前付き保存。localStorageの新キーで従来の編集中の設定を保護。
- `app.js`：名前付き保存/選択/読み込み/削除、上書き確認、全車種JSONバックアップ書き出し/読み込み（同名はスキップ）、読み込み後に手動で「ルート検索」。既存の計算済みルートやナビの状態は自動変更しない。
- `index.html`、`style.css`：プリセットUI、スマホ操作が下部GPX操作パネルに遮られない折り畳み時の非表示。
- `sw.js`：キャッシュ名 `bnavi-pc-pwa-20261121-custom-presets-v1`、`route-presets.js` を追加。
- 追加 `tests/test_route_presets.cjs` (6件)、`tests/browser_route_presets.py`。古いbrowser smoke/voice/long pressテストのスクリプト読込を同期。テストのSWリビジョン文字列を更新。
- **Node 70/70成功**、スマホChromium模擬の保存→呼出→計算、バックアップの挙動成功。実機と公開BRouterは未確認。GitHub Pages未更新。

---

# 2026-11-21 — 排気量別一般基準・3軸カスタムルート（ZIP統合版 / GitHub未公開）

- 車種を50cc/51〜125cc/126cc以上に分け、各 `*_general.brf` を初期値に固定。旧「走り方」プルダウンを内部化。
- 3独立スライダー（距離↔探索／道狭↔道広／直線↔景観）を5刻みで追加。一般中央ではBRFのバイト列を無変更。
- 一般BRFの道路種別コスト、車線数ペナルティ、曲がりコスト、森林・水辺推定のソフトペナルティを設定に応じて変更。通行禁止判定は維持。
- 126cc以上だけ高速/有料許容を別々にON可能（両方初期OFF）。法律上の通行可否は実機・現地で未検証。
- 公開BRouterへ設定別のBRFをPOSTしてキャッシュキーを分離。計算済みルートはスナップショット設定で再探索（しまなみ島内道路を含む）。専用Java APIには未実装の詳細調整を偽装しない。
- カスタム設定を車種ごとにローカル保存、初期化ボタン追加。実走GPX保存/LINE共有ボタンは維持。ナビ/フリー走行時に保存パネルが操作を塞ぐ問題をCSSで解消。
- キャッシュ更新。Node 64/64 PASS。新規Chromium自動テスト＋既存GPX/ナビ/レーダー/操作幅テストを確認。公開BRouter本番の疎通・GPX端末共有・全しまなみブラウザは未確認。

---

## 2026-11-21 GPX中継地点取り込み修正
- 地点順序だけを格納したGPXの `<rtept>` を道路の線ではなく、中継地点として登録するよう修正。S→経由地→Gの順序・名前を保持。
- インポート後、車種別BRouterで経由地を含む道路ルートを自動計算。失敗したら地点を残し再計算ボタンを表示。
- 既存の実軌跡GPXの読み込みを維持。遠隔経路が中継地点を300m以上外した場合は未成功扱いにする。
- アプリ本体のService Workerキャッシュ名を更新。GPS・音声・しまなみ・レーダーの処理自体は変更なし。
- 既存+新規 Node 58件合格、合成GPXのブラウザ試験3件、および非公開のユーザー提供GPX試験を実施。公開BRouter通信は未検証。


## 2026-11-21 レーダー中の音声案内ミュート（最新版）
- ナビ中レーダー表示に切り替えた時点で再生中の読み上げを中断し、新しい案内音声を止める。
- レーダー表示中もGPS・経由地到着検知・再計算判定・目的地到着終了は動作する。
- 地図に戻ると次の案内音声から自然に再開。設定画面の音声ON/OFF、速度などは書き換えない。
- 単独レーダー使用中も読み上げを抑制。レーダー独自の接近チャイムは残す（音声読み上げとは別）。
- 到着終了処理はレーダー中に音声完了待ちにならない。経由地到着ポップアップはそのまま。
- 確認対象: `app.js`、`ride-radar.js`、`sw.js`、`tests/test_radar_voice_mute.cjs`、`tests/browser_radar_voice_mute.py`。
- 検証範囲は模擬GPS・模擬音声のみ。実機スピーカーは未確認。

## 2026-11-21 通知重なり修正
- 上部の6つの地図操作ボタンと一時GPS通知が重なる問題を解消。
- 通常地図・案内中・フリー走行で、通知を上部ボタン直下へ移動。表示時間や音声/経路計算は変更なし。
- Service Workerのキャッシュ名をv4へ更新。

## 2026-11-21 走行UI・停止中リルート改修
- 地図上の「＋／－／◎／十字／レーダー／進行方向」を一列に配置。狭い画面はアイコンを縮小しはみ出さないようにする。レーダーはアイコンのみ。
- 停止中のGPS揺れでリルートしないようMotionGateを導入。複数の走行GPS速度、または方向の揃った連続移動で走行を確定してから逸脱判定する。
- 既存の車種別探索、しまなみ6橋データ、経由地の音声再開は変更なし。

## 2026-11-21 操作ボタン横並び・公開反映
- 上段を `＋ / － / ◎ / ⌖ / 📡` の5ボタン、下段右端に `進行方向 ⇔ 北を上` を配置。レーダーはアイコンのみ。
- 既存CSSがナビ中にズームボタンを隠していた競合を解消。5ボタンを同列に保った。
- PWAのService Workerキャッシュ名を更新し、新しいレイアウトの取得を促す。
- 既存の経路計算・GPS・音声・しまなみロジックには変更なし。

- 2026-11-21: 地図操作ボタンを上段「＋ / － / ◎ / ⌖ / 📡」、下段右端「進行方向」に再配置。レーダーはアイコンのみ表示。
# 2026-11-21 — しまなみWeb組立 / 計算済み島内案内・橋GPS切替強化版

- Java専用API依存だったGitHub Pages上のしまなみ原付（50cc・125cc以下）島内ルート計算を、旧PWAの公開BRouter `/profile`・`/brouter`＋Android由来の橋参考形状へ置き換える試験実装。
- 向島から今治側まで6橋を跨ぐ行程を、道路7区間と橋6本の**参考表示**に分割。橋の入口出口で25mより大きい未確認接続があれば、描画に直線を捏造せず計算失敗を表示。
- `shimanami-web-router.js` を追加：順方向・逆方向・経由地・引き返しの計算順序を決定。島内路面形状が返らない場合は偽の直線に切り替えず停止。
- `shimanami-bridge-references.js` を追加：原本GPXの座標とSHA256を保持（あくまで参考で走行GPXではない）。Androidアプローチデータは変更なし。
- `app.js`：GPSで橋に入ったら島内音声停止、次の島に入ったら自動再開。従来の経由地到着確認と最終目的地の案内終了を維持。現在の島内道路のみオンラインリルート追加。
- `public-brouter-client.js`：同時7島内計算で同一BRFのアップロードを重複させない。
- `offlinePayload()`：計算順・島内音声指示・橋参考線メタデータを保存対象に追加。
- 机上検証UI追加。新規Node8テスト合格、全Node45テスト合格。旧5＋新3のブラウザ模擬8テスト合格。
- 実際の公開BRouter通信・スマホ実GPS・橋の法規・IndexedDB実保存は未確認（机上検証/模擬GPSのみ）。

---
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

## 2026-11-21: 住所検索対応
- 施設名だけの検索に加え、住所入力から候補の緯度経度を取得する経路を追加。
- 住所らしい入力での自動判定と、「住所で探す」明示ボタンを追加。
- 住所の候補は所在地照合・重複排除・概略位置注記を行い、「目的地にする」ボタンと共通登録メニューに接続。
- 道路計算、BRF、しまなみ島渡り、タップ事故防止、音声を変更しない。

## 2026-11-21 実走GPS GPX記録（追加）
- フリー走行・単独レーダー・ナビ走行の実GPS測位を共通の記録器へ送る。
- GPX 1.1 trk/trkseg/trkpt に実測緯度・経度・時刻・任意の標高を出力。予定経路・リルート計算結果は混入させない。
- 走行中の点列をlocalStorageへ逐次保存。画面再読み込み時は未保存ログとして復元。記録中断後の再開にも対応。
- GPS精度65m超、重複、極端なジャンプを除外。GPX保存ボタンと明示的破棄ボタンを追加。
- 注意：画面消灯・バックグラウンドでのGPS継続はPWA/OS制約あり。実機テスト未実施。


2026-11-21: 実走GPXをWeb Share APIのファイル共有からLINE等へ渡すボタンを追加。非対応時は保存後にLINEのファイル送信を案内。実機共有未検証。
