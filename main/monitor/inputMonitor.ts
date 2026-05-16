import { EventEmitter } from "node:events";

// uiohook-napi は optional dependency。 OS バインディングが入っていないと require が失敗するので
// 遅延 require で吸収し、 失敗時はメトリクスのみ stub 動作させる (renderer 側 UI が壊れない)。
type UioHook = {
  on: (event: string, handler: (e: UioEvent) => void) => void;
  start: () => void;
  stop: () => void;
};
type UioEvent = {
  type: number;
  x?: number;
  y?: number;
  keychar?: number;
  keycode?: number;
};

/**
 * 入力動態の集計メトリクス。 個人データ保管禁止ルール (AIFormat §5) に従い
 * raw stroke (keycode / 座標履歴) は外に出さず、 窓内集計だけ emit する。
 */
export interface InputMetric {
  windowStart: number;  // unix ms
  windowEnd: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  mouseTravelPx: number;
  idleMs: number;       // window 内で 1 秒以上動きがなかった累積
}

const WINDOW_MS = 5000;

export class InputMonitor extends EventEmitter {
  private hook: UioHook | null = null;
  private running = false;
  private bucket = this.empty();
  private flushTimer: NodeJS.Timeout | null = null;
  private lastEventAt = 0;
  private lastMousePos: { x: number; y: number } | null = null;

  start(): { ok: boolean; reason?: string } {
    if (this.running) return { ok: true };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("uiohook-napi") as { uIOhook: UioHook; UiohookKey?: unknown };
      this.hook = mod.uIOhook;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `uiohook-napi unavailable: ${reason}` };
    }

    this.bucket = this.empty();
    this.lastEventAt = Date.now();

    this.hook.on("keydown", () => this.onKey());
    this.hook.on("mousedown", () => this.onClick());
    this.hook.on("mousemove", (e) => this.onMove(e.x ?? 0, e.y ?? 0));
    this.hook.start();

    this.flushTimer = setInterval(() => this.flush(), WINDOW_MS);
    this.running = true;
    return { ok: true };
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      this.hook?.stop();
    } catch {
      // hook が既に死んでいる場合は無視
    }
    this.hook = null;
    this.flush();
  }

  snapshot(): InputMetric {
    return { ...this.bucket, windowEnd: Date.now() };
  }

  private onKey(): void {
    this.touchIdle();
    this.bucket.keyPresses++;
  }

  private onClick(): void {
    this.touchIdle();
    this.bucket.mouseClicks++;
  }

  private onMove(x: number, y: number): void {
    this.touchIdle();
    this.bucket.mouseMoves++;
    if (this.lastMousePos) {
      const dx = x - this.lastMousePos.x;
      const dy = y - this.lastMousePos.y;
      this.bucket.mouseTravelPx += Math.sqrt(dx * dx + dy * dy);
    }
    this.lastMousePos = { x, y };
  }

  private touchIdle(): void {
    const now = Date.now();
    const gap = now - this.lastEventAt;
    if (gap >= 1000) this.bucket.idleMs += gap;
    this.lastEventAt = now;
  }

  private flush(): void {
    const finished: InputMetric = { ...this.bucket, windowEnd: Date.now() };
    this.bucket = this.empty();
    this.emit("metric", finished);
  }

  private empty(): InputMetric {
    return {
      windowStart: Date.now(),
      windowEnd: Date.now(),
      keyPresses: 0,
      mouseClicks: 0,
      mouseMoves: 0,
      mouseTravelPx: 0,
      idleMs: 0,
    };
  }
}
