# B_Navi / 旧Cloudflare再利用の調査と実装計画

更新: 2026-11-20（GitHub実ソースおよびCloudflare公式文書に基づく。Cloudflareアカウントの稼働中サービスは未確認）

## 調査した実ソース
- 旧リポジトリ: `Penta2026/BikeNavigator`
  - `infra/cloudflare-map-relay/src/index.js`
  - `infra/cloudflare-map-relay/wrangler.toml`
  - `infra/cloudflare-map-relay/README.md`
  - `brouter-server/README.md`
  - `brouter-server/docker-compose.https.yml`
- 新リポジトリ: `Penta2026/b_navi`
  - `app.js`、`README.md`、`HANDOFF_CURRENT.md`

## 確定事実と未確認事項
1. 旧Cloudflare Worker名は `bikenavigator-map-relay`。実装済みエンドポイントは `GET /health` と `GET /maps/{region}.zip`。BBBike地図ZIPをそのままストリーミングする**地図配信用**で、経路計算を行わない。地図の転送可否と公開URLは未確認。
2. 旧リポジトリの `brouter-server` は別途Java BRouterのDocker/Caddy案を含む。ただし旧 README 自体に、Docker/HTTPS公開/実際のルート計算は未検証と記載されている。
3. 新B_NaviのWeb UIは `route-api-base` にHTTPSのAPIベースURLを登録できる。`GET api/status`、`POST api/route`、`POST api/shimanami/island-legs`、`POST api/shimanami/preview` に対応するサーバーが必要。
4. Cloudflareダッシュボード/実運用サービスには接続していないため、**現在どのWorkerが稼働しているか、課金プラン、既存Cloudflare URLは未確認**。
5. ユーザーは `Penta2026/b_navi` のGitHub Pages設定を保存したが、公開URLのHTTP応答は未確認。フロントエンドとルート計算の公開を混同しない。

## 採用候補: 同一Cloudflareアカウントを活用し役割を分離
- **既存地図Worker**: 地図配信用のまま維持。既存サービスを無理にBRouterへ置換しない。
- **新ルーティング用Worker**: HTTPS入口としてCORS、要求サイズ制限、アクセス制御、レート制限、エラー処理を担当。
- **Cloudflare Containers**: Java BRouter HTTPサーバー、Android由来の車種別BRF、RD5、しまなみ/関門処理をコンテナで稼働させる。
- **RD5等のデータ**: GitHub Pages / 公開Webルート / GitHub公開リポジトリに79MBのRD5や私的Android全体を無断で置かない。コンテナイメージへの安全な組込み、または権限付きオブジェクトストレージから起動時取得する方式を採否検討。ライセンスとデータ更新も確認。
- Cloudflare Containersは公式仕様で **Workers Paid** が必要（2026-11-20時点で $5 USD/月を含む有料プラン、使用量課金あり）。購入・デプロイ前にアカウントのプランを確認する。
- **代替**: Cloudflare Tunnelを既存PC/Dockerに接続するとHTTPS入口にはできるが、PC稼働が必要なので「PC不要」目標の本命にはしない。

## API互換性（移植で絶対に変えないもの）
- `POST` は `application/x-www-form-urlencoded`。`points` は `lon,lat|lon,lat|...`、`vehicle`、`mode` パラメータを送る（実装は `app.js` 参照）。
- `GET api/status` は `routeReady`, `segments` 等を返す。`api/route` はルートGPX等を返す。しまなみ島内区間の計算、橋参考線、関門の押し歩き分離のJSON仕様を実コードで確認して一致させる。
- `Penta2026/b_navi` のOrigin `https://penta2026.github.io` のみを許容するCORS設計を基本とし、必要な `OPTIONS` や `POST`、適切なレスポンスヘッダーを確認する。Originだけを認証だと見なさない。
- 旧Androidの車種3区分、探索ルール、しまなみ6橋・往復12方向、GPS島間切替、GPX右左折情報を保持する。クラウド側計算を別の汎用無料APIに置換しない。
- 新規経路計算はオンライン。計算済みGPXの端末保存と、GPS/音声のオフライン案内はPWA内。ただしiPhoneの画面OFF中動作、音声リソースのオフライン availability は未確認。

## 次の作業
1. Cloudflareダッシュボードで既存 Worker/Containers、アカウントプラン、Workers subdomain を確認（APIトークンはチャットに送らない）。
2. 現行Java `BikeNavServer.java` の起動方法、必要ファイルとルートAPI契約を確定させてDocker化。RD5の格納・更新方法を確定。
3. 少人数（10人未満）向けに1コンテナ + Cloudflare Worker前段の最小構成を用意し、費用・インスタンスサイズ・コールドスタートを計測。
4. `GET api/status` の実応答、通常 `POST api/route`、しまなみ、関門、一般/探索の差、CORSの実試験を通す。
5. **実在する**Cloudflare HTTPS URLが得られてから新B_Naviに登録。URL未確認の段階でダミーアドレスを本番設定しない。
6. iPhone/Androidでオンライン計算→ルート保存→通信遮断→GPS+音声案内の実走前試験（安全な停止状態）を実施。音声や背景地図がオフラインで使えたか、別々に記録。
7. 各公開版にソース、引継ぎ、CHANGELOG、NEXT_STEPS、検証ログを同梱。

## 公式参考
- https://developers.cloudflare.com/containers/
- https://developers.cloudflare.com/containers/platform/pricing/
- https://developers.cloudflare.com/containers/get-started/
