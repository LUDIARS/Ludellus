// SpeechSynthesis (ja-JP) のラッパ。 uni-math v10 / uni-writing-game v8 で確立した
// 「onstart で開始、onboundary 優先、 fallback タイマー、 最大タイムアウト」 パターン。

const DEFAULT_LANG = "ja-JP";
const DEFAULT_RATE = 0.95;
const DEFAULT_PITCH = 1.15;
const FALLBACK_PER_CHAR_MS = 280;
const HARD_TIMEOUT_BASE_MS = 1500;
const HARD_TIMEOUT_PER_CHAR_MS = 600;
const BOUNDARY_GRACE_MS = 100;

let activeUtterance = null;
let activeTimers = [];

function clearTimers() {
  for (const t of activeTimers) clearTimeout(t);
  activeTimers = [];
}

export function isAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * 単語を読み上げる。 ハイライト同期コールバックも提供する。
 *
 * @param {string} text
 * @param {object} [opts]
 * @param {(charIndex: number) => void} [opts.onChar]
 *   現在読み上げ中の文字 index を通知。 onboundary が来ればそれ、 来なければ等分タイマー。
 * @param {() => void} [opts.onStart]
 *   実際に音声が再生開始した瞬間。
 * @param {() => void} [opts.onComplete]
 *   読み上げが完了 or 中断された時。 必ず 1 回呼ばれる。
 * @param {number} [opts.rate=0.95]
 * @param {number} [opts.pitch=1.15]
 * @returns {() => void} 中断用キャンセラ。 中断時も onComplete は呼ばれる。
 */
export function speak(text, opts = {}) {
  if (!isAvailable() || !text) {
    setTimeout(() => opts.onComplete?.(), 0);
    return () => {};
  }

  cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = DEFAULT_LANG;
  utter.rate = opts.rate ?? DEFAULT_RATE;
  utter.pitch = opts.pitch ?? DEFAULT_PITCH;

  let boundaryFired = false;
  let completed = false;

  const complete = () => {
    if (completed) return;
    completed = true;
    clearTimers();
    if (activeUtterance === utter) activeUtterance = null;
    opts.onComplete?.();
  };

  utter.onstart = () => {
    opts.onStart?.();
    if (opts.onChar) opts.onChar(0);

    // boundary が来なかった場合のフォールバック (onstart から少し待つ)
    activeTimers.push(setTimeout(() => {
      if (boundaryFired || completed) return;
      // 等分タイマー方式
      for (let i = 1; i < text.length; i++) {
        activeTimers.push(setTimeout(() => {
          if (!completed) opts.onChar?.(i);
        }, FALLBACK_PER_CHAR_MS * i));
      }
    }, BOUNDARY_GRACE_MS));
  };

  utter.onboundary = (ev) => {
    if (!opts.onChar) return;
    if (typeof ev.charIndex !== "number") return;
    if (!boundaryFired) {
      boundaryFired = true;
      // fallback タイマーを止める
      clearTimers();
    }
    opts.onChar(ev.charIndex);
  };

  utter.onend = complete;
  utter.onerror = complete;

  // 壊れた環境向け最大タイムアウト
  activeTimers.push(setTimeout(complete, HARD_TIMEOUT_BASE_MS + HARD_TIMEOUT_PER_CHAR_MS * text.length));

  activeUtterance = utter;
  window.speechSynthesis.speak(utter);

  return complete;
}

/**
 * 現在の読み上げを中断する。
 */
export function cancel() {
  clearTimers();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try { window.speechSynthesis.cancel(); } catch {}
  activeUtterance = null;
}

/**
 * 「ピンポンピンポン」 等の擬音を Promise で読み上げる (キューに乗せる)。
 */
export function speakSequence(items) {
  return items.reduce((prev, item) => {
    return prev.then(() => new Promise((resolve) => {
      speak(item.text, { ...item, onComplete: resolve });
    }));
  }, Promise.resolve());
}
