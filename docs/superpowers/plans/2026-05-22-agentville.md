# AgentVille Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js app that visualizes Claude Code agents as pixel-art characters in themed scenes, with real-time activity feeds and host-app window focusing.

**Architecture:** Three-layer app — data layer (session discovery + JSONL transcript streaming via Next.js API routes), scene layer (PixiJS pixel-art tilemap with animated agent sprites), UI layer (React side panel + header overlaid on the canvas). Data flows from `~/.claude/sessions/*.json` and JSONL transcripts via a streaming response endpoint to a Zustand store that drives both the scene and UI.

**Tech Stack:** Next.js 16 (App Router), PixiJS 8 + @pixi/react 8, Zustand 5, Tailwind CSS 4, TypeScript

---

## File Structure

```
agentville/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with fonts + Tailwind
│   │   ├── page.tsx                      # Main page composing Scene + UI
│   │   ├── api/
│   │   │   └── agents/
│   │   │       ├── stream/
│   │   │       │   └── route.ts          # GET streaming response endpoint
│   │   │       └── [sessionId]/
│   │   │           └── focus/
│   │   │               └── route.ts      # POST focus host app window
│   │   └── globals.css                   # Tailwind imports
│   ├── lib/
│   │   ├── types.ts                      # Shared TypeScript interfaces
│   │   ├── sessions.ts                   # Session discovery (poll ~/.claude/sessions/)
│   │   ├── transcript.ts                 # JSONL transcript parser
│   │   ├── host-app.ts                   # PID → host app resolver
│   │   └── focus-window.ts              # macOS AppleScript window focus
│   ├── store/
│   │   └── agents.ts                     # Zustand store for agent state
│   ├── hooks/
│   │   └── use-agent-stream.ts           # Client hook: connect to streaming endpoint
│   ├── components/
│   │   ├── scene/
│   │   │   ├── AgentVilleScene.tsx        # PixiJS Application wrapper
│   │   │   ├── Tilemap.tsx               # Renders floor tiles + props from theme
│   │   │   ├── AgentSprite.tsx           # Single agent character with animation FSM
│   │   │   └── themes/
│   │   │       ├── theme-types.ts        # Theme schema interface
│   │   │       ├── office.ts             # Office theme config + sprite refs
│   │   │       ├── farm.ts               # Farm theme config + sprite refs
│   │   │       └── workshop.ts           # Workshop theme config + sprite refs
│   │   ├── ui/
│   │   │   ├── Header.tsx                # Top bar: title, agent counts, theme selector
│   │   │   ├── SidePanel.tsx             # Agent detail panel (slides from right)
│   │   │   ├── StatusBadge.tsx           # Busy/idle badge component
│   │   │   └── ActionList.tsx            # Recent actions list with timestamps
│   │   └── AppShell.tsx                  # Composes scene + UI layers together
│   └── public/
│       └── sprites/
│           ├── office/                    # Office theme sprite sheets
│           ├── farm/                      # Farm theme sprite sheets
│           └── workshop/                  # Workshop theme sprite sheets
├── tests/
│   ├── lib/
│   │   ├── sessions.test.ts
│   │   ├── transcript.test.ts
│   │   ├── host-app.test.ts
│   │   └── focus-window.test.ts
│   ├── store/
│   │   └── agents.test.ts
│   └── components/
│       └── ui/
│           ├── Header.test.tsx
│           ├── SidePanel.test.tsx
│           └── ActionList.test.tsx
└── fixtures/
    ├── session-busy.json                  # Sample session file for tests
    ├── session-idle.json
    ├── transcript-sample.jsonl            # Sample JSONL transcript for tests
    └── ide-lock.json                      # Sample IDE lock file
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/daniel/Documents/Projects/agents-visual
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: Project scaffolded with Next.js 16, Tailwind 4, TypeScript, App Router, `src/` directory.

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npm install pixi.js @pixi/react zustand
```

Expected: `pixi.js@8.x`, `@pixi/react@8.x`, `zustand@5.x` added to `package.json`.

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify the app starts**

Run:
```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: default Next.js page renders.

- [ ] **Step 7: Verify tests run**

Run:
```bash
npm test
```

Expected: Vitest runs with 0 tests (no test files yet), exits cleanly.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 project with PixiJS, Zustand, Tailwind, Vitest"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Create the type definitions**

Create `src/lib/types.ts`:

```typescript
export interface AgentState {
  sessionId: string;
  pid: number;
  cwd: string;
  status: "busy" | "idle";
  currentAction: AgentAction;
  lastToolName: string | null;
  subagents: AgentState[];
  hostApp: HostApp | null;
  startedAt: number;
  recentActions: TranscriptEntry[];
}

export type AgentAction =
  | "thinking"
  | "tool:Read"
  | "tool:Edit"
  | "tool:Bash"
  | "tool:Write"
  | "tool:Agent"
  | "tool:other"
  | "writing"
  | "idle";

export interface HostApp {
  type: "terminal" | "ide";
  name: string;
  pid: number;
  cwd: string;
}

export interface TranscriptEntry {
  timestamp: number;
  type: "tool_use" | "thinking" | "text" | "subagent_start" | "subagent_stop";
  summary: string;
}

export interface StreamEvent {
  event: "agent-added" | "agent-removed" | "agent-updated";
  agent: AgentState;
}

export interface RawSessionFile {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  procStart: string;
  version: string;
  peerProtocol: number;
  kind: string;
  entrypoint: string;
  status: "busy" | "idle";
  updatedAt: number;
}

export interface RawIdeLock {
  workspaceFolders: string[];
  pid: number;
  ideName: string;
  transport: string;
  authToken: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: Test Fixtures

**Files:**
- Create: `fixtures/session-busy.json`, `fixtures/session-idle.json`, `fixtures/transcript-sample.jsonl`, `fixtures/ide-lock.json`

- [ ] **Step 1: Create session fixtures**

Create `fixtures/session-busy.json`:

```json
{
  "pid": 12345,
  "sessionId": "abc-123-def",
  "cwd": "/Users/test/my-project",
  "startedAt": 1700000000000,
  "procStart": "Wed Nov 15 10:00:00 2023",
  "version": "2.1.147",
  "peerProtocol": 1,
  "kind": "interactive",
  "entrypoint": "cli",
  "status": "busy",
  "updatedAt": 1700000060000
}
```

Create `fixtures/session-idle.json`:

```json
{
  "pid": 67890,
  "sessionId": "xyz-456-ghi",
  "cwd": "/Users/test/other-project",
  "startedAt": 1700000000000,
  "procStart": "Wed Nov 15 10:00:00 2023",
  "version": "2.1.147",
  "peerProtocol": 1,
  "kind": "interactive",
  "entrypoint": "cli",
  "status": "idle",
  "updatedAt": 1700000030000
}
```

- [ ] **Step 2: Create transcript fixture**

Create `fixtures/transcript-sample.jsonl` (one JSON object per line):

```jsonl
{"type":"user","message":{"role":"user","content":"fix the bug in app.ts"},"sessionId":"abc-123-def","uuid":"u1","timestamp":1700000010000,"cwd":"/Users/test/my-project"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Let me look at the file..."}]},"sessionId":"abc-123-def","uuid":"u2","parentUuid":"u1","timestamp":1700000011000}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":{"file_path":"/Users/test/my-project/src/app.ts"}}]},"sessionId":"abc-123-def","uuid":"u3","parentUuid":"u2","timestamp":1700000012000}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"file contents here"}]},"sessionId":"abc-123-def","uuid":"u4","parentUuid":"u3","timestamp":1700000013000}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","id":"t2","name":"Edit","input":{"file_path":"/Users/test/my-project/src/app.ts","old_string":"bug","new_string":"fix"}}]},"sessionId":"abc-123-def","uuid":"u5","parentUuid":"u4","timestamp":1700000014000}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I fixed the bug in app.ts."}]},"sessionId":"abc-123-def","uuid":"u6","parentUuid":"u5","timestamp":1700000015000}
```

- [ ] **Step 3: Create IDE lock fixture**

Create `fixtures/ide-lock.json`:

```json
{
  "workspaceFolders": ["/Users/test/my-project"],
  "pid": 99999,
  "ideName": "VS Code",
  "transport": "ws",
  "authToken": "fake-token"
}
```

- [ ] **Step 4: Commit**

```bash
git add fixtures/
git commit -m "feat: add test fixtures for session, transcript, and IDE lock files"
```

---

### Task 4: Session Discovery Module

**Files:**
- Create: `src/lib/sessions.ts`, `tests/lib/sessions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/sessions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { discoverSessions } from "@/lib/sessions";
import fs from "fs";
import path from "path";
import os from "os";

const FIXTURES = path.resolve(__dirname, "../../fixtures");

describe("discoverSessions", () => {
  const mockSessionsDir = path.join(os.tmpdir(), "agentville-test-sessions");

  beforeEach(() => {
    fs.mkdirSync(mockSessionsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(mockSessionsDir, { recursive: true, force: true });
  });

  it("returns empty array when no session files exist", async () => {
    const result = await discoverSessions(mockSessionsDir);
    expect(result).toEqual([]);
  });

  it("parses a valid session file", async () => {
    const fixture = fs.readFileSync(
      path.join(FIXTURES, "session-busy.json"),
      "utf-8"
    );
    fs.writeFileSync(path.join(mockSessionsDir, "12345.json"), fixture);

    const result = await discoverSessions(mockSessionsDir, () => true);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("abc-123-def");
    expect(result[0].status).toBe("busy");
    expect(result[0].pid).toBe(12345);
    expect(result[0].cwd).toBe("/Users/test/my-project");
  });

  it("skips files with invalid JSON", async () => {
    fs.writeFileSync(path.join(mockSessionsDir, "bad.json"), "not json");

    const result = await discoverSessions(mockSessionsDir);
    expect(result).toEqual([]);
  });

  it("filters out sessions whose PID is not alive", async () => {
    const fixture = fs.readFileSync(
      path.join(FIXTURES, "session-busy.json"),
      "utf-8"
    );
    fs.writeFileSync(path.join(mockSessionsDir, "12345.json"), fixture);

    const result = await discoverSessions(mockSessionsDir, () => false);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/sessions.test.ts`

Expected: FAIL — `discoverSessions` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/sessions.ts`:

```typescript
import fs from "fs";
import path from "path";
import type { RawSessionFile } from "./types";

export interface DiscoveredSession {
  pid: number;
  sessionId: string;
  cwd: string;
  status: "busy" | "idle";
  startedAt: number;
  updatedAt: number;
  entrypoint: string;
  version: string;
}

function isPidAliveDefault(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function discoverSessions(
  sessionsDir: string,
  isPidAlive: (pid: number) => boolean = isPidAliveDefault
): Promise<DiscoveredSession[]> {
  let files: string[];
  try {
    files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const sessions: DiscoveredSession[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(sessionsDir, file), "utf-8");
      const data: RawSessionFile = JSON.parse(raw);

      if (!isPidAlive(data.pid)) continue;

      sessions.push({
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        status: data.status,
        startedAt: data.startedAt,
        updatedAt: data.updatedAt,
        entrypoint: data.entrypoint,
        version: data.version,
      });
    } catch {
      continue;
    }
  }

  return sessions;
}

export function getTranscriptPath(
  projectsDir: string,
  cwd: string,
  sessionId: string
): string | null {
  const escaped = cwd.replace(/\//g, "-");
  const jsonlPath = path.join(projectsDir, escaped, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonlPath)) return jsonlPath;
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/sessions.test.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessions.ts tests/lib/sessions.test.ts
git commit -m "feat: add session discovery module with tests"
```

---

### Task 5: Transcript Parser Module

**Files:**
- Create: `src/lib/transcript.ts`, `tests/lib/transcript.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/transcript.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTranscriptLine, parseTranscriptFile } from "@/lib/transcript";
import path from "path";

const FIXTURES = path.resolve(__dirname, "../../fixtures");

describe("parseTranscriptLine", () => {
  it("parses a tool_use line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "Read",
            input: { file_path: "/src/app.ts" },
          },
        ],
      },
      sessionId: "abc-123",
      uuid: "u1",
      timestamp: 1700000012000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000012000,
      type: "tool_use",
      summary: "Read /src/app.ts",
    });
  });

  it("parses a thinking line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "thinking", thinking: "Let me check..." }],
      },
      sessionId: "abc-123",
      uuid: "u2",
      timestamp: 1700000011000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000011000,
      type: "thinking",
      summary: "Thinking...",
    });
  });

  it("parses a text line into a TranscriptEntry", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "I fixed the bug in app.ts." }],
      },
      sessionId: "abc-123",
      uuid: "u3",
      timestamp: 1700000015000,
    });

    const result = parseTranscriptLine(line);
    expect(result).toEqual({
      timestamp: 1700000015000,
      type: "text",
      summary: "I fixed the bug in app.ts.",
    });
  });

  it("returns null for non-assistant lines", () => {
    const line = JSON.stringify({ type: "user", message: { role: "user" } });
    expect(parseTranscriptLine(line)).toBeNull();
  });

  it("returns null for attachment lines", () => {
    const line = JSON.stringify({ type: "attachment" });
    expect(parseTranscriptLine(line)).toBeNull();
  });
});

describe("parseTranscriptFile", () => {
  it("parses the fixture JSONL file and returns entries", () => {
    const entries = parseTranscriptFile(
      path.join(FIXTURES, "transcript-sample.jsonl")
    );
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const toolUse = entries.find((e) => e.type === "tool_use");
    expect(toolUse).toBeDefined();
    expect(toolUse!.summary).toContain("Read");

    const thinking = entries.find((e) => e.type === "thinking");
    expect(thinking).toBeDefined();
    expect(thinking!.summary).toBe("Thinking...");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/transcript.test.ts`

Expected: FAIL — `parseTranscriptLine` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/transcript.ts`:

```typescript
import fs from "fs";
import type { TranscriptEntry, AgentAction } from "./types";

interface RawTranscriptLine {
  type: string;
  message?: {
    role: string;
    content?: Array<{
      type: string;
      text?: string;
      thinking?: string;
      name?: string;
      id?: string;
      input?: Record<string, unknown>;
    }>;
  };
  sessionId?: string;
  uuid?: string;
  parentUuid?: string;
  timestamp?: number;
  isSidechain?: boolean;
}

export function parseTranscriptLine(line: string): TranscriptEntry | null {
  let data: RawTranscriptLine;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }

  if (data.type !== "assistant") return null;

  const content = data.message?.content;
  if (!Array.isArray(content) || content.length === 0) return null;

  const block = content[0];
  const timestamp = data.timestamp ?? Date.now();

  if (block.type === "tool_use") {
    const toolName = block.name ?? "unknown";
    const summary = formatToolSummary(toolName, block.input);
    return { timestamp, type: "tool_use", summary };
  }

  if (block.type === "thinking") {
    return { timestamp, type: "thinking", summary: "Thinking..." };
  }

  if (block.type === "text" && block.text) {
    const text =
      block.text.length > 80 ? block.text.slice(0, 77) + "..." : block.text;
    return { timestamp, type: "text", summary: text };
  }

  return null;
}

function formatToolSummary(
  name: string,
  input?: Record<string, unknown>
): string {
  if (!input) return name;

  if (name === "Read" && input.file_path) {
    return `Read ${input.file_path}`;
  }
  if (name === "Edit" && input.file_path) {
    return `Edit ${input.file_path}`;
  }
  if (name === "Write" && input.file_path) {
    return `Write ${input.file_path}`;
  }
  if (name === "Bash" && input.description) {
    return `Bash: ${input.description}`;
  }
  if (name === "Bash" && input.command) {
    const cmd = String(input.command);
    return `Bash: ${cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd}`;
  }
  if (name === "Agent" && input.description) {
    return `Agent: ${input.description}`;
  }

  return name;
}

export function currentActionFromTranscript(
  entries: TranscriptEntry[]
): AgentAction {
  if (entries.length === 0) return "idle";

  const last = entries[entries.length - 1];

  if (last.type === "thinking") return "thinking";
  if (last.type === "text") return "writing";

  if (last.type === "tool_use") {
    const toolName = last.summary.split(" ")[0].split(":")[0];
    if (["Read", "Edit", "Write", "Bash", "Agent"].includes(toolName)) {
      return `tool:${toolName}` as AgentAction;
    }
    return "tool:other";
  }

  return "idle";
}

export function parseTranscriptFile(filePath: string): TranscriptEntry[] {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const entries: TranscriptEntry[] = [];

  for (const line of lines) {
    const entry = parseTranscriptLine(line);
    if (entry) entries.push(entry);
  }

  return entries;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/transcript.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transcript.ts tests/lib/transcript.test.ts
git commit -m "feat: add JSONL transcript parser with tool summary formatting"
```

---

### Task 6: Host App Resolution Module

**Files:**
- Create: `src/lib/host-app.ts`, `tests/lib/host-app.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/host-app.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveHostApp,
  parseIdeLockFiles,
  identifyAppFromProcessName,
} from "@/lib/host-app";

describe("identifyAppFromProcessName", () => {
  it("identifies iTerm2", () => {
    expect(identifyAppFromProcessName("iTerm2")).toEqual({
      type: "terminal",
      name: "iTerm2",
    });
  });

  it("identifies VS Code", () => {
    expect(identifyAppFromProcessName("Electron")).toEqual(null);
    expect(identifyAppFromProcessName("Code Helper (Renderer)")).toEqual({
      type: "ide",
      name: "VS Code",
    });
  });

  it("identifies Terminal.app", () => {
    expect(identifyAppFromProcessName("Terminal")).toEqual({
      type: "terminal",
      name: "Terminal",
    });
  });

  it("identifies Warp", () => {
    expect(identifyAppFromProcessName("Warp")).toEqual({
      type: "terminal",
      name: "Warp",
    });
  });

  it("returns null for unknown process", () => {
    expect(identifyAppFromProcessName("node")).toBeNull();
  });
});

describe("parseIdeLockFiles", () => {
  it("parses IDE lock file content", () => {
    const lockContent = JSON.stringify({
      workspaceFolders: ["/Users/test/my-project"],
      pid: 99999,
      ideName: "VS Code",
      transport: "ws",
      authToken: "fake-token",
    });

    const result = parseIdeLockFiles([{ port: 61035, content: lockContent }]);
    expect(result).toHaveLength(1);
    expect(result[0].ideName).toBe("VS Code");
    expect(result[0].pid).toBe(99999);
    expect(result[0].workspaceFolders).toContain("/Users/test/my-project");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/host-app.test.ts`

Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/host-app.ts`:

```typescript
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { HostApp, RawIdeLock } from "./types";

interface AppIdentification {
  type: "terminal" | "ide";
  name: string;
}

const KNOWN_APPS: Record<string, AppIdentification> = {
  iTerm2: { type: "terminal", name: "iTerm2" },
  "iTerm2-arm64": { type: "terminal", name: "iTerm2" },
  Terminal: { type: "terminal", name: "Terminal" },
  Warp: { type: "terminal", name: "Warp" },
  Hyper: { type: "terminal", name: "Hyper" },
  Alacritty: { type: "terminal", name: "Alacritty" },
  kitty: { type: "terminal", name: "Kitty" },
  WezTerm: { type: "terminal", name: "WezTerm" },
  "Code Helper (Renderer)": { type: "ide", name: "VS Code" },
  "Cursor Helper (Renderer)": { type: "ide", name: "Cursor" },
};

export function identifyAppFromProcessName(
  name: string
): AppIdentification | null {
  return KNOWN_APPS[name] ?? null;
}

interface IdeLockEntry {
  port: number;
  content: string;
}

export function parseIdeLockFiles(entries: IdeLockEntry[]): RawIdeLock[] {
  const results: RawIdeLock[] = [];
  for (const entry of entries) {
    try {
      const data: RawIdeLock = JSON.parse(entry.content);
      results.push(data);
    } catch {
      continue;
    }
  }
  return results;
}

function getParentPids(pid: number): number[] {
  const pids: number[] = [];
  let currentPid = pid;

  for (let i = 0; i < 20; i++) {
    try {
      const ppid = parseInt(
        execSync(`ps -o ppid= -p ${currentPid}`, { encoding: "utf-8" }).trim(),
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

function getProcessName(pid: number): string | null {
  try {
    return execSync(`ps -o comm= -p ${pid}`, { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

function readIdeLockDir(ideDir: string): RawIdeLock[] {
  try {
    const files = fs.readdirSync(ideDir).filter((f) => f.endsWith(".lock"));
    return parseIdeLockFiles(
      files.map((f) => ({
        port: parseInt(f.replace(".lock", ""), 10),
        content: fs.readFileSync(path.join(ideDir, f), "utf-8"),
      }))
    );
  } catch {
    return [];
  }
}

const hostAppCache = new Map<string, HostApp | null>();

export function resolveHostApp(
  pid: number,
  cwd: string,
  sessionId: string,
  ideDir?: string
): HostApp | null {
  const cacheKey = sessionId;
  if (hostAppCache.has(cacheKey)) return hostAppCache.get(cacheKey)!;

  const ideLockDir =
    ideDir ?? path.join(process.env.HOME ?? "~", ".claude", "ide");
  const ideLocks = readIdeLockDir(ideLockDir);
  for (const lock of ideLocks) {
    if (lock.workspaceFolders.some((ws) => cwd.startsWith(ws))) {
      const result: HostApp = {
        type: "ide",
        name: lock.ideName,
        pid: lock.pid,
        cwd,
      };
      hostAppCache.set(cacheKey, result);
      return result;
    }
  }

  const parentPids = getParentPids(pid);
  for (const ppid of parentPids) {
    const processName = getProcessName(ppid);
    if (!processName) continue;

    const baseName = path.basename(processName);
    const app = identifyAppFromProcessName(baseName);
    if (app) {
      const result: HostApp = {
        type: app.type,
        name: app.name,
        pid: ppid,
        cwd,
      };
      hostAppCache.set(cacheKey, result);
      return result;
    }
  }

  hostAppCache.set(cacheKey, null);
  return null;
}

export function clearHostAppCache(): void {
  hostAppCache.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/host-app.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/host-app.ts tests/lib/host-app.test.ts
git commit -m "feat: add host app resolution via PID chain and IDE lock files"
```

---

### Task 7: Window Focus Module

**Files:**
- Create: `src/lib/focus-window.ts`, `tests/lib/focus-window.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/focus-window.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildFocusScript } from "@/lib/focus-window";

describe("buildFocusScript", () => {
  it("builds AppleScript for a terminal app", () => {
    const script = buildFocusScript({
      type: "terminal",
      name: "iTerm2",
      pid: 123,
      cwd: "/Users/test",
    });
    expect(script).toContain("iTerm2");
    expect(script).toContain("activate");
  });

  it("builds AppleScript for an IDE", () => {
    const script = buildFocusScript({
      type: "ide",
      name: "VS Code",
      pid: 456,
      cwd: "/Users/test/project",
    });
    expect(script).toContain("Visual Studio Code");
    expect(script).toContain("activate");
  });

  it("builds AppleScript for Terminal.app", () => {
    const script = buildFocusScript({
      type: "terminal",
      name: "Terminal",
      pid: 789,
      cwd: "/Users/test",
    });
    expect(script).toContain("Terminal");
    expect(script).toContain("activate");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/focus-window.test.ts`

Expected: FAIL — `buildFocusScript` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/focus-window.ts`:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/focus-window.test.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/focus-window.ts tests/lib/focus-window.test.ts
git commit -m "feat: add macOS AppleScript window focus module"
```

---

### Task 8: Streaming API Route

**Files:**
- Create: `src/app/api/agents/stream/route.ts`

- [ ] **Step 1: Implement the streaming endpoint**

Create `src/app/api/agents/stream/route.ts`:

```typescript
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { discoverSessions, getTranscriptPath } from "@/lib/sessions";
import {
  parseTranscriptLine,
  currentActionFromTranscript,
} from "@/lib/transcript";
import { resolveHostApp } from "@/lib/host-app";
import type { AgentState, StreamEvent, TranscriptEntry } from "@/lib/types";

const CLAUDE_HOME = path.join(process.env.HOME ?? "~", ".claude");
const SESSIONS_DIR = path.join(CLAUDE_HOME, "sessions");
const PROJECTS_DIR = path.join(CLAUDE_HOME, "projects");
const POLL_INTERVAL = 2000;
const MAX_RECENT_ACTIONS = 20;

function buildAgentState(
  session: Awaited<ReturnType<typeof discoverSessions>>[number]
): AgentState {
  const transcriptPath = getTranscriptPath(
    PROJECTS_DIR,
    session.cwd,
    session.sessionId
  );

  let recentActions: TranscriptEntry[] = [];
  if (transcriptPath) {
    try {
      const raw = fs.readFileSync(transcriptPath, "utf-8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      const allEntries: TranscriptEntry[] = [];
      for (const line of lines) {
        const entry = parseTranscriptLine(line);
        if (entry) allEntries.push(entry);
      }
      recentActions = allEntries.slice(-MAX_RECENT_ACTIONS);
    } catch {
      // transcript not available
    }
  }

  const hostApp = resolveHostApp(
    session.pid,
    session.cwd,
    session.sessionId
  );

  return {
    sessionId: session.sessionId,
    pid: session.pid,
    cwd: session.cwd,
    status: session.status,
    currentAction: currentActionFromTranscript(recentActions),
    lastToolName:
      recentActions.length > 0 &&
      recentActions[recentActions.length - 1].type === "tool_use"
        ? recentActions[recentActions.length - 1].summary.split(" ")[0]
        : null,
    subagents: [],
    hostApp,
    startedAt: session.startedAt,
    recentActions,
  };
}

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const knownAgents = new Map<string, AgentState>();

      const poll = async () => {
        if (cancelled) return;

        try {
          const sessions = await discoverSessions(SESSIONS_DIR);
          const currentIds = new Set(sessions.map((s) => s.sessionId));

          for (const session of sessions) {
            const agent = buildAgentState(session);
            const existing = knownAgents.get(session.sessionId);

            if (!existing) {
              knownAgents.set(session.sessionId, agent);
              const event: StreamEvent = {
                event: "agent-added",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            } else if (
              existing.status !== agent.status ||
              existing.currentAction !== agent.currentAction ||
              existing.recentActions.length !== agent.recentActions.length
            ) {
              knownAgents.set(session.sessionId, agent);
              const event: StreamEvent = {
                event: "agent-updated",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          }

          for (const [id, agent] of knownAgents) {
            if (!currentIds.has(id)) {
              knownAgents.delete(id);
              const event: StreamEvent = {
                event: "agent-removed",
                agent,
              };
              controller.enqueue(
                encoder.encode(JSON.stringify(event) + "\n")
              );
            }
          }
        } catch {
          // continue polling
        }

        if (!cancelled) {
          setTimeout(poll, POLL_INTERVAL);
        }
      };

      await poll();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx next build 2>&1 | tail -5`

Expected: Build succeeds or only warns (no TypeScript errors in this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agents/stream/route.ts
git commit -m "feat: add streaming API route for agent discovery and updates"
```

---

### Task 9: Focus API Route

**Files:**
- Create: `src/app/api/agents/[sessionId]/focus/route.ts`

- [ ] **Step 1: Implement the focus endpoint**

Create `src/app/api/agents/[sessionId]/focus/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { resolveHostApp } from "@/lib/host-app";
import { focusWindow } from "@/lib/focus-window";
import type { RawSessionFile } from "@/lib/types";

const CLAUDE_HOME = path.join(process.env.HOME ?? "~", ".claude");
const SESSIONS_DIR = path.join(CLAUDE_HOME, "sessions");

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const { sessionId } = await params;

  let sessionFile: RawSessionFile | null = null;
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    for (const file of files) {
      const raw = fs.readFileSync(
        path.join(SESSIONS_DIR, file),
        "utf-8"
      );
      const data: RawSessionFile = JSON.parse(raw);
      if (data.sessionId === sessionId) {
        sessionFile = data;
        break;
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to read sessions" },
      { status: 500 }
    );
  }

  if (!sessionFile) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  const hostApp = resolveHostApp(
    sessionFile.pid,
    sessionFile.cwd,
    sessionId
  );

  if (!hostApp) {
    return NextResponse.json(
      { error: "Could not determine host application" },
      { status: 404 }
    );
  }

  const result = focusWindow(hostApp);

  return NextResponse.json({
    success: result.success,
    hostApp: { type: hostApp.type, name: hostApp.name },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/agents/\[sessionId\]/focus/route.ts
git commit -m "feat: add POST endpoint to focus host app window via AppleScript"
```

---

### Task 10: Zustand Agent Store

**Files:**
- Create: `src/store/agents.ts`, `tests/store/agents.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store/agents.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/store/agents";

describe("useAgentStore", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      theme: "office",
    });
  });

  it("adds an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "busy" as const,
      currentAction: "thinking" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    expect(useAgentStore.getState().agents["abc-123"]).toEqual(agent);
  });

  it("removes an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().removeAgent("abc-123");
    expect(useAgentStore.getState().agents["abc-123"]).toBeUndefined();
  });

  it("clears selection when selected agent is removed", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().selectAgent("abc-123");
    useAgentStore.getState().removeAgent("abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("updates an agent", () => {
    const agent = {
      sessionId: "abc-123",
      pid: 12345,
      cwd: "/test",
      status: "idle" as const,
      currentAction: "idle" as const,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: Date.now(),
      recentActions: [],
    };

    useAgentStore.getState().addAgent(agent);
    useAgentStore.getState().updateAgent({ ...agent, status: "busy" });
    expect(useAgentStore.getState().agents["abc-123"].status).toBe("busy");
  });

  it("selects and deselects an agent", () => {
    useAgentStore.getState().selectAgent("abc-123");
    expect(useAgentStore.getState().selectedAgentId).toBe("abc-123");

    useAgentStore.getState().selectAgent(null);
    expect(useAgentStore.getState().selectedAgentId).toBeNull();
  });

  it("changes the theme", () => {
    useAgentStore.getState().setTheme("farm");
    expect(useAgentStore.getState().theme).toBe("farm");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/store/agents.test.ts`

Expected: FAIL — `useAgentStore` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/store/agents.ts`:

```typescript
import { create } from "zustand";
import type { AgentState } from "@/lib/types";

export type Theme = "office" | "farm" | "workshop";

interface AgentStore {
  agents: Record<string, AgentState>;
  selectedAgentId: string | null;
  theme: Theme;

  addAgent: (agent: AgentState) => void;
  removeAgent: (sessionId: string) => void;
  updateAgent: (agent: AgentState) => void;
  selectAgent: (sessionId: string | null) => void;
  setTheme: (theme: Theme) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",

  addAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.sessionId]: agent },
    })),

  removeAgent: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.agents;
      return {
        agents: rest,
        selectedAgentId:
          state.selectedAgentId === sessionId ? null : state.selectedAgentId,
      };
    }),

  updateAgent: (agent) =>
    set((state) => ({
      agents: { ...state.agents, [agent.sessionId]: agent },
    })),

  selectAgent: (sessionId) => set({ selectedAgentId: sessionId }),

  setTheme: (theme) => set({ theme }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/store/agents.test.ts`

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/agents.ts tests/store/agents.test.ts
git commit -m "feat: add Zustand store for agent state, selection, and theme"
```

---

### Task 11: Client-Side Stream Hook

**Files:**
- Create: `src/hooks/use-agent-stream.ts`

- [ ] **Step 1: Implement the stream hook**

Create `src/hooks/use-agent-stream.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";
import type { StreamEvent } from "@/lib/types";

export function useAgentStream() {
  const addAgent = useAgentStore((s) => s.addAgent);
  const removeAgent = useAgentStore((s) => s.removeAgent);
  const updateAgent = useAgentStore((s) => s.updateAgent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      while (!cancelled) {
        try {
          const controller = new AbortController();
          abortRef.current = controller;

          const response = await fetch("/api/agents/stream", {
            signal: controller.signal,
          });

          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.trim().length === 0) continue;
              try {
                const event: StreamEvent = JSON.parse(line);
                switch (event.event) {
                  case "agent-added":
                    addAgent(event.agent);
                    break;
                  case "agent-removed":
                    removeAgent(event.agent.sessionId);
                    break;
                  case "agent-updated":
                    updateAgent(event.agent);
                    break;
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        } catch (err) {
          if (cancelled) return;
        }

        if (!cancelled) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [addAgent, removeAgent, updateAgent]);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-agent-stream.ts
git commit -m "feat: add useAgentStream hook for client-side streaming connection"
```

---

### Task 12: Theme System & Placeholder Sprites

**Files:**
- Create: `src/components/scene/themes/theme-types.ts`, `src/components/scene/themes/office.ts`, `src/components/scene/themes/farm.ts`, `src/components/scene/themes/workshop.ts`
- Create: placeholder sprite PNGs via a generation script

- [ ] **Step 1: Define the theme type interface**

Create `src/components/scene/themes/theme-types.ts`:

```typescript
import type { AgentAction } from "@/lib/types";

export interface TileConfig {
  src: string;
  tileWidth: number;
  tileHeight: number;
}

export interface PropConfig {
  slot: "workstation" | "entrance" | "storage";
  src: string;
  width: number;
  height: number;
}

export interface AgentAnimationConfig {
  src: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<AgentAction, { row: number; frames: number; speed: number }>;
}

export interface AgentSlot {
  x: number;
  y: number;
}

export interface SceneTheme {
  name: string;
  tileSize: number;
  gridCols: number;
  gridRows: number;
  floor: TileConfig;
  props: PropConfig[];
  agent: AgentAnimationConfig;
  agentSlots: AgentSlot[];
}
```

- [ ] **Step 2: Create the office theme config**

Create `src/components/scene/themes/office.ts`:

```typescript
import type { SceneTheme } from "./theme-types";

export const officeTheme: SceneTheme = {
  name: "office",
  tileSize: 32,
  gridCols: 8,
  gridRows: 6,
  floor: {
    src: "/sprites/office/floor.png",
    tileWidth: 32,
    tileHeight: 32,
  },
  props: [
    { slot: "entrance", src: "/sprites/office/door.png", width: 32, height: 64 },
    { slot: "workstation", src: "/sprites/office/desk.png", width: 64, height: 32 },
    { slot: "storage", src: "/sprites/office/cabinet.png", width: 32, height: 48 },
  ],
  agent: {
    src: "/sprites/office/agent.png",
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:          { row: 0, frames: 2, speed: 0.02 },
      thinking:      { row: 1, frames: 4, speed: 0.05 },
      "tool:Read":   { row: 2, frames: 2, speed: 0.03 },
      "tool:Edit":   { row: 3, frames: 4, speed: 0.08 },
      "tool:Bash":   { row: 4, frames: 4, speed: 0.06 },
      "tool:Write":  { row: 3, frames: 4, speed: 0.08 },
      "tool:Agent":  { row: 5, frames: 4, speed: 0.05 },
      "tool:other":  { row: 2, frames: 2, speed: 0.03 },
      writing:       { row: 3, frames: 4, speed: 0.1 },
    },
  },
  agentSlots: [
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
    { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 },
  ],
};
```

- [ ] **Step 3: Create the farm theme config**

Create `src/components/scene/themes/farm.ts`:

```typescript
import type { SceneTheme } from "./theme-types";

export const farmTheme: SceneTheme = {
  name: "farm",
  tileSize: 32,
  gridCols: 8,
  gridRows: 6,
  floor: {
    src: "/sprites/farm/floor.png",
    tileWidth: 32,
    tileHeight: 32,
  },
  props: [
    { slot: "entrance", src: "/sprites/farm/gate.png", width: 32, height: 64 },
    { slot: "workstation", src: "/sprites/farm/plot.png", width: 64, height: 32 },
    { slot: "storage", src: "/sprites/farm/barn.png", width: 32, height: 48 },
  ],
  agent: {
    src: "/sprites/farm/agent.png",
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:          { row: 0, frames: 2, speed: 0.02 },
      thinking:      { row: 1, frames: 4, speed: 0.05 },
      "tool:Read":   { row: 2, frames: 2, speed: 0.03 },
      "tool:Edit":   { row: 3, frames: 4, speed: 0.08 },
      "tool:Bash":   { row: 4, frames: 4, speed: 0.06 },
      "tool:Write":  { row: 3, frames: 4, speed: 0.08 },
      "tool:Agent":  { row: 5, frames: 4, speed: 0.05 },
      "tool:other":  { row: 2, frames: 2, speed: 0.03 },
      writing:       { row: 3, frames: 4, speed: 0.1 },
    },
  },
  agentSlots: [
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
    { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 },
  ],
};
```

- [ ] **Step 4: Create the workshop theme config**

Create `src/components/scene/themes/workshop.ts`:

```typescript
import type { SceneTheme } from "./theme-types";

export const workshopTheme: SceneTheme = {
  name: "workshop",
  tileSize: 32,
  gridCols: 8,
  gridRows: 6,
  floor: {
    src: "/sprites/workshop/floor.png",
    tileWidth: 32,
    tileHeight: 32,
  },
  props: [
    { slot: "entrance", src: "/sprites/workshop/garage-door.png", width: 32, height: 64 },
    { slot: "workstation", src: "/sprites/workshop/workbench.png", width: 64, height: 32 },
    { slot: "storage", src: "/sprites/workshop/shelf.png", width: 32, height: 48 },
  ],
  agent: {
    src: "/sprites/workshop/agent.png",
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      idle:          { row: 0, frames: 2, speed: 0.02 },
      thinking:      { row: 1, frames: 4, speed: 0.05 },
      "tool:Read":   { row: 2, frames: 2, speed: 0.03 },
      "tool:Edit":   { row: 3, frames: 4, speed: 0.08 },
      "tool:Bash":   { row: 4, frames: 4, speed: 0.06 },
      "tool:Write":  { row: 3, frames: 4, speed: 0.08 },
      "tool:Agent":  { row: 5, frames: 4, speed: 0.05 },
      "tool:other":  { row: 2, frames: 2, speed: 0.03 },
      writing:       { row: 3, frames: 4, speed: 0.1 },
    },
  },
  agentSlots: [
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
    { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 },
    { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 },
  ],
};
```

- [ ] **Step 5: Generate placeholder sprite sheets**

Create `scripts/generate-placeholders.ts`:

```typescript
import fs from "fs";
import path from "path";

// Generates simple colored PNG placeholders for each theme.
// Each sprite sheet is a 128x192 PNG (4 frames × 6 rows, 32×32 each).
// Floor tiles are 32x32. Props vary.
// We use a 1x1 pixel BMP-in-PNG trick for solid-color placeholders.

const THEMES = [
  { name: "office", floorColor: "#8B7355", agentColor: "#4169E1", propColor: "#696969" },
  { name: "farm",   floorColor: "#228B22", agentColor: "#DAA520", propColor: "#8B4513" },
  { name: "workshop", floorColor: "#708090", agentColor: "#FF6347", propColor: "#2F4F4F" },
];

function createMinimalPng(width: number, height: number, hex: string): Buffer {
  // Create a minimal valid PNG with a solid color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // For simplicity, use a canvas-free approach: write raw RGBA pixels into a PNG
  // This creates a tiny 1x1 PNG that browsers will stretch
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = c ^ buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: filter byte 0 + RGB
  const raw = Buffer.from([0, r, g, b]);
  const { deflateSync } = require("zlib");
  const compressed = deflateSync(raw);

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", iend),
  ]);
}

const publicDir = path.resolve(__dirname, "../public/sprites");

for (const theme of THEMES) {
  const dir = path.join(publicDir, theme.name);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, "floor.png"), createMinimalPng(32, 32, theme.floorColor));
  fs.writeFileSync(path.join(dir, "agent.png"), createMinimalPng(128, 192, theme.agentColor));
  fs.writeFileSync(path.join(dir, "desk.png"), createMinimalPng(64, 32, theme.propColor));
  fs.writeFileSync(path.join(dir, "plot.png"), createMinimalPng(64, 32, theme.propColor));
  fs.writeFileSync(path.join(dir, "workbench.png"), createMinimalPng(64, 32, theme.propColor));
  fs.writeFileSync(path.join(dir, "door.png"), createMinimalPng(32, 64, theme.propColor));
  fs.writeFileSync(path.join(dir, "gate.png"), createMinimalPng(32, 64, theme.propColor));
  fs.writeFileSync(path.join(dir, "garage-door.png"), createMinimalPng(32, 64, theme.propColor));
  fs.writeFileSync(path.join(dir, "cabinet.png"), createMinimalPng(32, 48, theme.propColor));
  fs.writeFileSync(path.join(dir, "barn.png"), createMinimalPng(32, 48, theme.propColor));
  fs.writeFileSync(path.join(dir, "shelf.png"), createMinimalPng(32, 48, theme.propColor));
}

console.log("Placeholder sprites generated.");
```

Run:
```bash
npx tsx scripts/generate-placeholders.ts
```

Expected: `public/sprites/{office,farm,workshop}/` directories created with PNG files.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/themes/ scripts/generate-placeholders.ts public/sprites/
git commit -m "feat: add theme system with office/farm/workshop configs and placeholder sprites"
```

---

### Task 13: PixiJS Scene Components

**Files:**
- Create: `src/components/scene/AgentVilleScene.tsx`, `src/components/scene/Tilemap.tsx`, `src/components/scene/AgentSprite.tsx`

- [ ] **Step 1: Create the AgentSprite component**

Create `src/components/scene/AgentSprite.tsx`:

```tsx
"use client";

import { useCallback, useRef } from "react";
import { Container, Sprite, Text } from "@pixi/react";
import { TextStyle } from "pixi.js";
import type { AgentAction } from "@/lib/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

interface AgentSpriteProps {
  x: number;
  y: number;
  sessionId: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
  animConfig: AgentAnimationConfig;
  onClick: (sessionId: string) => void;
  isSelected: boolean;
}

const labelStyle = new TextStyle({
  fontSize: 8,
  fill: 0xffffff,
  fontFamily: "monospace",
  align: "center",
});

const selectedLabelStyle = new TextStyle({
  fontSize: 8,
  fill: 0xffff00,
  fontFamily: "monospace",
  align: "center",
});

export function AgentSprite({
  x,
  y,
  sessionId,
  currentAction,
  status,
  animConfig,
  onClick,
  isSelected,
}: AgentSpriteProps) {
  const handleClick = useCallback(() => {
    onClick(sessionId);
  }, [onClick, sessionId]);

  const label = sessionId.slice(0, 6);
  const tint = status === "busy" ? 0xffffff : 0x888888;

  return (
    <Container x={x} y={y}>
      <Sprite
        image={animConfig.src}
        width={animConfig.frameWidth}
        height={animConfig.frameHeight}
        anchor={0.5}
        tint={tint}
        eventMode="static"
        cursor="pointer"
        pointerdown={handleClick}
      />
      <Text
        text={label}
        style={isSelected ? selectedLabelStyle : labelStyle}
        anchor={0.5}
        y={animConfig.frameHeight / 2 + 6}
      />
      {status === "busy" && (
        <Text
          text={formatAction(currentAction)}
          style={labelStyle}
          anchor={0.5}
          y={-(animConfig.frameHeight / 2 + 4)}
        />
      )}
    </Container>
  );
}

function formatAction(action: AgentAction): string {
  switch (action) {
    case "thinking":
      return "💭";
    case "tool:Read":
      return "📖";
    case "tool:Edit":
      return "✏️";
    case "tool:Bash":
      return "⚡";
    case "tool:Write":
      return "📝";
    case "tool:Agent":
      return "🤖";
    case "tool:other":
      return "🔧";
    case "writing":
      return "💬";
    case "idle":
      return "";
  }
}
```

- [ ] **Step 2: Create the Tilemap component**

Create `src/components/scene/Tilemap.tsx`:

```tsx
"use client";

import { Container, Sprite, TilingSprite } from "@pixi/react";
import type { SceneTheme } from "./themes/theme-types";

interface TilemapProps {
  theme: SceneTheme;
}

export function Tilemap({ theme }: TilemapProps) {
  const totalWidth = theme.gridCols * theme.tileSize;
  const totalHeight = theme.gridRows * theme.tileSize;

  return (
    <Container>
      <TilingSprite
        image={theme.floor.src}
        width={totalWidth}
        height={totalHeight}
        tilePosition={{ x: 0, y: 0 }}
      />
      {theme.props.map((prop, i) => {
        const positions = getPropPositions(prop.slot, theme);
        return positions.map((pos, j) => (
          <Sprite
            key={`${prop.slot}-${i}-${j}`}
            image={prop.src}
            x={pos.x}
            y={pos.y}
            width={prop.width}
            height={prop.height}
          />
        ));
      })}
    </Container>
  );
}

function getPropPositions(
  slot: string,
  theme: SceneTheme
): Array<{ x: number; y: number }> {
  const t = theme.tileSize;
  switch (slot) {
    case "entrance":
      return [{ x: 0, y: 0 }];
    case "workstation":
      return theme.agentSlots.map((s) => ({
        x: s.x * t - t / 2,
        y: s.y * t - t,
      }));
    case "storage":
      return [{ x: (theme.gridCols - 1) * t, y: (theme.gridRows - 2) * t }];
    default:
      return [];
  }
}
```

- [ ] **Step 3: Create the main scene wrapper**

Create `src/components/scene/AgentVilleScene.tsx`:

```tsx
"use client";

import { useCallback } from "react";
import { Application, Container } from "@pixi/react";
import { useAgentStore } from "@/store/agents";
import { Tilemap } from "./Tilemap";
import { AgentSprite } from "./AgentSprite";
import { officeTheme } from "./themes/office";
import { farmTheme } from "./themes/farm";
import { workshopTheme } from "./themes/workshop";
import type { SceneTheme } from "./themes/theme-types";
import type { Theme } from "@/store/agents";

const THEMES: Record<Theme, SceneTheme> = {
  office: officeTheme,
  farm: farmTheme,
  workshop: workshopTheme,
};

export function AgentVilleScene() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const themeName = useAgentStore((s) => s.theme);
  const theme = THEMES[themeName];

  const agentList = Object.values(agents);

  const handleAgentClick = useCallback(
    (sessionId: string) => {
      selectAgent(selectedAgentId === sessionId ? null : sessionId);
    },
    [selectAgent, selectedAgentId]
  );

  const sceneWidth = theme.gridCols * theme.tileSize;
  const sceneHeight = theme.gridRows * theme.tileSize;

  return (
    <Application
      width={sceneWidth}
      height={sceneHeight}
      background={0x1a1a2e}
      antialias={false}
      resolution={2}
    >
      <Container>
        <Tilemap theme={theme} />
        {agentList.map((agent, index) => {
          const slot = theme.agentSlots[index % theme.agentSlots.length];
          return (
            <AgentSprite
              key={agent.sessionId}
              x={slot.x * theme.tileSize}
              y={slot.y * theme.tileSize}
              sessionId={agent.sessionId}
              currentAction={agent.currentAction}
              status={agent.status}
              animConfig={theme.agent}
              onClick={handleAgentClick}
              isSelected={selectedAgentId === agent.sessionId}
            />
          );
        })}
      </Container>
    </Application>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/
git commit -m "feat: add PixiJS scene with tilemap, agent sprites, and theme switching"
```

---

### Task 14: UI Components — Header, SidePanel, ActionList, StatusBadge

**Files:**
- Create: `src/components/ui/Header.tsx`, `src/components/ui/SidePanel.tsx`, `src/components/ui/ActionList.tsx`, `src/components/ui/StatusBadge.tsx`
- Test: `tests/components/ui/Header.test.tsx`, `tests/components/ui/SidePanel.test.tsx`, `tests/components/ui/ActionList.test.tsx`

- [ ] **Step 1: Create StatusBadge**

Create `src/components/ui/StatusBadge.tsx`:

```tsx
"use client";

interface StatusBadgeProps {
  status: "busy" | "idle";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "busy"
          ? "bg-green-900/50 text-green-300"
          : "bg-gray-700/50 text-gray-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "busy" ? "bg-green-400 animate-pulse" : "bg-gray-500"
        }`}
      />
      {status === "busy" ? "Busy" : "Idle"}
    </span>
  );
}
```

- [ ] **Step 2: Create ActionList**

Create `src/components/ui/ActionList.tsx`:

```tsx
"use client";

import type { TranscriptEntry } from "@/lib/types";

interface ActionListProps {
  actions: TranscriptEntry[];
}

export function ActionList({ actions }: ActionListProps) {
  if (actions.length === 0) {
    return <p className="text-gray-500 text-sm italic">No activity yet</p>;
  }

  return (
    <ul className="space-y-1 max-h-64 overflow-y-auto">
      {[...actions].reverse().map((action, i) => (
        <li key={i} className="flex gap-2 text-xs font-mono">
          <span className="text-gray-500 shrink-0">
            {formatTime(action.timestamp)}
          </span>
          <span className="text-gray-300 truncate">{action.summary}</span>
        </li>
      ))}
    </ul>
  );
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
```

- [ ] **Step 3: Write ActionList test**

Create `tests/components/ui/ActionList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionList } from "@/components/ui/ActionList";

describe("ActionList", () => {
  it("shows 'No activity yet' when empty", () => {
    render(<ActionList actions={[]} />);
    expect(screen.getByText("No activity yet")).toBeDefined();
  });

  it("renders actions with timestamps", () => {
    const actions = [
      {
        timestamp: new Date("2024-01-01T09:41:12").getTime(),
        type: "tool_use" as const,
        summary: "Read src/app.ts",
      },
    ];
    render(<ActionList actions={actions} />);
    expect(screen.getByText("Read src/app.ts")).toBeDefined();
  });
});
```

- [ ] **Step 4: Run ActionList test**

Run: `npx vitest run tests/components/ui/ActionList.test.tsx`

Expected: 2 tests PASS.

- [ ] **Step 5: Create Header**

Create `src/components/ui/Header.tsx`:

```tsx
"use client";

import { useAgentStore, type Theme } from "@/store/agents";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "farm", label: "Farm" },
  { value: "workshop", label: "Workshop" },
];

export function Header() {
  const agents = useAgentStore((s) => s.agents);
  const theme = useAgentStore((s) => s.theme);
  const setTheme = useAgentStore((s) => s.setTheme);

  const agentList = Object.values(agents);
  const busyCount = agentList.filter((a) => a.status === "busy").length;
  const idleCount = agentList.filter((a) => a.status === "idle").length;

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white tracking-tight">
          AgentVille
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{agentList.length} agents</span>
          <span className="text-green-400">{busyCount} busy</span>
          <span className="text-gray-500">{idleCount} idle</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`px-3 py-1 text-xs rounded ${
              theme === opt.value
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Create SidePanel**

Create `src/components/ui/SidePanel.tsx`:

```tsx
"use client";

import { useAgentStore } from "@/store/agents";
import { StatusBadge } from "./StatusBadge";
import { ActionList } from "./ActionList";

export function SidePanel() {
  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const agent = selectedAgentId ? agents[selectedAgentId] : null;

  if (!agent) return null;

  const handleFocus = async () => {
    try {
      await fetch(`/api/agents/${agent.sessionId}/focus`, { method: "POST" });
    } catch {
      // focus failed silently
    }
  };

  const formatAction = (action: string): string => {
    if (action.startsWith("tool:")) return action.replace("tool:", "Using ");
    if (action === "thinking") return "Thinking...";
    if (action === "writing") return "Writing response...";
    return "Idle";
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white truncate">
            {agent.sessionId.slice(0, 8)}
          </h2>
          <button
            onClick={() => selectAgent(null)}
            className="text-gray-500 hover:text-white text-lg leading-none"
          >
            x
          </button>
        </div>
        <StatusBadge status={agent.status} />

        {agent.hostApp && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {agent.hostApp.name} — {shortenPath(agent.cwd)}
            </span>
            <button
              onClick={handleFocus}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded"
            >
              Focus
            </button>
          </div>
        )}
      </div>

      {/* Current Activity */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
          Current Activity
        </h3>
        <p className="text-sm text-white">
          {formatAction(agent.currentAction)}
        </p>
      </div>

      {/* Recent Actions */}
      <div className="p-4 border-b border-gray-800 flex-1 overflow-hidden">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Recent Actions
        </h3>
        <ActionList actions={agent.recentActions} />
      </div>

      {/* Subagents */}
      {agent.subagents.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Subagents
          </h3>
          <ul className="space-y-1">
            {agent.subagents.map((sub) => (
              <li
                key={sub.sessionId}
                onClick={() => selectAgent(sub.sessionId)}
                className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white"
              >
                <StatusBadge status={sub.status} />
                <span className="truncate">{sub.sessionId.slice(0, 8)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Session Info */}
      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
          Session Info
        </h3>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">Started</dt>
            <dd className="text-gray-300">
              {new Date(agent.startedAt).toLocaleTimeString()}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Directory</dt>
            <dd className="text-gray-300 truncate ml-4">
              {shortenPath(agent.cwd)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">PID</dt>
            <dd className="text-gray-300">{agent.pid}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function shortenPath(p: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ tests/components/ui/
git commit -m "feat: add Header, SidePanel, ActionList, and StatusBadge UI components"
```

---

### Task 15: AppShell & Main Page

**Files:**
- Create: `src/components/AppShell.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create AppShell**

Create `src/components/AppShell.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Header } from "./ui/Header";
import { SidePanel } from "./ui/SidePanel";

const AgentVilleScene = dynamic(
  () =>
    import("./scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export function AppShell() {
  useAgentStream();

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex items-center justify-center bg-gray-950 overflow-auto">
          <AgentVilleScene />
        </main>
        <SidePanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the root layout**

Replace the contents of `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentVille",
  description: "Visualize your AI agents at work",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Update the main page**

Replace the contents of `src/app/page.tsx`:

```tsx
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return <AppShell />;
}
```

- [ ] **Step 4: Update globals.css**

Replace the contents of `src/app/globals.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 5: Verify the app starts and renders**

Run:
```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: dark background, "AgentVille" header with theme buttons, and the PixiJS scene area. If any Claude Code sessions are running on the machine, they should appear as colored squares (placeholder sprites) in the scene. Clicking one should open the side panel.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppShell.tsx src/app/page.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: wire up AppShell with scene, header, side panel, and streaming"
```

---

### Task 16: Integration Test — End-to-End Smoke Test

**Files:**
- Create: `tests/integration/smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/integration/smoke.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { discoverSessions } from "@/lib/sessions";
import { parseTranscriptFile, currentActionFromTranscript } from "@/lib/transcript";
import { identifyAppFromProcessName } from "@/lib/host-app";
import { buildFocusScript } from "@/lib/focus-window";
import { useAgentStore } from "@/store/agents";

describe("integration: full pipeline", () => {
  const tmpDir = path.join(os.tmpdir(), "agentville-integration");
  const sessionsDir = path.join(tmpDir, "sessions");
  const projectsDir = path.join(tmpDir, "projects");
  const projectDir = path.join(projectsDir, "-Users-test-my-project");
  const fixturesDir = path.resolve(__dirname, "../../fixtures");

  beforeEach(() => {
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    useAgentStore.setState({ agents: {}, selectedAgentId: null, theme: "office" });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers a session, parses its transcript, resolves host info, and populates the store", async () => {
    // 1. Write a session file
    const sessionData = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, "session-busy.json"), "utf-8")
    );
    fs.writeFileSync(
      path.join(sessionsDir, "12345.json"),
      JSON.stringify(sessionData)
    );

    // 2. Write a transcript
    fs.copyFileSync(
      path.join(fixturesDir, "transcript-sample.jsonl"),
      path.join(projectDir, "abc-123-def.jsonl")
    );

    // 3. Discover sessions (with PID always alive)
    const sessions = await discoverSessions(sessionsDir, () => true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("abc-123-def");

    // 4. Parse transcript
    const entries = parseTranscriptFile(
      path.join(projectDir, "abc-123-def.jsonl")
    );
    expect(entries.length).toBeGreaterThan(0);

    // 5. Derive current action
    const action = currentActionFromTranscript(entries);
    expect(["thinking", "writing", "tool:Read", "tool:Edit", "tool:Bash", "tool:Write", "idle", "tool:other", "tool:Agent"]).toContain(action);

    // 6. Test host app identification
    expect(identifyAppFromProcessName("iTerm2")).toEqual({
      type: "terminal",
      name: "iTerm2",
    });

    // 7. Test focus script building
    const script = buildFocusScript({
      type: "terminal",
      name: "iTerm2",
      pid: 123,
      cwd: "/test",
    });
    expect(script).toContain("activate");

    // 8. Populate store
    const store = useAgentStore.getState();
    store.addAgent({
      sessionId: sessions[0].sessionId,
      pid: sessions[0].pid,
      cwd: sessions[0].cwd,
      status: sessions[0].status,
      currentAction: action,
      lastToolName: null,
      subagents: [],
      hostApp: null,
      startedAt: sessions[0].startedAt,
      recentActions: entries.slice(-20),
    });

    const agents = useAgentStore.getState().agents;
    expect(Object.keys(agents)).toHaveLength(1);
    expect(agents["abc-123-def"].status).toBe("busy");
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run tests/integration/smoke.test.ts`

Expected: 1 test PASS.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`

Expected: All tests pass (sessions, transcript, host-app, focus-window, agents store, ActionList, integration).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/smoke.test.ts
git commit -m "test: add end-to-end integration smoke test"
```

---

### Task 17: Final Verification & Cleanup

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build completes without errors.

- [ ] **Step 3: Start the app and verify visually**

Run: `npm run dev`

Open `http://localhost:3000`. Verify:
- Header shows "AgentVille" with agent count and theme buttons
- Theme buttons switch the scene tiles (different colored placeholders)
- If any Claude Code sessions are running, they appear as sprites in the scene
- Clicking a sprite opens the side panel with session details
- "Focus" button in the side panel brings the host app to the foreground
- Side panel shows recent actions with timestamps
- Closing the side panel (x button) deselects the agent

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```
