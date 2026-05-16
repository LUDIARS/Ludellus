// モバイル / iframe 環境で親ウィンドウが勝手にスクロールするのを抑止する。
// CSS の touch-action: none は theme.css に既定で入っているが、 iOS Safari では
// JS 側で passive: false の preventDefault を併用しないと完全には止まらない。

let installed = false;

function shouldAllow(target) {
  if (!(target instanceof Element)) return false;
  // ボタン・入力欄はネイティブクリック合成を壊さないようイベントを通す
  return !!target.closest("button, input, select, textarea, [data-ludellus-allow-touch]");
}

/**
 * touch スクロール抑止を有効化する。 アプリ起動時に 1 回だけ呼ぶ。
 * 重複呼び出しは無害。
 */
export function installTouchGuard() {
  if (installed) return;
  installed = true;
  if (typeof document === "undefined") return;

  document.addEventListener("touchmove", (e) => {
    if (!shouldAllow(e.target)) e.preventDefault();
  }, { passive: false });

  document.addEventListener("touchstart", (e) => {
    if (!shouldAllow(e.target)) e.preventDefault();
  }, { passive: false });
}

/**
 * 既存の DOM 要素に強制的に touch-action: none を当てる。
 * CSS が読み込まれていない iframe 等で使う緊急用。
 */
export function applyTouchAction(el) {
  if (!el || !el.style) return;
  el.style.touchAction = "none";
  el.style.overscrollBehavior = "none";
  el.style.webkitUserSelect = "none";
  el.style.userSelect = "none";
}

/**
 * 画面方向取得 (game 側で縦/横レイアウト切替に使う)。
 */
export function getOrientation() {
  if (typeof window === "undefined") return "landscape";
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}
