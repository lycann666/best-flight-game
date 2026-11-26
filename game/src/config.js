// config.js — tuning constants and mission data for Garuda Courier.
// One file, one job: every number the rest of the game reads lives here.
export const CONFIG = {
  // World: metres on the XZ plane, Y is altitude in feet above the sea.
  seaLevel: 0,
  worldSize: 26000,          // playable square, metres (x,z in [-13000, 13000])
  gravity: 9.81,
  // Flight model.
  maxSpeedKt: 165,           // top speed at full throttle, level flight
  cruiseSpeedKt: 110,
  minFlySpeedKt: 52,         // below this the wing stops flying
  stallSpeedKt: 48,
  accelPerSec: 14,           // knots gained per second at full throttle
  dragPerSec: 9,
  climbRateFpm: 900,         // max climb at full throttle and cruise speed
  turnRateDegPerSec: 22,     // at full bank
  maxBankDeg: 38,
  bankRateDegPerSec: 55,
  // Fuel: percent of a full tank.
  fuelCapacity: 100,
  fuelBurnPerSec: 0.16,      // at full throttle; scaled by throttle
  fuelBurnIdle: 0.03,
  // Damage: 0..100, 100 = wrecked.
  crashDamage: 100,
  hardLandingDamage: 34,
  // Scoring.
  ringScore: 250,
  landingScore: 400,
  rescueScore: 1200,
  timeBonusPerSec: 2,
  // Rendering.
  viewWidth: 1280,
  viewHeight: 800,
  focal: 620,                // pseudo-3D focal length in pixels
  camBack: 26,               // camera metres behind the plane
  camUp: 7,                  // camera metres above the plane
  fogFar: 11000,             // metres; beyond this islands fade into haze
  // Colours (golden hour over Nusantara).
  skyTop: '#2e4a7a',
  skyMid: '#e8955a',
  skyLow: '#f7c873',
  seaDeep: '#0e6b7a',
  seaShallow: '#2fb3a3',
  sunColor: '#ffd98a',
};

// Missions: id, name, blurb, and the numbers missions.js needs.
export const MISSIONS = [
  {
    id: 1,
    key: 'rings',
    name: 'Ring Run',
    blurb: 'Fly through all 8 glowing rings over the islands.',
    rings: 8,
    timeLimitSec: 300,
    fuelStart: 100,
    parScore: 2000,
  },
  {
    id: 2,
    key: 'mail',
    name: 'Mail Drop',
    blurb: 'Deliver the mail: land on 3 island strips, then take off again.',
    strips: 3,
    timeLimitSec: 480,
    fuelStart: 100,
    parScore: 1200,
  },
  {
    id: 3,
    key: 'rescue',
    name: 'Storm Rescue',
    blurb: 'Reach the climber beacon on the volcano before the fuel runs out.',
    timeLimitSec: 360,
    fuelStart: 62,
    wind: 14, // crosswind knots, gusts
    parScore: 1200,
  },
];

// Home strip (where every sortie starts) and the other strips, in world metres.
// Heading 90 deg = east, along the strip.
export const STRIPS = [
  { name: 'Kaimana Field', x: 0, z: 0, heading: 90, length: 620, width: 46, island: 0 },
  { name: 'Banda Strip', x: 5200, z: -3400, heading: 35, length: 540, width: 42, island: 2 },
  { name: 'Flores Strip', x: -4800, z: 4100, heading: 140, length: 560, width: 42, island: 4 },
  { name: 'Ternate Strip', x: 2400, z: 6200, heading: 200, length: 520, width: 40, island: 5 },
];
