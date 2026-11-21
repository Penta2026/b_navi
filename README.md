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
