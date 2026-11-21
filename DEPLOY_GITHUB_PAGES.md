# B_Navi PWA GitHub Pages反映 — 2026-11-22 実走GPX日時ファイル名

GitHub Pages: https://penta2026.github.io/b_navi/
リポジトリ: https://github.com/Penta2026/b_navi

この版は `track-recorder.js` の保存/共有ファイル名と `sw.js` キャッシュ名を更新し、テスト/引継ぎ文書を追加したもの。リポジトリ `main` に配置してPagesのビルドが成功すると反映される。PWAの古い表示が残る場合は一度閉じて再読み込みする。

注意：最初の保存・共有時の端末ローカル時刻を使うため、未保存の走行開始時刻と異なることがある。実機GPS・LINEは未検証。

# B_Navi PWA 公開版への反映（マイルート集）

1. 先に既存の `Penta2026/b_navi` リポジトリのバックアップを確保してください。`main` は今回のZIPより古いため、単独ファイルだけの上書きでは動きません。
2. 本ZIPを解凍し、`index.html`、`app.js`、`style.css`、`my-route-library.js`、`route-tuning.js`、`route-presets.js`、`track-recorder.js`、`sw.js`、`profiles/` ほか同梱ファイルを **リポジトリ直下へまとめて反映**してください。ZIP全体を1ファイルとしてアップロードしないでください。
3. GitHub Actions / Pages が公開を完了したら `https://penta2026.github.io/b_navi/` を再読込。PWAインストール版では古いキャッシュが残る場合があります。Service Worker はバージョンを更新してあります。
4. 50cc / 125cc / 126ccで一般→スライダー調整→ルート検索→「経路の結果」→「マイルート集」で保存→別の経路へ→保存分を呼び出す、の順に実機で確認してください。
5. 実走GPX保存・共有とマイルート集の保存は別機能です。背景地図はオフラインキャッシュされません。ルート計算には通常オンライン接続が必要です。

**重要**：このZIPは実装済みの配布物ですが、GitHubへのpushと本番公開は行っていません。現在公開されているPagesへ自動反映されたわけではありません。
