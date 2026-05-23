import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Generates a minimal valid PNG for a given RGBA color.
 * Uses a 1x1 pixel image — browsers will stretch it to fill any element.
 */
function makePng(r: number, g: number, b: number, a = 255): Buffer {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type: string, data: Buffer): Buffer {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crc = crc32(crcInput);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  // IHDR: width=1, height=1, bit depth=8, color type=6 (RGBA)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression method
  ihdrData[11] = 0; // filter method
  ihdrData[12] = 0; // interlace method

  // IDAT: filter byte (0) + RGBA pixel, deflate-compressed
  const rawRow = Buffer.from([0, r, g, b, a]);
  const compressed = deflateSync(rawRow);
  const idatData = compressed;

  // IEND
  const iendData = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", idatData),
    chunk("IEND", iendData),
  ]);
}

/** CRC-32 implementation (PNG requires it for each chunk) */
function crc32(buf: Buffer): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
}

function writePng(filePath: string, r: number, g: number, b: number): void {
  const png = makePng(r, g, b);
  writeFileSync(filePath, png);
  console.log(`  wrote ${filePath}`);
}

const publicDir = join(process.cwd(), "public", "sprites");

// ── Office theme — blue tones ──────────────────────────────────────────────
const officeDir = join(publicDir, "office");
mkdirSync(officeDir, { recursive: true });
console.log("office:");
writePng(join(officeDir, "floor.png"),    100, 130, 180); // steel-blue floor
writePng(join(officeDir, "agent.png"),     70,  90, 160); // navy agent
writePng(join(officeDir, "desk.png"),      80, 110, 200); // blue desk
writePng(join(officeDir, "door.png"),      60,  80, 150); // dark-blue door
writePng(join(officeDir, "cabinet.png"),  120, 150, 210); // light-blue cabinet

// ── Farm theme — green tones ───────────────────────────────────────────────
const farmDir = join(publicDir, "farm");
mkdirSync(farmDir, { recursive: true });
console.log("farm:");
writePng(join(farmDir, "floor.png"),    100, 160,  80); // grass green floor
writePng(join(farmDir, "agent.png"),     60, 120,  50); // dark green agent
writePng(join(farmDir, "plot.png"),      80, 140,  60); // medium-green plot
writePng(join(farmDir, "gate.png"),     140, 100,  50); // wooden-brown gate
writePng(join(farmDir, "barn.png"),     180,  60,  50); // barn-red storage

// ── Workshop theme — red/gray tones ────────────────────────────────────────
const workshopDir = join(publicDir, "workshop");
mkdirSync(workshopDir, { recursive: true });
console.log("workshop:");
writePng(join(workshopDir, "floor.png"),        120, 110, 100); // concrete gray
writePng(join(workshopDir, "agent.png"),         90,  70,  60); // dark-gray agent
writePng(join(workshopDir, "workbench.png"),    100,  60,  50); // rust-red bench
writePng(join(workshopDir, "garage-door.png"),  130, 120, 110); // light-gray door
writePng(join(workshopDir, "shelf.png"),         80,  70,  60); // dark-gray shelf

console.log("\nDone. Placeholder sprites written to public/sprites/");
