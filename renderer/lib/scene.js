// Ludellus Scene インターフェース。 ゲーム 1 つ = 1 つの Scene。
// shell が永続的に持つ foundation サービス (renderer / audio / voice / score) を共有しつつ、
// scene を切り替えるだけでゲームを遷移する。 これにより、 AudioContext / SpeechSynthesis や
// うにキャラクターの canvas は **作り直さず** に再利用できる ([[project-ludellus]] の「軽量」 方針)。
//
// PC 専用 (マウス + キーボード) を前提に設計。 タッチも入るが multi-touch 等の特殊対応はしない。

/**
 * @typedef {object} SceneContext
 *   shell が scene に渡す共有サービス一式。
 * @property {import("./render.js").default} renderer
 *   foundation の抽象 renderer (Canvas 2D / Pictor 自動切替)
 * @property {HTMLCanvasElement} canvas
 * @property {{ width: number, height: number }} viewport
 *   論理 px (devicePixelRatio で割った後の値)。 resize 時に更新される
 * @property {object} scoreApi
 *   { getBestScore, saveScore, hasAttainedFullScore } へのバインド
 * @property {object} audio
 *   { playCorrect, playWrong, playTimeout, playTick, startUniLoop, stopUniLoop, unlock }
 * @property {object} voice
 *   { speak, cancel }
 * @property {(toast: string) => void} showToast
 */

/**
 * Scene の基底クラス。 ゲームは継承して必要な lifecycle を override する。
 * すべて任意 — override しなければデフォルト no-op。
 */
export class Scene {
  /** @type {string} 一意 id (registry のキー) */
  static id = "abstract-scene";
  /** @type {string} 切替 chip に表示するラベル */
  static label = "Scene";
  /** @type {string} 短い説明 (ヒント) */
  static description = "";

  /**
   * shell が scene を生成するときに 1 回呼ぶ。 リソース確保はここで。
   * @param {SceneContext} ctx
   */
  init(ctx) {}

  /**
   * scene 切替で active になる瞬間に呼ぶ。 描画開始 / 入力受付開始。
   */
  enter() {}

  /**
   * 毎フレーム呼ぶ (active のときのみ)。 ctx.renderer.beginScene 〜 endScene を scene 内で完結させる。
   * @param {number} dt    秒
   * @param {number} now   performance.now() の ms
   */
  frame(dt, now) {}

  /**
   * scene 切替で非 active になる瞬間に呼ぶ。 進行中の音声 / 効果音は止める。
   */
  exit() {}

  /**
   * shell が scene を完全に破棄する時に呼ぶ。 タイマー解放等。
   */
  dispose() {}

  /**
   * ポインタイベント (mousedown / mouseup / mousemove)。 active のときだけ呼ばれる。
   * @param {"down"|"up"|"move"} kind
   * @param {{ x: number, y: number, button?: number }} ev   論理 px の canvas 座標
   */
  onPointer(kind, ev) {}

  /**
   * キーイベント (active のときだけ)。
   * @param {"down"|"up"} kind
   * @param {KeyboardEvent} ev
   */
  onKey(kind, ev) {}

  /**
   * viewport がリサイズした時 (DPR 変化 / window resize)。 ctx.viewport は既に更新済み。
   */
  onResize() {}
}
