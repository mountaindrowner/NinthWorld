// Input (Tech §7). Explore: WASD move/strafe, Pointer-Lock mouse-yaw with
// Q/arrow turn fallback, E to interact. Menus/modals: mouse clicks (translated
// into pixel buffer space) and number hotkeys. main.js owns integration.

const HELD = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'strafeL', KeyD: 'strafeR',
  KeyQ: 'turnL', ArrowLeft: 'turnL', ArrowRight: 'turnR',
};

import { BUF_W, BUF_H } from './screen.js';

// Touch layout in buffer coords (shared with ui/touch.js for drawing), anchored
// to the buffer edges so it survives resolution changes. Left half is the move
// stick; the right half (minus these buttons) is look-drag. HUD top = BUF_H−40.
export const TOUCH_UI = {
  joy: { cx: 44, cy: BUF_H - 66, r: 26 },  // virtual stick base (visual)
  buttons: [
    { id: 'swing', label: 'ATK', x: BUF_W - 56, y: BUF_H - 72, w: 52, h: 24 },
    { id: 'interact', label: 'E', x: BUF_W - 56, y: BUF_H - 100, w: 52, h: 24 },
    { id: 'KeyC', label: 'Cy', x: BUF_W - 56, y: BUF_H - 128, w: 52, h: 24 },
    { id: 'Tab', label: 'Sheet', x: BUF_W - 56, y: BUF_H - 156, w: 52, h: 24 },
  ],
};
const JOY_PX = 46; // screen px from stick origin for full deflection

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Object} polled input state + edge-trigger consumers
 */
export function createInput(canvas) {
  const state = {
    forward: false, back: false, strafeL: false, strafeR: false,
    turnL: false, turnR: false,
    yaw: 0, pitch: 0, locked: false, // pitch consumed only by the 3D renderer
    wantPointerLock: false,       // main sets true only in EXPLORE
    viewport: { scale: 1, offX: 0, offY: 0 },
    touchActive: false,           // true once a touch is seen → analog move + on-screen UI
    analogX: 0, analogY: 0,       // virtual-stick vector (−1..1)
    knob: { x: 0, y: 0 },         // stick knob offset (buffer px) for drawing
    _interact: false,             // edge: consumed by takeInteract()
    _clicks: [],                  // buffer-space {x,y}
    _keys: [],                    // buffer of pressed key codes for menus
    _swings: [],                  // realtime melee: {heavy} per press (LMB / Space)
    swingCharging: 0,             // >0 = mousedown timestamp (heavy charge underway)
    consumeYaw() { const y = this.yaw; this.yaw = 0; return y; },
    consumePitch() { const p = this.pitch; this.pitch = 0; return p; },
    takeInteract() { const v = this._interact; this._interact = false; return v; },
    takeClick() { return this._clicks.shift() || null; },
    takeKey() { return this._keys.shift() || null; },
    takeSwing() { return this._swings.shift() || null; },
    clearBuffered() { this._clicks.length = 0; this._keys.length = 0; this._swings.length = 0; this._interact = false; },
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (HELD[e.code]) { state[HELD[e.code]] = true; e.preventDefault(); return; }
    if (e.code === 'KeyE') { state._interact = true; state._keys.push(e.code); e.preventDefault(); return; }
    if (e.code === 'Space') { state._keys.push(e.code); state._swings.push({ heavy: false }); e.preventDefault(); return; }
    if (e.code === 'Enter') { state._keys.push(e.code); e.preventDefault(); return; }
    if (e.code === 'KeyF') { state._keys.push(e.code); return; }
    if (e.code === 'Escape') { state._keys.push('Escape'); return; }
    if (/^Digit[1-9]$/.test(e.code)) { state._keys.push(e.code); e.preventDefault(); return; }
    if (e.code === 'KeyR' || e.code === 'KeyC') { state._keys.push(e.code); return; }
    if (e.code === 'Tab') { state._keys.push('Tab'); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { if (HELD[e.code]) { state[HELD[e.code]] = false; e.preventDefault(); } });

  document.addEventListener('pointerlockchange', () => { state.locked = document.pointerLockElement === canvas; });
  document.addEventListener('mousemove', (e) => { if (state.locked) { state.yaw += e.movementX; state.pitch += e.movementY; } });

  // pointer-locked mouse = the sword arm: tap to swing, hold ≥350ms for a heavy
  // (Effort) swing released on mouseup — Morrowind's hold-attack, Cypher inside.
  canvas.addEventListener('mousedown', (e) => {
    if (state.locked && e.button === 0) state.swingCharging = performance.now();
  });
  canvas.addEventListener('mouseup', (e) => {
    if (state.locked && e.button === 0 && state.swingCharging) {
      state._swings.push({ heavy: performance.now() - state.swingCharging >= 350 });
    }
    state.swingCharging = 0;
  });

  canvas.addEventListener('click', (e) => {
    if (state.wantPointerLock && !state.locked) { canvas.requestPointerLock?.(); return; }
    const { scale, offX, offY } = state.viewport;
    state._clicks.push({ x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale });
  });

  // --- touch: left stick = move, right drag = look, tap = click in menus -----
  const toBuffer = (t) => { const { scale, offX, offY } = state.viewport; return { x: (t.clientX - offX) / scale, y: (t.clientY - offY) / scale }; };
  const inRect = (b, r) => b.x >= r.x && b.x <= r.x + r.w && b.y >= r.y && b.y <= r.y + r.h;
  const active = new Map(); // touch id -> {role, ox, oy, prevX}

  const fireButton = (id) => {
    if (id === 'interact') state._interact = true;
    else if (id === 'swing') state._swings.push({ heavy: false });
    else state._keys.push(id);
  };

  canvas.addEventListener('touchstart', (e) => {
    state.touchActive = true;
    for (const t of e.changedTouches) {
      const b = toBuffer(t);
      if (!state.wantPointerLock) { state._clicks.push(b); active.set(t.identifier, { role: 'tap' }); continue; }
      const btn = TOUCH_UI.buttons.find((r) => inRect(b, r));
      if (btn) { fireButton(btn.id); active.set(t.identifier, { role: 'button' }); continue; }
      if (b.x < BUF_W / 2) { active.set(t.identifier, { role: 'move', ox: t.clientX, oy: t.clientY }); }
      else { active.set(t.identifier, { role: 'look', prevX: t.clientX }); }
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const a = active.get(t.identifier);
      if (!a) continue;
      if (a.role === 'move') {
        state.analogX = Math.max(-1, Math.min(1, (t.clientX - a.ox) / JOY_PX));
        state.analogY = Math.max(-1, Math.min(1, (t.clientY - a.oy) / JOY_PX));
        state.knob = { x: state.analogX * TOUCH_UI.joy.r, y: state.analogY * TOUCH_UI.joy.r };
      } else if (a.role === 'look') {
        state.yaw += (t.clientX - a.prevX); a.prevX = t.clientX;
      }
    }
    e.preventDefault();
  }, { passive: false });

  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      const a = active.get(t.identifier);
      if (a && a.role === 'move') { state.analogX = 0; state.analogY = 0; state.knob = { x: 0, y: 0 }; }
      active.delete(t.identifier);
    }
    e.preventDefault();
  };
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });

  return state;
}
