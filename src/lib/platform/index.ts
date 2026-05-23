import { MacOSStrategy } from "./macos";
import type { PlatformStrategy } from "./strategy";

function detectPlatform(): "macos" | "linux" | "windows" {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

let instance: PlatformStrategy | null = null;

export function getPlatform(): PlatformStrategy {
  if (!instance) {
    const platform = detectPlatform();
    switch (platform) {
      case "macos":
        instance = new MacOSStrategy();
        break;
      default:
        throw new Error(
          `Platform "${platform}" is not yet supported. Contributions welcome!`
        );
    }
  }
  return instance;
}

/** Reset the cached platform instance (useful for testing) */
export function resetPlatform(): void {
  instance = null;
}

export type {
  PlatformStrategy,
  WindowInfo,
  FocusResult,
  HighlightOptions,
} from "./strategy";
