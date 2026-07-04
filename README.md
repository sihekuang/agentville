# AgentVille

A real-time visualization dashboard for AI coding agents. It discovers running **Claude Code** and **OpenAI Codex** sessions on your machine and renders each agent as a pixel-art sprite in a themed isometric scene, showing what every agent is doing at a glance.

![AgentVille scene with Claude Code and Codex agents](docs/screenshots/scene-multi-provider.png)

## Features

- **Live multi-provider discovery** — Claude Code sessions (from `~/.claude`) and Codex sessions (via `pgrep` + `lsof` on live `codex` processes) are streamed over SSE and rendered side-by-side in the same scene.
- **Pixel-art scene** — agents are animated sprites on a PixiJS tilemap; an emote above each sprite updates in real time as the agent works.
- **Rich activity vocabulary** — each agent's current activity maps to a neutral action shown as an emote:

  | Emote | Meaning | Emote | Meaning |
  |-------|---------|-------|---------|
  | 💭 | Thinking / planning | ❯_ | Running a shell command |
  | 💬 | Writing a response | 👀 | Monitoring a process |
  | 📖 | Reading & searching | 🤖 | Delegating to sub-agents |
  | ✏️ | Editing files | ❓ | Waiting for your input |
  | ⚡ | Running a tool | 🔧 | Using other tools |
  | ⏳ | Long-running (>1 min) | 💤 | Idle |

- **Picture-in-Picture** — pop the scene out into a floating, always-on-top window (⧉ button) so you can keep an eye on your agents while you work in another app. In the desktop app it can grow on hover or click and shrink back automatically (configurable in the side panel).
- **Side panel** — click an agent to inspect its full id (`<provider>:<sessionId>`), current action, host app, working directory, recent transcript, subagents, and session info. Click the directory to open it in Finder.
- **Double-click to focus** — brings the agent's host terminal or IDE window to the front (macOS).
- **Idle detection** — token-flow tracking marks stalled agents as idle; the idle timeout is configurable (1–30 min, or off).
- **Themes & appearance** — switch the scene between Office, Farm, and Workshop tile sets, and toggle light / dark / system appearance.
- **Resizable layout** — drag the handle between the scene and the side panel.
- **Pluggable provider architecture** — every agent is represented by a single shared `Agent` interface using a neutral action vocabulary (`thinking` / `reading` / `editing` / `executing` / `shell` / `monitoring` / `writing` / `delegating` / `other` / `waiting` / `idle`). Adding a new source (Gemini CLI, Cursor, …) is one new provider class + one `register()` call — no changes to the stream, store, or scene.

## Install

### Desktop app (macOS) — recommended

Download the latest signed & notarized build from the [**Releases**](https://github.com/sihekuang/agentville/releases/latest) page:

1. Download `AgentVille.zip` and unzip it.
2. Move `AgentVille.app` to `/Applications`.
3. Double-click to launch.
4. Grant **Accessibility** permission when prompted (needed for the focus and Picture-in-Picture expand features — see below).

The desktop build is the only way to get the always-on-top Picture-in-Picture window with hover/click expand.

### Homebrew (runs the web app locally)

```bash
brew tap sihekuang/agentville https://github.com/sihekuang/agentville.git
brew install agentville
agentville
```

Open [http://localhost:4200](http://localhost:4200). To use a different port:

```bash
AGENTVILLE_PORT=8080 agentville
```

Or run it as a background service:

```bash
brew services start agentville
```

### From source

```bash
npm install
npm run dev
```

Open [http://localhost:4200](http://localhost:4200). The app automatically discovers any running Claude Code or Codex sessions.

### macOS Accessibility permission

The **Focus** feature uses AppleScript and System Events to raise the specific window matching an agent's project. For this to work, the host app (the desktop app, or the Terminal/iTerm2/Warp/VS Code that runs the dev server) must be granted Accessibility access:

1. Open **System Settings → Privacy & Security → Accessibility**
2. Click **+** and add AgentVille (or the terminal/IDE you use to run `npm run dev`)

Without this permission, Focus will still activate the host application, but it won't be able to target the specific project window.

## Tech Stack

- **Next.js 16** / React 19
- **PixiJS 8** + `@pixi/react` for the 2D scene
- **Electron** for the packaged macOS desktop app
- **Zustand** for state management
- **Tailwind CSS 4** + shadcn/ui components
- **Vitest** (unit) + **Playwright** (E2E)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run electron:dev` | Run the desktop app against the dev server |
| `npm run electron:build` | Build the packaged macOS app (unsigned) |

## Project Structure

```
src/
  app/                # Next.js app router (pages, API routes)
    api/agents/       # SSE stream + focus endpoint
    pip/              # Picture-in-Picture window route
  components/
    scene/            # PixiJS scene, tilemap, agent sprites, theme config
    ui/               # Header, SidePanel, action list, status badge, PiP controls
  hooks/              # useAgentStream (SSE client), usePip, usePipExpand
  lib/
    providers/        # Agent / AgentProvider / ProviderRegistry; ClaudeCodeProvider; CodexProvider
    codex/            # Codex rollout parser + pgrep/lsof process discovery
    sessions.ts       # Claude session discovery
    transcript.ts     # Claude transcript parsing
    host-app.ts       # Resolve agent PID → host terminal/IDE for focus
    pip-*.ts          # Picture-in-Picture types, bounds, and resize helpers
  store/              # Zustand store (agents, theme, selection, PiP settings)
electron/             # Electron main/preload, PiP window management, packaging config
public/
  sprites/            # Pixel-art tile and character PNGs per theme
```

See [`AGENTS.md`](AGENTS.md) for the architecture principles (uniform `Agent` interface, SOLID, pluggable datasources).
