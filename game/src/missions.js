// missions.js — objectives, scoring and win/fail rules for the three sorties.
// One file, one job: what "done" means for each mission, and how the score grows.
import { MISSIONS, STRIPS } from './config.js';
import { buildRings, beaconPosition, groundHeightAt } from './world.js';
import { distanceTo, landingQuality } from './flight.js';
import { clamp } from './random.js';

export function makeMission(missionId, world, rng) {
  const def = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
  const mission = {
    def,
    elapsedSec: 0,
    rings: def.key === 'rings' ? buildRings(world, rng) : [],
    beacon: def.key === 'rescue' ? beaconPosition(world) : null,
    stripsVisited: [], // mail mission: strip names landed on, in order
    nextStripIndex: 0, // mail mission: which strip is next (1..3, skipping home)
    done: false,
    failed: false,
    failReason: '',
  };
  return mission;
}

// Mail route: home -> Banda -> Flores -> Ternate (indices into STRIPS, skipping home).
export const MAIL_ROUTE = [1, 2, 3];

export function nextMailStrip(mission) {
  return STRIPS[MAIL_ROUTE[mission.nextStripIndex]];
}

// Per-frame objective update. Returns events: ['ring'|'landed'|'beacon'|'complete'|'fail'].
// onEvent is called by main.js for sound + message; this function only mutates state.
export function updateMission(state, dt) {
  const { mission, plane, world } = state;
  const events = [];
  if (mission.done || mission.failed) return events;
  mission.elapsedSec += dt;

  // Out of time.
  if (mission.elapsedSec >= mission.def.timeLimitSec) {
    mission.failed = true;
    mission.failReason = 'Out of time — the sortie window closed.';
    events.push('fail');
    return events;
  }
  // Out of fuel while airborne and far from any strip: the sortie is over.
  if (plane.fuel <= 0 && !plane.onGround && plane.y > 120) {
    mission.failed = true;
    mission.failReason = 'Fuel exhausted — forced ditching in the sea.';
    events.push('fail');
    return events;
  }
  // Wrecked.
  if (plane.damage >= 100) {
    mission.failed = true;
    mission.failReason = 'Cendrawasih-9 is wrecked. The courier walks home.';
    events.push('fail');
    return events;
  }

  if (mission.def.key === 'rings') {
    const next = mission.rings.find((r) => !r.passed);
    if (next) {
      const d = distanceTo(plane, next);
      // Passing the ring plane within its radius counts.
      if (d < next.r) {
        next.passed = true;
        state.score += state.config.ringScore;
        events.push('ring');
        if (mission.rings.every((r) => r.passed)) {
          mission.done = true;
          state.score += timeBonus(state);
          events.push('complete');
        }
      }
    }
  } else if (mission.def.key === 'mail') {
    // A gentle touchdown on the current target strip counts as a delivery.
    if (plane.onGround && state.lastLandingEvent) {
      const target = nextMailStrip(mission);
      if (target) {
        const q = landingQuality(plane, target, groundHeightAt(world, plane.x, plane.z));
        if (q.onStrip && q.good) {
          mission.stripsVisited.push(target.name);
          mission.nextStripIndex += 1;
          state.score += state.config.landingScore;
          events.push('landed');
          // Refuel a little at each strip — the ground crew tops the tanks up.
          plane.fuel = clamp(plane.fuel + 35, 0, 100);
          if (mission.nextStripIndex >= MAIL_ROUTE.length) {
            mission.done = true;
            state.score += timeBonus(state);
            events.push('complete');
          }
        }
      }
      state.lastLandingEvent = false;
    }
  } else if (mission.def.key === 'rescue') {
    const d = distanceTo(plane, mission.beacon);
    if (d < 220 && plane.y < mission.beacon.y + 500) {
      mission.done = true;
      state.score += state.config.rescueScore + timeBonus(state);
      events.push('beacon');
      events.push('complete');
    }
  }
  return events;
}

function timeBonus(state) {
  const left = Math.max(0, state.mission.def.timeLimitSec - state.mission.elapsedSec);
  return Math.round(left * state.config.timeBonusPerSec);
}

// Objective line shown in the HUD.
export function objectiveText(state) {
  const m = state.mission;
  if (m.done) return 'Sortie complete — well flown!';
  if (m.failed) return m.failReason;
  if (m.def.key === 'rings') {
    const got = m.rings.filter((r) => r.passed).length;
    return `Rings ${got}/8 — fly through the next gold ring`;
  }
  if (m.def.key === 'mail') {
    const target = nextMailStrip(m);
    if (!target) return 'All mail delivered!';
    return `Deliver mail ${m.nextStripIndex + 1}/3 — land on ${target.name}`;
  }
  const d = Math.round(distanceTo(state.plane, m.beacon) / 100) / 10;
  return `Reach the beacon — ${d} km away, before the fuel runs out`;
}
