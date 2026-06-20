import { BrowserWindow, ipcMain, screen } from "electron";
import path from "path";
import { computeResizedBounds, isCursorBeyond } from "./pip-bounds";

const IPC = {
  PIP_ACTIVATE: "pip:activate",
  PIP_DEACTIVATE: "pip:deactivate",
  PIP_FOCUS_MAIN: "pip:focus-main",
  PIP_ACTIVATED: "pip:activated",
  PIP_DEACTIVATED: "pip:deactivated",
  PIP_RESIZE: "pip:resize",
  PIP_CURSOR_BEYOND: "pip:cursor-beyond",
} as const;

const PIP_WIDTH = 400;
const PIP_HEIGHT = 300;
const PIP_MIN_WIDTH = 200;
const PIP_MIN_HEIGHT = 150;
const PIP_OFFSET = 20;
const PIP_ROUTE = "/pip";
// While the user is dragging the window, a title-bar drag fires `pointerleave`
// (starting the collapse watch) and the live cursor outruns the lagging window
// bounds — so a poll can read the cursor as "beyond" and collapse mid-drag. The
// cursor is on the window by definition during a drag, so suppress collapse for a
// short settle window after any move.
const PIP_MOVE_SETTLE_MS = 250;

// Flag-gated diagnostics — launch with `PIP_DEBUG=1` to enable (see src/lib/pip-debug.ts).
const PIP_DEBUG = process.env.PIP_DEBUG === "1";
function pipLog(...args: unknown[]) {
  if (PIP_DEBUG) console.log("[pip]", ...args);
}

let pipWindow: BrowserWindow | null = null;
let lastMoveAt = 0;

export interface PipSetupOptions {
  getMainWindow: () => BrowserWindow | null;
  ensureMainWindow: () => BrowserWindow;
  getPort: () => number;
}

export function setupPip({ getMainWindow, ensureMainWindow, getPort }: PipSetupOptions) {
  ipcMain.on(IPC.PIP_ACTIVATE, () => {
    pipLog("PIP_ACTIVATE received");
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

    // Record window movement so the cursor-beyond query can suppress collapse
    // while the user is dragging (see PIP_MOVE_SETTLE_MS).
    pipWindow.on("move", () => {
      lastMoveAt = Date.now();
    });

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

  ipcMain.on(IPC.PIP_RESIZE, (_e, payload: { width: number; height: number }) => {
    pipLog("PIP_RESIZE received:", JSON.stringify(payload), "live?", !!pipWindow && !pipWindow.isDestroyed());
    if (!pipWindow || pipWindow.isDestroyed()) return;
    const current = pipWindow.getBounds();
    const { workArea } = screen.getDisplayMatching(current);
    const next = computeResizedBounds(current, payload.width, payload.height, workArea);
    pipLog("resize", JSON.stringify(current), "→", JSON.stringify(next));
    pipWindow.setBounds(next);
  });

  ipcMain.handle(IPC.PIP_CURSOR_BEYOND, (_e, outset: number): boolean => {
    if (!pipWindow || pipWindow.isDestroyed()) return true; // gone → allow collapse
    const cursor = screen.getCursorScreenPoint();
    const bounds = pipWindow.getBounds();
    // The window is on the cursor during a drag; never collapse mid-drag.
    const movingRecently = Date.now() - lastMoveAt < PIP_MOVE_SETTLE_MS;
    const beyond = !movingRecently && isCursorBeyond(cursor, bounds, outset);
    pipLog(
      "cursor-beyond?",
      "cursor", JSON.stringify(cursor),
      "bounds", JSON.stringify(bounds),
      "outset", outset,
      "moving", movingRecently,
      "→", beyond,
    );
    return beyond;
  });
}

export function closePipWindow() {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.close();
    pipWindow = null;
  }
}
