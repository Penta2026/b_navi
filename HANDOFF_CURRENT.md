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
