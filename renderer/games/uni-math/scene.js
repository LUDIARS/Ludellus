// うにけいさん (iframe 版) — sample/uni-math.html を 100% 忠実に埋め込む。
// scene framework の役割は「chip 切替で出し入れする」 だけで、 中身は sample 原本そのまま。
// AudioContext / SpeechSynthesis は iframe 内で独立 (shell の共有サービスとは別系統)。

import { Scene } from "../../lib/index.js";

export class UniMathScene extends Scene {
  static id = "uni-math";
  static label = "🧮 うにけいさん";
  static description = "10 もん といて けいさんを おぼえよう";

  init(ctx) {
    this.ctx = ctx;
    this.iframe = null;
  }

  enter() {
    const wrap = this.ctx.canvas.parentElement;
    this.iframe = document.createElement("iframe");
    // serve root が project root の前提。 renderer/shell.html から見て ../sample/...
    this.iframe.src = "../sample/uni-math.html";
    this.iframe.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "border:none",
      "background:#f7f1e8",
    ].join(";");
    this.iframe.setAttribute("title", "うにけいさん");
    wrap.appendChild(this.iframe);
    this.ctx.canvas.style.visibility = "hidden";
  }

  exit() {
    if (this.iframe) {
      // iframe 内の document が破棄されるので AudioContext / SpeechSynthesis も自動的に止まる
      this.iframe.remove();
      this.iframe = null;
    }
    this.ctx.canvas.style.visibility = "visible";
  }

  frame() { /* iframe が自前で描画する */ }
  onPointer() { /* iframe が自前で受ける */ }
  onKey() { /* 同上 */ }
}
