# B_Navi PWA — Online route calculation / offline voice navigation

**Status (2026-11-20): GitHub Pages frontend preparation only.**

- Open `https://penta2026.github.io/b_navi/` once Pages deploy succeeds (not verified until deployed).
- GitHub Pages hosts a static, HTTPS mobile PWA, **not** the Java BRouter route engine.
- For online route calculation, supply a **separately deployed HTTPS B_Navi Java API** via "オンライン経路計算の接続設定". Endpoints `api/status`, `api/route`, `api/shimanami/island-legs`, `api/shimanami/preview` must implement the current app contract, allow CORS from the Pages origin, and support the original BRF/RD5/Shimanami/Kanmon rules. **No public routing server is deployed or configured in this revision.**
- Online map tiles and place search require internet. Cached application assets + IndexedDB-stored GPX/route geometry + client-side GPS and speech synthesis can operate without network while the browser tab remains active and the system voice is available.
- iOS Safari background/screen-off GPS/TTS are *not guaranteed*. Route lines are still visible offline, but the OSM basemap tiles are not offline-cached.
- GPX with `<rtept>` turn offsets supports local right/left cues. GPX without turn cues only shows the track; never fabricate instructions.
- Cycling bridge references and Kanmon push-walk lines are not exported as riding tracks.

See [HANDOFF_CURRENT.md](HANDOFF_CURRENT.md) and [NEXT_STEPS.md](NEXT_STEPS.md).

## Deployment

Repository Settings → Pages → Source: **Deploy from a branch**, Branch: **main**, Folder: **/(root)**, then Save. This one-time setting needs repository administrator action. The frontend is static; the backend must be deployed independently. Do not publish Java RD5 or Android source as public website files.


## Cloudflare backend reuse investigation
Old `BikeNavigator` Cloudflare Worker `bikenavigator-map-relay` is a map-data streaming relay, **not** the Java BRouter engine. See [Cloudflare reuse plan](docs/CLOUDFLARE_REUSE_PLAN.md). No hosted routing endpoint is currently verified; the existing app UI's HTTPS API setting is not yet configured.


## 2026-11-20 — Previous-PWA-compatible public BRouter trial
- `Penta2026/BikeNavigator/motorcycle-map-v734.html` set its endpoint to `https://brouter.de/brouter`; `assets/motorcycle-map-v660.mjs` POSTed the BRF to `/profile`, then GET `/brouter` with `lonlats`, `profile=custom_...`, `format=geojson`, `timode=3`. Its Cloudflare Worker was **map data relay only**.
- The **current GitHub Pages `b_navi` frontend now supports that same public routing method for ordinary routes if no private HTTPS API is configured**. Ten profile files are sourced from the immediately preceding integrated PWA (`engine/data/profiles2`), including the user-adjusted 50cc explore profile. No local Java engine/RD5 is installed on Pages.
- BRouter is a public third-party server: availability, quotas and long-term permission for third-party apps are not verified. This is a pilot, not a guaranteed production backend.
- For Shimanami and Kanmon, **public routing is NOT equivalent to the B_Navi specialized island/human-push behavior**. The dedicated Java API is still required. No bridge reference lines are silently added to a GPX.
- When server returns `voicehints` with `timode=3`, the PWA converts supported BRouter hints to GPX `<rtept><desc>...<offset>` metadata and saves the GPX locally. Unknown maneuvers are omitted; iPhone/Android actual offline GPS/audio and screen-off use remain unverified.
