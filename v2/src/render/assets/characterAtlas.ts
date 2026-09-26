// Loads the character sprite atlas (WebP page + JSON manifest) and hands out a
// Texture per (character, awareness state). Every failure mode is graceful: a
// missing manifest, a missing page, a decode error, or an individual missing frame
// all leave the game fully playable on the procedural fallback — load() never throws
// and never blocks the first frame. Rendering only; the core never sees this.

import { Assets, Texture, Rectangle } from 'pixi.js';
import {
  type CharacterManifest, type AwarenessState, type CharMeta,
  choosePage, frameKey, stateForAwareness,
} from './atlasMath';

function baseUrl(): string {
  try {
    const b = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return b || '/';
  } catch { return '/'; }
}

/** Dev-only load report — lets a diagnostic conclusively show atlas vs fallback. */
export interface AtlasDiagnostics {
  available: boolean;          // did the authored atlas load and resolve?
  forcedFallback: boolean;     // did ?noatlas force the procedural cast?
  manifestUrl: string;
  manifestOk: boolean;
  httpStatus: number | null;
  pageKey: string;             // '1x' | '2x' | ''
  pageSrc: string;
  pageScale: number;           // 1 or 2 (resolution actually selected)
  dpr: number;
  framesInManifest: number;
  texturesResolved: number;    // frames that produced a real Texture
  charactersExpected: number;  // 12
  charactersResolved: number;  // characters with all three state frames
  missing: string[];           // frame keys that failed to resolve
  error: string | null;
}

function blankDiag(forced: boolean): AtlasDiagnostics {
  return {
    available: false, forcedFallback: forced, manifestUrl: '', manifestOk: false,
    httpStatus: null, pageKey: '', pageSrc: '', pageScale: 0, dpr: 0,
    framesInManifest: 0, texturesResolved: 0, charactersExpected: 0,
    charactersResolved: 0, missing: [], error: forced ? 'forced fallback (?noatlas)' : null,
  };
}

export class CharacterAtlas {
  private constructor(
    private readonly manifest: CharacterManifest | null,
    private readonly textures: Map<string, Texture>,
    readonly available: boolean,
    readonly diagnostics: AtlasDiagnostics,
  ) {}

  static unavailable(diag: AtlasDiagnostics = blankDiag(false)): CharacterAtlas {
    return new CharacterAtlas(null, new Map(), false, diag);
  }

  /**
   * Load the atlas; on ANY failure resolve to an unavailable (fallback) instance.
   * Pass { force: 'fallback' } (dev `?noatlas`) to skip the atlas entirely.
   */
  static async load(
    base: string = baseUrl(),
    opts: { force?: 'fallback' } = {},
  ): Promise<CharacterAtlas> {
    if (opts.force === 'fallback') return CharacterAtlas.unavailable(blankDiag(true));
    const diag = blankDiag(false);
    try {
      const mUrl = `${base}art/characters.manifest.json`;
      diag.manifestUrl = mUrl;
      const res = await fetch(mUrl);
      diag.httpStatus = res.status;
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = (await res.json()) as CharacterManifest;
      diag.manifestOk = true;
      const frameKeys = Object.keys(manifest.frames);
      diag.framesInManifest = frameKeys.length;
      diag.charactersExpected = manifest.characters?.length ?? 0;
      const dpr = globalThis.devicePixelRatio || 1;
      diag.dpr = dpr;
      const pageKey = choosePage(manifest, dpr);
      const page = manifest.pages[pageKey];
      if (!page) throw new Error('no usable atlas page');
      diag.pageKey = pageKey;
      diag.pageSrc = page.src;
      diag.pageScale = page.scale;
      const tex = (await Assets.load(`${base}art/${page.src}`)) as Texture;
      const source = tex.source;
      // Frames are authored in LOGICAL units (the base 1× grid). Set the source
      // resolution to the page scale so its logical size matches that grid — then a
      // single logical frame rect maps to one cell on any page. (Pixi also infers
      // resolution from the "@2x" filename; setting it here makes it deterministic
      // and avoids double-scaling the rects, which previously sampled 2×2 cells.)
      source.resolution = page.scale;
      const textures = new Map<string, Texture>();
      for (const [key, rect] of Object.entries(manifest.frames)) {
        textures.set(key, new Texture({ source, frame: new Rectangle(rect.x, rect.y, rect.w, rect.h) }));
      }
      diag.texturesResolved = textures.size;
      // per-character completeness (all three awareness states present)
      const states: AwarenessState[] = manifest.states ?? ['afraid', 'listening', 'clear'];
      let whole = 0;
      for (const c of manifest.characters ?? []) {
        const ok = states.every((st) => textures.has(frameKey(c.id, st)));
        if (ok) whole++;
        else for (const st of states) if (!textures.has(frameKey(c.id, st))) diag.missing.push(frameKey(c.id, st));
      }
      diag.charactersResolved = whole;
      diag.available = textures.size > 0 && diag.missing.length === 0;
      return new CharacterAtlas(manifest, textures, diag.available, diag);
    } catch (e) {
      // Expected in offline/preview or before assets ship — degrade, don't crash.
      diag.error = (e as Error)?.message ?? String(e);
      diag.available = false;
      console.warn('[art] character atlas unavailable; using procedural cast:', diag.error);
      return CharacterAtlas.unavailable(diag);
    }
  }

  /** True when this character has at least its neutral (listening) sprite. */
  has(id: string): boolean {
    return this.available && this.textures.has(frameKey(id, 'listening'));
  }

  state(aw: number): AwarenessState { return stateForAwareness(aw); }

  /** Texture for a (character, state), or null → caller draws the procedural bust. */
  texture(id: string, state: AwarenessState): Texture | null {
    if (!this.available) return null;
    return this.textures.get(frameKey(id, state)) ?? this.textures.get(frameKey(id, 'listening')) ?? null;
  }

  /** Local-unit span for a sprite of this texture (keeps on-table size constant). */
  localScaleFor(tex: Texture): number {
    const w = this.manifest?.local.w ?? 144;
    return w / (tex.width || w);
  }

  get anchor(): { x: number; y: number } {
    return this.manifest?.anchor ?? { x: 0.5, y: 0.64 };
  }

  get characters(): CharMeta[] { return this.manifest?.characters ?? []; }
  get attribution(): Record<string, string> { return this.manifest?.attribution ?? {}; }
}
