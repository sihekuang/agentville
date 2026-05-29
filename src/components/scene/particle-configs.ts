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
  editing: {
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
  writing: {
    styles: [
      { text: "<", color: 0x90c0a0, fontSize: 3 },
      { text: ">", color: 0x90c0a0, fontSize: 3 },
    ],
    spawnRate: 0.4,
    drift: { dx: 0, dy: -10 },
    lifetime: { min: 0.8, max: 1.5 },
  },
  executing: {
    styles: [
      { text: ">", color: 0x60dd60, fontSize: 3 },
      { text: "_", color: 0x60dd60, fontSize: 3 },
    ],
    spawnRate: 0.6,
    drift: { dx: 4, dy: -6 },
    lifetime: { min: 0.6, max: 1.0 },
  },
  reading: {
    styles: [
      { text: "◰", color: 0xccccaa, fontSize: 3 },
      { text: "▫", color: 0xbbbb99, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 0, dy: -8 },
    lifetime: { min: 1.0, max: 1.5 },
  },
  delegating: {
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
  editing: {
    styles: [
      { text: "🌿", color: 0x66aa44, fontSize: 3 },
      { text: "·", color: 0x55aa33, fontSize: 2 },
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
  executing: {
    styles: [
      { text: "·", color: 0x8b6940, fontSize: 3 },
      { text: "°", color: 0x7a5c38, fontSize: 2 },
    ],
    spawnRate: 0.6,
    drift: { dx: 2, dy: 4 },
    lifetime: { min: 0.5, max: 1.0 },
  },
  reading: {
    styles: [
      { text: "·", color: 0xee88aa, fontSize: 2 },
      { text: "°", color: 0xdd7799, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 2, dy: -8 },
    lifetime: { min: 1.0, max: 1.5 },
  },
  delegating: {
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
  editing: {
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
  executing: {
    styles: [
      { text: "✦", color: 0xffdd44, fontSize: 3 },
      { text: "·", color: 0xffbb33, fontSize: 2 },
      { text: "∗", color: 0xffcc55, fontSize: 2 },
    ],
    spawnRate: 0.8,
    drift: { dx: 4, dy: 2 },
    lifetime: { min: 0.4, max: 0.8 },
  },
  reading: {
    styles: [
      { text: "─", color: 0x4488cc, fontSize: 2 },
      { text: "│", color: 0x4488cc, fontSize: 2 },
    ],
    spawnRate: 0.3,
    drift: { dx: 0, dy: -4 },
    lifetime: { min: 0.6, max: 1.0 },
  },
  delegating: {
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
