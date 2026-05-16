import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";

export interface InputMetric {
  windowStart: number;
  windowEnd: number;
  keyPresses: number;
  mouseClicks: number;
  mouseMoves: number;
  mouseTravelPx: number;
  idleMs: number;
}

export interface MockupManifest {
  id: string;
  title: string;
  description?: string;
  entry: string;
  tags?: string[];
}

contextBridge.exposeInMainWorld("ludellus", {
  listMockups: (): Promise<MockupManifest[]> => ipcRenderer.invoke("mockups:list"),
  startMonitor: (): Promise<{ ok: boolean; reason?: string }> => ipcRenderer.invoke("monitor:start"),
  stopMonitor: (): Promise<void> => ipcRenderer.invoke("monitor:stop"),
  snapshotMonitor: (): Promise<InputMetric> => ipcRenderer.invoke("monitor:snapshot"),
  onMetric: (cb: (m: InputMetric) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, m: InputMetric) => cb(m);
    ipcRenderer.on("input:metric", handler);
    return () => ipcRenderer.removeListener("input:metric", handler);
  },
});
