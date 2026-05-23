import type { HostApp } from "./types";
import { getPlatform } from "./platform";

export function focusWindow(
  hostApp: HostApp,
  projectHint?: string
): { success: boolean; windowTitle?: string } {
  return getPlatform().focusWindow(hostApp, projectHint);
}
