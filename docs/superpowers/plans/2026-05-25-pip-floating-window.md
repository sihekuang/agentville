# PIP Floating Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Picture-in-Picture functionality that pops the PixiJS canvas into a small, always-on-top floating window (Electron) or Document PIP window (browser).

**Architecture:** A `usePip()` hook detects the runtime environment and delegates to either Electron IPC (child BrowserWindow) or the Document Picture-in-Picture API. The main window swaps the canvas for a placeholder when PIP is active. Both environments share the same activation UI (button + keyboard shortcut).

**Tech Stack:** Electron BrowserWindow, Document Picture-in-Picture API, Zustand, React, Next.js App Router, Vitest, Playwright

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/store/agents.ts` | Add `pipActive` flag and `setPipActive` action |
| `src/hooks/usePip.ts` | Unified PIP hook — environment detection, activate/deactivate |
| `src/components/ui/PipPlaceholder.tsx` | Placeholder shown when canvas is in PIP mode |
| `src/components/scene/AgentVilleScene.tsx` | Add PIP button to scene controls |
| `src/components/AppShell.tsx` | Conditionally render canvas vs placeholder |
| `src/app/pip/page.tsx` | Dedicated route for Electron PIP window (canvas only) |
| `src/app/pip/layout.tsx` | Minimal layout for PIP route (theme provider, no chrome) |
| `electron/pip.ts` | PIP window creation/management/IPC handlers |
| `electron/main.ts` | Import PIP module, register keyboard shortcut |
| `electron/preload.ts` | Expose PIP IPC methods to renderer |
| `tests/store/pip.test.ts` | Store tests for pipActive state |
| `tests/hooks/usePip.test.ts` | Hook logic tests |
| `tests/components/PipPlaceholder.test.tsx` | Component render tests |
| `e2e/pip.spec.ts` | E2E tests for activation flow |

---

### Task 1: Store — Add `pipActive` State

**Files:**
- Modify: `src/store/agents.ts`
- Create: `tests/store/pip.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/store/pip.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/store/agents";

describe("pipActive state", () => {
  beforeEach(() => {
    useAgentStore.setState({
      agents: {},
      selectedAgentId: null,
      theme: "office",
      pipActive: false,
    });
  });

  it("defaults to false", () => {
    expect(useAgentStore.getState().pipActive).toBe(false);
  });

  it("setPipActive(true) activates PIP", () => {
    useAgentStore.getState().setPipActive(true);
    expect(useAgentStore.getState().pipActive).toBe(true);
  });

  it("setPipActive(false) deactivates PIP", () => {
    useAgentStore.getState().setPipActive(true);
    useAgentStore.getState().setPipActive(false);
    expect(useAgentStore.getState().pipActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/store/pip.test.ts`
Expected: FAIL — `pipActive` and `setPipActive` don't exist on the store type.

- [ ] **Step 3: Add pipActive to the store**

In `src/store/agents.ts`, add to the `AgentStore` interface:

```typescript
interface AgentStore {
  agents: Record<string, TrackedAgent>;
  selectedAgentId: string | null;
  theme: Theme;
  pipActive: boolean;

  addAgent: (agent: AgentState | TrackedAgent) => void;
  removeAgent: (sessionId: string) => void;
  updateAgent: (agent: AgentState | TrackedAgent) => void;
  selectAgent: (sessionId: string | null) => void;
  setTheme: (theme: Theme) => void;
  setPipActive: (active: boolean) => void;
}
```

Add the initial state and action to the `create` call:

```typescript
export const useAgentStore = create<AgentStore>((set) => ({
  agents: {},
  selectedAgentId: null,
  theme: "office",
  pipActive: false,

  // ... existing actions unchanged ...

  setPipActive: (active) => set({ pipActive: active }),
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store/pip.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `npx vitest run`
Expected: All tests PASS (the existing `agents.test.ts` `beforeEach` may need updating — add `pipActive: false` to the reset state if it fails).

- [ ] **Step 6: Commit**

```bash
git add src/store/agents.ts tests/store/pip.test.ts
git commit -m "feat(pip): add pipActive state to store"
```

---

### Task 2: PipPlaceholder Component

**Files:**
- Create: `src/components/ui/PipPlaceholder.tsx`
- Create: `tests/components/PipPlaceholder.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/PipPlaceholder.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipPlaceholder } from "@/components/ui/PipPlaceholder";

describe("PipPlaceholder", () => {
  it("renders the floating message", () => {
    render(<PipPlaceholder onRedock={() => {}} />);
    expect(screen.getByText("Canvas is floating")).toBeInTheDocument();
  });

  it("renders a Re-dock button", () => {
    render(<PipPlaceholder onRedock={() => {}} />);
    expect(screen.getByRole("button", { name: /re-dock/i })).toBeInTheDocument();
  });

  it("calls onRedock when button is clicked", () => {
    const onRedock = vi.fn();
    render(<PipPlaceholder onRedock={onRedock} />);
    fireEvent.click(screen.getByRole("button", { name: /re-dock/i }));
    expect(onRedock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PipPlaceholder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Install @testing-library/react if not present**

Run: `npm ls @testing-library/react` — if missing:
Run: `npm install -D @testing-library/react @testing-library/jest-dom`

Add to `vitest.config.ts` setupFiles if needed: create `tests/setup.ts` with:
```typescript
import "@testing-library/jest-dom/vitest";
```
And add `setupFiles: ["./tests/setup.ts"]` to the vitest config.

- [ ] **Step 4: Create PipPlaceholder component**

Create `src/components/ui/PipPlaceholder.tsx`:

```tsx
"use client";

interface PipPlaceholderProps {
  onRedock: () => void;
}

export function PipPlaceholder({ onRedock }: PipPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 bg-muted text-muted-foreground">
      <p className="text-lg font-medium">Canvas is floating</p>
      <button
        onClick={onRedock}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Re-dock
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/components/PipPlaceholder.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/PipPlaceholder.tsx tests/components/PipPlaceholder.test.tsx tests/setup.ts vitest.config.ts
git commit -m "feat(pip): add PipPlaceholder component"
```

---

### Task 3: usePip Hook — Core Logic

**Files:**
- Create: `src/hooks/usePip.ts`
- Create: `tests/hooks/usePip.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/hooks/usePip.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentStore } from "@/store/agents";

// Mock window.electronAPI
const mockElectronAPI = {
  pipActivate: vi.fn(),
  pipDeactivate: vi.fn(),
  onPipActivated: vi.fn(() => () => {}),
  onPipDeactivated: vi.fn(() => () => {}),
};

describe("usePip", () => {
  beforeEach(() => {
    useAgentStore.setState({ pipActive: false });
    vi.resetModules();
    // Clean up window mocks
    delete (window as any).electronAPI;
    delete (window as any).documentPictureInPicture;
  });

  it("returns supported: false when no PIP API available", async () => {
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(false);
  });

  it("returns backend: 'electron' when electronAPI is present", async () => {
    (window as any).electronAPI = mockElectronAPI;
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("electron");
  });

  it("returns backend: 'browser' when documentPictureInPicture is present", async () => {
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    expect(result.current.supported).toBe(true);
    expect(result.current.backend).toBe("browser");
  });

  it("prefers electron over browser when both available", async () => {
    (window as any).electronAPI = mockElectronAPI;
    (window as any).documentPictureInPicture = { requestWindow: vi.fn() };
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    expect(result.current.backend).toBe("electron");
  });

  it("activate() calls electronAPI.pipActivate in electron mode", async () => {
    (window as any).electronAPI = mockElectronAPI;
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.activate();
    });
    expect(mockElectronAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("deactivate() calls electronAPI.pipDeactivate in electron mode", async () => {
    (window as any).electronAPI = mockElectronAPI;
    useAgentStore.setState({ pipActive: true });
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.deactivate();
    });
    expect(mockElectronAPI.pipDeactivate).toHaveBeenCalledOnce();
  });

  it("toggle() activates when inactive", async () => {
    (window as any).electronAPI = mockElectronAPI;
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockElectronAPI.pipActivate).toHaveBeenCalledOnce();
  });

  it("toggle() deactivates when active", async () => {
    (window as any).electronAPI = mockElectronAPI;
    useAgentStore.setState({ pipActive: true });
    const { usePip } = await import("@/hooks/usePip");
    const { result } = renderHook(() => usePip());
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockElectronAPI.pipDeactivate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/usePip.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the usePip hook**

Create `src/hooks/usePip.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agents";

type PipBackend = "electron" | "browser";

interface ElectronAPI {
  pipActivate: () => void;
  pipDeactivate: () => void;
  onPipActivated: (callback: () => void) => () => void;
  onPipDeactivated: (callback: () => void) => () => void;
}

interface UsePipResult {
  supported: boolean;
  backend: PipBackend | null;
  active: boolean;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  toggle: () => Promise<void>;
}

function getBackend(): PipBackend | null {
  if (typeof window === "undefined") return null;
  if ("electronAPI" in window && (window as any).electronAPI?.pipActivate) {
    return "electron";
  }
  if ("documentPictureInPicture" in window) {
    return "browser";
  }
  return null;
}

export function usePip(): UsePipResult {
  const pipActive = useAgentStore((s) => s.pipActive);
  const setPipActive = useAgentStore((s) => s.setPipActive);
  const pipWindowRef = useRef<Window | null>(null);
  const backend = getBackend();

  // Listen for Electron IPC pip:activated / pip:deactivated
  useEffect(() => {
    if (backend !== "electron") return;
    const api = (window as any).electronAPI as ElectronAPI;
    const offActivated = api.onPipActivated(() => setPipActive(true));
    const offDeactivated = api.onPipDeactivated(() => setPipActive(false));
    return () => {
      offActivated();
      offDeactivated();
    };
  }, [backend, setPipActive]);

  const activate = useCallback(async () => {
    if (pipActive) return;

    if (backend === "electron") {
      const api = (window as any).electronAPI as ElectronAPI;
      api.pipActivate();
    } else if (backend === "browser") {
      const pipWin = await (window as any).documentPictureInPicture.requestWindow({
        width: 400,
        height: 300,
      });
      pipWindowRef.current = pipWin;

      // Copy stylesheets
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.href) {
            const link = pipWin.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pipWin.document.head.appendChild(link);
          } else if (sheet.cssRules) {
            const style = pipWin.document.createElement("style");
            for (const rule of sheet.cssRules) {
              style.textContent += rule.cssText;
            }
            pipWin.document.head.appendChild(style);
          }
        } catch {
          // CORS stylesheet — skip
        }
      }

      // Copy dark class
      if (document.documentElement.classList.contains("dark")) {
        pipWin.document.documentElement.classList.add("dark");
      }

      // Dispatch custom event so PipCanvas can mount into pipWin
      window.dispatchEvent(
        new CustomEvent("pip:window-ready", { detail: { pipWindow: pipWin } })
      );

      pipWin.addEventListener("pagehide", () => {
        pipWindowRef.current = null;
        setPipActive(false);
      });

      setPipActive(true);
    }
  }, [backend, pipActive, setPipActive]);

  const deactivate = useCallback(async () => {
    if (!pipActive) return;

    if (backend === "electron") {
      const api = (window as any).electronAPI as ElectronAPI;
      api.pipDeactivate();
    } else if (backend === "browser") {
      pipWindowRef.current?.close();
      pipWindowRef.current = null;
      setPipActive(false);
    }
  }, [backend, pipActive, setPipActive]);

  const toggle = useCallback(async () => {
    if (pipActive) {
      await deactivate();
    } else {
      await activate();
    }
  }, [pipActive, activate, deactivate]);

  return {
    supported: backend !== null,
    backend,
    active: pipActive,
    activate,
    deactivate,
    toggle,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/hooks/usePip.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePip.ts tests/hooks/usePip.test.ts
git commit -m "feat(pip): add usePip hook with electron and browser backends"
```

---

### Task 4: AppShell — Conditional Canvas vs Placeholder

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Update AppShell to conditionally render canvas or placeholder**

Replace the contents of `src/components/AppShell.tsx` with:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { useAgentStore } from "@/store/agents";
import { usePip } from "@/hooks/usePip";
import { Header } from "./ui/Header";
import { SidePanel } from "./ui/SidePanel";
import { PipPlaceholder } from "./ui/PipPlaceholder";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./ui/resizable";

const AgentVilleScene = dynamic(
  () =>
    import("./scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export function AppShell() {
  useAgentStream();
  const pipActive = useAgentStore((s) => s.pipActive);
  const { deactivate } = usePip();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize="65%" minSize="30%">
          <main className="bg-background h-full overflow-hidden p-4">
            {pipActive ? (
              <PipPlaceholder onRedock={deactivate} />
            ) : (
              <AgentVilleScene />
            )}
          </main>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel
          defaultSize="35%"
          minSize="20%"
          maxSize="60%"
        >
          <SidePanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
```

- [ ] **Step 2: Run all tests to check nothing is broken**

Run: `npx vitest run`
Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(pip): swap canvas for placeholder when PIP is active"
```

---

### Task 5: PIP Button in Scene Controls

**Files:**
- Modify: `src/components/scene/AgentVilleScene.tsx`

- [ ] **Step 1: Add PIP button to the scene controls div**

In `src/components/scene/AgentVilleScene.tsx`, import the hook at the top:

```typescript
import { usePip } from "@/hooks/usePip";
```

Inside the `AgentVilleScene` component function, add:

```typescript
const { supported: pipSupported, activate: activatePip } = usePip();
```

Then in the JSX, add the PIP button before the zoom controls. Replace the controls `<div>` at the bottom:

```tsx
<div className="absolute bottom-3 right-3 flex gap-1">
  {pipSupported && (
    <button
      onClick={activatePip}
      className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
      title="Picture in Picture"
    >
      ⧉
    </button>
  )}
  <button
    onClick={handleZoomIn}
    className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
    title="Zoom in"
  >
    +
  </button>
  <button
    onClick={handleZoomOut}
    className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
    title="Zoom out"
  >
    −
  </button>
  <button
    onClick={handleFitAll}
    className="w-7 h-7 flex items-center justify-center text-sm rounded bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
    title="Fit all agents in view"
  >
    ⊡
  </button>
</div>
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/AgentVilleScene.tsx
git commit -m "feat(pip): add PIP button to scene controls"
```

---

### Task 6: Keyboard Shortcut (Cmd+Shift+P)

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Add keyboard listener for Cmd+Shift+P**

In `src/components/AppShell.tsx`, add a `useEffect` for the keyboard shortcut inside the `AppShell` component, after the existing hook calls:

```typescript
import { useEffect } from "react";

// Inside AppShell component:
const { deactivate, toggle } = usePip();

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
      e.preventDefault();
      toggle();
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggle]);
```

Note: update the destructuring of `usePip()` to also get `toggle`:
```typescript
const { deactivate, toggle } = usePip();
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat(pip): add Cmd+Shift+P keyboard shortcut to toggle PIP"
```

---

### Task 7: Electron Preload — Expose PIP IPC

**Files:**
- Modify: `electron/preload.ts`

- [ ] **Step 1: Add PIP IPC exposure to preload**

Replace `electron/preload.ts` with:

```typescript
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  pipActivate: () => ipcRenderer.send("pip:activate"),
  pipDeactivate: () => ipcRenderer.send("pip:deactivate"),
  onPipActivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("pip:activated", handler);
    return () => ipcRenderer.removeListener("pip:activated", handler);
  },
  onPipDeactivated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("pip:deactivated", handler);
    return () => ipcRenderer.removeListener("pip:deactivated", handler);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.ts
git commit -m "feat(pip): expose PIP IPC methods in preload"
```

---

### Task 8: Electron PIP Window Manager

**Files:**
- Create: `electron/pip.ts`

- [ ] **Step 1: Create the PIP window module**

Create `electron/pip.ts`:

```typescript
import { BrowserWindow, ipcMain, screen } from "electron";

let pipWindow: BrowserWindow | null = null;

export function setupPip(mainWindow: BrowserWindow, getPort: () => number) {
  ipcMain.on("pip:activate", () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.focus();
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;

    pipWindow = new BrowserWindow({
      width: 400,
      height: 300,
      minWidth: 200,
      minHeight: 150,
      x: screenW - 400 - 20,
      y: screenH - 300 - 20,
      frame: false,
      alwaysOnTop: true,
      visibleOnAllWorkspaces: true,
      skipTaskbar: true,
      resizable: true,
      roundedCorners: true,
      parent: mainWindow,
      webPreferences: {
        preload: mainWindow.webContents.session.getPreloads?.()[0] || "",
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const port = getPort();
    pipWindow.loadURL(`http://127.0.0.1:${port}/pip`);

    pipWindow.once("ready-to-show", () => {
      mainWindow.webContents.send("pip:activated");
    });

    pipWindow.on("closed", () => {
      pipWindow = null;
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pip:deactivated");
      }
    });
  });

  ipcMain.on("pip:deactivate", () => {
    if (pipWindow && !pipWindow.isDestroyed()) {
      pipWindow.close();
    }
  });
}

export function closePipWindow() {
  if (pipWindow && !pipWindow.isDestroyed()) {
    pipWindow.close();
    pipWindow = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/pip.ts
git commit -m "feat(pip): add Electron PIP window manager"
```

---

### Task 9: Electron Main — Integrate PIP Module

**Files:**
- Modify: `electron/main.ts`

- [ ] **Step 1: Import and wire up PIP in main.ts**

Add imports at the top of `electron/main.ts`:

```typescript
import { setupPip, closePipWindow } from "./pip";
```

Add a variable to track the port:

```typescript
let appPort: number = 3000;
```

In the `createWindow` function, after `mainWindow.loadURL(...)`, add:

```typescript
setupPip(mainWindow, () => appPort);
```

In `app.on("ready", ...)`, store the port in both branches:

```typescript
app.on("ready", async () => {
  if (IS_DEV) {
    appPort = parseInt(process.env.DEV_PORT ?? "3000", 10);
    createWindow(appPort);
  } else {
    appPort = await findFreePort();
    await startNextServer(appPort);
    createWindow(appPort);
  }
});
```

In `app.on("window-all-closed", ...)`, add before `app.quit()`:

```typescript
closePipWindow();
```

- [ ] **Step 2: Build Electron to verify it compiles**

Run: `npx tsc --project electron/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat(pip): integrate PIP module into Electron main process"
```

---

### Task 10: PIP Route (Electron Window Content)

**Files:**
- Create: `src/app/pip/layout.tsx`
- Create: `src/app/pip/page.tsx`

- [ ] **Step 1: Create the PIP layout**

Create `src/app/pip/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "../globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentVille — PIP",
};

export default function PipLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the PIP page**

Create `src/app/pip/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";

const AgentVilleScene = dynamic(
  () =>
    import("@/components/scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export default function PipPage() {
  useAgentStream();

  return (
    <div className="w-screen h-screen overflow-hidden bg-background">
      <div className="w-full h-full pt-5">
        <AgentVilleScene />
      </div>
    </div>
  );
}
```

The `pt-5` (20px top padding) provides the drag region. The Electron frameless window uses `-webkit-app-region: drag` on this area — add the drag behavior via a small overlay:

Update `src/app/pip/page.tsx` to include the drag handle:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useAgentStream } from "@/hooks/use-agent-stream";

const AgentVilleScene = dynamic(
  () =>
    import("@/components/scene/AgentVilleScene").then((m) => ({
      default: m.AgentVilleScene,
    })),
  { ssr: false }
);

export default function PipPage() {
  useAgentStream();

  return (
    <div className="w-screen h-screen overflow-hidden bg-background relative">
      {/* Drag handle */}
      <div
        className="absolute top-0 left-0 right-0 h-5 z-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      {/* Close button */}
      <button
        className="absolute top-1 right-2 z-20 w-4 h-4 flex items-center justify-center text-xs rounded-full text-muted-foreground opacity-0 hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-opacity"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        onClick={() => window.close()}
      >
        ×
      </button>
      {/* Canvas */}
      <div className="w-full h-full pt-5">
        <AgentVilleScene />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the dev server compiles the new route**

Run: `npx next build --no-lint` (or just check that `npm run dev` doesn't error — if dev server is running, navigate to `http://localhost:3000/pip` in a browser to confirm it renders).

- [ ] **Step 4: Commit**

```bash
git add src/app/pip/layout.tsx src/app/pip/page.tsx
git commit -m "feat(pip): add /pip route for Electron PIP window content"
```

---

### Task 11: E2E Tests — PIP Activation Flow

**Files:**
- Create: `e2e/pip.spec.ts`

- [ ] **Step 1: Write E2E tests for PIP activation in browser**

Create `e2e/pip.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("PIP feature", () => {
  test("PIP button is visible in scene controls", async ({ page }) => {
    await page.goto("/");
    // Wait for canvas to render
    await expect(page.locator("canvas")).toBeVisible();
    // PIP button should be visible (if Document PIP API is available)
    // In Playwright's Chromium, documentPictureInPicture may not be available
    // So we inject it as a mock to test the UI flow
    await page.evaluate(() => {
      (window as any).documentPictureInPicture = {
        requestWindow: () =>
          Promise.resolve({
            document: {
              createElement: document.createElement.bind(document),
              head: { appendChild: () => {} },
              documentElement: { classList: { add: () => {} } },
              styleSheets: [],
            },
            addEventListener: () => {},
            close: () => {},
          }),
      };
    });
    // Reload to pick up the mock
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
    const pipButton = page.getByTitle("Picture in Picture");
    await expect(pipButton).toBeVisible();
  });

  test("clicking PIP button shows placeholder", async ({ page }) => {
    // Mock documentPictureInPicture before page loads
    await page.addInitScript(() => {
      (window as any).documentPictureInPicture = {
        requestWindow: () =>
          Promise.resolve({
            document: {
              createElement: (tag: string) => document.createElement(tag),
              head: { appendChild: () => {} },
              documentElement: { classList: { add: () => {} } },
            },
            addEventListener: () => {},
            close: () => {},
          }),
      };
    });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();

    const pipButton = page.getByTitle("Picture in Picture");
    await pipButton.click();

    // Canvas should be replaced by placeholder
    await expect(page.getByText("Canvas is floating")).toBeVisible();
    await expect(page.getByRole("button", { name: /re-dock/i })).toBeVisible();
  });

  test("clicking Re-dock restores the canvas", async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).documentPictureInPicture = {
        requestWindow: () =>
          Promise.resolve({
            document: {
              createElement: (tag: string) => document.createElement(tag),
              head: { appendChild: () => {} },
              documentElement: { classList: { add: () => {} } },
            },
            addEventListener: () => {},
            close: () => {},
          }),
      };
    });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();

    // Activate PIP
    await page.getByTitle("Picture in Picture").click();
    await expect(page.getByText("Canvas is floating")).toBeVisible();

    // Re-dock
    await page.getByRole("button", { name: /re-dock/i }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("Canvas is floating")).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test e2e/pip.spec.ts`
Expected: Tests pass (may need the dev server running — check `playwright.config.ts` for webServer config).

- [ ] **Step 3: Commit**

```bash
git add e2e/pip.spec.ts
git commit -m "test(pip): add E2E tests for PIP activation flow"
```

---

### Task 12: Manual Verification & Cleanup

**Files:** None new — manual testing only.

- [ ] **Step 1: Test in browser (Document PIP)**

1. Run `npm run dev`
2. Open `http://localhost:3000` in Chrome
3. Verify PIP button appears in scene controls (bottom-right)
4. Click PIP button — floating window should open with canvas
5. Verify canvas shows agents and is interactive (click, pan, zoom)
6. Close PIP window — main window should restore canvas
7. Test Cmd+Shift+P keyboard shortcut toggles PIP

- [ ] **Step 2: Test in Electron**

1. Run the Electron dev mode (or build): `npm run electron:dev` or equivalent
2. Verify PIP button appears
3. Click PIP button — always-on-top child window should open at bottom-right
4. Verify window is frameless, draggable (via top handle), resizable
5. Verify canvas in PIP window is interactive
6. Verify × button (hover to reveal) closes PIP
7. Verify Cmd+Shift+P works from both windows
8. Verify closing main window closes PIP too

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run && npx playwright test`
Expected: All tests PASS.

- [ ] **Step 4: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix(pip): address issues found during manual testing"
```
