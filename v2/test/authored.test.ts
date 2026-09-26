// Authored raster pipeline tests — pure loading math + manifest integrity,
// without a browser. Guards the contract in
// docs/v2/authored-character-art-spec.md: partial coverage is a supported,
// permanent state (some characters authored, most still on the SVG-atlas
// fallback), the manifest stays fixed-length/seat-ordered so index-based
// lookups (renderer + ui/portrait.ts) agree, and a placeholder is never
// silently indistinguishable from final art.

import { describe, it, expect } from 'vitest';
import {
  stateForAwareness, pickVariant, findEntry, hasFigure, anchorFor,
  type AuthoredManifest,
} from '../src/render/assets/authoredMath';
import { CAST_IDS } from '../src/render/castIds';
import manifestJson from '../public/art/authored/manifest.json';

const manifest = manifestJson as unknown as AuthoredManifest;

describe('awareness → state buckets', () => {
  it('matches the SVG-atlas thresholds exactly, so both tiers agree', () => {
    expect(stateForAwareness(0)).toBe('afraid');
    expect(stateForAwareness(0.34)).toBe('afraid');
    expect(stateForAwareness(0.35)).toBe('listening');
    expect(stateForAwareness(0.69)).toBe('listening');
    expect(stateForAwareness(0.7)).toBe('clear');
  });
});

describe('resolution-aware variant selection', () => {
  it('serves 2× on hi-dpi and 1× otherwise, and degrades gracefully', () => {
    const v = { '1x': 'a@1x.webp', '2x': 'a@2x.webp' };
    expect(pickVariant(v, 2)).toEqual({ src: 'a@2x.webp', scale: 2 });
    expect(pickVariant(v, 1)).toEqual({ src: 'a@1x.webp', scale: 1 });
    expect(pickVariant({ '1x': 'only1x.webp' }, 2)).toEqual({ src: 'only1x.webp', scale: 1 });
    expect(pickVariant(undefined, 2)).toBeNull();
  });
});

describe('manifest integrity', () => {
  it('is a fixed 12-entry, seat-ordered roster matching castIds — even for uncovered characters', () => {
    expect(manifest.characters).toHaveLength(12);
    expect(manifest.characters.map((c) => c.id)).toEqual([...CAST_IDS]);
  });

  it('declares an in-bounds default anchor and no third-party art', () => {
    expect(manifest.anchor.x).toBeGreaterThan(0);
    expect(manifest.anchor.x).toBeLessThan(1);
    expect(manifest.anchor.y).toBeGreaterThan(0);
    expect(manifest.anchor.y).toBeLessThan(1);
    expect(manifest.attribution.thirdParty).toBe('none');
  });

  it('keeps the figure canvas an exact-multiple pair across 1×/2× per declared image', () => {
    for (const c of manifest.characters) {
      for (const variants of Object.values(c.figure ?? {})) {
        if (variants['1x'] && variants['2x']) {
          // filenames encode the scale; the canvas itself is the same logical
          // box for both — this just guards the naming convention (§3 of the spec).
          expect(variants['1x']).toMatch(/@1x\.webp$/);
          expect(variants['2x']).toMatch(/@2x\.webp$/);
        }
      }
    }
  });
});

describe('partial coverage + the one placeholder proof', () => {
  it('has exactly one character with usable art in this phase, clearly marked as a placeholder', () => {
    const covered = manifest.characters.filter((c) => hasFigure(c));
    expect(covered).toHaveLength(1);
    expect(covered[0].status).toBe('placeholder');
  });

  it('the covered character has every state for both figure and portrait, at both resolutions', () => {
    const entry = manifest.characters.find((c) => hasFigure(c))!;
    for (const state of manifest.states) {
      for (const kind of ['figure', 'portrait'] as const) {
        const v = entry[kind]?.[state];
        expect(v?.['1x']).toBeTruthy();
        expect(v?.['2x']).toBeTruthy();
      }
    }
  });

  it('every other character is present but empty — falls through to the SVG atlas', () => {
    const uncovered = manifest.characters.filter((c) => !hasFigure(c));
    expect(uncovered).toHaveLength(11);
    for (const c of uncovered) {
      expect(Object.keys(c.figure ?? {})).toHaveLength(0);
    }
  });

  it('findEntry / anchorFor resolve a known id and fall back to the manifest default anchor', () => {
    const entry = findEntry(manifest, 'baker');
    expect(entry).toBeDefined();
    expect(anchorFor(manifest, entry)).toEqual(manifest.anchor);
    expect(findEntry(manifest, 'nobody')).toBeUndefined();
  });
});
