import { execSync } from "child_process";
import type { HostApp } from "../types";
import type {
  PlatformStrategy,
  FocusResult,
  WindowInfo,
  HighlightOptions,
} from "./strategy";

const APP_NAME_MAP: Record<string, string> = {
  "VS Code": "Visual Studio Code",
  Cursor: "Cursor",
  iTerm2: "iTerm2",
  Terminal: "Terminal",
  Warp: "Warp",
  Hyper: "Hyper",
  Alacritty: "Alacritty",
  Kitty: "kitty",
  WezTerm: "WezTerm",
  "IntelliJ IDEA": "IntelliJ IDEA",
  WebStorm: "WebStorm",
  PyCharm: "PyCharm",
  GoLand: "GoLand",
  RubyMine: "RubyMine",
  CLion: "CLion",
  Rider: "Rider",
  PhpStorm: "PhpStorm",
};

export function buildFocusScript(hostApp: HostApp): string {
  const appName = APP_NAME_MAP[hostApp.name] ?? hostApp.name;
  return `tell application "${appName}" to activate`;
}

export class MacOSStrategy implements PlatformStrategy {
  focusWindow(hostApp: HostApp, _projectHint?: string): FocusResult {
    const script = buildFocusScript(hostApp);

    try {
      execSync(`osascript -e '${script}'`, {
        encoding: "utf-8",
        timeout: 3000,
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // TODO: Implement with System Events AppleScript to enumerate windows
  listWindows(_appName: string): WindowInfo[] {
    return [];
  }

  // TODO: Implement with System Events AppleScript to get window position/size
  getWindowBounds(
    _appName: string,
    _windowTitle: string
  ): WindowInfo | null {
    return null;
  }

  // TODO: Implement overlay highlighting (e.g. via a transparent NSWindow)
  highlightWindow(
    _bounds: { x: number; y: number; width: number; height: number },
    _options?: HighlightOptions
  ): void {
    // no-op stub
  }

  getParentPids(pid: number): number[] {
    const pids: number[] = [];
    let currentPid = pid;

    for (let i = 0; i < 20; i++) {
      try {
        const ppid = parseInt(
          execSync(`ps -o ppid= -p ${currentPid}`, {
            encoding: "utf-8",
          }).trim(),
          10
        );
        if (isNaN(ppid) || ppid <= 1) break;
        pids.push(ppid);
        currentPid = ppid;
      } catch {
        break;
      }
    }

    return pids;
  }

  getProcessName(pid: number): string | null {
    try {
      return execSync(`ps -o comm= -p ${pid}`, {
        encoding: "utf-8",
      }).trim();
    } catch {
      return null;
    }
  }

  openDirectory(dirPath: string): { success: boolean } {
    try {
      execSync(`open ${JSON.stringify(dirPath)}`, { timeout: 3000 });
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
