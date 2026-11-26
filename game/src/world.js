// world.js — the Nusantara archipelago: islands, volcanoes, strips and rings.
// Terrain is a function of position, so flight and rendering agree exactly.
import { CONFIG, STRIPS } from './config.js';
import { mulberry32, range, clamp } from './random.js';

// Island: { x, z, r (metres), peak (feet), volcano (bool), hue, name }
function buildIslands(rng) {
  const fixed = [
    { x: 0, z: 0, r: 1500, peak: 420, volcano: false, name: 'Kaimana' },
    { x: 3400, z: -2600, r: 1900, peak: 1450, volcano: true, name: 'Gunung Api' },
    { x: 5200, z: -3400, r: 1200, peak: 380, volcano: false, name: 'Banda' },
    { x: -2600, z: -4200, r: 2100, peak: 980, volcano: false, name: 'Seram' },
    { x: -4800, z: 4100, r: 1300, peak: 460, volcano: false, name: 'Flores' },
    { x: 2400, z: 6200, r: 1100, peak: 350, volcano: false, name: 'Ternate' },
    { x: -7200, z: -900, r: 2400, peak: 2100, volcano: true, name: 'Rinjani' },
    { x: 7600, z: 2800, r: 1700, peak: 760, volcano: false, name: 'Biak' },
    { x: 900, z: -7400, r: 1500, peak: 620, volcano: false, name: 'Buru' },
    { x: -5800, z: 7600, r: 1900, peak: 1200, volcano: true, name: 'Tambora' },
  ];
  // A few small seeded islets for texture; fixed islands never move.
  const extra = [];
  for (let i = 0; i < 14; i++) {
    const x = range(rng, -11500, 11500);
    const z = range(rng, -11500, 11500);
    if (fixed.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 900)) continue;
    extra.push({
      x, z,
      r: range(rng, 260, 700),
      peak: range(rng, 90, 320),
      volcano: false,
      name: 'Islet ' + (i + 1),
    });
  }
  return fixed.concat(extra);
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const islands = buildIslands(rng);
  // Clouds: seeded puffs drifting slowly over the sea.
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: range(rng, -12000, 12000),
      z: range(rng, -12000, 12000),
      y: range(rng, 1600, 3400), // feet
      s: range(rng, 300, 900),   // metres across
      a: range(rng, 0.35, 0.75),
    });
  }
  return { seed, islands, clouds, strips: STRIPS };
}

// Ground height in feet at (x, z): 0 over the sea, rising to the peak on land.
// Smooth cone profile so landing on a strip (flat island top) is well defined.
export function groundHeightAt(world, x, z) {
  let h = 0;
  for (const isl of world.islands) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d >= isl.r) continue;
    const t = 1 - d / isl.r; // 0 at shore, 1 at summit
    const prof = Math.pow(t, 1.6);
    h = Math.max(h, prof * isl.peak);
  }
  return h;
}

// Flat pad height for a strip: the island is levelled where the strip sits.
export function stripHeightAt(world, strip) {
  return groundHeightAt(world, strip.x, strip.z);
}

// Ring course for Ring Run: 8 rings arcing from the home strip over the islands.
export function buildRings(world, rng) {
  const rings = [];
  const path = [
    { x: 900, z: -500, y: 900 },
    { x: 2100, z: -1600, y: 1100 },
    { x: 3400, z: -2600, y: 1500 },
    { x: 4300, z: -3400, y: 1000 },
    { x: 2600, z: -4800, y: 1300 },
    { x: 900, z: -7400, y: 1400 },
    { x: -900, z: -6200, y: 1100 },
    { x: -2600, z: -4200, y: 1200 },
  ];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    rings.push({
      index: i,
      x: p.x + range(rng, -60, 60),
      z: p.z + range(rng, -60, 60),
      y: p.y,
      r: 55, // metres
      passed: false,
    });
  }
  return rings;
}

// Beacon for Storm Rescue: a climber's light on the flank of Gunung Api.
export function beaconPosition(world) {
  const isl = world.islands[1]; // Gunung Api
  return { x: isl.x + 420, z: isl.z - 260, y: 1050, island: isl };
}

export function clampToWorld(v) {
  const half = CONFIG.worldSize / 2;
  return clamp(v, -half, half);
}
