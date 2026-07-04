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
// to the buffer edges so it survives resolution changes. Two thumb clusters:
// actions bottom-right (round), menus as small tabs top-right; everything else
// on the right half is look-drag. Hit rects (x/y/w/h) are deliberately larger
// than the drawn shapes — thumbs are imprecise. HUD top = BUF_H−40.
export const TOUCH_UI = {
  joy: { cx: 48, cy: BUF_H - 48, r: 26 },  // ghost anchor; the live base floats to the thumb
  buttons: [
    { id: 'swing', label: 'ATK', kind: 'circle', cx: BUF_W - 34, cy: BUF_H - 48, r: 17, x: BUF_W - 58, y: BUF_H - 72, w: 48, h: 48 },
    { id: 'interact', label: 'E', kind: 'circle', cx: BUF_W - 36, cy: BUF_H - 94, r: 11, x: BUF_W - 54, y: BUF_H - 112, w: 36, h: 36 },
    { id: 'KeyM', label: 'Map', kind: 'tab', x: BUF_W - 96, y: 30, w: 30, h: 15 },
    { id: 'Tab', label: 'You', kind: 'tab', x: BUF_W - 64, y: 30, w: 30, h: 15 },
    { id: 'KeyC', label: 'Cy', kind: 'tab', x: BUF_W - 32, y: 30, w: 30, h: 15 },
  ],
};
// Touch feel, in LOGICAL px so every phone behaves the same regardless of
// screen size/scale: full stick deflection, look gain, and stick dead zone.
const JOY_LOGICAL = 30, LOOK_GAIN = 2.2, DEAD = 0.15;

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
    joyBase: null,                // live stick base (buffer px) — floats to the thumb
    heldIds: new Set(),           // touch buttons currently pressed (for drawing)
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
    if (e.code === 'KeyR' || e.code === 'KeyC' || e.code === 'KeyM') { state._keys.push(e.code); return; }
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
    else state._keys.push(id);
  };

  canvas.addEventListener('touchstart', (e) => {
    state.touchActive = true;
    for (const t of e.changedTouches) {
      const b = toBuffer(t);
      if (!state.wantPointerLock) { state._clicks.push(b); active.set(t.identifier, { role: 'tap' }); continue; }
      const btn = TOUCH_UI.buttons.find((r) => inRect(b, r));
      if (btn) {
        state.heldIds.add(btn.id);
        if (btn.id === 'swing') { state.swingCharging = performance.now(); active.set(t.identifier, { role: 'swingBtn', btnId: btn.id }); }
        else { fireButton(btn.id); active.set(t.identifier, { role: 'button', btnId: btn.id }); }
        continue;
      }
      // exactly ONE stick finger and ONE look finger — a second touch on the
      // same half is inert, otherwise two look-drags fight and the camera twists
      const roles = new Set([...active.values()].map((a) => a.role));
      if (b.x < BUF_W / 2) {
        if (roles.has('move')) { active.set(t.identifier, { role: 'idle' }); continue; }
        state.joyBase = b; active.set(t.identifier, { role: 'move', ox: t.clientX, oy: t.clientY });
      } else {
        if (roles.has('look')) { active.set(t.identifier, { role: 'idle' }); continue; }
        active.set(t.identifier, { role: 'look', prevX: t.clientX, prevY: t.clientY });
      }
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const a = active.get(t.identifier);
      if (!a) continue;
      if (a.role === 'move') {
        // deflection in logical px + radial dead zone → no drift, same feel on any phone
        let ax = (t.clientX - a.ox) / state.viewport.scale / JOY_LOGICAL;
        let ay = (t.clientY - a.oy) / state.viewport.scale / JOY_LOGICAL;
        const len = Math.hypot(ax, ay);
        if (len < DEAD) { ax = 0; ay = 0; }
        else if (len > 1) { ax /= len; ay /= len; }
        state.analogX = ax; state.analogY = ay;
        state.knob = { x: ax * TOUCH_UI.joy.r, y: ay * TOUCH_UI.joy.r };
      } else if (a.role === 'look') {
        state.yaw += (t.clientX - a.prevX) / state.viewport.scale * LOOK_GAIN; a.prevX = t.clientX;
        state.pitch += (t.clientY - a.prevY) / state.viewport.scale * LOOK_GAIN; a.prevY = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });

  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      const a = active.get(t.identifier);
      if (a && a.role === 'move') { state.analogX = 0; state.analogY = 0; state.knob = { x: 0, y: 0 }; state.joyBase = null; }
      if (a && a.role === 'swingBtn') { // hold ATK = heavy swing, like the mouse
        state._swings.push({ heavy: performance.now() - state.swingCharging >= 350 });
        state.swingCharging = 0;
      }
      if (a?.btnId) state.heldIds.delete(a.btnId);
      active.delete(t.identifier);
    }
    e.preventDefault();
  };
  canvas.addEventListener('touchend', endTouch, { passive: false });
  canvas.addEventListener('touchcancel', endTouch, { passive: false });
  // iOS Safari pinch/rotate gestures would zoom the page mid-fight
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    canvas.addEventListener(ev, (e) => e.preventDefault());
  }

  return state;
}
