#!/usr/bin/env node
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = path.join(__dirname, "..", "public", "sprites");

function rgba(r, g, b, a = 255) {
  return [r, g, b, a];
}

const T = rgba(0, 0, 0, 0); // transparent

function createPixelData(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const buf = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = grid[y][x];
      const offset = (y * width + x) * 4;
      buf[offset] = px[0];
      buf[offset + 1] = px[1];
      buf[offset + 2] = px[2];
      buf[offset + 3] = px[3];
    }
  }
  return { buf, width, height };
}

async function savePng(grid, filePath) {
  const { buf, width, height } = createPixelData(grid);
  await sharp(buf, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);
  console.log(`  ✓ ${path.relative(SPRITES_DIR, filePath)}`);
}

function fillGrid(w, h, color) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => color));
}

function drawRect(grid, x1, y1, w, h, color) {
  for (let y = y1; y < y1 + h && y < grid.length; y++) {
    for (let x = x1; x < x1 + w && x < grid[0].length; x++) {
      if (x >= 0 && y >= 0) grid[y][x] = color;
    }
  }
}

function drawPixel(grid, x, y, color) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x] = color;
  }
}

// ─── Color palettes ───

const SKIN = rgba(255, 210, 170);
const SKIN_SHADOW = rgba(220, 180, 140);
const HAIR_DARK = rgba(60, 40, 30);
const HAIR_LIGHT = rgba(140, 100, 60);
const EYE = rgba(30, 30, 50);
const EYE_SHINE = rgba(255, 255, 255);
const MOUTH = rgba(180, 100, 80);
const BLUSH = rgba(255, 170, 150);

// Office
const CARPET_1 = rgba(70, 80, 110);
const CARPET_2 = rgba(60, 70, 100);
const WOOD_DOOR = rgba(140, 90, 50);
const WOOD_DOOR_D = rgba(110, 70, 40);
const DOOR_HANDLE = rgba(200, 180, 60);
const DESK_TOP = rgba(120, 80, 50);
const DESK_LEG = rgba(90, 60, 40);
const MONITOR_BODY = rgba(50, 50, 60);
const MONITOR_SCREEN = rgba(100, 180, 220);
const CABINET_BODY = rgba(140, 145, 155);
const CABINET_DARK = rgba(110, 115, 125);
const CABINET_HANDLE = rgba(180, 180, 190);
const SHIRT_BLUE = rgba(80, 120, 180);
const SHIRT_BLUE_D = rgba(60, 95, 150);
const PANTS_GRAY = rgba(70, 70, 85);

// Farm
const GRASS_1 = rgba(80, 150, 60);
const GRASS_2 = rgba(70, 135, 50);
const GRASS_3 = rgba(90, 160, 70);
const DIRT = rgba(140, 100, 60);
const DIRT_D = rgba(120, 85, 50);
const FENCE_WOOD = rgba(160, 120, 70);
const FENCE_DARK = rgba(130, 95, 55);
const PLANT_GREEN = rgba(50, 170, 50);
const PLANT_DARK = rgba(40, 130, 40);
const BARN_RED = rgba(170, 50, 40);
const BARN_RED_D = rgba(140, 40, 30);
const BARN_ROOF = rgba(100, 30, 25);
const OVERALLS_BLUE = rgba(70, 100, 160);
const OVERALLS_BLUE_D = rgba(55, 80, 130);
const STRAW_HAT = rgba(220, 190, 120);
const STRAW_HAT_D = rgba(190, 160, 90);

// Workshop
const CONCRETE_1 = rgba(130, 130, 135);
const CONCRETE_2 = rgba(120, 120, 125);
const METAL_GRAY = rgba(150, 155, 165);
const METAL_DARK = rgba(100, 105, 115);
const METAL_RIVET = rgba(170, 175, 180);
const BENCH_WOOD = rgba(130, 90, 55);
const BENCH_DARK = rgba(100, 70, 45);
const TOOL_RED = rgba(200, 60, 50);
const TOOL_YELLOW = rgba(220, 200, 60);
const SHELF_WOOD = rgba(140, 100, 60);
const SHELF_DARK = rgba(110, 80, 50);
const JUMPSUIT = rgba(60, 80, 120);
const JUMPSUIT_D = rgba(45, 65, 100);
const HARD_HAT = rgba(230, 200, 50);
const HARD_HAT_D = rgba(200, 170, 40);

// ─── Pose infrastructure ───

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

const ACTION_POSES = {
  idle: [
    makePose(),
    makePose({ leanDx: 1, eyesClosed: true }),
  ],
  thinking: [
    makePose(),
    makePose({ rightArmDy: -2 }),
    makePose({ rightArmDy: -3, headDx: 1, headDy: -1 }),
    makePose({ rightArmDy: -2, headDx: 1 }),
  ],
  reading: [
    makePose({ leftArmDx: 1, rightArmDx: -1 }),
    makePose({ leftArmDx: 1, rightArmDx: -1, headDy: 1 }),
  ],
  editing: [
    makePose({ leftArmDy: -1 }),
    makePose({ rightArmDy: -1 }),
    makePose({ leftArmDy: -1, headDy: 1 }),
    makePose({ rightArmDy: -1 }),
  ],
  bash: [
    makePose({ leftArmDx: -1, rightArmDx: 1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, leftArmDy: -1, leanDx: -1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, rightArmDy: -1 }),
    makePose({ leftArmDx: -1, rightArmDx: 1, rightArmDy: -1, leanDx: 1 }),
  ],
  agent: [
    makePose({ rightArmDy: -3, rightArmDx: 1 }),
    makePose({ rightArmDy: -4, rightArmDx: 2 }),
    makePose({ rightArmDy: -3, rightArmDx: 1, leanDx: 1 }),
    makePose({ rightArmDy: -4, rightArmDx: 2, leanDx: 1 }),
  ],
};

const ROW_ORDER = ["idle", "thinking", "reading", "editing", "bash", "agent"];

// ─── Office sprites ───

function officeFloor() {
  const g = fillGrid(32, 32, CARPET_1);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x + y) % 4 === 0) g[y][x] = CARPET_2;
      if (x % 8 === 0 || y % 8 === 0) g[y][x] = rgba(55, 60, 85);
    }
  }
  return g;
}

function officeDoor() {
  const g = fillGrid(32, 64, T);
  // door frame
  drawRect(g, 4, 2, 24, 60, WOOD_DOOR_D);
  drawRect(g, 6, 4, 20, 56, WOOD_DOOR);
  // panels
  drawRect(g, 8, 8, 16, 18, WOOD_DOOR_D);
  drawRect(g, 9, 9, 14, 16, rgba(150, 100, 60));
  drawRect(g, 8, 34, 16, 18, WOOD_DOOR_D);
  drawRect(g, 9, 35, 14, 16, rgba(150, 100, 60));
  // handle
  drawRect(g, 21, 30, 3, 5, DOOR_HANDLE);
  drawPixel(g, 22, 32, rgba(220, 200, 80));
  // threshold
  drawRect(g, 2, 62, 28, 2, rgba(90, 70, 50));
  return g;
}

function officeDesk() {
  const g = fillGrid(64, 32, T);
  // desk surface
  drawRect(g, 2, 12, 60, 4, DESK_TOP);
  drawRect(g, 2, 12, 60, 1, rgba(140, 95, 60));
  // legs
  drawRect(g, 4, 16, 3, 14, DESK_LEG);
  drawRect(g, 57, 16, 3, 14, DESK_LEG);
  drawRect(g, 28, 16, 3, 10, DESK_LEG);
  // monitor
  drawRect(g, 24, 2, 16, 10, MONITOR_BODY);
  drawRect(g, 25, 3, 14, 8, MONITOR_SCREEN);
  drawRect(g, 30, 11, 4, 1, MONITOR_BODY);
  drawRect(g, 28, 11, 8, 1, rgba(60, 60, 70));
  // keyboard
  drawRect(g, 10, 9, 12, 3, rgba(70, 70, 80));
  for (let x = 11; x < 21; x += 2) {
    drawPixel(g, x, 10, rgba(100, 100, 110));
  }
  // coffee mug
  drawRect(g, 48, 8, 4, 4, rgba(200, 200, 210));
  drawPixel(g, 52, 9, rgba(200, 200, 210));
  drawRect(g, 49, 9, 2, 2, rgba(100, 60, 30));
  return g;
}

function officeCabinet() {
  const g = fillGrid(32, 48, T);
  // cabinet body
  drawRect(g, 4, 2, 24, 44, CABINET_BODY);
  drawRect(g, 4, 2, 24, 2, CABINET_DARK);
  drawRect(g, 4, 2, 2, 44, CABINET_DARK);
  // drawers
  for (let i = 0; i < 3; i++) {
    const dy = 6 + i * 14;
    drawRect(g, 7, dy, 18, 12, rgba(130, 135, 145));
    drawRect(g, 7, dy, 18, 1, CABINET_DARK);
    drawRect(g, 14, dy + 5, 4, 2, CABINET_HANDLE);
  }
  // feet
  drawRect(g, 6, 46, 4, 2, CABINET_DARK);
  drawRect(g, 22, 46, 4, 2, CABINET_DARK);
  return g;
}

function officeAgentFrame(pose) {
  const g = fillGrid(32, 32, T);
  const lean = pose.leanDx;

  // Hair (moves with head + lean)
  const hx = pose.headDx + lean;
  const hy = pose.headDy;
  drawRect(g, 12 + hx, 4 + hy, 8, 3, HAIR_DARK);
  drawPixel(g, 11 + hx, 5 + hy, HAIR_DARK);
  drawPixel(g, 20 + hx, 5 + hy, HAIR_DARK);

  // Head (moves with head + lean)
  drawRect(g, 12 + hx, 6 + hy, 8, 8, SKIN);
  drawRect(g, 12 + hx, 12 + hy, 8, 2, SKIN_SHADOW);

  // Eyes (moves with head + lean)
  if (pose.eyesClosed) {
    // Closed eyes: horizontal lines at eye-y+1 (y=9)
    drawPixel(g, 14 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 15 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 18 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 19 + hx, 9 + hy, SKIN_SHADOW);
  } else {
    drawPixel(g, 14 + hx, 8 + hy, EYE);
    drawPixel(g, 15 + hx, 8 + hy, EYE);
    drawPixel(g, 18 + hx, 8 + hy, EYE);
    drawPixel(g, 19 + hx, 8 + hy, EYE);
    drawPixel(g, 15 + hx, 8 + hy, EYE_SHINE);
    drawPixel(g, 19 + hx, 8 + hy, EYE_SHINE);
  }

  // Rosy cheeks (moves with head + lean)
  drawPixel(g, 13 + hx, 10 + hy, BLUSH);
  drawPixel(g, 20 + hx, 10 + hy, BLUSH);

  // Smile (moves with head + lean)
  drawPixel(g, 14 + hx, 11 + hy, MOUTH);
  drawPixel(g, 15 + hx, 12 + hy, MOUTH);
  drawPixel(g, 16 + hx, 12 + hy, MOUTH);
  drawPixel(g, 17 + hx, 12 + hy, MOUTH);
  drawPixel(g, 18 + hx, 11 + hy, MOUTH);

  // Shirt/body (moves with lean)
  drawRect(g, 10 + lean, 14, 12, 8, SHIRT_BLUE);
  drawRect(g, 10 + lean, 14, 12, 2, SHIRT_BLUE_D);
  drawRect(g, 14 + lean, 14, 4, 2, rgba(200, 200, 210)); // collar

  // Left arm (moves with lean + arm offsets)
  const lax = pose.leftArmDx + lean;
  const lay = pose.leftArmDy;
  drawRect(g, 8 + lax, 15 + lay, 2, 7, SHIRT_BLUE);
  drawRect(g, 8 + lax, 22 + lay, 2, 2, SKIN);

  // Right arm (moves with lean + arm offsets)
  const rax = pose.rightArmDx + lean;
  const ray = pose.rightArmDy;
  drawRect(g, 22 + rax, 15 + ray, 2, 7, SHIRT_BLUE);
  drawRect(g, 22 + rax, 22 + ray, 2, 2, SKIN);

  // Pants (anchored)
  drawRect(g, 11, 22, 10, 4, PANTS_GRAY);

  // Legs/shoes (anchored)
  drawRect(g, 11, 26, 4, 4, PANTS_GRAY);
  drawRect(g, 17, 26, 4, 4, PANTS_GRAY);
  drawRect(g, 11, 29, 4, 2, rgba(40, 40, 50));
  drawRect(g, 17, 29, 4, 2, rgba(40, 40, 50));
  return g;
}

// ─── Farm sprites ───

function farmFloor() {
  const g = fillGrid(32, 32, GRASS_1);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const n = (x * 7 + y * 13) % 17;
      if (n < 3) g[y][x] = GRASS_2;
      else if (n < 5) g[y][x] = GRASS_3;
    }
  }
  // small flowers/details
  drawPixel(g, 5, 8, rgba(220, 200, 50));
  drawPixel(g, 20, 15, rgba(220, 80, 80));
  drawPixel(g, 12, 25, rgba(200, 200, 50));
  drawPixel(g, 27, 5, rgba(220, 120, 200));
  return g;
}

function farmGate() {
  const g = fillGrid(32, 64, T);
  // fence posts
  drawRect(g, 2, 8, 4, 54, FENCE_WOOD);
  drawRect(g, 26, 8, 4, 54, FENCE_WOOD);
  drawRect(g, 2, 8, 4, 2, FENCE_DARK);
  drawRect(g, 26, 8, 4, 2, FENCE_DARK);
  // post caps
  drawRect(g, 1, 6, 6, 3, FENCE_DARK);
  drawRect(g, 25, 6, 6, 3, FENCE_DARK);
  // horizontal bars
  drawRect(g, 6, 20, 20, 3, FENCE_WOOD);
  drawRect(g, 6, 36, 20, 3, FENCE_WOOD);
  drawRect(g, 6, 50, 20, 3, FENCE_WOOD);
  // cross bar
  for (let i = 0; i < 30; i++) {
    const x = 6 + Math.floor(i * 20 / 30);
    const y = 20 + i;
    drawPixel(g, x, y, FENCE_DARK);
    drawPixel(g, x + 1, y, FENCE_DARK);
  }
  // hinges
  drawRect(g, 5, 22, 2, 2, rgba(100, 100, 110));
  drawRect(g, 5, 38, 2, 2, rgba(100, 100, 110));
  return g;
}

function farmPlot() {
  const g = fillGrid(64, 32, T);
  // dirt bed
  drawRect(g, 2, 8, 60, 22, DIRT);
  drawRect(g, 2, 8, 60, 2, DIRT_D);
  // rows of crops
  for (let row = 0; row < 3; row++) {
    const y = 12 + row * 7;
    for (let x = 6; x < 58; x += 8) {
      // plant stem
      drawRect(g, x + 2, y + 1, 1, 4, PLANT_DARK);
      // leaves
      drawPixel(g, x + 1, y, PLANT_GREEN);
      drawPixel(g, x + 2, y - 1, PLANT_GREEN);
      drawPixel(g, x + 3, y, PLANT_GREEN);
      drawPixel(g, x, y + 1, rgba(60, 180, 60));
      drawPixel(g, x + 4, y + 1, rgba(60, 180, 60));
    }
  }
  // border stones
  for (let x = 0; x < 64; x += 4) {
    drawRect(g, x, 28, 3, 2, rgba(160, 155, 145));
  }
  return g;
}

function farmBarn() {
  const g = fillGrid(32, 48, T);
  // barn body
  drawRect(g, 2, 16, 28, 30, BARN_RED);
  drawRect(g, 2, 16, 28, 2, BARN_RED_D);
  drawRect(g, 2, 16, 2, 30, BARN_RED_D);
  // roof
  for (let i = 0; i < 12; i++) {
    drawRect(g, 2 + i, 6 + i, 28 - i * 2, 2, BARN_ROOF);
  }
  drawRect(g, 0, 16, 32, 2, rgba(120, 40, 30));
  // door
  drawRect(g, 10, 28, 12, 18, WOOD_DOOR);
  drawRect(g, 15, 28, 2, 18, WOOD_DOOR_D);
  // X on door
  for (let i = 0; i < 10; i++) {
    drawPixel(g, 11 + i, 30 + Math.floor(i * 14 / 10), WOOD_DOOR_D);
    drawPixel(g, 20 - i, 30 + Math.floor(i * 14 / 10), WOOD_DOOR_D);
  }
  // hay loft window
  drawRect(g, 12, 18, 8, 6, WOOD_DOOR_D);
  drawRect(g, 13, 19, 6, 4, rgba(50, 40, 30));
  drawRect(g, 15, 19, 2, 4, WOOD_DOOR_D);
  return g;
}

function farmAgentFrame(pose) {
  const g = fillGrid(32, 32, T);
  const lean = pose.leanDx;
  const hx = pose.headDx + lean;
  const hy = pose.headDy;

  // Straw hat (moves with head + lean)
  drawRect(g, 10 + hx, 2 + hy, 12, 3, STRAW_HAT);
  drawRect(g, 8 + hx, 5 + hy, 16, 2, STRAW_HAT);
  drawRect(g, 8 + hx, 5 + hy, 16, 1, STRAW_HAT_D);
  drawRect(g, 12 + hx, 2 + hy, 8, 1, STRAW_HAT_D);

  // Head (moves with head + lean)
  drawRect(g, 12 + hx, 7 + hy, 8, 7, SKIN);
  drawRect(g, 12 + hx, 12 + hy, 8, 2, SKIN_SHADOW);

  // Eyes (moves with head + lean)
  if (pose.eyesClosed) {
    drawPixel(g, 14 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 15 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 18 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 19 + hx, 9 + hy, SKIN_SHADOW);
  } else {
    drawPixel(g, 14 + hx, 8 + hy, EYE);
    drawPixel(g, 15 + hx, 8 + hy, EYE);
    drawPixel(g, 18 + hx, 8 + hy, EYE);
    drawPixel(g, 19 + hx, 8 + hy, EYE);
    drawPixel(g, 15 + hx, 8 + hy, EYE_SHINE);
    drawPixel(g, 19 + hx, 8 + hy, EYE_SHINE);
  }

  // Rosy cheeks (moves with head + lean)
  drawPixel(g, 13 + hx, 10 + hy, BLUSH);
  drawPixel(g, 20 + hx, 10 + hy, BLUSH);

  // Smile (moves with head + lean)
  drawPixel(g, 14 + hx, 11 + hy, MOUTH);
  drawPixel(g, 15 + hx, 12 + hy, MOUTH);
  drawPixel(g, 16 + hx, 12 + hy, MOUTH);
  drawPixel(g, 17 + hx, 12 + hy, MOUTH);
  drawPixel(g, 18 + hx, 11 + hy, MOUTH);

  // Overalls body (moves with lean)
  drawRect(g, 10 + lean, 14, 12, 9, rgba(200, 180, 140)); // undershirt
  drawRect(g, 12 + lean, 16, 8, 7, OVERALLS_BLUE);
  // straps
  drawRect(g, 12 + lean, 14, 2, 3, OVERALLS_BLUE_D);
  drawRect(g, 18 + lean, 14, 2, 3, OVERALLS_BLUE_D);

  // Left arm (moves with lean + arm offsets)
  const lax = pose.leftArmDx + lean;
  const lay = pose.leftArmDy;
  drawRect(g, 8 + lax, 15 + lay, 2, 7, rgba(200, 180, 140));
  drawRect(g, 8 + lax, 22 + lay, 2, 2, SKIN);

  // Right arm (moves with lean + arm offsets)
  const rax = pose.rightArmDx + lean;
  const ray = pose.rightArmDy;
  drawRect(g, 22 + rax, 15 + ray, 2, 7, rgba(200, 180, 140));
  drawRect(g, 22 + rax, 22 + ray, 2, 2, SKIN);

  // Legs (anchored)
  drawRect(g, 11, 23, 4, 5, OVERALLS_BLUE);
  drawRect(g, 17, 23, 4, 5, OVERALLS_BLUE);

  // Boots (anchored)
  drawRect(g, 10, 28, 5, 3, rgba(110, 70, 40));
  drawRect(g, 17, 28, 5, 3, rgba(110, 70, 40));
  return g;
}

// ─── Workshop sprites ───

function workshopFloor() {
  const g = fillGrid(32, 32, CONCRETE_1);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if ((x * 11 + y * 7) % 13 < 2) g[y][x] = CONCRETE_2;
    }
  }
  // tile lines
  for (let x = 0; x < 32; x++) {
    drawPixel(g, x, 15, rgba(110, 110, 115));
    drawPixel(g, x, 31, rgba(110, 110, 115));
  }
  for (let y = 0; y < 32; y++) {
    drawPixel(g, 15, y, rgba(110, 110, 115));
    drawPixel(g, 31, y, rgba(110, 110, 115));
  }
  // oil stain
  drawPixel(g, 8, 10, rgba(80, 75, 70));
  drawPixel(g, 9, 10, rgba(80, 75, 70));
  drawPixel(g, 8, 11, rgba(85, 80, 75));
  return g;
}

function workshopGarageDoor() {
  const g = fillGrid(32, 64, T);
  // frame
  drawRect(g, 2, 2, 28, 60, METAL_DARK);
  // panel segments
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * 14;
    drawRect(g, 4, y, 24, 12, METAL_GRAY);
    drawRect(g, 4, y, 24, 1, rgba(160, 165, 175));
    drawRect(g, 4, y + 11, 24, 1, METAL_DARK);
  }
  // rivets
  for (let i = 0; i < 4; i++) {
    drawPixel(g, 6, 8 + i * 14, METAL_RIVET);
    drawPixel(g, 25, 8 + i * 14, METAL_RIVET);
  }
  // handle
  drawRect(g, 13, 40, 6, 2, rgba(80, 80, 90));
  // warning stripes at bottom
  for (let x = 4; x < 28; x += 4) {
    drawRect(g, x, 58, 2, 3, rgba(220, 200, 50));
  }
  return g;
}

function workshopWorkbench() {
  const g = fillGrid(64, 32, T);
  // bench surface
  drawRect(g, 2, 10, 60, 5, BENCH_WOOD);
  drawRect(g, 2, 10, 60, 1, rgba(145, 100, 65));
  // legs
  drawRect(g, 4, 15, 3, 15, BENCH_DARK);
  drawRect(g, 57, 15, 3, 15, BENCH_DARK);
  drawRect(g, 28, 15, 3, 12, BENCH_DARK);
  // shelf underneath
  drawRect(g, 6, 22, 52, 2, BENCH_DARK);
  // vice
  drawRect(g, 6, 6, 5, 4, METAL_GRAY);
  drawRect(g, 5, 4, 3, 2, METAL_DARK);
  drawRect(g, 9, 4, 3, 2, METAL_DARK);
  // tools on bench
  // hammer
  drawRect(g, 18, 7, 2, 4, rgba(140, 100, 60));
  drawRect(g, 16, 6, 6, 2, METAL_GRAY);
  // wrench
  drawRect(g, 30, 8, 8, 2, METAL_GRAY);
  drawPixel(g, 29, 7, METAL_GRAY);
  drawPixel(g, 29, 10, METAL_GRAY);
  drawPixel(g, 38, 7, METAL_GRAY);
  drawPixel(g, 38, 10, METAL_GRAY);
  // screwdriver
  drawRect(g, 46, 8, 6, 2, TOOL_YELLOW);
  drawRect(g, 52, 8, 4, 2, METAL_GRAY);
  // parts on shelf
  drawRect(g, 10, 19, 4, 3, TOOL_RED);
  drawRect(g, 20, 20, 6, 2, rgba(60, 60, 70));
  drawRect(g, 40, 19, 5, 3, TOOL_YELLOW);
  return g;
}

function workshopShelf() {
  const g = fillGrid(32, 48, T);
  // back panel
  drawRect(g, 4, 2, 24, 44, SHELF_DARK);
  // shelves
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * 11;
    drawRect(g, 2, y, 28, 2, SHELF_WOOD);
    drawRect(g, 2, y, 28, 1, rgba(150, 110, 70));
  }
  // items on shelves
  // top shelf - paint cans
  drawRect(g, 6, 0, 5, 4, TOOL_RED);
  drawRect(g, 14, 1, 5, 3, rgba(50, 120, 200));
  drawRect(g, 22, 0, 5, 4, PLANT_GREEN);
  // second shelf - boxes
  drawRect(g, 7, 7, 6, 8, rgba(170, 140, 90));
  drawRect(g, 16, 9, 8, 6, rgba(160, 160, 170));
  // third shelf - tools
  drawRect(g, 6, 18, 3, 8, TOOL_YELLOW);
  drawRect(g, 12, 20, 2, 6, METAL_GRAY);
  drawRect(g, 18, 18, 8, 2, METAL_GRAY);
  drawRect(g, 18, 22, 4, 4, rgba(80, 80, 90));
  // bottom shelf - parts bin
  drawRect(g, 6, 35, 20, 8, rgba(60, 60, 70));
  drawRect(g, 6, 35, 20, 1, rgba(80, 80, 90));
  // side supports
  drawRect(g, 2, 2, 2, 44, SHELF_WOOD);
  drawRect(g, 28, 2, 2, 44, SHELF_WOOD);
  return g;
}

function workshopAgentFrame(pose) {
  const g = fillGrid(32, 32, T);
  const lean = pose.leanDx;
  const hx = pose.headDx + lean;
  const hy = pose.headDy;

  // Hard hat (moves with head + lean)
  drawRect(g, 11 + hx, 2 + hy, 10, 2, HARD_HAT_D);
  drawRect(g, 10 + hx, 4 + hy, 12, 3, HARD_HAT);
  drawRect(g, 10 + hx, 4 + hy, 12, 1, HARD_HAT_D);

  // Head (moves with head + lean)
  drawRect(g, 12 + hx, 7 + hy, 8, 7, SKIN);
  drawRect(g, 12 + hx, 12 + hy, 8, 2, SKIN_SHADOW);

  // Safety glasses (moves with head + lean)
  if (pose.eyesClosed) {
    // Closed eyes: glasses still visible but eyes shut
    drawRect(g, 13 + hx, 8 + hy, 3, 2, rgba(150, 200, 230));
    drawRect(g, 17 + hx, 8 + hy, 3, 2, rgba(150, 200, 230));
    drawRect(g, 16 + hx, 8 + hy, 1, 1, rgba(80, 80, 90));
    drawPixel(g, 14 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 15 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 18 + hx, 9 + hy, SKIN_SHADOW);
    drawPixel(g, 19 + hx, 9 + hy, SKIN_SHADOW);
  } else {
    drawRect(g, 13 + hx, 8 + hy, 3, 2, rgba(150, 200, 230));
    drawRect(g, 17 + hx, 8 + hy, 3, 2, rgba(150, 200, 230));
    drawRect(g, 16 + hx, 8 + hy, 1, 1, rgba(80, 80, 90));
    // Eyes behind glasses
    drawPixel(g, 14 + hx, 8 + hy, rgba(30, 30, 50, 180));
    drawPixel(g, 18 + hx, 8 + hy, rgba(30, 30, 50, 180));
    drawPixel(g, 15 + hx, 8 + hy, rgba(200, 230, 255));
    drawPixel(g, 19 + hx, 8 + hy, rgba(200, 230, 255));
  }

  // Rosy cheeks (moves with head + lean)
  drawPixel(g, 13 + hx, 10 + hy, BLUSH);
  drawPixel(g, 20 + hx, 10 + hy, BLUSH);

  // Smile (moves with head + lean)
  drawPixel(g, 14 + hx, 11 + hy, MOUTH);
  drawPixel(g, 15 + hx, 12 + hy, MOUTH);
  drawPixel(g, 16 + hx, 12 + hy, MOUTH);
  drawPixel(g, 17 + hx, 12 + hy, MOUTH);
  drawPixel(g, 18 + hx, 11 + hy, MOUTH);

  // Jumpsuit body (moves with lean)
  drawRect(g, 10 + lean, 14, 12, 9, JUMPSUIT);
  drawRect(g, 10 + lean, 14, 12, 2, JUMPSUIT_D);
  // name patch
  drawRect(g, 12 + lean, 16, 5, 3, rgba(200, 200, 200));
  drawRect(g, 13 + lean, 17, 3, 1, rgba(30, 30, 30));
  // zipper
  for (let y = 14; y < 23; y += 2) {
    drawPixel(g, 16 + lean, y, rgba(180, 180, 60));
  }

  // Left arm (moves with lean + arm offsets)
  const lax = pose.leftArmDx + lean;
  const lay = pose.leftArmDy;
  drawRect(g, 8 + lax, 15 + lay, 2, 7, JUMPSUIT);
  drawRect(g, 8 + lax, 22 + lay, 2, 2, rgba(180, 150, 50)); // glove

  // Right arm (moves with lean + arm offsets)
  const rax = pose.rightArmDx + lean;
  const ray = pose.rightArmDy;
  drawRect(g, 22 + rax, 15 + ray, 2, 7, JUMPSUIT);
  drawRect(g, 22 + rax, 22 + ray, 2, 2, rgba(180, 150, 50)); // glove

  // Legs (anchored)
  drawRect(g, 11, 23, 4, 5, JUMPSUIT);
  drawRect(g, 17, 23, 4, 5, JUMPSUIT);

  // Work boots (anchored)
  drawRect(g, 10, 28, 5, 3, rgba(80, 60, 40));
  drawRect(g, 17, 28, 5, 3, rgba(80, 60, 40));
  drawRect(g, 10, 28, 5, 1, rgba(100, 80, 50));
  drawRect(g, 17, 28, 5, 1, rgba(100, 80, 50));
  return g;
}

// ─── Sheet assembly ───

async function saveAgentSheet(agentFrameFn, filePath) {
  const maxFrames = 4;
  const rows = ROW_ORDER.length; // 6
  const sheetWidth = maxFrames * 32;
  const sheetHeight = rows * 32;
  const sheet = fillGrid(sheetWidth, sheetHeight, T);

  for (let r = 0; r < rows; r++) {
    const actionName = ROW_ORDER[r];
    const poses = ACTION_POSES[actionName];
    for (let f = 0; f < poses.length; f++) {
      const frame = agentFrameFn(poses[f]);
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

// ─── Generate all ───

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

main().catch(console.error);
