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

## Focus Feature (macOS)

The focus feature uses AppleScript files in `scripts/macos/` to activate and raise specific application windows. The host terminal/IDE running the dev server needs **Accessibility** permission in System Settings for window-level targeting (AXRaise) to work. Without it, focus falls back to simple app activation.

- `focus-window.applescript` — activates app + raises matching window via System Events
- `focus-warp-tab.applescript` — Warp-specific tab matching
- `list-windows.applescript` — enumerates windows (title, index, bounds) as JSON
- `get-window-bounds.applescript` — single window bounds lookup

## Electron Packaging

### Build

```bash
npm run electron:build
```

This runs `scripts/build-electron.sh` which:
1. Builds Next.js in standalone mode
2. Copies standalone output + public assets + macOS scripts into `.electron-standalone/`
3. Compiles Electron TypeScript (`electron/` → `dist-electron/`)
4. Packages with electron-builder into `dist/` (DMG + .app)
5. Injects `node_modules` into the .app (electron-builder strips them from extraResources)

The build output is **unsigned**. Signing and notarization are handled separately.

### Sign & Notarize

After building, run the signing script from `~/Documents/AppleSigning/`:

```bash
~/Documents/AppleSigning/sign-and-notarize.sh
```

This script (not in the repo) handles:
1. Signing all native binaries (`.dylib`, `.node`, `.so`) inside `Contents/Resources/` — these get missed by electron-builder's initial signing since they're injected post-build
2. Re-signing the `.app` bundle with hardened runtime + entitlements
3. Rebuilding the DMG via `npx electron-builder --prepackaged` — this preserves electron-builder's built-in arrow background for the drag-and-drop install experience
4. Submitting to Apple for notarization via `xcrun notarytool`
5. Stapling the notarization ticket to both the DMG and .app
6. Verifying with `spctl`

Credentials are sourced from `~/Documents/AppleSigning/local-notarize.env`. The signing identity is auto-detected from the keychain.

### Why signing is separate from the build script

The build script (`scripts/build-electron.sh`) is checked into the repo and must stay generic — no personal signing identities, API keys, or machine-specific paths. The signing script lives outside the repo in `~/Documents/AppleSigning/` alongside the `.p12` cert and `.p8` API key.

### Key files

| File | Purpose |
|------|---------|
| `scripts/build-electron.sh` | Build pipeline (in repo) |
| `electron/main.ts` | Electron main process |
| `electron/preload.ts` | Preload script (minimal) |
| `electron/entitlements.mac.plist` | macOS entitlements (JIT, AppleEvents, etc.) |
| `electron/icon.icns` | macOS app icon |
| `package.json` `"build"` section | electron-builder config (app ID, DMG layout, targets) |

## Testing

```bash
npm test           # Vitest unit tests (excludes e2e/)
npm run test:e2e   # Playwright browser tests
```
