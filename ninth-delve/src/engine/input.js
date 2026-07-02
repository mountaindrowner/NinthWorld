// Input (Tech §7). Explore: WASD move/strafe, Pointer-Lock mouse-yaw with
// Q/arrow turn fallback, E to interact. Menus/modals: mouse clicks (translated
// into 320×200 buffer space) and number hotkeys. main.js owns integration.

const HELD = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'strafeL', KeyD: 'strafeR',
  KeyQ: 'turnL', ArrowLeft: 'turnL', ArrowRight: 'turnR',
};

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Object} polled input state + edge-trigger consumers
 */
export function createInput(canvas) {
  const state = {
    forward: false, back: false, strafeL: false, strafeR: false,
    turnL: false, turnR: false,
    yaw: 0, locked: false,
    wantPointerLock: false,       // main sets true only in EXPLORE
    viewport: { scale: 1, offX: 0, offY: 0 },
    _interact: false,             // edge: consumed by takeInteract()
    _clicks: [],                  // buffer-space {x,y}
    _keys: [],                    // buffer of pressed key codes for menus
    consumeYaw() { const y = this.yaw; this.yaw = 0; return y; },
    takeInteract() { const v = this._interact; this._interact = false; return v; },
    takeClick() { return this._clicks.shift() || null; },
    takeKey() { return this._keys.shift() || null; },
    clearBuffered() { this._clicks.length = 0; this._keys.length = 0; this._interact = false; },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (HELD[e.code]) { state[HELD[e.code]] = true; e.preventDefault(); return; }
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { state._interact = true; state._keys.push(e.code); e.preventDefault(); return; }
    if (e.code === 'Escape') { state._keys.push('Escape'); return; }
    if (/^Digit[1-9]$/.test(e.code)) { state._keys.push(e.code); e.preventDefault(); return; }
    if (e.code === 'KeyR' || e.code === 'KeyC') { state._keys.push(e.code); return; }
    if (e.code === 'Tab') { state._keys.push('Tab'); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (HELD[e.code]) { state[HELD[e.code]] = false; e.preventDefault(); } });

  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', (e) => { if (state.locked) state.yaw += e.movementX; });

  canvas.addEventListener('click', (e) => {
    if (state.wantPointerLock && !state.locked) { canvas.requestPointerLock?.(); return; }
    const { scale, offX, offY } = state.viewport;
    state._clicks.push({ x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale });
  });

  return state;
}
