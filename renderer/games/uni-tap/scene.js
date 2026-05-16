// うにタップ — メインのうにと背景うに 3 体を配置し、 クリック/タップで burst (2 アクション同時実行)。
// foundation の uni-character + sound + voice を一通り使うミニデモ。

import { Scene, createMainUni, createBackgroundTrio } from "../../lib/index.js";

export class UniTapScene extends Scene {
  static id = "uni-tap";
  static label = "🐙 うにタップ";
  static description = "うにを クリックすると ぴょこんと はねるよ";

  init(ctx) {
    this.ctx = ctx;
    this.mainUni = null;
    this.bgUnis = [];
    this.taps = 0;
    this._buildUnis();
  }

  _buildUnis() {
    const { width, height } = this.ctx.viewport;
    this.mainUni = createMainUni(width, height, { radius: Math.min(width, height) * 0.12 });
    this.bgUnis = createBackgroundTrio(width, height);
  }

  onResize() {
    if (!this.ctx) return;
    this._buildUnis();
  }

  enter() {
    this.ctx.showToast("うにを タップしてね");
  }

  exit() {
    this.ctx.audio.stopUniLoop();
    this.ctx.voice.cancel();
  }

  frame(dt, now) {
    const { renderer, viewport } = this.ctx;
    renderer.beginScene({ clearColor: 0xf7f1e8ff });

    this.mainUni.update(dt, now);
    this.mainUni.drawAbstract(renderer, "main");

    for (let i = 0; i < this.bgUnis.length; i++) {
      this.bgUnis[i].update(dt, now);
      this.bgUnis[i].drawAbstract(renderer, `bg${i}`);
    }

    renderer.submitText("score", {
      x: viewport.width / 2,
      y: viewport.height - 40,
      text: `タップ: ${this.taps}`,
      size: 22,
      color: 0x6b5a48ff,
    });

    renderer.endScene();
  }

  // 旧 drawUni ローカル関数は削除。 foundation の uni.drawAbstract に統合済み。

  onPointer(kind, ev) {
    if (kind !== "down") return;
    const now = performance.now();
    let hit = false;

    if (this.mainUni.hitTest(ev.x, ev.y)) {
      this.mainUni.triggerActions(now);
      hit = true;
    }
    for (const u of this.bgUnis) {
      if (u.hitTest(ev.x, ev.y)) {
        u.triggerActions(now);
        hit = true;
      }
    }

    if (hit) {
      this.taps++;
      this.ctx.audio.playCorrect();
      // 10 回タップごとに記録 (デモなので軽く)
      if (this.taps % 10 === 0) {
        this.ctx.scoreApi.saveScore("uni-tap", "default", this.taps, this.taps);
        this.ctx.voice.speak("うに うに");
      }
    }
  }
}

