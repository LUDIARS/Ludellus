# UniLand 設計メモ

## 目的

知育系教材プロジェクトの 1 つとして、 Claude Web フロントエンドが書き出した HTML/CSS/JS モックアップを
**軽量に・作り込んだ状態で** 動かす。 Memoria 同様の監視層を持ち、 ユーザの入力動態を集計して
学習分析のシグナルにする。

## 非機能要件

- **ローカル専用アプリ**。 外部サービス連携 / 認証 / ネットワーク送信なし。
- LUDIARS 個人データ保管禁止ルール (AIFormat §5) 準拠。 raw 入力は永続化しない。
- Foundation UI に準拠 (角丸 + やや大きめ padding + token 共通)。

## アーキテクチャ

```
+--------------------+      IPC      +-------------------+
| renderer (UI shell)|  <-------->   | main (node)       |
|  - mockup 一覧     |               |  - InputMonitor   |
|  - iframe ロード   |               |  - MockupRegistry |
|  - メトリクス表示  |               |                   |
+--------------------+               +-------------------+

  (ネットワーク I/O は無い — process は完全にローカルで完結する)
```

### InputMonitor

`uiohook-napi` を遅延 require して OS 入力フックを取り、 5 秒バケットに集計する。
emit するのは `InputMetric` (keyPresses / mouseClicks / mouseMoves / mouseTravelPx / idleMs) のみ。
raw な keycode / 座標は **emit しない** ことが個人データ保管禁止ルール準拠の鍵。

### MockupRegistry

`renderer/mockups/<id>/manifest.json` を列挙して renderer に返す。 manifest:

```json
{
  "id": "sample-hello",
  "title": "Hello UniLand",
  "description": "...",
  "entry": "index.html",
  "tags": ["sample"]
}
```

renderer は iframe sandbox="allow-scripts allow-pointer-lock" でロードする。

## 段階的拡張案

1. **v0.1 (scaffold)** — 本リポの現状。 単発モックアップ動作 + メトリクス UI 表示。
2. **v0.2** — 集計メトリクスのローカル永続化 (raw 入力は引き続き保存しない)、 セッション概要の確認 UI。
3. **v0.3** — 集中度推定 (idle / 入力速度の変動)、 セッションリプレイ。
4. **v0.4** — Curare の知育コンテンツ pack 連携、 教材作者向けエディタ。
