@AGENTS.md

# AgentVille

## Styling: shadcn/ui + Tailwind CSS

This project uses **shadcn/ui** with **Tailwind CSS 4**. Follow these rules strictly:

### Use shadcn semantic color tokens, NOT raw Tailwind colors

shadcn defines CSS variables in `src/app/globals.css` for both `:root` (light) and `.dark` (dark) themes. These automatically switch when the `dark` class is toggled on `<html>`.

**Do this:**
```tsx
<div className="bg-background text-foreground">         // page backgrounds
<div className="bg-card text-card-foreground">           // cards, panels
<div className="bg-muted text-muted-foreground">         // secondary/muted areas
<div className="bg-primary text-primary-foreground">     // primary buttons
<div className="bg-secondary text-secondary-foreground"> // secondary buttons
<div className="bg-accent text-accent-foreground">       // hover states
<div className="bg-destructive">                         // destructive actions
<div className="border-border">                          // all borders
<div className="ring-ring">                              // focus rings
<div className="bg-popover text-popover-foreground">     // dropdowns, popovers
```

**Do NOT do this:**
```tsx
// WRONG: hardcoded grays with dark: variants
<div className="bg-gray-900 dark:bg-gray-950 text-white dark:text-gray-100">
<div className="border-gray-200 dark:border-gray-800">
```

Using raw colors with `dark:` prefixes bypasses the shadcn theme system and creates maintenance problems. The semantic tokens handle light/dark automatically.

### Dark mode strategy

- Dark mode uses the `class` strategy: `<html class="dark">`
- Defined in `globals.css` via `@custom-variant dark (&:is(.dark *));`
- Toggle dark mode by adding/removing the `dark` class on `<html>`
- The `@layer base` in `globals.css` sets `bg-background text-foreground` on `<body>` — this handles the base colors automatically
- Do NOT set `bg-*` or `text-*` on `<body>` in `layout.tsx` — let the base layer handle it

### Adding shadcn components

```bash
npx shadcn@latest add <component-name>
```

Components are installed to `src/components/ui/`. Do not modify generated shadcn component files unless necessary.

### react-resizable-panels (v4)

The shadcn Resizable component wraps `react-resizable-panels` v4. Key v4 API differences:

- Use `orientation` not `direction` on `ResizablePanelGroup`
- Use `panelRef` not `ref` for imperative panel handles
- Type is `PanelImperativeHandle` not `ImperativePanelHandle`
- Size props accept strings with units: `defaultSize="35%"`

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- PixiJS 8 + @pixi/react 8 (scene rendering, SSR disabled via dynamic import)
- Zustand 5 (state management)
- Tailwind CSS 4 + shadcn/ui (styling)
- Vitest (unit tests) + Playwright (E2E tests)

## Project Structure

```
src/
  app/              # Next.js app router (pages, API routes)
    api/agents/     # Streaming endpoint + focus endpoint
  components/
    scene/          # PixiJS scene, tilemap, agent sprites
      themes/       # Theme configs (office, farm, workshop)
    ui/             # shadcn components + custom UI (Header, SidePanel, etc.)
  hooks/            # useAgentStream (streaming client)
  lib/              # Session discovery, transcript parsing, host-app resolution, types
  store/            # Zustand store (agents, theme, selection, colorMode)
public/
  sprites/          # Pixel-art sprite sheets per theme
```

## Testing

```bash
npm test           # Vitest unit tests (excludes e2e/)
npm run test:e2e   # Playwright browser tests
```
