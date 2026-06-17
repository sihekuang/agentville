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
} as const;

contextBridge.exposeInMainWorld("electronAPI", {
  pipActivate: () => ipcRenderer.send(IPC.PIP_ACTIVATE),
  pipDeactivate: () => ipcRenderer.send(IPC.PIP_DEACTIVATE),
  pipFocusMain: () => ipcRenderer.send(IPC.PIP_FOCUS_MAIN),
  pipResize: (width: number, height: number) =>
    ipcRenderer.send(IPC.PIP_RESIZE, { width, height }),
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
});
