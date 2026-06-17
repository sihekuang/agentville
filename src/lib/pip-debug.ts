// Flag-gated diagnostics for the PiP hover-expand feature. Off by default.
//
// Enable (renderer): in any window's devtools console run
//   localStorage.setItem("agentville-pip-debug", "1")
// then re-open the PiP window. Or load with `?pipdebug` in the URL.
// When on, hook/resizer events are logged to the console AND surfaced in the
// on-screen <PipHoverDebug /> overlay.
//
// Enable (Electron main process): launch with `PIP_DEBUG=1` (see electron/pip.ts).

const STORAGE_KEY = "agentville-pip-debug";

export function isPipDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("pipdebug")) return true;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

type PipDebugSink = (message: string) => void;
let sink: PipDebugSink | null = null;

/** The on-screen overlay registers a sink so logs are visible inside the PiP window. */
export function setPipDebugSink(next: PipDebugSink | null): void {
  sink = next;
}

/** Log a PiP diagnostic line — no-op unless the debug flag is on. */
export function pipDebug(message: string): void {
  if (!isPipDebugEnabled()) return;
  console.log("[pip]", message);
  sink?.(message);
}
