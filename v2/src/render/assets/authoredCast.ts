// Loads the AUTHORED raster character set (illustrator-supplied transparent
// WebP — see docs/v2/authored-character-art-spec.md) and hands out a Texture per
// (character, awareness state, kind). This is the PRIMARY visual tier; any
// character (or state) it doesn't cover falls through to the SVG cast atlas, and
// from there to the procedural bust — both existing tiers are untouched. Every
// failure mode here is graceful and per-character: one missing/broken image
// never blocks the manifest, the page, or any other character. Rendering only;
// the core never sees this.

import { Assets, Texture } from 'pixi.js';
import {
  type AuthoredManifest, type AwarenessState, type AuthoredCharacterEntry,
  STATES, pickVariant, anchorFor, stateForAwareness,
} from './authoredMath';

// Same on-table span (in the scene's local units) the SVG atlas uses for a
// figure — see atlasMath's `manifest.local.w`. Reusing the same constant means
// an authored figure and an SVG-atlas figure read as the same physical size at
// a given seat, regardless of which tier actually rendered that character.
const LOCAL_W = 144;

function baseUrl(): string {
  try {
    const b = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return b || '/';
  } catch { return '/'; }
}

/** Dev-only load report — which characters are authored/placeholder vs. absent. */
export interface AuthoredDiagnostics {
  available: boolean;      // did the manifest load at all (regardless of coverage)?
  forcedOff: boolean;      // did ?noauthored force this tier off entirely?
  manifestUrl: string;
  manifestOk: boolean;
  httpStatus: number | null;
  charactersDeclared: number;   // entries in the manifest (always 12 once shipped)
  authoredIds: string[];        // status:'authored', fully usable
  placeholderIds: string[];     // status:'placeholder', fully usable (dev proof only)
  failedIds: string[];          // declared art that failed to load → falls back per-character
  error: string | null;
}

function blankDiag(forced: boolean): AuthoredDiagnostics {
  return {
    available: false, forcedOff: forced, manifestUrl: '', manifestOk: false, httpStatus: null,
    charactersDeclared: 0, authoredIds: [], placeholderIds: [], failedIds: [],
    error: forced ? 'forced off (?noauthored)' : null,
  };
}

interface Entry {
  status: 'authored' | 'placeholder';
  anchor: { x: number; y: number };
  figure: Map<AwarenessState, Texture>;
  portrait: Map<AwarenessState, Texture>;
}

export class AuthoredCast {
  private constructor(
    private readonly figureCanvas: { w: number; h: number },
    private readonly portraitCanvas: { w: number; h: number },
    private readonly entries: Map<string, Entry>,
    readonly diagnostics: AuthoredDiagnostics,
  ) {}

  static unavailable(diag: AuthoredDiagnostics = blankDiag(false)): AuthoredCast {
    return new AuthoredCast({ w: 480, h: 600 }, { w: 440, h: 560 }, new Map(), diag);
  }

  /** Load the manifest + every declared image; per-character failures degrade gracefully. */
  static async load(base: string = baseUrl(), opts: { force?: 'off' } = {}): Promise<AuthoredCast> {
    if (opts.force === 'off') return AuthoredCast.unavailable(blankDiag(true));
    const diag = blankDiag(false);
    try {
      const mUrl = `${base}art/authored/manifest.json`;
      diag.manifestUrl = mUrl;
      const res = await fetch(mUrl);
      diag.httpStatus = res.status;
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = (await res.json()) as AuthoredManifest;
      diag.manifestOk = true;
      diag.available = true;
      diag.charactersDeclared = manifest.characters?.length ?? 0;

      const dpr = globalThis.devicePixelRatio || 1;
      const entries = new Map<string, Entry>();
      for (const char of manifest.characters ?? []) {
        const loaded = await AuthoredCast.loadOne(base, manifest, char, dpr);
        if (!loaded) continue; // no usable neutral figure → this character stays on the SVG atlas
        entries.set(char.id, loaded);
        (loaded.status === 'placeholder' ? diag.placeholderIds : diag.authoredIds).push(char.id);
      }
      // characters that declared SOME art but didn't make it into `entries`
      for (const char of manifest.characters ?? []) {
        const declared = Object.keys(char.figure ?? {}).length > 0;
        if (declared && !entries.has(char.id)) diag.failedIds.push(char.id);
      }
      return new AuthoredCast(manifest.figureCanvas, manifest.portraitCanvas, entries, diag);
    } catch (e) {
      diag.error = (e as Error)?.message ?? String(e);
      diag.available = false;
      console.warn('[art] authored cast unavailable; using SVG-atlas / procedural cast:', diag.error);
      return AuthoredCast.unavailable(diag);
    }
  }

  private static async loadOne(
    base: string, manifest: AuthoredManifest, char: AuthoredCharacterEntry, dpr: number,
  ): Promise<Entry | null> {
    const figure = new Map<AwarenessState, Texture>();
    const portrait = new Map<AwarenessState, Texture>();
    for (const state of STATES) {
      const fv = pickVariant(char.figure?.[state], dpr);
      if (fv) {
        try { figure.set(state, (await Assets.load(`${base}art/authored/${fv.src}`)) as Texture); }
        catch { /* this one state stays missing; texture()/portraitTexture() fall back to 'listening' */ }
      }
      const pv = pickVariant(char.portrait?.[state], dpr);
      if (pv) {
        try { portrait.set(state, (await Assets.load(`${base}art/authored/${pv.src}`)) as Texture); }
        catch { /* same graceful per-state miss */ }
      }
    }
    if (!figure.has('listening')) return null; // neutral figure is the minimum bar for "has art"
    return { status: char.status === 'authored' ? 'authored' : 'placeholder', anchor: anchorFor(manifest, char), figure, portrait };
  }

  /** True when this character has at least its neutral (listening) figure. */
  has(id: string): boolean { return this.entries.has(id); }

  state(aw: number): AwarenessState { return stateForAwareness(aw); }

  statusFor(id: string): 'authored' | 'placeholder' | null { return this.entries.get(id)?.status ?? null; }

  figureTexture(id: string, state: AwarenessState): Texture | null {
    const e = this.entries.get(id);
    if (!e) return null;
    return e.figure.get(state) ?? e.figure.get('listening') ?? null;
  }

  portraitTexture(id: string, state: AwarenessState): Texture | null {
    const e = this.entries.get(id);
    if (!e) return null;
    return e.portrait.get(state) ?? e.portrait.get('listening') ?? null;
  }

  anchorFor(id: string): { x: number; y: number } {
    return this.entries.get(id)?.anchor ?? { x: 0.5, y: 0.6444 };
  }

  /** Local-unit span for a figure sprite of this texture (matches the atlas convention). */
  localScaleFor(tex: Texture): number {
    return LOCAL_W / (tex.width || LOCAL_W);
  }

  get portraitAspect(): number { return this.portraitCanvas.w / this.portraitCanvas.h; }
  get figureAspect(): number { return this.figureCanvas.w / this.figureCanvas.h; }
}
