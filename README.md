# アートワーク検索（iTunes / Apple Music）— iOS / iPadOS 最適化 PWA

このツールは iTunes Search API または Apple Music API を使い、アルバム・映画・TV・App 等のアートワークを **高解像度** で検索・保存できるモバイル最適化のウェブアプリです。ホーム画面に追加してネイティブ風に使えます。

## 使い方
1. `index.html` を任意のホスティングにアップロード（例: GitHub Pages / Netlify / Vercel / iCloud Drive 共有など）。
2. iPhone / iPad の Safari で開き、「共有」→「ホーム画面に追加」で PWA としてインストールできます。
3. 検索ワードを入力し、カテゴリー・国・出力サイズを選んで「検索」。結果カードから「画像を開く」「ダウンロード」「URLをコピー」ができます。

### Apple Music API を使う（任意）
Apple Developer の **開発者トークン** を入力すると、Apple Music Catalog API を使った正式なアートワークURL（`{w}x{h}bb` テンプレート）で取得します。トークンが空の場合は、認証不要で使える **iTunes Search API** を使います。

> 注意：Apple Music API は Developer Program と署名付きトークンの発行が必要です。

## 技術メモ
- iTunes Search API: `https://itunes.apple.com/search?term=...&entity=...&country=...`
- 返却される `artworkUrl100` などのURLは、`/100x100bb` の部分を `/1200x1200bb` のように置換することで多くの場合で高解像度が取得できます（非公式仕様）。
- Apple Music API: `GET /v1/catalog/{storefront}/search` で `attributes.artwork.url` の `{w}x{h}` プレースホルダを希望サイズに置換して使用します（公式仕様）。

## ライセンス
あなたのプロジェクト用途で自由にお使いください（無保証）。
