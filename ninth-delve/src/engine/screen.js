// Shared internal-buffer dimensions. 384×216 = 16:9 widescreen at the same
// texel density as the original 320×200 — Arena crunch, modern shape.
// Every renderer/UI module imports these instead of hardcoding.

export const BUF_W = 384;
export const BUF_H = 216;
