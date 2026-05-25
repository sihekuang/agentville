# Character Animations — Design Spec

**Date:** 2026-05-24
**Status:** Approved

## Overview

Add a layered animation system to AgentVille's character sprites, delivered in three phases: procedural motion, sprite sheet frame animation, and theme-specific particle effects. The vibe is cozy and subtle — animations are felt more than seen, like watching a terrarium.

## Goals

- Make the scene feel alive without being distracting
- Leverage PixiJS v8's native `AnimatedSprite` for frame cycling
- Fix the current performance antipattern (setState inside useTick)
- Generate all sprite art programmatically via `generate-sprites.mjs`
- Support all 9 agent actions across all 3 themes
- Theme-specific particles that reinforce each world's identity

## Non-Goals

- Full walk cycles or locomotion (agents stay in their grid slot)
- Sound effects or music
- Hand-drawn art (everything stays programmatic)
- Animation blending or skeletal animation
- Dramatic or attention-grabbing motion

---

## Phasing

### Phase 1 — Procedural Motion

Immediate improvements using code-driven transforms on the existing single-frame sprites.

- Replace all `setState` calls in `useTick` with imperative refs (eliminates 240+ setState/sec per agent)
- Add breathing animation: subtle Y-scale oscillation (±2% scale, ~2Hz)
- Add squash/stretch on action transitions (0.15s elastic deformation)
- Add a drop shadow (small ellipse below sprite, scales with bob height)
- Refine existing bob/zzz/emote for cozy feel (slower, gentler curves)
- Anchor compensation so feet stay grounded during scale changes

### Phase 2 — Sprite Sheet Frames

Extend the sprite generator to produce multi-row sheets and wire up AnimatedSprite.

- Extend `generate-sprites.mjs` to output (max_frames×32)px × (9×32)px sprite sheets (128×288)
- Each row corresponds to one action, each column is one frame
- Add `useAnimationFrames` hook to slice `Texture[]` from sheet using `Rectangle` frames
- Swap `<pixiSprite>` for `<pixiAnimatedSprite>` with native frame cycling
- Use imperative ref to swap textures on action change via `useEffect`

### Phase 3 — Theme-Specific Particles

Ambient particle effects that reinforce what agents are doing.

- Add `AgentParticles.tsx` using raw `ParticleContainer` + `Particle`
- Sparse particles: 3-5 visible at a time max, 2-4px, low alpha
- Theme-specific particle designs (see Particle Effects section)
- Particles only appear during busy state (idle agents rest quietly, except farm fireflies)

---

## Technical Architecture

### File Changes

| File | Change |
|------|--------|
| `src/components/scene/AgentSprite.tsx` | Swap to `<pixiAnimatedSprite>`, replace setState with refs, add squash/stretch + breathing + shadow |
| `src/components/scene/use-animation-frames.ts` | New hook — loads sprite sheet, slices into `Texture[]` per action |
| `src/components/scene/AgentParticles.tsx` | New component (phase 3) — per-theme particle overlays |
| `scripts/generate-sprites.mjs` | Extend to output multi-row sheets |
| `src/components/scene/themes/theme-types.ts` | Add optional `particles` config to `SceneTheme` |
| Theme configs | No changes needed — already define row/frames/speed |

### Data Flow

```
Zustand store (status + currentAction)
  → useAnimationFrames(src, animConfig, currentAction, status)
    → slices Texture[] from sprite sheet for current action
      → <pixiAnimatedSprite textures={frames} animationSpeed={speed} />
        → useTick ref callback: breathing, squash, shadow, bob
          → AgentParticles reads action, emits themed particles
```

### Key Decisions

- `AnimatedSprite` handles frame cycling (no manual counters)
- `useEffect` on `[currentAction, status]` swaps textures via ref (imperative)
- All per-frame motion goes through refs — zero setState in useTick
- Particles are a sibling component, not nested in AgentSprite's tick loop
- Sprite sheets stay programmatic (generated, not hand-drawn)

### useAnimationFrames Hook

```typescript
function useAnimationFrames(
  src: string,
  animConfig: AgentAnimationConfig,
  currentAction: AgentAction,
  status: "busy" | "idle"
): Texture[] | null {
  // 1. Load base texture from src
  // 2. Determine action: status === "idle" ? "idle" : currentAction
  // 3. Look up { row, frames, speed } from animConfig.animations[action]
  // 4. Slice Texture[] using Rectangle(col*32, row*32, 32, 32) for each frame
  // 5. Memoize on [baseTexture, action] to avoid re-slicing
}
```

### Performance Model

Current (broken):
- `useTick` → `setBobY()`, `setEmoteY()`, `setEmoteAlpha()`, `setZzzPhase()` = 4 state updates × 60fps × N agents

After:
- `useTick` → direct ref mutations, zero React re-renders per frame
- React only re-renders on action/status change (infrequent, from Zustand)

---

## Sprite Sheet Frame Designs

All frames are cozy/subtle — small pose shifts, not dramatic animations. Each theme keeps its character identity (office = shirt + pants, farm = overalls + hat, workshop = jumpsuit + hardhat) with limbs/head shifting slightly.

| Action | Frames | Motion Description |
|--------|--------|-------------------|
| `idle` | 2 | Weight shift (body sways 1px left/right), occasional blink |
| `thinking` | 4 | Hand raises to chin, head tilts slightly |
| `tool:Read` | 2 | Arms forward (holding something), head bobs down |
| `tool:Edit` | 4 | Arms at desk height, fingers alternate (typing) |
| `tool:Bash` | 4 | Energetic typing — arms wider, slight forward lean |
| `tool:Write` | 4 | Typing with head nod (confirming) |
| `tool:Agent` | 4 | One arm raised (directing), body turned slightly |
| `tool:other` | 2 | Generic arm extend and return |
| `writing` | 4 | Gentle typing, longer hold on first frame |

### Frame Timing

- Idle: hold first frame ~80% of cycle time, blink is quick
- Busy actions: even frame distribution at speed from theme config
- Transitions: procedural squash/stretch bridges animation switches

---

## Particle Effects

Particles are sparse and ambient — 3-5 visible at a time, small (2-4px), low alpha, gentle drift.

### Particle Behavior (all themes)

- Spawn near sprite (random offset ±8px)
- Drift: mostly upward with slight horizontal wander
- Lifetime: 0.8–1.5 seconds
- Alpha: fade in quickly, fade out over last 40% of life
- Scale: start at 1x, shrink to 0.5x by end
- Implementation: raw `ParticleContainer` + `Particle` in `useTick`

### Office Theme

| Action | Particle |
|--------|----------|
| `thinking` | Tiny `?` and `...` dots float up |
| `tool:Edit` / `tool:Write` / `writing` | Code brackets `{ }` and `< >` drift upward |
| `tool:Bash` | Miniature `>_` terminal cursors spark outward |
| `tool:Read` | Faint page-corner shapes float up |
| `tool:Agent` | Signal/radio waves ripple outward |
| `idle` | Nothing (sleeping is quiet) |

### Farm Theme

| Action | Particle |
|--------|----------|
| `thinking` | Seed/pollen dots drift in gentle arcs |
| `tool:Edit` / `tool:Write` / `writing` | Small leaves rustle to the side |
| `tool:Bash` | Dirt/earth particles kick up |
| `tool:Read` | Flower petals drift |
| `tool:Agent` | Small bird silhouettes pass by |
| `idle` | Fireflies (tiny yellow dots with slow pulse) |

### Workshop Theme

| Action | Particle |
|--------|----------|
| `thinking` | Small gear outlines rotate and fade |
| `tool:Edit` / `tool:Write` / `writing` | Tiny sparks drift down (welding feel) |
| `tool:Bash` | Brighter sparks shoot out in short bursts |
| `tool:Read` | Blueprint-blue measurement lines appear briefly |
| `tool:Agent` | Small wrench/bolt shapes drift |
| `idle` | Gentle steam wisps rise |

---

## Sprite Sheet Generation

The `generate-sprites.mjs` script will be extended to:

1. Define frame variations per action (pixel offsets for limbs, head, blink state)
2. Output a single PNG per theme: 32px wide × (rows × 32px) tall
3. Row order matches the `row` field in theme animation configs
4. Each row contains N frames laid out horizontally (32px × frames wide, 32px tall)

Actual sheet dimensions per theme: `(max_frames × 32)` × `(9 × 32)` = 128×288 px (4 frames max × 9 rows).

Frame variations are defined as transforms on the base character: arm offsets, head position, eye state (open/closed), hand positions. The base drawing functions are parameterized to accept these offsets.
