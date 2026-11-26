// main.js — the game loop and state machine: title -> flying -> paused / complete / failed.
// Wires config, world, flight, input, render, hud, audio, missions and shots together.
import { CONFIG, MISSIONS, STRIPS } from './config.js';
import { mulberry32, seedFromString } from './random.js';
import { buildWorld, groundHeightAt } from './world.js';
import { makePlaneState, stepFlight } from './flight.js';
import { makeInput, attachInput, consumePress } from './input.js';
import { drawScene } from './render.js';
import { drawHUD, drawTitle, drawEndScreen, drawPaused } from './hud.js';
import { makeAudio, startAudio, setMuted, updateAudio, playChime, playThud, playCrash, playFanfare } from './audio.js';
import { makeMission, updateMission, objectiveText } from './missions.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = seedFromString(params.get('seed') || 'garuda-1');
const rng = mulberry32(seed);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const world = buildWorld(seed);
const input = makeInput();
attachInput(input, window);
const audio = makeAudio();

const state = {
  config: CONFIG,
  world,
  missionDefs: MISSIONS,
  selectedMission: 1,
  screen: 'title', // title | flying | paused | complete | failed
  plane: makePlaneState(STRIPS[0]),
  mission: makeMission(1, world, rng),
  score: 0,
  message: '',
  messageUntil: 0,
  endReason: '',
  endKind: '',
  lastLandingEvent: false,
  frozen: false,
  shot: null,
  objectiveText: '',
  _stripHeights: {},
};
// Levelled pad heights for every strip (render.js reads these).
for (const s of STRIPS) {
  state._stripHeights[s.name] = groundHeightAt(world, s.x, s.z);
}

function setMessage(text, ms = 2600) {
  state.message = text;
  state.messageUntil = performance.now() + ms;
}

function startMission(id) {
  state.selectedMission = id;
  state.mission = makeMission(id, world, rng);
  state.plane = makePlaneState(STRIPS[0]);
  state.plane.fuel = state.mission.def.fuelStart;
  state.score = 0;
  state.screen = 'flying';
  state.endReason = '';
  state.endKind = '';
  setMessage(state.mission.def.name + ' — ' + state.mission.def.blurb, 3400);
  startAudio(audio);
}

function restart() {
  startMission(state.selectedMission);
}

function backToTitle() {
  state.screen = 'title';
  state.plane = makePlaneState(STRIPS[0]);
  state.mission = makeMission(state.selectedMission, world, rng);
  state.score = 0;
}

// Screenshot mode: freeze the sim at a deterministic moment.
if (shot) {
  startMission(1);
  applyShot(state, shot);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const W = window.innerWidth;
  const H = window.innerHeight;

  // --- One-shot keys. ---
  if (consumePress(input, 'KeyM')) {
    input.muted = !input.muted;
    setMuted(audio, input.muted);
  }
  if (consumePress(input, 'KeyR') && state.screen !== 'title') restart();
  if (consumePress(input, 'KeyT') && (state.screen === 'complete' || state.screen === 'failed')) backToTitle();
  if (consumePress(input, 'KeyP')) {
    if (state.screen === 'flying') state.screen = 'paused';
    else if (state.screen === 'paused') state.screen = 'flying';
  }
  if (state.screen === 'title') {
    for (const n of [1, 2, 3]) {
      if (consumePress(input, 'Digit' + n)) state.selectedMission = n;
    }
    if (consumePress(input, 'Enter') || consumePress(input, 'NumpadEnter')) startMission(state.selectedMission);
  } else if (state.screen === 'complete' || state.screen === 'failed') {
    for (const n of [1, 2, 3]) {
      if (consumePress(input, 'Digit' + n)) startMission(n);
    }
  }
  // Mouse throttle from the HUD bar.
  if (input.mouseThrottle !== null && state.screen === 'flying') {
    state.plane.throttle = input.mouseThrottle;
    input.mouseThrottle = null;
  }

  // --- Simulation. ---
  if (state.screen === 'flying' && !state.frozen) {
    const groundY = groundHeightAt(world, state.plane.x, state.plane.z);
    const windKt = state.mission.def.wind || 0;
    const events = stepFlight(state.plane, input, dt, groundY, windKt);
    for (const ev of events) {
      if (ev === 'takeoff') setMessage('Airborne — gear up, courier away!');
      if (ev === 'landed') {
        state.lastLandingEvent = true;
        playThud(audio);
        if (state.mission.def.key !== 'mail') setMessage('Smooth touchdown on ' + nearestStripName());
      }
      if (ev === 'hard') {
        state.lastLandingEvent = true;
        playThud(audio);
        setMessage('Hard landing! The old girl felt that one.');
      }
      if (ev === 'crash') {
        playCrash(audio);
        setMessage('Crashed!');
      }
      if (ev === 'flameout') setMessage('Fuel gone — gliding now, find a strip!');
    }
    const mEvents = updateMission(state, dt);
    for (const ev of mEvents) {
      if (ev === 'ring') {
        playChime(audio);
        const got = state.mission.rings.filter((r) => r.passed).length;
        setMessage('Ring ' + got + '/8 — +' + CONFIG.ringScore + ' pts');
      }
      if (ev === 'landed') {
        playChime(audio);
        setMessage('Mail delivered — +' + CONFIG.landingScore + ' pts, tanks topped up');
      }
      if (ev === 'beacon') {
        playFanfare(audio);
        setMessage('Beacon reached — the climber is safe!');
      }
      if (ev === 'complete') {
        playFanfare(audio);
        state.screen = 'complete';
        state.endKind = 'complete';
        state.endReason = state.mission.def.key === 'rings'
          ? 'All 8 rings cleared over the islands — the courier route is open.'
          : state.mission.def.key === 'mail'
            ? 'All three island strips served — every letter delivered.'
            : 'Beacon reached in time — the climber is coming home.';
      }
      if (ev === 'fail') {
        playCrash(audio);
        state.screen = 'failed';
        state.endKind = 'failed';
        state.endReason = state.mission.failReason;
      }
    }
    updateAudio(audio, state.plane.throttle, state.plane.speedKt);
  }

  state.objectiveText = objectiveText(state);

  // --- Render. ---
  drawScene(ctx, state, W, H, now);
  drawHUD(ctx, state, W, H); // the instruments stay lit on every screen, title included
  if (state.screen === 'title') drawTitle(ctx, state, W, H);
  else if (state.screen === 'paused') drawPaused(ctx, W, H);
  else if (state.screen === 'complete' || state.screen === 'failed') {
    drawEndScreen(ctx, state, W, H, state.endKind);
  }

  requestAnimationFrame(frame);
}

function nearestStripName() {
  let best = STRIPS[0];
  let bd = Infinity;
  for (const s of STRIPS) {
    const d = Math.hypot(state.plane.x - s.x, state.plane.z - s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best.name;
}

// First gesture unlocks audio (browsers require it).
window.addEventListener('pointerdown', () => startAudio(audio), { once: true });
window.addEventListener('keydown', () => startAudio(audio), { once: true });

requestAnimationFrame(frame);
