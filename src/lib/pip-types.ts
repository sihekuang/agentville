export const PIP_CONFIG = {
  WIDTH: 400,
  HEIGHT: 300,
  MIN_WIDTH: 200,
  MIN_HEIGHT: 150,
  OFFSET: 20,
  REDOCK_DELAY_MS: 300,
  PIP_ROUTE: "/pip",
} as const;

export const IPC = {
  PIP_ACTIVATE: "pip:activate",
  PIP_DEACTIVATE: "pip:deactivate",
  PIP_FOCUS_MAIN: "pip:focus-main",
  PIP_ACTIVATED: "pip:activated",
  PIP_DEACTIVATED: "pip:deactivated",
  PIP_RESIZE: "pip:resize",
  PIP_CURSOR_BEYOND: "pip:cursor-beyond",
} as const;

export interface ElectronPipAPI {
  pipActivate: () => void;
  pipDeactivate: () => void;
  pipFocusMain: () => void;
  pipResize: (width: number, height: number) => void;
  pipCursorBeyond: (outset: number) => Promise<boolean>;
  onPipActivated: (callback: () => void) => () => void;
  onPipDeactivated: (callback: () => void) => () => void;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}

export function getElectronAPI(): ElectronPipAPI | null {
  if (!isElectron()) return null;
  const api = (window as any).electronAPI;
  if (typeof api?.pipActivate !== "function") return null;
  return api as ElectronPipAPI;
}

export type PipBackend = "electron" | "browser";
