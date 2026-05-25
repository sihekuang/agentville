# PIP Floating Window Design

## Overview

Add Picture-in-Picture functionality to AgentVille that pops the PixiJS canvas into a small, always-on-top floating window. The user can continue watching and interacting with their agents while working in other apps.

## Approach

Use an Electron child `BrowserWindow` — frameless, always-on-top, visible on all workspaces. This provides full interactivity (click agents, pan, zoom) in the floating window while maintaining a native feel.

Not using macOS native PIP (AVKit) because it's video-only with no interaction support.

## Architecture

Both windows (main + PIP) load from the same Next.js server. The PIP window loads a dedicated `/pip` route that renders only the PixiJS canvas. Each window independently subscribes to the agent streaming API — no direct state sharing needed between windows.

Coordination between windows uses Electron IPC for activation/deactivation signals and theme sync.

## PIP Window Specification

### BrowserWindow Config

| Property | Value |
|----------|-------|
| Size | 400×300 |
| Min size | 200×150 |
| Position | Bottom-right of screen |
| Frame | Frameless |
| Always on top | `true` |
| Visible on all workspaces | `true` |
| Skip taskbar | `true` |
| Resizable | `true` |
| Rounded corners | `true` (macOS) |
| Parent | Main window (closes with parent) |

### Visual Design

- Solid background matching current theme (no vibrancy — keeps it simple)
- ~20px semi-transparent drag handle at the top for repositioning
- Small × button in top-right corner, visible on hover only
- macOS window manager provides shadow/depth
- No window controls (no traffic lights)

### Content

Renders `AgentVilleScene` component directly — same PixiJS canvas with full viewport (drag, pinch, zoom, click). No header, no side panel, no scene control buttons (the window itself is small enough that these would clutter).

## Main Window Behavior (PIP Active)

When PIP activates, the canvas panel in the main window is replaced with a `PipPlaceholder` component:

- Centered message: "Canvas is floating"
- "Re-dock" button to deactivate PIP and restore the canvas inline
- Muted/subtle styling using `bg-muted text-muted-foreground`
- Side panel (activity log, agent details) remains fully functional

## Activation & Deactivation

### Triggers

| Action | Effect |
|--------|--------|
| Click PIP button (scene controls, bottom-right) | Activate PIP |
| Press `Cmd+Shift+P` | Toggle PIP on/off |
| Click × on PIP window | Deactivate PIP |
| Click "Re-dock" in main window | Deactivate PIP |
| Close main window | PIP closes too (child window) |
| Activate when already active | Focus existing PIP window |

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `pip:activate` | Renderer → Main | Request PIP window creation |
| `pip:deactivate` | Renderer → Main | Request PIP window close |
| `pip:activated` | Main → Renderer | Confirm PIP window opened |
| `pip:deactivated` | Main → Renderer | Confirm PIP window closed |
| `pip:theme-changed` | Main → PIP Renderer | Sync theme to PIP window |

### Activation Flow

1. User clicks PIP button or presses `Cmd+Shift+P`
2. Renderer sends `pip:activate` to main process
3. Main process creates PIP `BrowserWindow`, positions bottom-right
4. Main process sends `pip:activated` to main window renderer
5. Main window sets `pipActive = true` in store, swaps canvas for placeholder

### Deactivation Flow

1. User clicks ×, clicks "Re-dock", or presses `Cmd+Shift+P`
2. Renderer sends `pip:deactivate` (or main process detects window close)
3. Main process closes PIP window
4. Main process sends `pip:deactivated` to main window renderer
5. Main window sets `pipActive = false`, restores canvas inline

## State & Synchronization

### Shared via streaming API (independent)

- Agent positions, statuses, emotes — both windows subscribe to the same SSE endpoint
- Each window maintains its own agent state independently

### Synced via IPC

- Theme (dark/light): main window notifies PIP on change via `pip:theme-changed`

### Independent (not synced)

- Agent selection: clicking an agent in PIP selects it locally, doesn't affect main window's side panel
- Viewport position/zoom: each window has its own viewport state

## Store Changes

Add to the Zustand store:

```typescript
pipActive: boolean
setPipActive: (active: boolean) => void
```

This flag controls whether the main window shows the canvas or the placeholder.

## New Files

| File | Purpose |
|------|---------|
| `src/app/pip/page.tsx` | PIP route — renders canvas only |
| `src/components/ui/PipPlaceholder.tsx` | Placeholder shown in main window during PIP |
| `electron/pip.ts` | PIP window creation/management logic |

## Modified Files

| File | Change |
|------|--------|
| `electron/main.ts` | Import PIP module, register IPC handlers, add menu item |
| `electron/preload.ts` | Expose PIP IPC methods to renderer |
| `src/components/scene/AgentVilleScene.tsx` | Add PIP button to scene controls |
| `src/components/AppShell.tsx` | Conditionally render canvas vs placeholder based on `pipActive` |
| `src/store/` | Add `pipActive` state |

## Out of Scope

- Position/size memory between sessions
- Opacity control
- Minimap or simplified view
- Cross-window agent selection sync
- Native macOS PIP (video-only, no interaction)
- Document Picture-in-Picture API (experimental, uncertain Electron support)
