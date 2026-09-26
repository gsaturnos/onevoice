// Pure types + helpers for the AUTHORED raster character pipeline (illustrator-
// supplied transparent WebP art — see docs/v2/authored-character-art-spec.md for
// the full contract this manifest implements). This is the PRIMARY visual tier
// when a character has authored art; the procedural SVG cast atlas
// (atlasMath.ts / characterAtlas.ts) remains the fallback for any character (or
// state) the authored set doesn't cover yet — coverage is intentionally partial
// and permanent, not a migration step. No DOM, no Pixi — safe to unit-test.

export type AwarenessState = 'afraid' | 'listening' | 'clear';
export const STATES: AwarenessState[] = ['afraid', 'listening', 'clear'];

export interface ResVariant { '1x'?: string; '2x'?: string; }

export interface AuthoredCharacterEntry {
  id: string;
  status?: 'authored' | 'placeholder';
  anchor?: { x: number; y: number }; // per-character override of the manifest default
  figure?: Partial<Record<AwarenessState, ResVariant>>;
  portrait?: Partial<Record<AwarenessState, ResVariant>>;
}

export interface AuthoredManifest {
  version: number;
  figureCanvas: { w: number; h: number };
  portraitCanvas: { w: number; h: number };
  anchor: { x: number; y: number };
  states: AwarenessState[];
  characters: AuthoredCharacterEntry[];
  attribution: Record<string, string>;
}

// Same thresholds the procedural face/posture and the SVG atlas use, so every
// tier agrees on which state a given awareness value is in.
export function stateForAwareness(aw: number): AwarenessState {
  if (aw < 0.35) return 'afraid';
  if (aw < 0.7) return 'listening';
  return 'clear';
}

/** Pick the best resolution variant for this device, falling back gracefully. */
export function pickVariant(v: ResVariant | undefined, dpr: number): { src: string; scale: number } | null {
  if (!v) return null;
  if (dpr >= 1.5 && v['2x']) return { src: v['2x'], scale: 2 };
  if (v['1x']) return { src: v['1x'], scale: 1 };
  if (v['2x']) return { src: v['2x'], scale: 2 };
  return null;
}

export function findEntry(manifest: AuthoredManifest, id: string): AuthoredCharacterEntry | undefined {
  return manifest.characters.find((c) => c.id === id);
}

/** True once an entry has at least its neutral (listening) figure image. */
export function hasFigure(entry: AuthoredCharacterEntry | undefined): boolean {
  return !!entry?.figure?.listening && !!pickVariant(entry.figure.listening, 1);
}

export function anchorFor(manifest: AuthoredManifest, entry: AuthoredCharacterEntry | undefined): { x: number; y: number } {
  return entry?.anchor ?? manifest.anchor;
}
