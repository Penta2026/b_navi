# Next steps / acceptance gates — 2026-11-20

1. **Repository source uploaded** to `Penta2026/b_navi`. User must enable GitHub Pages in repository **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**, then verify HTTPS and mobile display. Actions could not create the site (`Resource not accessible by integration`). Publishing alone is not route calculation.
2. Deploy B_Navi Java BRouter engine + RD5 + vehicle BRF profiles on an HTTPS backend suitable for low traffic (under 10 users). Must allow frontend origin CORS and enforce request limits, capacity, monitoring, and legal/OSM attribution. Do not swap in unrelated routing profiles.
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
