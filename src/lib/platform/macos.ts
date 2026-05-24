import { execFileSync, execSync } from "child_process";
import path from "path";
import type { HostApp } from "../types";
import type {
  PlatformStrategy,
  FocusResult,
  WindowInfo,
  HighlightOptions,
} from "./strategy";

function getScriptsDir(): string {
  if (process.env.ELECTRON_SCRIPTS_DIR) {
    return process.env.ELECTRON_SCRIPTS_DIR;
  }
  return path.join(process.cwd(), "scripts", "macos");
}

const SCRIPTS_DIR = getScriptsDir();

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

const PROCESS_NAME_MAP: Record<string, string> = {
  "VS Code": "Code",
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

export function resolveAppNames(hostAppName: string): {
  appName: string;
  processName: string;
} {
  const appName = APP_NAME_MAP[hostAppName] ?? hostAppName;
  const processName = PROCESS_NAME_MAP[hostAppName] ?? appName;
  return { appName, processName };
}

function runScript(scriptName: string, args: string[]): string {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  return execFileSync("osascript", [scriptPath, ...args], {
    encoding: "utf-8",
    timeout: 5000,
  }).trim();
}

export class MacOSStrategy implements PlatformStrategy {
  private getWarpFocusUrl(agentPid: number): string | null {
    try {
      const env = execSync(`ps eww -p ${agentPid}`, {
        encoding: "utf-8",
        timeout: 3000,
      });
      const match = env.match(/WARP_FOCUS_URL=(warp:\/\/\S+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  focusWindow(hostApp: HostApp, projectHint?: string, agentPid?: number): FocusResult {
    const appName = APP_NAME_MAP[hostApp.name] ?? hostApp.name;
    const processName = PROCESS_NAME_MAP[hostApp.name] ?? appName;
    const hint = projectHint ?? "";

    try {
      if (hostApp.name === "Warp" && agentPid) {
        const focusUrl = this.getWarpFocusUrl(agentPid);
        if (focusUrl) {
          execSync(`open ${JSON.stringify(focusUrl)}`, { timeout: 3000 });
          return { success: true, windowTitle: focusUrl };
        }

        execFileSync("osascript", ["-e", 'tell application "Warp" to activate'], {
          encoding: "utf-8",
          timeout: 3000,
        });

        return { success: true };
      }

      const result = runScript("focus-window.applescript", [appName, processName, hint]);

      if (result.startsWith("focused:")) {
        return { success: true, windowTitle: result.slice("focused:".length) };
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  listWindows(appName: string): WindowInfo[] {
    const processName = PROCESS_NAME_MAP[appName] ?? APP_NAME_MAP[appName] ?? appName;

    try {
      const raw = runScript("list-windows.applescript", [processName]);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.map(
        (w: { title: string; index: number; x: number; y: number; width: number; height: number }) => ({
          title: w.title,
          index: w.index,
          bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
        })
      );
    } catch {
      return [];
    }
  }

  getWindowBounds(appName: string, windowTitle: string): WindowInfo | null {
    const processName = PROCESS_NAME_MAP[appName] ?? APP_NAME_MAP[appName] ?? appName;

    try {
      const raw = runScript("get-window-bounds.applescript", [
        processName,
        windowTitle,
      ]);
      if (raw === "null") return null;

      const w = JSON.parse(raw) as {
        title: string;
        index: number;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      return {
        title: w.title,
        index: w.index,
        bounds: { x: w.x, y: w.y, width: w.width, height: w.height },
      };
    } catch {
      return null;
    }
  }

  highlightWindow(
    _bounds: { x: number; y: number; width: number; height: number },
    _options?: HighlightOptions
  ): void {
    // TODO: Implement overlay highlighting (e.g. via a transparent NSWindow)
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
