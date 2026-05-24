# Warp Terminal Tab Focus

## Current Implementation

AgentVille focuses Warp tabs using a two-tier approach:

### Tier 1: `WARP_FOCUS_URL` deep link (preferred)

`src/lib/platform/macos.ts` reads `WARP_FOCUS_URL` from the agent's process
environment via `ps eww`. If present, it opens the URL (`warp://session/<uuid>`)
which tells Warp to focus the exact pane, tab, and window internally.

### Tier 2: Tab-cycling AppleScript (fallback)

`scripts/macos/focus-warp-tab.applescript` cycles through Warp tabs using
Cmd+Shift+] keystrokes and matches the window title against the project
directory name. This is fragile (timing-dependent, max 20 tabs) but works on
older Warp versions without `WARP_FOCUS_URL`.

### Tier 3: Simple activation

If neither method works, falls back to `tell application "Warp" to activate`,
which brings Warp to the front but doesn't switch tabs.

## Upstream Status (as of 2026-05-24)

### Shipped: `WARP_FOCUS_URL` + `WARP_TERMINAL_SESSION_UUID`

- **PR**: warpdotdev/warp#11130 ("Expose terminal focus URL env vars")
- **Merged**: 2026-05-22
- **Issue**: warpdotdev/warp#8611 (closed)

Warp now exposes two env vars in every terminal session:

- `WARP_TERMINAL_SESSION_UUID` — 32-char hex session ID
- `WARP_FOCUS_URL` — channel-aware deep link (`warp://session/<uuid>` or
  `warposs://session/<uuid>`)

Opening `WARP_FOCUS_URL` resolves the correct window, pane group, and pane
internally. Our existing code already consumes this — no changes needed.

**Note**: The regex in `getWarpFocusUrl` currently only matches `warp://`. It
should also match `warposs://` for the open-source Warp build. Update the regex
from `warp:\/\/\S+` to `warp(?:oss)?:\/\/\S+` once we can test against WarpOss.

### Not available

- **AppleScript support** (warpdotdev/Warp#3364, #1228) — Warp is not
  scriptable via AppleScript. No scripting dictionary, no `do script`, no tab
  enumeration. AXRaise doesn't work because Warp exposes only one window to
  System Events (tabs are internal, not NSWindows).

- **Tab focus in launch configs** (warpdotdev/Warp#5575) — Cannot specify which
  tab receives focus when opening a launch configuration.

## TODO

- [ ] Update `WARP_FOCUS_URL` regex to support `warposs://` scheme
- [ ] Remove the tab-cycling AppleScript fallback once `WARP_FOCUS_URL` is in
      a Warp stable release (check changelog at docs.warp.dev/changelog/2026)
- [ ] Consider reading `WARP_TERMINAL_SESSION_UUID` directly from the session
      file instead of scraping `ps eww` output — would be more reliable
