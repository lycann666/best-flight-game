// audio.js — WebAudio synth only: engine drone, wind, ring chime, landing thud.
// No audio files, no network. Everything is created after the first user gesture.
export function makeAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSrc: null,
    windGain: null,
    muted: false,
    started: false,
  };
}

function ensure(audio) {
  if (audio.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
    // Engine: two detuned sawtooths through a lowpass, gain follows throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const osc2 = audio.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 58;
    const lp = audio.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(lp);
    osc2.connect(lp);
    lp.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    osc2.start();
    audio._osc2 = osc2;
    // Wind: looped noise buffer, gain follows airspeed.
    const len = audio.ctx.sampleRate * 2;
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSrc = audio.ctx.createBufferSource();
    audio.windSrc.buffer = buf;
    audio.windSrc.loop = true;
    const bp = audio.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSrc.connect(bp);
    bp.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSrc.start();
    audio.started = true;
    return true;
  } catch {
    return false;
  }
}

export function startAudio(audio) {
  if (!ensure(audio)) return;
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
}

// Called every frame while flying: engine pitch follows throttle, wind follows speed.
export function updateAudio(audio, throttle, speedKt) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.1);
  audio._osc2.frequency.setTargetAtTime(51 + throttle * 73, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(0.02 + throttle * 0.075, t, 0.15);
  audio.windGain.gain.setTargetAtTime(Math.min(0.12, speedKt / 165 * 0.12), t, 0.2);
}

function blip(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + when;
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = audio.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(audio.master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playChime(audio) {
  startAudio(audio);
  blip(audio, 880, 0.5, 'sine', 0.22);
  blip(audio, 1318, 0.6, 'sine', 0.18, 0.09);
}

export function playThud(audio) {
  startAudio(audio);
  blip(audio, 70, 0.35, 'triangle', 0.4);
  blip(audio, 140, 0.2, 'sine', 0.2, 0.02);
}

export function playCrash(audio) {
  startAudio(audio);
  blip(audio, 55, 0.8, 'sawtooth', 0.35);
  blip(audio, 38, 1.1, 'triangle', 0.35, 0.1);
}

export function playFanfare(audio) {
  startAudio(audio);
  [523, 659, 784, 1046].forEach((f, i) => blip(audio, f, 0.55, 'triangle', 0.2, i * 0.13));
}
