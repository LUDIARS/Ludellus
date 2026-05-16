// Scene 管理層。 shell が 1 個だけインスタンス化する。
// scene を id で切り替え、 lifecycle を順序通りに呼ぶ。 切替時のフェード演出は scene の責務外
// (shell の CSS overlay で覆って消す程度で十分)。

import { Scene } from "./scene.js";

export class SceneManager {
  /**
   * @param {object} ctx   Scene に渡す共有 context
   */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Map<string, Scene>} */
    this.scenes = new Map();
    /** @type {Scene|null} */
    this.active = null;
    /** @type {string|null} */
    this.activeId = null;
    /** @type {Set<(id: string|null) => void>} */
    this._listeners = new Set();
  }

  /**
   * Scene のクラスを登録する。 まだインスタンス化はしない (遅延 init)。
   * @param {typeof Scene} SceneClass
   */
  register(SceneClass) {
    if (!SceneClass.id) throw new Error("Scene must have static id");
    this.scenes.set(SceneClass.id, { SceneClass, instance: null });
  }

  list() {
    return Array.from(this.scenes.entries()).map(([id, { SceneClass }]) => ({
      id,
      label: SceneClass.label ?? id,
      description: SceneClass.description ?? "",
    }));
  }

  /**
   * 指定 id の scene に切り替える。 既に active なら no-op。
   * 切替時: 旧 scene.exit() → 新 scene.init() (初回のみ) → 新 scene.enter()
   * @param {string} id
   */
  async switchTo(id) {
    if (this.activeId === id) return;
    const entry = this.scenes.get(id);
    if (!entry) {
      // eslint-disable-next-line no-console
      console.warn(`[scene-manager] unknown scene: ${id}`);
      return;
    }

    // 旧 scene を exit
    if (this.active) {
      try { this.active.exit(); } catch (e) { console.error(e); }
    }

    // 新 scene を取得 (初回ならインスタンス化 + init)
    if (!entry.instance) {
      entry.instance = new entry.SceneClass();
      try { entry.instance.init(this.ctx); } catch (e) { console.error(e); }
    }

    this.active = entry.instance;
    this.activeId = id;

    try { this.active.enter(); } catch (e) { console.error(e); }
    this._notify();
  }

  /**
   * メインループから毎フレーム呼ぶ。 active scene の frame() を回す。
   */
  frame(dt, now) {
    if (!this.active) return;
    try { this.active.frame(dt, now); } catch (e) { console.error(e); }
  }

  /**
   * ポインタイベントを active scene に配送。
   */
  pointer(kind, ev) {
    if (this.active) this.active.onPointer(kind, ev);
  }

  /**
   * キーイベント。
   */
  key(kind, ev) {
    if (this.active) this.active.onKey(kind, ev);
  }

  /**
   * リサイズ。 全 instance に通知 (非 active も viewport は最新であるべきなので)。
   */
  resize() {
    for (const entry of this.scenes.values()) {
      if (entry.instance) {
        try { entry.instance.onResize(); } catch (e) { console.error(e); }
      }
    }
  }

  /**
   * shell 終了時のクリーンアップ。 全 instance を dispose。
   */
  disposeAll() {
    for (const entry of this.scenes.values()) {
      if (entry.instance) {
        try { entry.instance.dispose(); } catch (e) { console.error(e); }
        entry.instance = null;
      }
    }
    this.active = null;
    this.activeId = null;
    this._notify();
  }

  /**
   * scene 切替時に通知を受け取りたい side bar 等が登録する。
   * @param {(id: string|null) => void} cb
   * @returns {() => void} 解除関数
   */
  onChange(cb) {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.activeId); } catch (e) { console.error(e); }
    }
  }
}
