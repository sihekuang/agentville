import { BrowserWindow, ipcMain, screen } from "electron";
import path from "path";

let pipWindow: BrowserWindow | null = null;

export function setupPip(mainWindow: BrowserWindow, getPort: () => number) {
  ipcMain.on("pip:activate", () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.focus();
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;

    pipWindow = new BrowserWindow({
      width: 400,
      height: 300,
      minWidth: 200,
      minHeight: 150,
      x: screenW - 400 - 20,
      y: screenH - 300 - 20,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      roundedCorners: true,
      parent: mainWindow,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    pipWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    const port = getPort();
    pipWindow.loadURL(`http://127.0.0.1:${port}/pip`);

    pipWindow.once("ready-to-show", () => {
      mainWindow.webContents.send("pip:activated");
    });

    pipWindow.on("closed", () => {
      pipWindow = null;
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pip:deactivated");
      }
    });
  });

  ipcMain.on("pip:deactivate", () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.close();
    }
  });
}

export function closePipWindow() {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.close();
    pipWindow = null;
  }
}
