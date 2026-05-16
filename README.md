# UniLand

LUDIARS 知育プロジェクトの 1 アプリ。 Claude Web フロントエンドで作った HTML/CSS/JS モックアップを、
軽量な Electron シェル上で動かしつつ、 ユーザのキーボード/マウス動態を学習分析向けメトリクスとして取得する。

## 構成

```
main/        Electron main プロセス
  monitor/   uiohook-napi を使ったグローバル入力フック + 集計バケット
  mockups/   renderer/mockups/<id>/manifest.json 列挙
preload/     contextBridge 経由の安全な API 提供
renderer/    Foundation UI ベースの軽量シェル UI
  mockups/   各モックアップ (manifest.json + index.html + 任意の static asset)
data/        セッションログ等 (.gitignore 対象)
docs/        設計ドキュメント
```

## 動作確認 (scaffold 段階)

```
npm install
npm run build
npm start
```

## データ取り扱い方針

LUDIARS の個人データ保管禁止ルール (AIFormat §5) に従い、 raw な keystroke / 座標履歴は
**ローカルでも永続化しない**。 main/monitor は 5 秒窓ごとに集計メトリクス (押下数 / 移動量 / idle 時間 等) のみ
emit し、 必要に応じて Memoria / Cernere に転送する。 raw stream は process memory にだけ存在する。

## 次の TODO

- Foundation UI を LUDIARS/Foundation の token に置換 (現在は最小サブセット)
- Cernere 認証 + per-user `/api/auth/project-token` で監視メトリクスを Memoria に送信
- Excubitor ヘルスチェック登録
- LUDIARS/PROJECT-CODES.md に 2 文字略称を提案 (Ul / UL 候補)
