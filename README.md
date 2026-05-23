# agents-visual

A real-time visualization dashboard for Claude Code agents. It discovers running Claude Code sessions on your machine and renders each agent as a pixel-art sprite in a themed isometric scene, showing what every agent is doing at a glance.

## Features

- **Live agent discovery** — polls `~/.claude/sessions/` for active Claude Code processes and streams updates via SSE
- **Pixel-art scene** — agents are rendered as animated sprites on a PixiJS tilemap with idle/busy animations mapped to their current action (reading, editing, writing code, thinking, etc.)
- **Themes** — switch between Office, Farm, and Workshop tile sets, each with its own sprites and floor tiles
- **Side panel** — click an agent to inspect its session details, current action, working directory, subagents, and recent transcript
- **Resizable layout** — drag the handle between the scene and the side panel

## Tech Stack

- **Next.js 16** / React 19
- **PixiJS 8** + `@pixi/react` for the 2D scene
- **Zustand** for state management
- **Tailwind CSS 4** + shadcn/ui components
- **Vitest** (unit) + **Playwright** (E2E)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app will automatically discover any running Claude Code sessions.

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

## Project Structure

```
src/
  app/             # Next.js app router (pages, API routes)
    api/agents/    # SSE stream endpoint for agent state
  components/
    scene/         # PixiJS scene, tilemap, agent sprites, theme config
    ui/            # Header, SidePanel, action list, status badge
  hooks/           # useAgentStream (SSE client)
  lib/             # Session discovery, transcript parsing, types
  store/           # Zustand store (agents, theme, selection)
public/
  sprites/         # Pixel-art tile and character PNGs per theme
```
