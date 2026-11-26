// flight.js — the bush plane's flight model: throttle, lift, drag, bank and wind.
// Pure functions over a plain state object; no DOM, no rendering.
import { CONFIG } from './config.js';
import { clamp, wrapAngle, degToRad } from './random.js';

export function makePlaneState(strip) {
  return {
    // Position: x/z in metres, y in feet above sea level.
    x: strip.x,
    z: strip.z,
    y: 30, // parked on the strip, wheels on the ground
    heading: strip.heading, // degrees, 0 = north (-z), 90 = east (+x)
    pitch: 0,               // degrees, + = nose up
    bank: 0,                // degrees, + = right wing down
    speedKt: 0,
    throttle: 0,            // 0..1
    fuel: 100,              // percent
    damage: 0,              // 0..100
    onGround: true,
    verticalSpeedFpm: 0,
    airborne: false,
  };
}

const KT_TO_MS = 0.514444; // 1 knot = 0.514444 m/s
const FT_TO_M = 0.3048;

// One simulation step. input: {throttleUp, throttleDown, bankLeft, bankRight, pitchUp, pitchDown}
// windKt: crosswind speed in knots blowing from the west (rescue mission).
// groundY: terrain height in feet under the plane. Returns events: ['takeoff'|'landed'|'crash'|'hard'].
export function stepFlight(plane, input, dt, groundY, windKt) {
  const events = [];
  const cfg = CONFIG;

  // Throttle.
  if (input.throttleUp) plane.throttle = clamp(plane.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) plane.throttle = clamp(plane.throttle - dt * 0.7, 0, 1);

  // Bank: A/D roll the wings; the wings level themselves slowly when released.
  if (input.bankLeft) plane.bank = clamp(plane.bank - cfg.bankRateDegPerSec * dt, -cfg.maxBankDeg, cfg.maxBankDeg);
  else if (input.bankRight) plane.bank = clamp(plane.bank + cfg.bankRateDegPerSec * dt, -cfg.maxBankDeg, cfg.maxBankDeg);
  else plane.bank *= Math.max(0, 1 - dt * 1.4);

  // Pitch: W/S already drive the throttle; pitch keys (arrows up/down are throttle
  // per the spec) — instead pitch follows speed: fast = climb, slow = sink.
  // The pilot trims with I/K if they want: pitchUp/pitchDown adjust trim.
  if (input.pitchUp) plane.pitch = clamp(plane.pitch + 14 * dt, -12, 18);
  else if (input.pitchDown) plane.pitch = clamp(plane.pitch - 14 * dt, -12, 18);
  else plane.pitch *= Math.max(0, 1 - dt * 0.5);

  // Heading follows bank: full bank turns ~22 deg/s at flying speed.
  const turnAuthority = plane.speedKt > 55 ? 1 : Math.max(0, plane.speedKt / 55);
  plane.heading = wrapAngle(plane.heading + (plane.bank / cfg.maxBankDeg) * cfg.turnRateDegPerSec * dt * turnAuthority);

  // Speed: throttle pushes, drag pulls; climbing costs speed.
  const target = plane.throttle * cfg.maxSpeedKt;
  const climbCost = Math.max(0, plane.pitch) * 0.9;
  plane.speedKt += ((target - plane.speedKt) * 0.32 - climbCost * 0.02) * dt * 2.2;
  plane.speedKt = clamp(plane.speedKt, 0, cfg.maxSpeedKt + 10);
  if (plane.speedKt < 0.5 && plane.throttle < 0.05) plane.speedKt = 0;

  // Lift-off: enough speed and a little nose-up trim, or full throttle on the strip.
  const flying = plane.speedKt >= cfg.minFlySpeedKt;
  if (plane.onGround && flying && (plane.pitch > -2 || plane.throttle > 0.85)) {
    plane.onGround = false;
    plane.airborne = true;
    events.push('takeoff');
  }

  // Vertical speed: throttle + pitch vs stall. On the ground it stays put.
  let vsFpm = 0;
  if (!plane.onGround) {
    const lift = (plane.speedKt - cfg.stallSpeedKt) / (cfg.cruiseSpeedKt - cfg.stallSpeedKt);
    vsFpm = clamp(
      plane.throttle * cfg.climbRateFpm * 0.9 + plane.pitch * 55 + (lift - 0.55) * 700,
      -1400, 1500,
    );
    if (plane.speedKt < cfg.stallSpeedKt) vsFpm = -900; // stalled: sink fast
    plane.verticalSpeedFpm = vsFpm;
    plane.y += (vsFpm * dt) / 60;
  } else {
    plane.verticalSpeedFpm = 0;
  }

  // Move along the heading; crosswind pushes sideways (rescue mission).
  const hRad = degToRad(plane.heading);
  const distM = plane.speedKt * KT_TO_MS * dt;
  plane.x += Math.sin(hRad) * distM;
  plane.z -= Math.cos(hRad) * distM;
  if (windKt) {
    // Wind from the west (+x drift) with gusts the pilot must correct.
    const gust = windKt * (0.7 + 0.6 * Math.sin(performance.now() / 1400));
    plane.x += gust * KT_TO_MS * dt * 0.6;
  }

  // Fuel burn follows the throttle.
  const burn = (cfg.fuelBurnIdle + plane.throttle * cfg.fuelBurnPerSec) * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);

  // Ground contact.
  if (plane.y <= groundY + 2) {
    plane.y = groundY + 2;
    if (!plane.onGround) {
      const hard = plane.verticalSpeedFpm < -450 || plane.speedKt > 95;
      const crash = plane.verticalSpeedFpm < -900 || plane.speedKt > 130;
      plane.onGround = true;
      plane.airborne = false;
      plane.verticalSpeedFpm = 0;
      if (crash) {
        plane.damage = 100;
        events.push('crash');
      } else if (hard) {
        plane.damage = Math.min(100, plane.damage + CONFIG.hardLandingDamage);
        events.push('hard');
      } else {
        events.push('landed');
      }
      // A gentle touchdown keeps rolling; a crash stops the plane.
      if (crash) plane.speedKt = 0;
    }
  }

  // Out of fuel: the engine quits and the plane glides down.
  if (plane.fuel <= 0 && plane.throttle > 0) {
    plane.throttle = 0;
    events.push('flameout');
  }
  return events;
}

// Distance from the plane to a point, in metres (y converted from feet).
export function distanceTo(plane, p) {
  const dy = (plane.y - p.y) * FT_TO_M;
  return Math.hypot(plane.x - p.x, plane.z - p.z, dy);
}

// Is the plane lined up with a strip for landing? (low, slow, roughly aligned)
export function landingQuality(plane, strip, groundY) {
  const along = Math.sin(degToRad(strip.heading));
  const across = Math.cos(degToRad(strip.heading));
  const dx = plane.x - strip.x;
  const dz = plane.z - strip.z;
  const lateral = Math.abs(dx * across - dz * along);
  const longitudinal = Math.abs(dx * along + dz * across);
  const headingErr = Math.abs(((plane.heading - strip.heading + 540) % 360) - 180);
  return {
    lateral,
    longitudinal,
    headingErr,
    altAboveGround: plane.y - groundY,
    speedKt: plane.speedKt,
    descentFpm: -plane.verticalSpeedFpm,
    onStrip: lateral < strip.width / 2 + 20 && longitudinal < strip.length / 2 + 20,
    good: lateral < 30 && headingErr < 18 && plane.speedKt < 85 && plane.speedKt > 40 && -plane.verticalSpeedFpm < 500,
  };
}
