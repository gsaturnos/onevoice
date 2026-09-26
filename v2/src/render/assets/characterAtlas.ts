// Loads the character sprite atlas (WebP page + JSON manifest) and hands out a
// Texture per (character, awareness state). Every failure mode is graceful: a
// missing manifest, a missing page, a decode error, or an individual missing frame
// all leave the game fully playable on the procedural fallback — load() never throws
// and never blocks the first frame. Rendering only; the core never sees this.

import { Assets, Texture, Rectangle } from 'pixi.js';
import {
  type CharacterManifest, type AwarenessState, type CharMeta,
  choosePage, scaleRect, frameKey, stateForAwareness,
} from './atlasMath';

function baseUrl(): string {
  try {
    const b = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    return b || '/';
  } catch { return '/'; }
}

export class CharacterAtlas {
  private constructor(
    private readonly manifest: CharacterManifest | null,
    private readonly textures: Map<string, Texture>,
    readonly available: boolean,
  ) {}

  static unavailable(): CharacterAtlas {
    return new CharacterAtlas(null, new Map(), false);
  }

  /** Load the atlas; on ANY failure resolve to an unavailable (fallback) instance. */
  static async load(base: string = baseUrl()): Promise<CharacterAtlas> {
    try {
      const mUrl = `${base}art/characters.manifest.json`;
      const res = await fetch(mUrl);
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      const manifest = (await res.json()) as CharacterManifest;
      const dpr = globalThis.devicePixelRatio || 1;
      const pageKey = choosePage(manifest, dpr);
      const page = manifest.pages[pageKey];
      if (!page) throw new Error('no usable atlas page');
      const tex = (await Assets.load(`${base}art/${page.src}`)) as Texture;
      const source = tex.source;
      const textures = new Map<string, Texture>();
      for (const [key, rect] of Object.entries(manifest.frames)) {
        const r = scaleRect(rect, page.scale);
        textures.set(key, new Texture({ source, frame: new Rectangle(r.x, r.y, r.w, r.h) }));
      }
      return new CharacterAtlas(manifest, textures, textures.size > 0);
    } catch (e) {
      // Expected in offline/preview or before assets ship — degrade, don't crash.
      console.warn('[art] character atlas unavailable; using procedural cast:', (e as Error)?.message);
      return CharacterAtlas.unavailable();
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
