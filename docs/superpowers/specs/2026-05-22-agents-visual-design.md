# AgentVille — Design Spec

**Date:** 2026-05-22
**Status:** Approved

## Overview

**AgentVille** is a local Next.js application that visualizes running Claude Code agents as pixel-art characters in a themed scene (office, farm, or workshop). Users can see what each agent is doing in real time, click on an agent to view details in a side panel, and focus the host terminal/IDE window where that agent is running.

## Goals

- Show all active Claude Code agents on the local machine in a single view
- Provide real-time visibility into what each agent is currently doing
- Map each agent back to its host application (terminal or IDE) and focus that window on click
- Deliver a playful, gamified experience using pixel-art visuals with swappable themes
- Architect for future expansion to other agent platforms

## Non-Goals (v1)

- No control features (pause, kill, message agents)
- No non-Claude agent support
- No full transcript/conversation viewer (activity feed only)
- No sound or music
- No persistent history (only currently active agents)

---

## Architecture

Three layers:

### 1. Data Layer (Next.js API routes + server-side)

Responsible for discovering agents, streaming their activity, and resolving host apps.

**Agent discovery** — polls `~/.claude/sessions/*.json` every 1-2 seconds:
- Each file represents a running Claude Code session with fields: `pid`, `sessionId`, `cwd`, `startedAt`, `status` ("busy"|"idle"), `updatedAt`
- Validates PID is alive via `kill -0`
- Diffs against previous scan to emit `agent-added`, `agent-removed`, `agent-status-changed` events

**Transcript streaming** — `fs.watch` on each agent's JSONL file:
- Path: `~/.claude/projects/<escaped-cwd>/<sessionId>.jsonl`
- Parses new lines to extract: current tool being used, thinking state, subagent spawns, errors
- Maps to `AgentActivity` updates

**Host app resolution** — PID parent-process chain + IDE lock files:
- Walks `ps -o ppid=` up from the agent PID to find the host process (iTerm2, Terminal.app, Warp, VS Code, Cursor, JetBrains, etc.)
- Checks `~/.claude/ide/<port>.lock` for IDE connections
- Cached per session (host app doesn't change mid-session)

### 2. Scene Layer (PixiJS via `@pixi/react`)

Renders the pixel-art world:
- Tilemap grid with environment props and animated agent characters
- Each agent maps to a sprite with animation states driven by live data
- Theme swapping changes sprite sheets and tile textures but not grid layout or animation state machine

### 3. UI Layer (React + Tailwind CSS)

Standard DOM elements overlaid on the canvas:
- Side panel (slides in on agent click)
- Theme selector
- Header bar with summary stats (total agents, busy/idle counts)

---

## Data Model

```typescript
interface AgentState {
  sessionId: string;
  pid: number;
  cwd: string;
  status: "busy" | "idle";
  currentAction: "thinking" | "tool:Read" | "tool:Edit" | "tool:Bash" | "writing" | "idle";
  lastToolName: string | null;
  subagents: AgentState[];
  hostApp: HostApp;
  startedAt: number;
  recentActions: TranscriptEntry[];
}

interface HostApp {
  type: "terminal" | "ide";
  name: string;           // "iTerm2", "VS Code", "Warp", etc.
  windowId: number;       // for macOS window focusing
  cwd: string;
}

interface TranscriptEntry {
  timestamp: number;
  type: "tool_use" | "thinking" | "text" | "subagent_start" | "subagent_stop";
  summary: string;        // e.g., "Read src/index.ts", "Thinking..."
}
```

---

## Real-Time Data Flow

**Transport:** Next.js Route Handler returning a `ReadableStream` (streaming response).

- `GET /api/agents/stream` — returns newline-delimited JSON events
- Event types: `agent-added`, `agent-removed`, `agent-updated`
- Client reads via `fetch()` with stream consumption, reconnects on disconnect

**Window focus endpoint:**

- `POST /api/agents/:sessionId/focus` — executes macOS AppleScript to bring the host app window to front

---

## Theming System

**Constraint:** Same structure across all three themes. Only the visual skin changes.

### Scene Schema (shared by all themes)

```typescript
interface SceneSchema {
  grid: { cols: 8; rows: 6 };
  agentSlots: Array<{ x: number; y: number }>;
  props: Array<{
    slot: "workstation" | "entrance" | "storage";
    x: number;
    y: number;
  }>;
}
```

### Skin Packs

Each theme provides sprite sheets and tile textures that conform to the same dimensions and frame counts.

| Slot         | Office            | Farm             | Workshop            |
| ------------ | ----------------- | ---------------- | ------------------- |
| Floor tiles  | Carpet/wood       | Grass/dirt        | Concrete/metal      |
| Workstation  | Desk + monitor    | Garden plot       | Workbench + tools   |
| Entrance     | Office door       | Farm gate         | Garage door         |
| Storage      | Filing cabinet    | Barn/silo         | Parts shelf         |
| Agent idle   | Sitting at desk   | Standing in field | Standing at bench   |
| Agent busy   | Typing            | Tending crop      | Operating machine   |
| Agent thinking | Leaning back    | Looking at sky    | Scratching head     |

Adding a new theme = adding a new set of PNGs conforming to the same sprite rig.

---

## Side Panel (Agent Detail View)

Slides in from the right when an agent character is clicked.

**Sections:**

1. **Header** — Agent name/ID, status badge (busy/idle), host app icon + name (e.g., "iTerm2 — ~/my-project"), "Focus Window" button
2. **Current Activity** — Real-time display of what the agent is doing: "Reading src/index.ts", "Running npm test", "Thinking...", etc.
3. **Recent Actions** — Scrollable list of the last ~20 tool calls with timestamps (e.g., `09:41:12 Read package.json`)
4. **Subagents** — Nested list of spawned subagents with status; clicking one highlights it in the scene and swaps the panel
5. **Session Info** — Start time, working directory, git branch, permission mode

---

## Host App Window Focus

**Resolution process:**
1. Read `pid` from session JSON
2. Walk parent process chain via `ps -o ppid=` to find host app
3. Check `~/.claude/ide/<port>.lock` for IDE connections
4. Cache result per session

**Focus mechanism:**
- macOS AppleScript: `osascript -e 'tell application "<app>" to activate'`
- Terminal apps: match TTY to specific window/tab
- IDEs: use workspace path from lock file to disambiguate windows
- Called via `POST /api/agents/:sessionId/focus`

**Limitation:** macOS only for v1.

---

## Tech Stack

| Layer            | Technology                                |
| ---------------- | ----------------------------------------- |
| Framework        | Next.js (App Router, latest)              |
| Scene rendering  | PixiJS + `@pixi/react`                    |
| Real-time data   | Streaming responses (ReadableStream)      |
| State management | Zustand                                   |
| Styling          | Tailwind CSS                              |
| Sprite assets    | Pixel art sprite sheets (consistent rig)  |
| Host app focus   | macOS AppleScript via shell exec          |
| Language         | TypeScript                                |

---

## Agent Character Animation States

Each agent sprite has a finite state machine driven by `currentAction`:

```
idle → busy (any tool or thinking)
busy → idle (action completes, no new action)

Sub-states of busy:
  thinking  → character leans back / looks up / scratches head
  tool:Read → character looks at paper / inspects crop / examines part
  tool:Edit → character types / plants seed / uses tool
  tool:Bash → character uses phone / waters plant / operates machine
  writing   → character types fast / harvests / assembles
```

Animation frame counts and sprite dimensions are identical across themes — only the pixel art differs.

---

## Future Expansion Points

- **Other agent platforms:** Abstract the data layer behind a provider interface; add LangGraph, CrewAI, AutoGen providers later
- **Control features:** Add `POST` endpoints for pause/kill/message; extend side panel with control buttons
- **Persistent history:** Store session snapshots to SQLite for historical view
- **Sound/music:** Add ambient audio per theme, SFX on agent state changes
