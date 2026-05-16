// うにのもじ — sample/uni-writing-game の最終仕様 (v11) を scene 形式に最小ポート。
// 文字をなぞるゲーム。 オフキャンバスに glyph をレンダリング → destination-in クリップで
// 「なぞった所だけ濃く現れる」 方式 (v3.5 で確立した方式)。
// PC マウス前提、 「うに」 ループ音 + onstart 同期読み上げ。

import { Scene } from "../../lib/index.js";
import { WORDS } from "./words.js";

const MASK_SIZE = 220;
const BRUSH_RADIUS = 21;
const COVERAGE_FULL = 0.99;
const COVERAGE_LIFTED = 0.90;

export class UniWritingScene extends Scene {
  static id = "uni-writing";
  static label = "✍ うにのもじ";
  static description = "ことばを なぞって おぼえよう";

  init(ctx) {
    this.ctx = ctx;
    this.state = "idle"; // idle | tracing | completing | speaking | done
    this.word = "";
    this.charIndex = 0;
    this.completedInks = []; // 完成した各文字の ImageData
    this.completedMasks = [];
    this.lastWord = null;
    this._setupCanvases();
  }

  enter() {
    this._startNewWord();
  }

  exit() {
    this.ctx.voice.cancel();
    this.ctx.audio.stopUniLoop();
  }

  onResize() {
    // canvas は内部 MASK_SIZE 固定、 リサイズ不要
  }

  _setupCanvases() {
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = MASK_SIZE;
    this.maskCanvas.height = MASK_SIZE;
    this.maskCtx = this.maskCanvas.getContext("2d");

    this.inkCanvas = document.createElement("canvas");
    this.inkCanvas.width = MASK_SIZE;
    this.inkCanvas.height = MASK_SIZE;
    this.inkCtx = this.inkCanvas.getContext("2d");

    this.totalMaskPixels = 0;
  }

  _startNewWord() {
    let w;
    do {
      w = WORDS[Math.floor(Math.random() * WORDS.length)];
    } while (w === this.lastWord && WORDS.length > 1);
    this.word = w;
    this.lastWord = w;
    this.charIndex = 0;
    this.completedInks = [];
    this.completedMasks = [];
    this._prepareChar();
  }

  _prepareChar() {
    if (this.charIndex >= this.word.length) {
      this._wordComplete();
      return;
    }
    const ch = this.word[this.charIndex];

    // mask canvas に文字を描画
    this.maskCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    this.maskCtx.fillStyle = "#2a2118";
    this.maskCtx.font = `bold ${MASK_SIZE * 0.85}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`;
    this.maskCtx.textAlign = "center";
    this.maskCtx.textBaseline = "middle";
    this.maskCtx.fillText(ch, MASK_SIZE / 2, MASK_SIZE / 2);

    // インク用キャンバスをクリア
    this.inkCtx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);

    // 総ピクセル数を計算
    const imageData = this.maskCtx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    let count = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 128) count++;
    }
    this.totalMaskPixels = count;
    this.state = "tracing";
    this.pointer = null;
    this.drawnSomething = false;
  }

  _getCoverage() {
    if (this.totalMaskPixels === 0) return 0;
    const imageData = this.inkCtx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    let count = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 128) count++;
    }
    return count / this.totalMaskPixels;
  }

  _paintAt(canvasX, canvasY) {
    // canvas 座標 → mask 座標
    const mp = this._toMaskCoord(canvasX, canvasY);
    if (!mp) return;
    if (!this.pointer) {
      this.pointer = mp;
    } else {
      // 線分でつなげる
      this.inkCtx.strokeStyle = "#2a2118";
      this.inkCtx.lineWidth = BRUSH_RADIUS * 2;
      this.inkCtx.lineCap = "round";
      this.inkCtx.beginPath();
      this.inkCtx.moveTo(this.pointer.x, this.pointer.y);
      this.inkCtx.lineTo(mp.x, mp.y);
      this.inkCtx.stroke();

      // mask でクリップ
      this.inkCtx.globalCompositeOperation = "destination-in";
      this.inkCtx.drawImage(this.maskCanvas, 0, 0);
      this.inkCtx.globalCompositeOperation = "source-over";
    }
    this.pointer = mp;
    this.drawnSomething = true;
  }

  _toMaskCoord(canvasX, canvasY) {
    const layout = this._getCharLayout();
    if (!layout) return null;
    const localX = canvasX - layout.x;
    const localY = canvasY - layout.y;
    if (localX < 0 || localY < 0 || localX > layout.size || localY > layout.size) return null;
    return {
      x: (localX / layout.size) * MASK_SIZE,
      y: (localY / layout.size) * MASK_SIZE,
    };
  }

  _getCharLayout() {
    const { width, height } = this.ctx.viewport;
    const size = Math.min(width * 0.45, height * 0.55);
    return {
      x: width / 2 - size / 2,
      y: height * 0.55 - size / 2,
      size,
    };
  }

  _completeChar() {
    // インクと mask をコピーして保存
    const inkCopy = document.createElement("canvas");
    inkCopy.width = MASK_SIZE; inkCopy.height = MASK_SIZE;
    inkCopy.getContext("2d").drawImage(this.inkCanvas, 0, 0);
    this.completedInks.push(inkCopy);

    const maskCopy = document.createElement("canvas");
    maskCopy.width = MASK_SIZE; maskCopy.height = MASK_SIZE;
    maskCopy.getContext("2d").drawImage(this.maskCanvas, 0, 0);
    this.completedMasks.push(maskCopy);

    this.ctx.audio.stopUniLoop();
    this.ctx.audio.playCorrect();
    this.charIndex++;
    this._prepareChar();
  }

  _wordComplete() {
    this.state = "speaking";
    this.ctx.voice.speak(this.word, {
      onComplete: () => {
        this.state = "done";
      },
    });
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;

    // tracing 中の coverage チェック (0.4 s ごと)
    if (this.state === "tracing" && this.drawnSomething) {
      if (!this._lastCoverageCheck || now - this._lastCoverageCheck > 400) {
        this._lastCoverageCheck = now;
        const c = this._getCoverage();
        if (c >= COVERAGE_FULL) this._completeChar();
      }
    }

    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    // 単語表示 (画面上)
    renderer.submitText("word", { x: viewport.width / 2, y: 80, text: this.word, size: 36, color: 0x2a2118ff });

    if (this.state === "tracing") {
      this._drawTracing(renderer, viewport);
      // 進捗
      renderer.submitText("prog", { x: viewport.width / 2, y: 110, text: `${this.charIndex + 1} / ${this.word.length}`, size: 14, color: 0x6b5a48ff });
    } else if (this.state === "speaking") {
      this._drawBigWord(renderer, viewport, now);
    } else if (this.state === "done") {
      this._drawBigWord(renderer, viewport, now);
      renderer.submitText("next", { x: viewport.width / 2, y: viewport.height - 40, text: "クリックで つぎへ", size: 18, color: 0xff7a3aff });
    }

    renderer.endScene();
  }

  _drawTracing(renderer, viewport) {
    // canvas を直接合成するため、 render 抽象 API では難しい。
    // ここでは Canvas 2D backend に直アクセスする (回避策)。
    // → 抽象 API に submitImage が必要だが、 Pictor backend ではまた対応が必要。
    const canvas2d = renderer.ctx; // Canvas2DRenderer 限定
    if (!canvas2d) return;

    const layout = this._getCharLayout();
    // ゴースト
    canvas2d.save();
    canvas2d.globalAlpha = 0.10;
    canvas2d.drawImage(this.maskCanvas, layout.x, layout.y, layout.size, layout.size);
    canvas2d.globalAlpha = 1;
    // インク
    canvas2d.drawImage(this.inkCanvas, layout.x, layout.y, layout.size, layout.size);
    canvas2d.restore();
  }

  _drawBigWord(renderer, viewport, now) {
    const canvas2d = renderer.ctx;
    if (!canvas2d) return;

    const word = this.word;
    const wordLen = this.completedInks.length;
    if (wordLen === 0) return;

    const sidePad = viewport.width * 0.08;
    const slotByWidth = (viewport.width - sidePad * 2) / wordLen;
    const slotByHeight = viewport.height * 0.55;
    const size = Math.min(slotByWidth, slotByHeight) * 0.96;
    const y = viewport.height * 0.52;
    const totalW = size * wordLen;
    const startX = viewport.width / 2 - totalW / 2;

    for (let i = 0; i < wordLen; i++) {
      const x = startX + i * size;
      canvas2d.save();
      canvas2d.globalAlpha = 0.08;
      canvas2d.drawImage(this.completedMasks[i], x, y - size / 2, size, size);
      canvas2d.globalAlpha = 1;
      canvas2d.drawImage(this.completedInks[i], x, y - size / 2, size, size);
      canvas2d.restore();
    }
  }

  onPointer(kind, ev) {
    if (this.state === "done") {
      if (kind === "down") {
        this._startNewWord();
      }
      return;
    }

    if (this.state !== "tracing") return;

    if (kind === "down") {
      this.pointer = null;
      this._paintAt(ev.x, ev.y);
      this.ctx.audio.startUniLoop();
    } else if (kind === "move" && this.pointer != null) {
      // pointer がある = まだ離されてない
      this._paintAt(ev.x, ev.y);
    } else if (kind === "up") {
      this.ctx.audio.stopUniLoop();
      const c = this._getCoverage();
      if (c >= COVERAGE_LIFTED && this.drawnSomething) {
        this._completeChar();
      } else {
        this.pointer = null;
      }
    }
  }
}
