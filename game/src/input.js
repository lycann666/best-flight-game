// input.js — keyboard (and optional mouse throttle) state.
// One file, one job: turn raw events into the {throttleUp, ...} the flight model reads.
export function makeInput() {
  return {
    keys: new Set(),
    // Flight-model inputs, refreshed every frame from the key set.
    throttleUp: false,
    throttleDown: false,
    bankLeft: false,
    bankRight: false,
    pitchUp: false,
    pitchDown: false,
    // One-shot actions consumed by main.js (edge-triggered).
    pressed: new Set(),
    mouseThrottle: null, // 0..1 when the HUD throttle slider is dragged, else null
    muted: false,
  };
}

const KEYMAP = {
  KeyW: 'throttleUp',
  ArrowUp: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowDown: 'throttleDown',
  KeyA: 'bankLeft',
  ArrowLeft: 'bankLeft',
  KeyD: 'bankRight',
  ArrowRight: 'bankRight',
  KeyI: 'pitchUp',
  KeyK: 'pitchDown',
};

export function attachInput(input, element) {
  function refresh() {
    for (const [code, field] of Object.entries(KEYMAP)) {
      input[field] = input.keys.has(code);
    }
  }
  element.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    refresh();
  });
  element.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    refresh();
  });
  element.addEventListener('blur', () => {
    input.keys.clear();
    refresh();
  });
  // Mouse: clicking the HUD throttle bar sets the throttle directly.
  element.addEventListener('pointerdown', (e) => {
    const bar = document.getElementById('throttle-bar');
    if (!bar) return;
    const r = bar.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      input.mouseThrottle = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    }
  });
}

// Consume a one-shot key press (R restart, P pause, M mute, 1/2/3 mission, Enter).
export function consumePress(input, code) {
  if (!input.pressed.has(code)) return false;
  input.pressed.delete(code);
  return true;
}

export function clearPresses(input) {
  input.pressed.clear();
}
