// 抽象描画 API。 Canvas 2D / Pictor の両 backend を切り替えられるようにする。
//
// Phase 1 (現状): Canvas 2D backend のみ実体あり。 Pictor backend は window.PictorBridge を
// 検出した時の hook だけ用意し、 本実装は Pictor 側で C ABI export + WASM ビルドが整ってから。
//
// API は retained-mode 寄り (id 指定で submit/update/remove)。 Pictor の ObjectDescriptor (DOD)
// にそのまま乗せやすい形にしている。 Canvas 2D backend では毎フレーム再描画するので id は無視可。
//
// 自動 backend 選択:
//   1. opts.preferBackend === "canvas2d" → canvas2d
//   2. opts.preferBackend === "pictor"   → pictor (失敗時は canvas2d にフォールバック)
//   3. window.PictorBridge があれば      → pictor
//   4. それ以外                          → canvas2d

/**
 * @typedef {object} ColorRGBA  0xRRGGBBAA の uint32 を想定
 * @typedef {object} CircleCmd  { x, y, r, color }
 * @typedef {object} LineCmd    { x1, y1, x2, y2, w, color, cap? }
 * @typedef {object} TextCmd    { x, y, text, size, color, font?, align?, baseline? }
 * @typedef {object} ImageCmd   { x, y, w, h, source }   source は HTMLImageElement/ImageBitmap 等
 * @typedef {object} QuadCmd    { x, y, w, h, color, rotate? }
 */

function detectBackend(opts) {
  if (opts?.preferBackend === "canvas2d") return "canvas2d";
  if (opts?.preferBackend === "pictor") {
    return (typeof window !== "undefined" && window.PictorBridge) ? "pictor" : "canvas2d";
  }
  if (typeof window !== "undefined" && window.PictorBridge) return "pictor";
  return "canvas2d";
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {"auto"|"canvas2d"|"pictor"} [opts.preferBackend="auto"]
 */
export function createRenderer(canvas, opts = {}) {
  const backendKind = detectBackend(opts);
  return backendKind === "pictor" ? new PictorRenderer(canvas, opts) : new Canvas2DRenderer(canvas, opts);
}

/* ── Canvas 2D backend ──────────────────────────── */

class Canvas2DRenderer {
  constructor(canvas, opts) {
    this.kind = "canvas2d";
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = opts?.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    // retained 側の保持 (Canvas 2D では毎フレーム描画するだけなので参照のみ保持)
    this._objects = new Map(); // id → { kind, params }
  }

  setSize(cssWidth, cssHeight) {
    this.canvas.width = cssWidth * this.dpr;
    this.canvas.height = cssHeight * this.dpr;
    this.canvas.style.width = cssWidth + "px";
    this.canvas.style.height = cssHeight + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  beginScene(opts = {}) {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    if (opts.clearColor) {
      ctx.fillStyle = colorToCss(opts.clearColor);
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }

  endScene() {
    // Canvas 2D は submit のたびに即描画している (retained 風 API だが描画は immediate)
    // ここでは特に何もしない。 Pictor backend ではここで flush する。
  }

  submitCircle(id, p) {
    if (id) this._objects.set(id, { kind: "circle", params: p });
    this._drawCircle(p);
  }
  updateCircle(id, p) {
    this._objects.set(id, { kind: "circle", params: p });
    this._drawCircle(p);
  }

  submitLine(id, p) {
    if (id) this._objects.set(id, { kind: "line", params: p });
    this._drawLine(p);
  }
  updateLine(id, p) {
    this._objects.set(id, { kind: "line", params: p });
    this._drawLine(p);
  }

  submitText(id, p) {
    if (id) this._objects.set(id, { kind: "text", params: p });
    this._drawText(p);
  }
  updateText(id, p) {
    this._objects.set(id, { kind: "text", params: p });
    this._drawText(p);
  }

  submitImage(id, p) {
    if (id) this._objects.set(id, { kind: "image", params: p });
    this._drawImage(p);
  }

  submitQuad(id, p) {
    if (id) this._objects.set(id, { kind: "quad", params: p });
    this._drawQuad(p);
  }

  remove(id) {
    this._objects.delete(id);
    // Canvas 2D では消すには再描画が必要 — ゲーム側で beginScene + 残り submit する想定
  }

  clearAll() {
    this._objects.clear();
  }

  /* 内部描画 */
  _drawCircle(p) {
    const ctx = this.ctx;
    ctx.fillStyle = colorToCss(p.color);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  _drawLine(p) {
    const ctx = this.ctx;
    ctx.strokeStyle = colorToCss(p.color);
    ctx.lineWidth = p.w;
    ctx.lineCap = p.cap ?? "round";
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);
    ctx.stroke();
  }
  _drawText(p) {
    const ctx = this.ctx;
    ctx.fillStyle = colorToCss(p.color);
    ctx.font = `${p.size}px ${p.font ?? '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif'}`;
    ctx.textAlign = p.align ?? "center";
    ctx.textBaseline = p.baseline ?? "middle";
    ctx.fillText(p.text, p.x, p.y);
  }
  _drawImage(p) {
    if (!p.source) return;
    this.ctx.drawImage(p.source, p.x, p.y, p.w, p.h);
  }
  _drawQuad(p) {
    const ctx = this.ctx;
    ctx.save();
    if (p.rotate) {
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rotate);
      ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
    }
    ctx.fillStyle = colorToCss(p.color);
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
}

/* ── Pictor backend (skeleton) ──────────────────── */
// 本実装は Pictor 側に C ABI export が整ってから。
// 現状は window.PictorBridge をモックすれば差し込めるよう、 同じ API 表面だけ用意する。
class PictorRenderer {
  constructor(canvas, opts) {
    this.kind = "pictor";
    this.canvas = canvas;
    this.bridge = (typeof window !== "undefined" && window.PictorBridge) ? window.PictorBridge : null;
    this.dpr = opts?.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    if (!this.bridge) throw new Error("PictorBridge not available");
    this.handle = this.bridge.createRenderer(canvas);
    this._objects = new Map();
  }

  setSize(cssWidth, cssHeight) {
    this.canvas.width = cssWidth * this.dpr;
    this.canvas.height = cssHeight * this.dpr;
    this.canvas.style.width = cssWidth + "px";
    this.canvas.style.height = cssHeight + "px";
    this.bridge.setSize?.(this.handle, this.canvas.width, this.canvas.height);
  }

  beginScene(opts = {}) {
    this.bridge.beginScene(this.handle, { clearColor: opts.clearColor ?? 0 });
  }

  endScene() {
    this.bridge.endScene(this.handle);
  }

  submitCircle(id, p) {
    const handle = this._objects.get(id);
    if (handle) this.bridge.updateObject(this.handle, handle, { kind: "circle", ...p });
    else this._objects.set(id, this.bridge.submitObject(this.handle, { kind: "circle", ...p }));
  }
  updateCircle(id, p) { this.submitCircle(id, p); }

  submitLine(id, p) {
    const handle = this._objects.get(id);
    if (handle) this.bridge.updateObject(this.handle, handle, { kind: "line", ...p });
    else this._objects.set(id, this.bridge.submitObject(this.handle, { kind: "line", ...p }));
  }
  updateLine(id, p) { this.submitLine(id, p); }

  submitText(id, p) {
    const handle = this._objects.get(id);
    if (handle) this.bridge.updateObject(this.handle, handle, { kind: "text", ...p });
    else this._objects.set(id, this.bridge.submitObject(this.handle, { kind: "text", ...p }));
  }
  updateText(id, p) { this.submitText(id, p); }

  submitImage(id, p) {
    const handle = this._objects.get(id);
    if (handle) this.bridge.updateObject(this.handle, handle, { kind: "image", ...p });
    else this._objects.set(id, this.bridge.submitObject(this.handle, { kind: "image", ...p }));
  }

  submitQuad(id, p) {
    const handle = this._objects.get(id);
    if (handle) this.bridge.updateObject(this.handle, handle, { kind: "quad", ...p });
    else this._objects.set(id, this.bridge.submitObject(this.handle, { kind: "quad", ...p }));
  }

  remove(id) {
    const handle = this._objects.get(id);
    if (handle) {
      this.bridge.removeObject(this.handle, handle);
      this._objects.delete(id);
    }
  }

  clearAll() {
    for (const handle of this._objects.values()) {
      this.bridge.removeObject(this.handle, handle);
    }
    this._objects.clear();
  }
}

/* ── 共通ヘルパ ─────────────────────────────────── */

function colorToCss(c) {
  if (typeof c === "string") return c;
  // 0xRRGGBBAA を rgba() に
  const a = (c & 0xff) / 255;
  const b = (c >>> 8) & 0xff;
  const g = (c >>> 16) & 0xff;
  const r = (c >>> 24) & 0xff;
  return `rgba(${r},${g},${b},${a})`;
}

/* ── 色定数 (theme.css と整合) ──────────────────── */
export const COLORS = {
  cream:      0xf7f1e8ff,
  ink:        0x2a2118ff,
  inkDim:     0x6b5a48ff,
  uniOrange:  0xff7a3aff,
  uniCoral:   0xf04a2cff,
  uniDeep:    0xb32616ff,
  white:      0xffffffff,
  panel:      0xfffaf1ff,
  ok:         0x3fa66aff,
  warn:       0xd04f2eff,
};
