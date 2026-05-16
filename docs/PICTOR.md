# Ludellus × Pictor レンダリング戦略

ユーザ指示: 「最終的に全部 Pictor で高速に描画したい。 Web と合わせて Pictor でレンダリングする方向で」

[[project_pictor_rive]] のとおり Pictor は Vulkan + Rive Renderer ベースの LUDIARS 描画ライブラリ。
Pictor 本体のリポを確認したところ、 **WebGL2 backend (Emscripten / WASM ビルド) が既に存在** している (`PICTOR_BUILD_WEBGL` オプション + `src/webgl/webgl_context.cpp` + `demo/webgl/main.cpp`)。 これにより Web / Mobile / Desktop の 3 ターゲット全部で Pictor を使う構成が技術的に成立する。

## ターゲット別バックエンド

| 環境 | Pictor backend | バインディング |
|---|---|---|
| **Web (PWA)** | `pictor_webgl` (Emscripten / WebGL2) → WASM | JS から `Module.ccall` / `cwrap` |
| **Capacitor iOS** | Vulkan via MoltenVK (native lib) | Capacitor plugin (Swift bridge) |
| **Capacitor Android** | Vulkan (native lib) | Capacitor plugin (Kotlin/JNI bridge) |
| **Electron Desktop** | Vulkan native lib (`libpictor.a`) | N-API native module |
| **(現状の sample)** | — (Canvas 2D) | foundation 経由でフォールバック |

## レンダリング抽象層

既存サンプルが Canvas 2D で動いている以上、 段階移行のため foundation に **抽象 draw API** を設ける。
ゲームコードは抽象 API だけ呼び、 backend の選択は foundation が自動で行う。

```
[ Game code ]
     │
     ▼ 抽象 API (描画コマンド: circle / line / text / image / sprite ...)
[ renderer/lib/render.js ]
     │
     ├─ backend: canvas2d   → Canvas 2D ctx (既存サンプル互換、 即動く)
     └─ backend: pictor     → Pictor WASM (Web) or Capacitor plugin (Mobile) or N-API (Desktop)
```

### 自動選択ロジック

```
1. window.PictorBridge があれば pictor backend (注入されている = 起動側で初期化済)
2. window.location が file:// で Pictor WASM が同梱なら pictor backend
3. それ以外は canvas2d backend
```

ユーザは明示的に `setBackend('pictor')` / `setBackend('canvas2d')` で切り替えも可能。

### 描画コマンド (API ドラフト)

Pictor の ObjectDescriptor (DOD) に乗せやすい形にする。 immediate mode より retained mode 寄り:

```js
import { createRenderer } from "../lib/render.js";

const renderer = createRenderer(canvas, { preferBackend: "pictor" });

// 1 シーンを宣言
renderer.beginScene({ clearColor: [0xf7, 0xf1, 0xe8, 1] });

// 描画ノードを submit (id を渡せば retain される = 次フレームも残る)
renderer.submitCircle("uni-core", { x: 400, y: 100, r: 30, color: 0xfffaf1ff });
renderer.submitLine("uni-tentacle-0", { x1: 400, y1: 100, x2: 460, y2: 60, w: 6, color: 0xff7a3aff });
renderer.submitText("title", { x: 400, y: 30, text: "せいかい", size: 88, color: 0xb32616ff });

renderer.endScene(); // ここで実際に描画
```

これがそのまま Pictor ObjectDescriptor に変換でき、 Canvas 2D backend では `ctx.beginPath() + arc / lineTo + fillText` に展開される。

### Pictor ObjectDescriptor との対応 (案)

| 抽象コマンド | Pictor side |
|---|---|
| `submitCircle` | `ObjectDescriptor { kind: Sphere2D, transform, material }` |
| `submitLine` | `ObjectDescriptor { kind: Quad (太い線分), transform, material }` or Rive のストローク |
| `submitText` | Rive Renderer の glyph path (フォント atlas 経由) |
| `submitImage` | Texture + Quad |
| `submitSprite` | Texture atlas + UV |
| `submitParticles` | Instanced Quad |

Rive Renderer 有効 (`PICTOR_ENABLE_RIVE=ON`) なら、 触手のような細いベジエ曲線も Pictor 側でベクター GPU 描画できる。 これは Canvas 2D ではどうしても CPU 寄りになる部分。

## うにキャラの Pictor 化

`renderer/lib/uni-character.js` は **抽象 draw API を使うように書き直す** ことで Pictor / Canvas 2D 両対応:

```js
class Uni {
  // ...
  draw(renderer) {
    // 触手 (11 本)
    for (let i = 0; i < this.tentacles.length; i++) {
      renderer.submitLine(`uni:${this.id}:t${i}`, { x1, y1, x2, y2, w, color });
    }
    // コア
    renderer.submitCircle(`uni:${this.id}:core`, { x, y, r, color });
  }
}
```

ID を付けることで Pictor backend では **retained mode** にできる (毎フレーム再構築せず差分更新)。 Canvas 2D backend では毎フレーム再描画。

## パフォーマンス目標

Pictor は本来 1M Spheres ベンチが回るレンダラ ([[project_pictor_rive]] / Pictor README の benchmark)。 Ludellus では:

| シーン | Canvas 2D 想定 fps | Pictor 想定 fps |
|---|---|---|
| メイン + 背景 3 体 + 進捗ドット | 60 (余裕) | 60 (1% 未満の負荷) |
| 降下うに 60 体 + 物理 + 数字パーティクル | 30〜45 (端末次第) | 60 安定 |
| AI 改修プレビュー (複数シーン同時) | 困難 | 60 維持 |
| パーティクル 1000 個 (花火演出等の将来) | 15〜20 | 60 |

将来のリッチ演出を見込むなら Pictor 移行は意味がある。 現状サンプル程度なら Canvas 2D で十分。

## 段階移行ロードマップ

| Phase | 内容 | 依存 |
|---|---|---|
| **0 (現状)** | foundation の uni-character.js / theme.css は Canvas 2D 前提 | — |
| **1** | `renderer/lib/render.js` 抽象層追加、 backend = canvas2d 固定 | (本 PR) |
| **2** | uni-character.js を抽象 API ベースに refactor、 Canvas 2D で動作維持 | Phase 1 |
| **3** | Pictor を Emscripten で WASM ビルド、 minimal demo (うに 1 体描画) を JS から呼ぶ | Pictor 側に export 関数を追加 (`pictor_create_renderer` / `pictor_submit_object` / `pictor_render` の C ABI) |
| **4** | foundation の Pictor backend 実装、 自動選択ロジック | Phase 3 |
| **5** | Capacitor plugin (iOS / Android native bridge) | Phase 4 + ネイティブビルド整備 |
| **6** | Electron で N-API バインディング | Phase 4 + Electron 統合 |

## Pictor 側に必要な作業

Ludellus 側からは Pictor を opaque な library として使うが、 Pictor 側に **C ABI の export** を足してもらう必要がある:

```c
// pictor-c-api.h (新規、 提案)
typedef struct PictorRenderer PictorRenderer;
typedef struct PictorObjectHandle PictorObjectHandle;

PICTOR_C_API PictorRenderer* pictor_create_renderer_webgl(int canvas_handle);
PICTOR_C_API PictorRenderer* pictor_create_renderer_vulkan(void* native_window);
PICTOR_C_API void pictor_destroy_renderer(PictorRenderer*);

PICTOR_C_API PictorObjectHandle* pictor_submit_object(PictorRenderer*, const PictorObjectDescriptor*);
PICTOR_C_API void pictor_update_object(PictorRenderer*, PictorObjectHandle*, const PictorObjectDescriptor*);
PICTOR_C_API void pictor_remove_object(PictorRenderer*, PictorObjectHandle*);

PICTOR_C_API void pictor_render(PictorRenderer*, double dt);
```

JS 側はこの C ABI を Emscripten の `cwrap` で叩く。 Mobile / Desktop も同じ ABI を経由する。 [[feedback_pictor_no_upper_dep]] のとおり Pictor 自身は Ludellus に依存しない (Ludellus が Pictor の thin client になる)。

## 既存サンプルの扱い

- `sample/*.html` (uni-writing-game / uni-math 等) は **Canvas 2D 前提のまま温存** (リファレンス)
- 新規ゲーム + foundation 経由のゲームは抽象 API → Pictor 利用
- 移行はゲーム単位で段階的に

## 関連

- [[project_pictor_rive]] — Pictor + Rive Renderer 統合の状況
- [[feedback_pictor_debug_default]] — 実行確認は Debug build
- [[feedback_pictor_no_run]] — Ludellus 側からは Pictor を実行確認しない (Pictor チームの責務)
- [`FOUNDATION.md`](./FOUNDATION.md) — render.js は foundation の一部
- [`MOBILE.md`](./MOBILE.md) — Capacitor plugin として Pictor をバンドル
- [`SERVER.md`](./SERVER.md) — レンダリングはクライアント側のみ、 サーバは関与しない
