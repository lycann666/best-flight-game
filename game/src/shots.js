// shots.js — deterministic screenshot states, driven by ?shot= and ?seed=.
// The states are produced by the game's own loop and render path — no mock scenes.
// shot=start    title screen, plane parked on the home strip, HUD lit
// shot=flight   mid-flight through the ring course, volcano + islands ahead
// shot=landing  final approach to the home strip, low altitude
// shot=complete mission-complete screen with a score
import { CONFIG, STRIPS } from './config.js';
import { groundHeightAt } from './world.js';
import { degToRad } from './random.js';

export const SHOT_NAMES = ['start', 'flight', 'landing', 'complete'];

export function applyShot(state, shot) {
  const { plane, mission, world } = state;
  const home = STRIPS[0];
  const groundY = groundHeightAt(world, home.x, home.z);
  state.shot = shot;
  state.frozen = true; // screenshots render a fixed moment, not a running sim

  if (shot === 'start') {
    state.screen = 'title';
    state.selectedMission = 1;
    plane.x = home.x; plane.z = home.z; plane.y = groundY + 2;
    plane.heading = home.heading; plane.speedKt = 0; plane.throttle = 0.2;
    plane.onGround = true; plane.bank = 0; plane.pitch = 0;
    return;
  }

  if (shot === 'flight') {
    state.screen = 'flying';
    // Mid-course: just past ring 2, closing on ring 3 over Gunung Api (~950 m out).
    const r2 = mission.rings[1];
    const r3 = mission.rings[2];
    if (r2) r2.passed = true;
    if (mission.rings[0]) mission.rings[0].passed = true;
    state.score = 500;
    plane.x = 2600;
    plane.z = -2100;
    plane.y = 1400;
    plane.heading = 58;
    plane.speedKt = 118;
    plane.throttle = 0.72;
    plane.bank = -8;
    plane.pitch = 2;
    plane.onGround = false;
    plane.fuel = 78;
    state.message = 'Ring 2 cleared — Ring 3 ahead!';
    state.messageUntil = performance.now() + 60000;
    return;
  }

  if (shot === 'landing') {
    state.screen = 'flying';
    // Final approach: 900 m out, 350 ft, lined up with the home strip.
    const hRad = degToRad(home.heading);
    plane.x = home.x - Math.sin(hRad) * 900;
    plane.z = home.z + Math.cos(hRad) * 900;
    plane.y = groundY + 350;
    plane.heading = home.heading;
    plane.speedKt = 68;
    plane.throttle = 0.28;
    plane.bank = 2;
    plane.pitch = -3;
    plane.verticalSpeedFpm = -320;
    plane.onGround = false;
    plane.fuel = 64;
    state.message = 'Final approach — Kaimana Field ahead';
    state.messageUntil = performance.now() + 60000;
    return;
  }

  if (shot === 'complete') {
    state.screen = 'complete';
    state.endKind = 'complete';
    state.endReason = 'All 8 rings cleared over the islands — the courier route is open.';
    state.score = 2640;
    mission.done = true;
    mission.elapsedSec = 187;
    mission.rings.forEach((r) => { r.passed = true; });
    plane.x = home.x + 400; plane.z = home.z - 600;
    plane.y = 1400;
    plane.heading = 90;
    plane.speedKt = 110;
    plane.throttle = 0.6;
    plane.onGround = false;
    plane.fuel = 55;
    return;
  }
}
