# Character Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-phase animation system (procedural motion, sprite sheet frames, theme-specific particles) to make AgentVille characters feel alive with a cozy, subtle vibe.

**Architecture:** Use PixiJS v8's native `AnimatedSprite` for frame cycling, imperative refs in `useTick` for procedural effects (breathing, squash/stretch, shadow), and lightweight text-based particles (max 5 per agent) for ambient theme-specific effects. All sprite art is generated programmatically via `scripts/generate-sprites.mjs`.

**Tech Stack:** PixiJS 8, @pixi/react 8, TypeScript, sharp (sprite generation), Vitest

---

## File Structure

| File | Phase | Role |
|------|-------|------|
| `src/components/scene/AgentSprite.tsx` | 1, 2 | Main character component — refactored from setState to refs (P1), then swapped from `<pixiSprite>` to `<pixiAnimatedSprite>` (P2) |
| `src/components/scene/use-animation-frames.ts` | 2 | Hook that loads sprite sheet and slices `Texture[]` per action |
| `src/components/scene/AgentParticles.tsx` | 3 | Particle overlay component using Text nodes + imperative refs |
| `src/components/scene/particle-configs.ts` | 3 | Per-theme particle definitions (shapes, colors, behavior) |
| `src/components/scene/themes/theme-types.ts` | 3 | Add `ParticleConfig` type |
| `scripts/generate-sprites.mjs` | 2 | Extended to output multi-row sprite sheets |
| `tests/components/scene/use-animation-frames.test.ts` | 2 | Unit tests for texture slicing hook |
| `tests/components/scene/AgentParticles.test.ts` | 3 | Unit tests for particle lifecycle |

**Note on row sharing:** The theme configs reuse rows — row 2 = `tool:Read` + `tool:other`, row 3 = `tool:Edit` + `tool:Write` + `writing`. The sprite sheet only needs 6 unique rows (0-5), not 9. Sheet dimensions: 128×192 per theme.

---

## Phase 1: Procedural Motion

### Task 1: Refactor AgentSprite to use imperative refs

**Files:**
- Modify: `src/components/scene/AgentSprite.tsx`

This task replaces all `useState` + `setState` calls inside `useTick` with direct ref mutations. Currently the component does 4 state updates per frame per agent (bobY, emoteY, emoteAlpha, zzzPhase), which triggers React re-renders at 60fps. After this change, `useTick` mutates PixiJS display objects directly via refs.

- [ ] **Step 1: Add container and text refs, remove animation useState**

In `src/components/scene/AgentSprite.tsx`, replace the animation state with refs. The component currently has:

```typescript
const [bobY, setBobY] = useState(0);
const [emoteY, setEmoteY] = useState(0);
const [emoteAlpha, setEmoteAlpha] = useState(1);
const [zzzPhase, setZzzPhase] = useState(0);
```

Replace with refs for each display object that needs per-frame updates:

```typescript
const containerRef = useRef<Container>(null);
const emoteRef = useRef<Text>(null);
const zzzRefs = useRef<(Text | null)[]>([null, null, null]);
```

Remove `useState` imports for `bobY`, `emoteY`, `emoteAlpha`, `zzzPhase`. Keep `timeRef` as is.

- [ ] **Step 2: Attach refs to JSX elements**

Update the JSX to attach refs:

```tsx
<pixiContainer
  ref={containerRef}
  x={x}
  y={y}
  eventMode="static"
  cursor="pointer"
  onPointerDown={handleClick}
  hitArea={hitArea}
>
```

For the emote text:
```tsx
{status === "busy" && emote && (
  <pixiText
    ref={emoteRef}
    text={emote}
    style={styles.emote}
    anchor={0.5}
    y={-animConfig.frameHeight / 2 - 6}
  />
)}
```

For the zzz texts, use callback refs:
```tsx
<pixiText
  ref={(el: Text | null) => { zzzRefs.current[0] = el; }}
  text="z"
  style={styles.zzz[0]}
  anchor={0.5}
  x={8}
  y={-animConfig.frameHeight / 2 - 2}
  alpha={0.4}
/>
```

Repeat for indices 1 and 2 with their respective initial positions.

- [ ] **Step 3: Rewrite useTick to use imperative ref mutations**

Replace the current `useTick` body. Instead of calling `setBobY()` etc., mutate the refs directly:

```typescript
useTick(useCallback((ticker) => {
  const dt = ticker.deltaTime / 60;
  timeRef.current += dt;
  const t = timeRef.current;
  const container = containerRef.current;
  if (!container) return;

  if (status === "busy") {
    container.y = y + Math.sin(t * 3) * 1.5;

    const emote = emoteRef.current;
    if (emote) {
      emote.y = -animConfig.frameHeight / 2 - 6 + Math.sin(t * 2) * 3;
      emote.alpha = 0.7 + Math.sin(t * 4) * 0.3;
    }
  } else {
    container.y = y + Math.sin(t * 0.8) * 0.5;

    const zzz = zzzRefs.current;
    for (let i = 0; i < 3; i++) {
      const z = zzz[i];
      if (!z) continue;
      z.y = -animConfig.frameHeight / 2 - 2 - i * 5.5 + Math.sin(t * 1.2 + i) * 2;
      z.alpha = (0.4 - i * 0.1) + Math.sin(t * 1.5 + i) * 0.3;
    }
  }

  // Selection arrows
  if (isSelected && selectorRefs.current) {
    const [left, right] = selectorRefs.current;
    if (left) left.x = -animConfig.frameWidth / 2 - 4 + Math.sin(t * 3) * 1.5;
    if (right) right.x = animConfig.frameWidth / 2 + 4 - Math.sin(t * 3) * 1.5;
  }
}, [status, y, animConfig.frameHeight, animConfig.frameWidth, isSelected]));
```

Add `selectorRefs` for the arrow texts:
```typescript
const selectorRefs = useRef<(Text | null)[]>([null, null]);
```

Attach them in JSX:
```tsx
<pixiText
  ref={(el: Text | null) => { selectorRefs.current[0] = el; }}
  text={"▶"}
  ...
/>
```

- [ ] **Step 4: Remove the y + bobY pattern from container**

The container now gets its `y` set imperatively in `useTick`, so the initial JSX should just use `y={y}` (the useTick callback overrides it every frame). Remove the `y={y + bobY}` pattern since `bobY` no longer exists.

- [ ] **Step 5: Run the dev server and verify animations look the same**

```bash
npm run dev
```

Open http://localhost:3000 in the browser. Verify:
- Busy agents bob up and down with floating emotes
- Idle agents sway gently with floating "zzz"
- Selection arrows pulse when an agent is clicked
- No visual regressions — behavior should be identical to before

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/AgentSprite.tsx
git commit -m "refactor: replace setState with imperative refs in AgentSprite useTick"
```

---

### Task 2: Add breathing animation and drop shadow

**Files:**
- Modify: `src/components/scene/AgentSprite.tsx`

- [ ] **Step 1: Add Graphics import and extend it**

At the top of `AgentSprite.tsx`:

```typescript
import { Container, Rectangle, Sprite, Text, TextStyle, Graphics, AnimatedSprite } from "pixi.js";
import { extend, useTick } from "@pixi/react";

extend({ Container, Sprite, Text, Graphics, AnimatedSprite });
```

- [ ] **Step 2: Add a sprite ref for breathing scale**

```typescript
const spriteRef = useRef<Sprite>(null);
```

Attach to the sprite JSX:
```tsx
<pixiSprite
  ref={spriteRef}
  texture={texture}
  width={animConfig.frameWidth}
  height={animConfig.frameHeight}
  anchor={0.5}
  tint={tint}
/>
```

- [ ] **Step 3: Add shadow ref and shadow graphic**

Add a ref:
```typescript
const shadowRef = useRef<Graphics>(null);
```

Add a shadow ellipse rendered below the sprite (before the sprite in JSX so it renders behind):

```tsx
<pixiGraphics
  ref={shadowRef}
  draw={(g: Graphics) => {
    g.clear();
    g.ellipse(0, animConfig.frameHeight / 2 + 1, 8, 3);
    g.fill({ color: 0x000000, alpha: 0.15 });
  }}
/>
```

- [ ] **Step 4: Add breathing and shadow updates to useTick**

Inside the `useTick` callback, add breathing for all states and shadow scaling:

```typescript
// Breathing — subtle Y-scale oscillation (both busy and idle)
const sprite = spriteRef.current;
if (sprite) {
  const breathe = Math.sin(t * 2) * 0.02;
  sprite.scale.y = 1.0 + breathe;
  sprite.y = -breathe * animConfig.frameHeight * 0.5;
}

// Shadow — scales inversely with bob height
const shadow = shadowRef.current;
if (shadow) {
  const bobOffset = container.y - y;
  const shadowScale = 1.0 - Math.abs(bobOffset) * 0.03;
  shadow.scale.x = shadowScale;
  shadow.alpha = 0.15 * shadowScale;
}
```

Place this code after the busy/idle bob logic, since it reads `container.y`.

- [ ] **Step 5: Verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Characters have a subtle breathing motion (body gently expands/contracts vertically)
- A small dark ellipse shadow appears below each character
- Shadow is slightly smaller/lighter when the agent bobs upward
- The feet stay grounded during breathing (no floating)

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/AgentSprite.tsx
git commit -m "feat: add breathing animation and drop shadow to agent sprites"
```

---

### Task 3: Add squash/stretch on action transitions

**Files:**
- Modify: `src/components/scene/AgentSprite.tsx`

- [ ] **Step 1: Add squash state ref**

```typescript
const squashRef = useRef({ active: false, t: 0 });
const prevActionRef = useRef(currentAction);
```

- [ ] **Step 2: Trigger squash on action change**

Add a `useEffect` that fires on action transitions:

```typescript
useEffect(() => {
  if (prevActionRef.current !== currentAction) {
    squashRef.current = { active: true, t: 0 };
    prevActionRef.current = currentAction;
  }
}, [currentAction]);
```

- [ ] **Step 3: Apply squash/stretch in useTick**

Inside `useTick`, after the breathing code, add:

```typescript
const sq = squashRef.current;
if (sq.active && sprite) {
  sq.t += dt;
  const duration = 0.15;
  const progress = Math.min(sq.t / duration, 1);
  const squashAmount = Math.sin(progress * Math.PI) * 0.12;
  sprite.scale.x = 1 + squashAmount;
  sprite.scale.y = 1 - squashAmount + Math.sin(t * 2) * 0.02;
  if (progress >= 1) {
    sq.active = false;
    sprite.scale.x = 1;
  }
}
```

Note: when squash is active, it overrides the breathing Y-scale. When squash ends, breathing resumes via the earlier code block.

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open the app. If no live agents, you can test by switching themes (which resets animConfig) or waiting for an agent to change actions. The squash should be a brief, subtle elastic deformation — not dramatic.

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/AgentSprite.tsx
git commit -m "feat: add squash/stretch animation on agent action transitions"
```

---

## Phase 2: Sprite Sheet Frames

### Task 4: Extend generate-sprites.mjs with parameterized character drawing

**Files:**
- Modify: `scripts/generate-sprites.mjs`

This task refactors the three agent drawing functions (`officeAgent`, `farmAgent`, `workshopAgent`) to accept pose parameters, so each can produce multiple frames with arm/head/eye variations.

- [ ] **Step 1: Add a pose parameter type and base character factory**

Add these helpers near the top of `generate-sprites.mjs`, after the existing color constants:

```javascript
// Pose parameters control limb/head offsets per frame
// dx/dy = pixel offsets from base position
function makePose(overrides = {}) {
  return {
    headDx: 0, headDy: 0,
    leftArmDy: 0, rightArmDy: 0,
    leftArmDx: 0, rightArmDx: 0,
    eyesClosed: false,
    leanDx: 0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Define pose sets for all 6 unique rows**

Each row needs its frame poses. Add after `makePose`:

```javascript
const ACTION_POSES = {
  // Row 0: idle (2 frames) — weight shift + blink
  idle: [
    makePose(),
    makePose({ leanDx: 1, eyesClosed: true }),
  ],
  // Row 1: thinking (4 frames) — hand to chin, head tilt
  thinking: [
    makePose(),
    makePose({ rightArmDy: -2 }),
    makePose({ rightArmDy: -3, headDx: 1, headDy: -1 }),
    makePose({ rightArmDy: -2, headDx: 1 }),
  ],
  // Row 2: reading/other (2 frames) — arms forward, head bob
  reading: [
    makePose({ leftArmDx: 1, rightArmDx: -1 }),
    makePose({ leftArmDx: 1, rightArmDx: -1, headDy: 1 }),
  ],
  // Row 3: editing/writing (4 frames) — typing motion
  editing: [
    makePose({ leftArmDy: -1 }),
    makePose({ rightArmDy: -1 }),
    makePose({ leftArmDy: -1, headDy: 1 }),
    makePose({ rightArmDy: -1 }),
  ],
  // Row 4: bash (4 frames) — energetic typing, wider arms, lean
  bash: [
    makePose({ leftArmDx: -1, rightArmDx: 1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, leftArmDy: -1, leanDx: -1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, rightArmDy: -1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, rightArmDy: -1, leanDx: 1 }),
  ],
  // Row 5: agent (4 frames) — arm raised, directing
  agent: [
    makePose({ rightArmDy: -3, rightArmDx: 1 }),
    makePose({ rightArmDy: -4, rightArmDx: 2 }),
    makePose({ rightArmDy: -3, rightArmDx: 1, leanDx: 1 }),
    makePose({ rightArmDy: -4, rightArmDx: 2, leanDx: 1 }),
  ],
};

const ROW_ORDER = ["idle", "thinking", "reading", "editing", "bash", "agent"];
const FRAMES_PER_ROW = { idle: 2, thinking: 4, reading: 2, editing: 4, bash: 4, agent: 4 };
```

- [ ] **Step 3: Refactor officeAgent to accept a pose**

Rename `officeAgent()` to `officeAgentFrame(pose)`. Apply the pose offsets to the existing pixel art. The key changes are:

```javascript
function officeAgentFrame(pose) {
  const g = fillGrid(32, 32, T);
  const lean = pose.leanDx || 0;

  // Hair (shifted by headDx/headDy)
  drawRect(g, 12 + pose.headDx + lean, 4 + pose.headDy, 8, 3, HAIR_DARK);
  drawPixel(g, 11 + pose.headDx + lean, 5 + pose.headDy, HAIR_DARK);
  drawPixel(g, 20 + pose.headDx + lean, 5 + pose.headDy, HAIR_DARK);

  // Head (shifted by headDx/headDy)
  drawRect(g, 12 + pose.headDx + lean, 6 + pose.headDy, 8, 8, SKIN);
  drawRect(g, 12 + pose.headDx + lean, 12 + pose.headDy, 8, 2, SKIN_SHADOW);

  // Eyes — open or closed
  if (pose.eyesClosed) {
    drawPixel(g, 14 + pose.headDx + lean, 9 + pose.headDy, SKIN_SHADOW);
    drawPixel(g, 15 + pose.headDx + lean, 9 + pose.headDy, SKIN_SHADOW);
    drawPixel(g, 18 + pose.headDx + lean, 9 + pose.headDy, SKIN_SHADOW);
    drawPixel(g, 19 + pose.headDx + lean, 9 + pose.headDy, SKIN_SHADOW);
  } else {
    drawPixel(g, 14 + pose.headDx + lean, 8 + pose.headDy, EYE);
    drawPixel(g, 15 + pose.headDx + lean, 8 + pose.headDy, EYE);
    drawPixel(g, 18 + pose.headDx + lean, 8 + pose.headDy, EYE);
    drawPixel(g, 19 + pose.headDx + lean, 8 + pose.headDy, EYE);
    drawPixel(g, 15 + pose.headDx + lean, 8 + pose.headDy, EYE_SHINE);
    drawPixel(g, 19 + pose.headDx + lean, 8 + pose.headDy, EYE_SHINE);
  }

  // Rosy cheeks
  drawPixel(g, 13 + pose.headDx + lean, 10 + pose.headDy, BLUSH);
  drawPixel(g, 20 + pose.headDx + lean, 10 + pose.headDy, BLUSH);

  // Smile
  drawPixel(g, 14 + pose.headDx + lean, 11 + pose.headDy, MOUTH);
  drawPixel(g, 15 + pose.headDx + lean, 12 + pose.headDy, MOUTH);
  drawPixel(g, 16 + pose.headDx + lean, 12 + pose.headDy, MOUTH);
  drawPixel(g, 17 + pose.headDx + lean, 12 + pose.headDy, MOUTH);
  drawPixel(g, 18 + pose.headDx + lean, 11 + pose.headDy, MOUTH);

  // Body (shifted by lean)
  drawRect(g, 10 + lean, 14, 12, 8, SHIRT_BLUE);
  drawRect(g, 10 + lean, 14, 12, 2, SHIRT_BLUE_D);
  drawRect(g, 14 + lean, 14, 4, 2, rgba(200, 200, 210));

  // Left arm (shifted by leftArmDx/leftArmDy)
  drawRect(g, 8 + lean + pose.leftArmDx, 15 + pose.leftArmDy, 2, 7, SHIRT_BLUE);
  drawRect(g, 8 + lean + pose.leftArmDx, 22 + pose.leftArmDy, 2, 2, SKIN);

  // Right arm (shifted by rightArmDx/rightArmDy)
  drawRect(g, 22 + lean + pose.rightArmDx, 15 + pose.rightArmDy, 2, 7, SHIRT_BLUE);
  drawRect(g, 22 + lean + pose.rightArmDx, 22 + pose.rightArmDy, 2, 2, SKIN);

  // Pants + legs + shoes (unchanged, anchored to ground)
  drawRect(g, 11, 22, 10, 4, PANTS_GRAY);
  drawRect(g, 11, 26, 4, 4, PANTS_GRAY);
  drawRect(g, 17, 26, 4, 4, PANTS_GRAY);
  drawRect(g, 11, 29, 4, 2, rgba(40, 40, 50));
  drawRect(g, 17, 29, 4, 2, rgba(40, 40, 50));

  return g;
}
```

- [ ] **Step 4: Refactor farmAgent and workshopAgent similarly**

Apply the same pattern to `farmAgent` → `farmAgentFrame(pose)` and `workshopAgent` → `workshopAgentFrame(pose)`. The structure is identical — apply `pose.headDx/headDy` to head/hair/eyes, `pose.leftArmDx/leftArmDy` to left arm, `pose.rightArmDx/rightArmDy` to right arm, `pose.leanDx` to body. Eyes closed draws `SKIN_SHADOW` lines instead of `EYE` pixels. Keep legs/feet/shoes anchored (no pose offset).

For `farmAgentFrame`: apply offsets to hat, head, overalls straps, arms. Hat moves with head.

For `workshopAgentFrame`: apply offsets to hard hat, head (with safety glasses), jumpsuit arms, gloves. Hard hat moves with head.

- [ ] **Step 5: Add sprite sheet assembly function**

Add a function that composes individual frames into a sheet:

```javascript
async function saveAgentSheet(agentFrameFn, filePath) {
  const maxFrames = 4;
  const rows = ROW_ORDER.length;
  const sheetWidth = maxFrames * 32;
  const sheetHeight = rows * 32;
  const sheet = fillGrid(sheetWidth, sheetHeight, T);

  for (let r = 0; r < rows; r++) {
    const actionName = ROW_ORDER[r];
    const poses = ACTION_POSES[actionName];
    for (let f = 0; f < poses.length; f++) {
      const frame = agentFrameFn(poses[f]);
      // Copy frame pixels into sheet at (f*32, r*32)
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          sheet[r * 32 + y][f * 32 + x] = frame[y][x];
        }
      }
    }
  }

  const { buf, width, height } = createPixelData(sheet);
  await sharp(buf, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);
  console.log(`  ✓ ${path.relative(SPRITES_DIR, filePath)}`);
}
```

- [ ] **Step 6: Update main() to generate sheets**

Replace the single agent calls with sheet generation:

```javascript
async function main() {
  console.log("Generating sprite assets...\n");

  console.log("Office theme:");
  await savePng(officeFloor(), path.join(SPRITES_DIR, "office", "floor.png"));
  await savePng(officeDoor(), path.join(SPRITES_DIR, "office", "door.png"));
  await savePng(officeDesk(), path.join(SPRITES_DIR, "office", "desk.png"));
  await savePng(officeCabinet(), path.join(SPRITES_DIR, "office", "cabinet.png"));
  await saveAgentSheet(officeAgentFrame, path.join(SPRITES_DIR, "office", "agent.png"));

  console.log("\nFarm theme:");
  await savePng(farmFloor(), path.join(SPRITES_DIR, "farm", "floor.png"));
  await savePng(farmGate(), path.join(SPRITES_DIR, "farm", "gate.png"));
  await savePng(farmPlot(), path.join(SPRITES_DIR, "farm", "plot.png"));
  await savePng(farmBarn(), path.join(SPRITES_DIR, "farm", "barn.png"));
  await saveAgentSheet(farmAgentFrame, path.join(SPRITES_DIR, "farm", "agent.png"));

  console.log("\nWorkshop theme:");
  await savePng(workshopFloor(), path.join(SPRITES_DIR, "workshop", "floor.png"));
  await savePng(workshopGarageDoor(), path.join(SPRITES_DIR, "workshop", "garage-door.png"));
  await savePng(workshopWorkbench(), path.join(SPRITES_DIR, "workshop", "workbench.png"));
  await savePng(workshopShelf(), path.join(SPRITES_DIR, "workshop", "shelf.png"));
  await saveAgentSheet(workshopAgentFrame, path.join(SPRITES_DIR, "workshop", "agent.png"));

  console.log("\nDone! All sprite assets generated.");
}
```

- [ ] **Step 7: Run the generator and verify output**

```bash
node scripts/generate-sprites.mjs
```

Expected output:
```
Generating sprite assets...

Office theme:
  ✓ office/floor.png
  ✓ office/door.png
  ✓ office/desk.png
  ✓ office/cabinet.png
  ✓ office/agent.png

Farm theme:
  ✓ farm/floor.png
  ✓ farm/gate.png
  ✓ farm/plot.png
  ✓ farm/barn.png
  ✓ farm/agent.png

Workshop theme:
  ✓ workshop/floor.png
  ✓ workshop/garage-door.png
  ✓ workshop/workbench.png
  ✓ workshop/shelf.png
  ✓ workshop/agent.png

Done! All sprite assets generated.
```

Verify the agent.png files are now larger:
```bash
file public/sprites/*/agent.png
```

Expected: each should be `128 x 192` (4 frames × 32 wide, 6 rows × 32 tall), not `32 x 32`.

- [ ] **Step 8: Commit**

```bash
git add scripts/generate-sprites.mjs public/sprites/
git commit -m "feat: generate multi-frame sprite sheets for all themes"
```

---

### Task 5: Create useAnimationFrames hook

**Files:**
- Create: `src/components/scene/use-animation-frames.ts`
- Create: `tests/components/scene/use-animation-frames.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/scene/use-animation-frames.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Texture, Rectangle } from "pixi.js";

// We test the pure slicing logic, not the hook itself (which needs React + PixiJS runtime)
import { sliceFrames } from "@/components/scene/use-animation-frames";

describe("sliceFrames", () => {
  let mockTexture: Texture;

  beforeEach(() => {
    mockTexture = { source: {} } as unknown as Texture;
    vi.spyOn(Texture.prototype, "constructor").mockImplementation(() => {});
  });

  it("returns correct number of frames for a 2-frame animation", () => {
    const anim = { row: 0, frames: 2, speed: 0.02 };
    const result = sliceFrames(mockTexture, anim, 32, 32);
    expect(result).toHaveLength(2);
  });

  it("returns correct number of frames for a 4-frame animation", () => {
    const anim = { row: 1, frames: 4, speed: 0.05 };
    const result = sliceFrames(mockTexture, anim, 32, 32);
    expect(result).toHaveLength(4);
  });

  it("creates textures with correct frame rectangles", () => {
    const anim = { row: 2, frames: 3, speed: 0.03 };
    const result = sliceFrames(mockTexture, anim, 32, 32);

    // Each texture should have the correct frame position
    expect(result[0].frame.x).toBe(0);
    expect(result[0].frame.y).toBe(64);
    expect(result[1].frame.x).toBe(32);
    expect(result[1].frame.y).toBe(64);
    expect(result[2].frame.x).toBe(64);
    expect(result[2].frame.y).toBe(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/components/scene/use-animation-frames.test.ts
```

Expected: FAIL — `sliceFrames` not found, module doesn't exist yet.

- [ ] **Step 3: Write the hook and exported sliceFrames**

Create `src/components/scene/use-animation-frames.ts`:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { Assets, Texture, Rectangle } from "pixi.js";
import type { AgentAction } from "@/lib/types";
import type { AgentAnimationConfig } from "./themes/theme-types";

export function sliceFrames(
  baseTexture: Texture,
  anim: { row: number; frames: number; speed: number },
  frameWidth: number,
  frameHeight: number,
): Texture[] {
  const frames: Texture[] = [];
  for (let i = 0; i < anim.frames; i++) {
    const frame = new Rectangle(
      i * frameWidth,
      anim.row * frameHeight,
      frameWidth,
      frameHeight,
    );
    frames.push(new Texture({ source: baseTexture.source, frame }));
  }
  return frames;
}

export function useAnimationFrames(
  src: string,
  animConfig: AgentAnimationConfig,
  currentAction: AgentAction,
  status: "busy" | "idle",
): { textures: Texture[] | null; speed: number } {
  const [baseTexture, setBaseTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    Assets.load<Texture>(src).then((t) => {
      if (!cancelled) setBaseTexture(t);
    });
    return () => { cancelled = true; };
  }, [src]);

  const action = status === "idle" ? "idle" : currentAction;
  const anim = animConfig.animations[action] ?? animConfig.animations.idle;

  const textures = useMemo(() => {
    if (!baseTexture) return null;
    return sliceFrames(baseTexture, anim, animConfig.frameWidth, animConfig.frameHeight);
  }, [baseTexture, anim.row, anim.frames, animConfig.frameWidth, animConfig.frameHeight]);

  return { textures, speed: anim.speed };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/components/scene/use-animation-frames.test.ts
```

Expected: tests may need adjustment depending on how PixiJS Texture constructor works in jsdom. If Texture constructor fails in test environment, mock it:

```typescript
vi.mock("pixi.js", async () => {
  const actual = await vi.importActual("pixi.js");
  return {
    ...actual,
    Texture: class MockTexture {
      frame: Rectangle;
      source: unknown;
      constructor({ source, frame }: { source: unknown; frame: Rectangle }) {
        this.source = source;
        this.frame = frame;
      }
    },
  };
});
```

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/use-animation-frames.ts tests/components/scene/use-animation-frames.test.ts
git commit -m "feat: add useAnimationFrames hook for sprite sheet texture slicing"
```

---

### Task 6: Swap AgentSprite to use AnimatedSprite

**Files:**
- Modify: `src/components/scene/AgentSprite.tsx`

This task replaces the static `<pixiSprite>` with `<pixiAnimatedSprite>` and wires up the `useAnimationFrames` hook.

- [ ] **Step 1: Import useAnimationFrames and update extend**

At the top of `AgentSprite.tsx`:

```typescript
import { Container, Rectangle, Sprite, Text, TextStyle, Graphics, AnimatedSprite } from "pixi.js";
import { extend, useTick } from "@pixi/react";
import { useAnimationFrames } from "./use-animation-frames";

extend({ Container, Sprite, Text, Graphics, AnimatedSprite });
```

- [ ] **Step 2: Replace useTexture with useAnimationFrames**

Remove the `useTexture` import and call. Replace:

```typescript
const texture = useTexture(animConfig.src);
```

With:

```typescript
const { textures, speed } = useAnimationFrames(animConfig.src, animConfig, currentAction, status);
```

- [ ] **Step 3: Change sprite ref type from Sprite to AnimatedSprite**

```typescript
const spriteRef = useRef<AnimatedSprite>(null);
```

- [ ] **Step 4: Add useEffect to swap textures on action change**

```typescript
useEffect(() => {
  const sprite = spriteRef.current;
  if (!sprite || !textures) return;
  sprite.textures = textures;
  sprite.animationSpeed = speed;
  sprite.loop = true;
  sprite.play();
}, [textures, speed]);
```

- [ ] **Step 5: Replace pixiSprite JSX with pixiAnimatedSprite**

Replace:

```tsx
{texture && (
  <pixiSprite
    ref={spriteRef}
    texture={texture}
    width={animConfig.frameWidth}
    height={animConfig.frameHeight}
    anchor={0.5}
    tint={tint}
  />
)}
```

With:

```tsx
{textures && (
  <pixiAnimatedSprite
    ref={spriteRef}
    textures={textures}
    animationSpeed={speed}
    loop={true}
    playing={true}
    anchor={0.5}
    tint={tint}
  />
)}
```

- [ ] **Step 6: Remove the old useTexture import**

Delete the import line:
```typescript
// Remove: import { useTexture } from "./use-texture";
```

- [ ] **Step 7: Verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Characters now cycle through frames (subtle pose shifts visible)
- Idle agents alternate between standing and blink
- Busy agents show action-appropriate animations (typing, thinking, etc.)
- Breathing, shadow, squash/stretch from Phase 1 still work
- Emotes and zzz still display correctly
- Theme switching still works

- [ ] **Step 8: Commit**

```bash
git add src/components/scene/AgentSprite.tsx
git commit -m "feat: swap to AnimatedSprite with sprite sheet frame cycling"
```

---

## Phase 3: Theme-Specific Particles

### Task 7: Add particle type definitions

**Files:**
- Modify: `src/components/scene/themes/theme-types.ts`
- Create: `src/components/scene/particle-configs.ts`

- [ ] **Step 1: Add particle types to theme-types.ts**

Add to `src/components/scene/themes/theme-types.ts`:

```typescript
export interface ParticleStyle {
  text: string;
  color: number;
  fontSize: number;
}

export interface ParticleActionConfig {
  styles: ParticleStyle[];
  spawnRate: number;
  drift: { dx: number; dy: number };
  lifetime: { min: number; max: number };
}

export type ParticleMap = Partial<Record<AgentAction, ParticleActionConfig>>;
```

- [ ] **Step 2: Create particle-configs.ts with all three themes**

Create `src/components/scene/particle-configs.ts`:

```typescript
import type { ParticleMap } from "./themes/theme-types";

export const officeParticles: ParticleMap = {
  thinking: {
    styles: [
      { text: "?", color: 0xaaaacc, fontSize: 4 },
      { text: "·", color: 0x8888aa, fontSize: 3 },
      { text: "·", color: 0x9999bb, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 0, dy: -12 },
    lifetime: { min: 0.8, max: 1.3 },
  },
  "tool:Edit": {
    styles: [
      { text: "{", color: 0x80b0e0, fontSize: 4 },
      { text: "}", color: 0x80b0e0, fontSize: 4 },
      { text: "<", color: 0x90c0a0, fontSize: 3 },
      { text: ">", color: 0x90c0a0, fontSize: 3 },
    ],
    spawnRate: 0.5,
    drift: { dx: 0, dy: -10 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  "tool:Write": {
    styles: [
      { text: "{", color: 0x80b0e0, fontSize: 4 },
      { text: "}", color: 0x80b0e0, fontSize: 4 },
    ],
    spawnRate: 0.5,
    drift: { dx: 0, dy: -10 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  writing: {
    styles: [
      { text: "<", color: 0x90c0a0, fontSize: 3 },
      { text: ">", color: 0x90c0a0, fontSize: 3 },
    ],
    spawnRate: 0.4,
    drift: { dx: 0, dy: -10 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  "tool:Bash": {
    styles: [
      { text: ">", color: 0x60dd60, fontSize: 3 },
      { text: "_", color: 0x60dd60, fontSize: 3 },
    ],
    spawnRate: 0.6,
    drift: { dx: 4, dy: -6 },
    lifetime: { min: 0.6, max: 1.0 },
  },
  "tool:Read": {
    styles: [
      { text: "◰", color: 0xccccaa, fontSize: 3 },
      { text: "▫", color: 0xbbbb99, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 0, dy: -8 },
    lifetime: { min: 1.0, max: 1.5 },
  },
  "tool:Agent": {
    styles: [
      { text: "~", color: 0xaaddff, fontSize: 3 },
      { text: "·", color: 0xaaddff, fontSize: 2 },
    ],
    spawnRate: 0.5,
    drift: { dx: 6, dy: -4 },
    lifetime: { min: 0.6, max: 1.2 },
  },
};

export const farmParticles: ParticleMap = {
  thinking: {
    styles: [
      { text: "·", color: 0xddcc66, fontSize: 2 },
      { text: "°", color: 0xccbb55, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 3, dy: -6 },
    lifetime: { min: 1.0, max: 1.5 },
  },
  "tool:Edit": {
    styles: [
      { text: "🌿", color: 0x66aa44, fontSize: 3 },
      { text: "·", color: 0x55aa33, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 4, dy: -4 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  "tool:Write": {
    styles: [
      { text: "🌿", color: 0x66aa44, fontSize: 3 },
    ],
    spawnRate: 0.4,
    drift: { dx: 4, dy: -4 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  writing: {
    styles: [
      { text: "·", color: 0x55aa33, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 3, dy: -5 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  "tool:Bash": {
    styles: [
      { text: "·", color: 0x8b6940, fontSize: 3 },
      { text: "°", color: 0x7a5c38, fontSize: 2 },
    ],
    spawnRate: 0.6,
    drift: { dx: 2, dy: 4 },
    lifetime: { min: 0.5, max: 1.0 },
  },
  "tool:Read": {
    styles: [
      { text: "·", color: 0xee88aa, fontSize: 2 },
      { text: "°", color: 0xdd7799, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 2, dy: -8 },
    lifetime: { min: 1.0, max: 1.5 },
  },
  "tool:Agent": {
    styles: [
      { text: "~", color: 0x445566, fontSize: 3 },
      { text: "·", color: 0x556677, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 6, dy: -6 },
    lifetime: { min: 0.8, max: 1.2 },
  },
  idle: {
    styles: [
      { text: "·", color: 0xeeee44, fontSize: 2 },
      { text: "°", color: 0xdddd33, fontSize: 2 },
    ],
    spawnRate: 0.2,
    drift: { dx: 2, dy: -3 },
    lifetime: { min: 1.5, max: 2.5 },
  },
};

export const workshopParticles: ParticleMap = {
  thinking: {
    styles: [
      { text: "⚙", color: 0x888899, fontSize: 3 },
      { text: "·", color: 0x999aaa, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 0, dy: -8 },
    lifetime: { min: 0.8, max: 1.3 },
  },
  "tool:Edit": {
    styles: [
      { text: "·", color: 0xffaa33, fontSize: 2 },
      { text: "∗", color: 0xffcc55, fontSize: 2 },
    ],
    spawnRate: 0.5,
    drift: { dx: 2, dy: 6 },
    lifetime: { min: 0.5, max: 1.0 },
  },
  "tool:Write": {
    styles: [
      { text: "·", color: 0xffaa33, fontSize: 2 },
      { text: "∗", color: 0xffcc55, fontSize: 2 },
    ],
    spawnRate: 0.5,
    drift: { dx: 2, dy: 6 },
    lifetime: { min: 0.5, max: 1.0 },
  },
  writing: {
    styles: [
      { text: "∗", color: 0xffcc55, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 1, dy: 5 },
    lifetime: { min: 0.5, max: 1.0 },
  },
  "tool:Bash": {
    styles: [
      { text: "✦", color: 0xffdd44, fontSize: 3 },
      { text: "·", color: 0xffbb33, fontSize: 2 },
      { text: "∗", color: 0xffcc55, fontSize: 2 },
    ],
    spawnRate: 0.8,
    drift: { dx: 4, dy: 2 },
    lifetime: { min: 0.4, max: 0.8 },
  },
  "tool:Read": {
    styles: [
      { text: "─", color: 0x4488cc, fontSize: 2 },
      { text: "│", color: 0x4488cc, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 0, dy: -4 },
    lifetime: { min: 0.6, max: 1.0 },
  },
  "tool:Agent": {
    styles: [
      { text: "◦", color: 0x888899, fontSize: 2 },
      { text: "·", color: 0x999aaa, fontSize: 2 },
    ],
    spawnRate: 0.4,
    drift: { dx: 3, dy: -6 },
    lifetime: { min: 0.8, max: 1.2 },
  },
  idle: {
    styles: [
      { text: "~", color: 0xaabbcc, fontSize: 2 },
      { text: "·", color: 0x99aabb, fontSize: 2 },
    ],
    spawnRate: 0.15,
    drift: { dx: 1, dy: -6 },
    lifetime: { min: 1.2, max: 2.0 },
  },
};

export const themeParticles: Record<string, ParticleMap> = {
  office: officeParticles,
  farm: farmParticles,
  workshop: workshopParticles,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/themes/theme-types.ts src/components/scene/particle-configs.ts
git commit -m "feat: add particle type definitions and per-theme configs"
```

---

### Task 8: Create AgentParticles component

**Files:**
- Create: `src/components/scene/AgentParticles.tsx`
- Create: `tests/components/scene/AgentParticles.test.ts`

- [ ] **Step 1: Write test for particle lifecycle logic**

Create `tests/components/scene/AgentParticles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createParticle,
  updateParticle,
  shouldSpawn,
  type ActiveParticle,
} from "@/components/scene/AgentParticles";

describe("particle lifecycle", () => {
  it("createParticle returns a particle with valid initial state", () => {
    const p = createParticle(
      { text: "{", color: 0x80b0e0, fontSize: 4 },
      { dx: 0, dy: -10 },
      { min: 0.8, max: 1.5 },
    );
    expect(p.age).toBe(0);
    expect(p.lifetime).toBeGreaterThanOrEqual(0.8);
    expect(p.lifetime).toBeLessThanOrEqual(1.5);
    expect(p.text).toBe("{");
    expect(p.x).toBeGreaterThanOrEqual(-8);
    expect(p.x).toBeLessThanOrEqual(8);
  });

  it("updateParticle advances age and position", () => {
    const p = createParticle(
      { text: "·", color: 0xffffff, fontSize: 2 },
      { dx: 0, dy: -10 },
      { min: 1.0, max: 1.0 },
    );
    const startY = p.y;
    updateParticle(p, 0.5);
    expect(p.age).toBe(0.5);
    expect(p.y).toBeLessThan(startY);
  });

  it("updateParticle marks particle as dead when age exceeds lifetime", () => {
    const p = createParticle(
      { text: "·", color: 0xffffff, fontSize: 2 },
      { dx: 0, dy: -10 },
      { min: 1.0, max: 1.0 },
    );
    updateParticle(p, 1.1);
    expect(p.age).toBeGreaterThan(p.lifetime);
  });

  it("shouldSpawn respects rate probability", () => {
    let spawns = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldSpawn(0.5, 0.016)) spawns++;
    }
    // With rate 0.5 and dt 0.016, expected ~8 spawns per 1000 calls
    // Allow wide margin for randomness
    expect(spawns).toBeGreaterThan(0);
    expect(spawns).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/components/scene/AgentParticles.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create AgentParticles.tsx**

Create `src/components/scene/AgentParticles.tsx`:

```typescript
"use client";

import { useRef, useCallback } from "react";
import { Container, Text, TextStyle } from "pixi.js";
import { extend, useTick } from "@pixi/react";
import type { AgentAction } from "@/lib/types";
import type { ParticleActionConfig, ParticleStyle } from "./themes/theme-types";
import { themeParticles } from "./particle-configs";

extend({ Container, Text });

const MAX_PARTICLES = 5;

export interface ActiveParticle {
  text: string;
  color: number;
  fontSize: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  age: number;
  lifetime: number;
  alpha: number;
  scale: number;
}

export function createParticle(
  style: ParticleStyle,
  drift: { dx: number; dy: number },
  lifetime: { min: number; max: number },
): ActiveParticle {
  return {
    text: style.text,
    color: style.color,
    fontSize: style.fontSize,
    x: (Math.random() - 0.5) * 16,
    y: -8 + Math.random() * 4,
    dx: drift.dx + (Math.random() - 0.5) * 4,
    dy: drift.dy + (Math.random() - 0.5) * 2,
    age: 0,
    lifetime: lifetime.min + Math.random() * (lifetime.max - lifetime.min),
    alpha: 0,
    scale: 1,
  };
}

export function updateParticle(p: ActiveParticle, dt: number): void {
  p.age += dt;
  p.x += p.dx * dt;
  p.y += p.dy * dt;

  const progress = p.age / p.lifetime;
  // Fade in over first 20%, fade out over last 40%
  if (progress < 0.2) {
    p.alpha = (progress / 0.2) * 0.6;
  } else if (progress > 0.6) {
    p.alpha = ((1 - progress) / 0.4) * 0.6;
  } else {
    p.alpha = 0.6;
  }

  p.scale = 1.0 - progress * 0.5;
}

export function shouldSpawn(rate: number, dt: number): boolean {
  return Math.random() < rate * dt;
}

interface AgentParticlesProps {
  themeName: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
}

export function AgentParticles({ themeName, currentAction, status }: AgentParticlesProps) {
  const particlesRef = useRef<ActiveParticle[]>([]);
  const textRefs = useRef<(Text | null)[]>(Array(MAX_PARTICLES).fill(null));

  const action = status === "idle" ? "idle" : currentAction;
  const particleMap = themeParticles[themeName];
  const config = particleMap?.[action];

  useTick(useCallback((ticker) => {
    const dt = ticker.deltaTime / 60;
    const particles = particlesRef.current;

    // Update existing particles
    for (let i = particles.length - 1; i >= 0; i--) {
      updateParticle(particles[i], dt);
      if (particles[i].age > particles[i].lifetime) {
        particles.splice(i, 1);
      }
    }

    // Spawn new if config exists and under limit
    if (config && particles.length < MAX_PARTICLES && shouldSpawn(config.spawnRate, dt)) {
      const style = config.styles[Math.floor(Math.random() * config.styles.length)];
      particles.push(createParticle(style, config.drift, config.lifetime));
    }

    // Sync to text refs
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const textNode = textRefs.current[i];
      if (!textNode) continue;
      const p = particles[i];
      if (p) {
        textNode.visible = true;
        textNode.text = p.text;
        textNode.x = p.x;
        textNode.y = p.y;
        textNode.alpha = p.alpha;
        textNode.scale.set(p.scale);
        textNode.style.fill = p.color;
        textNode.style.fontSize = p.fontSize;
      } else {
        textNode.visible = false;
      }
    }
  }, [config]));

  if (!config) return null;

  return (
    <pixiContainer>
      {Array.from({ length: MAX_PARTICLES }, (_, i) => (
        <pixiText
          key={i}
          ref={(el: Text | null) => { textRefs.current[i] = el; }}
          text=""
          style={new TextStyle({ fontSize: 2, fill: 0xffffff, fontFamily: "monospace" })}
          anchor={0.5}
          visible={false}
        />
      ))}
    </pixiContainer>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/components/scene/AgentParticles.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/AgentParticles.tsx tests/components/scene/AgentParticles.test.ts
git commit -m "feat: add AgentParticles component with per-theme particle effects"
```

---

### Task 9: Wire particles into the scene

**Files:**
- Modify: `src/components/scene/AgentSprite.tsx`
- Modify: `src/components/scene/AgentVilleScene.tsx`

- [ ] **Step 1: Add themeName prop to AgentSprite**

In `AgentSprite.tsx`, add `themeName` to the props interface:

```typescript
interface AgentSpriteProps {
  x: number;
  y: number;
  sessionId: string;
  cwd: string;
  currentAction: AgentAction;
  status: "busy" | "idle";
  animConfig: AgentAnimationConfig;
  onClick: (sessionId: string) => void;
  onDoubleClick: (sessionId: string) => void;
  isSelected: boolean;
  isDark: boolean;
  themeName: string;
}
```

- [ ] **Step 2: Add AgentParticles to AgentSprite render**

Import and render `AgentParticles` inside the container, after the sprite and before the labels:

```typescript
import { AgentParticles } from "./AgentParticles";
```

Inside the JSX, after the `<pixiAnimatedSprite>` block:

```tsx
<AgentParticles
  themeName={themeName}
  currentAction={currentAction}
  status={status}
/>
```

- [ ] **Step 3: Pass themeName from AgentVilleScene**

In `AgentVilleScene.tsx`, add `themeName` to the `AgentSprite` JSX:

```tsx
<AgentSprite
  key={agent.sessionId}
  x={slot.x * dynamicTheme.tileSize}
  y={slot.y * dynamicTheme.tileSize}
  sessionId={agent.sessionId}
  cwd={agent.cwd}
  currentAction={agent.currentAction}
  status={agent.status}
  animConfig={dynamicTheme.agent}
  onClick={handleAgentClick}
  onDoubleClick={handleAgentDoubleClick}
  isSelected={selectedAgentId === agent.sessionId}
  isDark={isDark}
  themeName={themeName}
/>
```

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- Busy agents show subtle particles floating around them
- Particle style matches the current theme (code brackets for office, leaves for farm, sparks for workshop)
- Idle agents: farm shows fireflies, workshop shows steam, office shows nothing
- Particles are sparse (3-5 max) and low opacity
- Switching themes changes particle style
- No performance regression with multiple agents

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/AgentSprite.tsx src/components/scene/AgentVilleScene.tsx
git commit -m "feat: wire theme-specific particles into agent sprites"
```

---

### Task 10: Final integration test and cleanup

**Files:**
- Modify: `src/components/scene/use-texture.ts` (remove if unused)

- [ ] **Step 1: Check if use-texture.ts is still imported anywhere**

```bash
grep -r "use-texture" src/
```

If `use-texture` is still imported by `Tilemap.tsx` or other files, keep it. If only `AgentSprite.tsx` used it and that's been replaced, check if `Tilemap.tsx` still imports it.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass, including the new ones from Tasks 5 and 8.

- [ ] **Step 3: Run the full app and test all themes**

```bash
npm run dev
```

Test matrix:
- [ ] Office theme: idle agents (zzz, breathing, shadow), busy agents (frame cycling, emotes, particles, squash on transition)
- [ ] Farm theme: same checks plus firefly particles on idle
- [ ] Workshop theme: same checks plus steam wisps on idle
- [ ] Click agent: selection arrows pulse
- [ ] Double-click agent: focus feature still works
- [ ] Switch themes mid-session: sprites and particles update correctly

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup after character animation system"
```
