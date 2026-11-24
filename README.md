## 2026-11-24 広域しまなみ旅程（検証版）
- 50cc・51〜125ccの広域旅程を地点順に分割し、一般道路と既存6橋の参考線を組み合わせる。尾道大橋の実道路照合と従来の接続距離基準を維持。
- 竹原などの外側の地点を最寄り島に割り当てない。接続方向は限定的な地理判定であり海岸線ポリゴンではない。不明な接続は経由地指定を求める。
- 広域接続中の自動リルートは無効化。実道路API・実機は未検証。

## 2026-11-24 道の途中。クリップボード連携
- 経路の結果に「道の途中。から」「GPX読み込み」「GPX保存」の3ボタン。全体表示ボタンを削除（自動地図調整は維持）。
- 道の途中。のGPX識別子を検証し、既存の地点順GPX読み込みと車種別道路計算へ接続。自動読取拒否時は手動貼り付けを案内。
- 通常のGPXファイル・共有受信・軌跡保存は維持。実機確認は未実施。

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

# 2026-11-22 — 実走GPXの日時付きファイル名（現行版）

- 「実走GPXを保存」または「GPXを共有（LINEなど）」で、`実走GPX-YYYY-MM-DD-HH-mm.gpx` を使用（例：`実走GPX-2026-11-22-08-25.gpx`）。
- 日付・時刻は端末のローカル時刻。**その走行記録で最初に保存／共有した時刻**を使用し、その後の保存・共有でも同じファイル名にする。
- Windowsで禁止される半角 `:` の代わりに `-` を使用。GPXの測位点やXML時刻・他の走行機能は変更なし。
- GitHub Pagesの公開状況はActionsで別途確認。実際のLINE送信と実走GPSは実機未確認。

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

### 2026-11-22 本線継続優先の経路調整
「一般」ルート（50cc／51〜125cc／126cc以上）ではOSMの `*_link` 接続路へ不要に出入りしないようソフトな追加コストを設けています。必要な分岐は通行可能。詳細は [検証メモ](docs/ROAD_CONTINUITY_20261122.md)。
