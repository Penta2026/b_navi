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
