import type { HostApp } from "../types";

export interface WindowInfo {
  title: string;
  index: number;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface FocusResult {
  success: boolean;
  windowTitle?: string;
}

export interface HighlightOptions {
  color?: string;
  borderWidth?: number;
  durationMs?: number;
}

export interface PlatformStrategy {
  /** Focus a specific window of the host app, matching by project/cwd name */
  focusWindow(hostApp: HostApp, projectHint?: string, agentPid?: number): FocusResult;

  /** List all windows for a given application */
  listWindows(appName: string): WindowInfo[];

  /** Get bounds of a specific window */
  getWindowBounds(appName: string, windowTitle: string): WindowInfo | null;

  /** Show a highlight border overlay around a window */
  highlightWindow(
    bounds: { x: number; y: number; width: number; height: number },
    options?: HighlightOptions
  ): void;

  /** Get parent process chain for a PID */
  getParentPids(pid: number): number[];

  /** Get process name/path for a PID */
  getProcessName(pid: number): string | null;

  /** Open a directory in the system file manager */
  openDirectory(dirPath: string): { success: boolean };
}
