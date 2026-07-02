// Explore-mode input (Tech §7): WASD move/strafe, Pointer-Lock mouse yaw with
// Q/E fallback turning, E to interact. Exposes a small polled state object plus
// a consumable mouse-yaw accumulator; movement integration lives in main.js so
// collision stays in world.js.

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'strafeL', KeyD: 'strafeR',
  KeyQ: 'turnL', ArrowLeft: 'turnL',
  KeyE_turn: 'turnR', ArrowRight: 'turnR',
};

/**
 * Wire input listeners to the canvas and return the polled input state.
 * @param {HTMLCanvasElement} canvas
 */
export function createInput(canvas) {
  const state = {
    forward: false, back: false, strafeL: false, strafeR: false,
    turnL: false, turnR: false, interact: false,
    yaw: 0,        // accumulated mouse dx since last consume()
    locked: false,
    consumeYaw() { const y = this.yaw; this.yaw = 0; return y; },
  };

  const setKey = (code, down) => {
    // E is interact when pointer-locked, but doubles as turn-right fallback.
    if (code === 'KeyE') { state.interact = down; state.turnR = down; return; }
    const action = KEY_MAP[code];
    if (action) state[action] = down;
  };

  window.addEventListener('keydown', (e) => {
    if (KEY_MAP[e.code] || e.code === 'KeyE') { setKey(e.code, true); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (KEY_MAP[e.code] || e.code === 'KeyE') { setKey(e.code, false); e.preventDefault(); }
  });

  // Pointer lock for mouse-yaw; click the canvas to engage.
  canvas.addEventListener('click', () => { if (!state.locked) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (state.locked) state.yaw += e.movementX;
  });

  return state;
}
