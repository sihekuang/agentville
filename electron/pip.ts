import { BrowserWindow, ipcMain, screen } from "electron";
import path from "path";

const IPC = {
  PIP_ACTIVATE: "pip:activate",
  PIP_DEACTIVATE: "pip:deactivate",
  PIP_FOCUS_MAIN: "pip:focus-main",
  PIP_ACTIVATED: "pip:activated",
  PIP_DEACTIVATED: "pip:deactivated",
} as const;

const PIP_WIDTH = 400;
const PIP_HEIGHT = 300;
const PIP_MIN_WIDTH = 200;
const PIP_MIN_HEIGHT = 150;
const PIP_OFFSET = 20;
const PIP_ROUTE = "/pip";

let pipWindow: BrowserWindow | null = null;

export interface PipSetupOptions {
  getMainWindow: () => BrowserWindow | null;
  ensureMainWindow: () => BrowserWindow;
  getPort: () => number;
}

export function setupPip({ getMainWindow, ensureMainWindow, getPort }: PipSetupOptions) {
  ipcMain.on(IPC.PIP_ACTIVATE, () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.focus();
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;

    pipWindow = new BrowserWindow({
      width: PIP_WIDTH,
      height: PIP_HEIGHT,
      minWidth: PIP_MIN_WIDTH,
      minHeight: PIP_MIN_HEIGHT,
      x: screenW - PIP_WIDTH - PIP_OFFSET,
      y: screenH - PIP_HEIGHT - PIP_OFFSET,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      roundedCorners: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    pipWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    pipWindow.setAlwaysOnTop(true, "floating");

    const port = getPort();
    pipWindow.loadURL(`http://127.0.0.1:${port}${PIP_ROUTE}`);

    pipWindow.once("ready-to-show", () => {
      const main = getMainWindow();
      if (main && !main.isDestroyed()) {
        main.webContents.send(IPC.PIP_ACTIVATED);
      }
    });

    pipWindow.on("closed", () => {
      pipWindow = null;
      const main = getMainWindow();
      if (main && !main.isDestroyed()) {
        main.webContents.send(IPC.PIP_DEACTIVATED);
      }
    });
  });

  ipcMain.on(IPC.PIP_FOCUS_MAIN, () => {
    const main = getMainWindow();
    if (main && !main.isDestroyed()) {
      main.show();
      main.focus();
    } else {
      const newMain = ensureMainWindow();
      newMain.once("ready-to-show", () => {
        newMain.show();
        newMain.focus();
      });
    }
  });

  ipcMain.on(IPC.PIP_DEACTIVATE, () => {
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
