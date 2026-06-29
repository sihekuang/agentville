import { contextBridge, ipcRenderer } from "electron";

// IPC channel names — keep in sync with src/lib/pip-types.ts IPC constants.
// Can't import directly (preload runs in a separate Node context).
const IPC = {
  PIP_ACTIVATE: "pip:activate",
  PIP_DEACTIVATE: "pip:deactivate",
  PIP_FOCUS_MAIN: "pip:focus-main",
  PIP_ACTIVATED: "pip:activated",
  PIP_DEACTIVATED: "pip:deactivated",
  PIP_RESIZE: "pip:resize",
  PIP_CURSOR_BEYOND: "pip:cursor-beyond",
  PIP_BLUR: "pip:blur",
} as const;

contextBridge.exposeInMainWorld("electronAPI", {
  pipActivate: () => ipcRenderer.send(IPC.PIP_ACTIVATE),
  pipDeactivate: () => ipcRenderer.send(IPC.PIP_DEACTIVATE),
  pipFocusMain: () => ipcRenderer.send(IPC.PIP_FOCUS_MAIN),
  pipResize: (width: number, height: number) =>
    ipcRenderer.send(IPC.PIP_RESIZE, { width, height }),
  pipCursorBeyond: (outset: number) => ipcRenderer.invoke(IPC.PIP_CURSOR_BEYOND, outset),
  onPipActivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.PIP_ACTIVATED, handler);
    return () => { ipcRenderer.removeListener(IPC.PIP_ACTIVATED, handler); };
  },
  onPipDeactivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.PIP_DEACTIVATED, handler);
    return () => { ipcRenderer.removeListener(IPC.PIP_DEACTIVATED, handler); };
  },
  onPipBlur: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC.PIP_BLUR, handler);
    return () => { ipcRenderer.removeListener(IPC.PIP_BLUR, handler); };
  },
});
