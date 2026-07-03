// audio.js — procedural WebAudio cues (Asset §5). No files: everything is
// synthesized. The context is created lazily on the first user gesture (browser
// autoplay policy); every call is a no-op until then and is wrapped so a missing
// AudioContext (headless) never throws.

let ctx = null, master = null, noiseBuf = null, zoneOsc = null, zoneGain = null, curZone = null;

/** Create the context on a user gesture; safe to call repeatedly. */
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume?.(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    const n = ctx.sampleRate * 0.4;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
  } catch { ctx = null; }
}

const now = () => ctx.currentTime;
function env(node, gain, a, dcy, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, now());
  g.gain.exponentialRampToValueAtTime(peak, now() + a);
  g.gain.exponentialRampToValueAtTime(0.0001, now() + a + dcy);
  node.connect(g); g.connect(gain || master);
  return g;
}
function tone(freq, a, dcy, type = 'sine', peak = 0.8) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  env(o, master, a, dcy, peak); o.start(); o.stop(now() + a + dcy + 0.02);
  return o;
}
function noise(dur, filterHz, type = 'lowpass', peak = 0.6) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterHz;
  s.connect(f); env(f, master, 0.005, dur, peak);
  s.start(); s.stop(now() + dur + 0.02);
}

const guard = (fn) => (...a) => { if (ctx && ctx.state === 'running') { try { fn(...a); } catch { /* ignore */ } } };

export const sfx = {
  step: guard(() => noise(0.08, 400, 'lowpass', 0.25)),
  swing: guard(() => noise(0.12, 1400, 'bandpass', 0.3)),
  door: guard(() => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(120, now()); o.frequency.exponentialRampToValueAtTime(300, now() + 0.4); env(o, master, 0.02, 0.4, 0.3); o.start(); o.stop(now() + 0.45); }),
  dice: guard(() => { for (let i = 0; i < 4; i++) setTimeout(() => ctx && noise(0.04, 2000 + Math.random() * 1500, 'bandpass', 0.4), i * 60); }),
  hit: guard(() => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(80, now()); o.frequency.exponentialRampToValueAtTime(40, now() + 0.15); env(o, master, 0.005, 0.15, 0.9); o.start(); o.stop(now() + 0.18); }),
  hurt: guard(() => { sfx.hit(); noise(0.15, 600, 'lowpass', 0.5); }),
  cypher: guard(() => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(440, now()); o.frequency.exponentialRampToValueAtTime(1200, now() + 0.3); const m = ctx.createOscillator(); m.frequency.value = 6; const mg = ctx.createGain(); mg.gain.value = 40; m.connect(mg); mg.connect(o.frequency); env(o, master, 0.02, 0.35, 0.5); o.start(); m.start(); o.stop(now() + 0.4); m.stop(now() + 0.4); }),
  drain: guard(() => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(660, now()); o.frequency.exponentialRampToValueAtTime(120, now() + 0.5); env(o, master, 0.02, 0.5, 0.5); o.start(); o.stop(now() + 0.55); }),
  whisper: guard(() => noise(0.9, 900, 'bandpass', 0.28)),
  // THE motif — three descending tones; O2 and the glyph solve share it (Asset §5)
  glyph: guard(() => { [660, 550, 440].forEach((f, i) => setTimeout(() => ctx && tone(f, 0.02, 0.35, 'sine', 0.5), i * 160)); }),
};

/** Low zone drone, detuned per zone (Asset §5). */
export const setZoneDrone = guard((zoneId) => {
  const detune = { Z1: 0, Z2: 3, Z3: 7, Z4: 5, Z5: 10 }[zoneId] ?? 0;
  if (curZone === zoneId) return;
  curZone = zoneId;
  if (!zoneOsc) {
    zoneOsc = ctx.createOscillator(); zoneOsc.type = 'sine'; zoneOsc.frequency.value = 60;
    zoneGain = ctx.createGain(); zoneGain.gain.value = 0.06;
    zoneOsc.connect(zoneGain); zoneGain.connect(master); zoneOsc.start();
  }
  zoneOsc.detune.setTargetAtTime(detune, now(), 0.5);
});
