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
