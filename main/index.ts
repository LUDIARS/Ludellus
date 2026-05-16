import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { InputMonitor } from "./monitor/inputMonitor";
import { MockupRegistry } from "./mockups/registry";

const monitor = new InputMonitor();
const registry = new MockupRegistry(join(app.getAppPath(), "renderer", "mockups"));

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(join(app.getAppPath(), "renderer", "index.html"));

  monitor.on("metric", (m) => {
    mainWindow?.webContents.send("input:metric", m);
  });
}

ipcMain.handle("mockups:list", async () => registry.list());
ipcMain.handle("monitor:start", async () => monitor.start());
ipcMain.handle("monitor:stop", async () => monitor.stop());
ipcMain.handle("monitor:snapshot", async () => monitor.snapshot());

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  monitor.stop();
  if (process.platform !== "darwin") app.quit();
});
