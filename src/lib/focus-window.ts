import { execSync } from "child_process";
import type { HostApp } from "./types";

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
};

export function buildFocusScript(hostApp: HostApp): string {
  const appName = APP_NAME_MAP[hostApp.name] ?? hostApp.name;
  return `tell application "${appName}" to activate`;
}

export function focusWindow(hostApp: HostApp): { success: boolean } {
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
