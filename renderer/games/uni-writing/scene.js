// うにのもじ (iframe 版) — sample/uni-writing-game.html を 100% 忠実に埋め込む。
// scene framework の役割は「chip 切替で出し入れする」 だけで、 中身は sample 原本そのまま。

import { Scene } from "../../lib/index.js";

export class UniWritingScene extends Scene {
  static id = "uni-writing";
  static label = "✍ うにのもじ";
  static description = "ことばを なぞって おぼえよう";

  init(ctx) {
    this.ctx = ctx;
    this.iframe = null;
  }

  enter() {
    const wrap = this.ctx.canvas.parentElement;
    this.iframe = document.createElement("iframe");
    // 原本を games/uni-writing/index.html に移植済 (sample/ は引き続きリファレンスとして温存)
    this.iframe.src = "games/uni-writing/index.html";
    this.iframe.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "border:none",
      "background:#f7f1e8",
    ].join(";");
    this.iframe.setAttribute("title", "うにのもじ");
    wrap.appendChild(this.iframe);
    this.ctx.canvas.style.visibility = "hidden";
  }

  exit() {
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.ctx.canvas.style.visibility = "visible";
  }

  frame() {}
  onPointer() {}
  onKey() {}
}
