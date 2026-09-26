// Pure helpers for the character sprite atlas: awareness→state buckets, resolution
// choice, frame-rect scaling, and a shape signature used to prove every neighbour is
// distinguishable by SHAPE (not colour). No DOM, no Pixi — safe to unit-test directly.

export type AwarenessState = 'afraid' | 'listening' | 'clear';

export interface FrameRect { x: number; y: number; w: number; h: number; }

export interface CharMeta {
  id: string;
  role: string;
  age: string;
  mobility: string;
  build: { h: number; girth: number; sh: number; neck: number };
  head: string;
  headwear: string;
  prop: string;
}

export interface CharacterManifest {
  version: number;
  cell: { w: number; h: number };
  local: { x0: number; y0: number; w: number; h: number };
  anchor: { x: number; y: number };
  pages: Record<string, { src: string; scale: number }>;
  states: AwarenessState[];
  frames: Record<string, FrameRect>;
  characters: CharMeta[];
  attribution: Record<string, string>;
}

// Same thresholds the procedural face/posture uses, so sprite and fallback agree.
export function stateForAwareness(aw: number): AwarenessState {
  if (aw < 0.35) return 'afraid';
  if (aw < 0.7) return 'listening';
  return 'clear';
}

/** Pick the atlas page whose scale best serves this device, capped at what exists. */
export function choosePage(manifest: CharacterManifest, dpr: number): string {
  const keys = Object.keys(manifest.pages);
  if (keys.length === 0) return '';
  const want = dpr >= 1.5 ? 2 : 1;
  // closest page with scale >= want, else the highest available
  let best = keys[0];
  for (const k of keys) {
    const s = manifest.pages[k].scale;
    if (s >= want && s < manifest.pages[best].scale) best = k;
    if (manifest.pages[best].scale < want && s > manifest.pages[best].scale) best = k;
  }
  return best;
}

export function frameKey(id: string, state: AwarenessState): string {
  return `${id}.${state}`;
}

/** Frame rect in source-pixels for a given page scale (frames are stored at 1×). */
export function scaleRect(r: FrameRect, scale: number): FrameRect {
  return { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale };
}

/** How many local units one displayed sprite should span, given its frame px width. */
export function localScale(manifest: CharacterManifest, frameWidthPx: number): number {
  return manifest.local.w / frameWidthPx;
}

/** A shape-only fingerprint: identity that survives greyscale / colour-blindness. */
export function shapeSignature(c: CharMeta): string {
  const b = c.build;
  return [b.h, b.girth, b.sh, b.neck, c.head, c.headwear, c.prop, c.mobility].join('|');
}
