// Screen dimensions. The UI lives in a fixed 384×216 logical space (all panel/
// font layout), while the 3D view renders at RENDER_SCALE× that for a sharper
// retro look (?res=1..4 to compare; default 2 = 768×432, 3 = 1152×648).

export const BUF_W = 384;   // logical UI space (layout coordinates)
export const BUF_H = 216;

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
const requested = parseInt(q?.get('res') ?? '', 10);

// Default 3 (1152×648): triple sharpness, still 60fps headroom — 4 drops
// below 60 on weak hardware. ?res=1 restores the original chunky look.
export const RENDER_SCALE = Number.isFinite(requested) ? Math.max(1, Math.min(4, requested)) : 3;

/** Physical pixel size of the render buffer. */
export const VIEW_W = BUF_W * RENDER_SCALE;
export const VIEW_H = BUF_H * RENDER_SCALE;
