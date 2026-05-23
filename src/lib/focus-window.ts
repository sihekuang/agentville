import type { HostApp } from "./types";
import { getPlatform } from "./platform";

export function focusWindow(hostApp: HostApp): { success: boolean } {
  return getPlatform().focusWindow(hostApp);
}
