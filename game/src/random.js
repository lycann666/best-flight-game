// random.js — small seeded RNG so the world and every screenshot are reproducible.
// mulberry32: fast, deterministic, good enough for terrain and clouds.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turn any string (e.g. a ?seed= value) into a uint32 seed.
export function seedFromString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Helpers built on a supplied rng function.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

// Wrap an angle to [0, 360).
export function wrapAngle(a) {
  a %= 360;
  return a < 0 ? a + 360 : a;
}

// Shortest signed difference between two headings, in degrees.
export function angleDiff(a, b) {
  let d = wrapAngle(a - b);
  if (d > 180) d -= 360;
  return d;
}
