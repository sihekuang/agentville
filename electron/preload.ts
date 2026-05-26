import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  pipActivate: () => ipcRenderer.send("pip:activate"),
  pipDeactivate: () => ipcRenderer.send("pip:deactivate"),
  pipFocusMain: () => ipcRenderer.send("pip:focus-main"),
  onPipActivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("pip:activated", handler);
    return () => { ipcRenderer.removeListener("pip:activated", handler); };
  },
  onPipDeactivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("pip:deactivated", handler);
    return () => { ipcRenderer.removeListener("pip:deactivated", handler); };
  },
});
