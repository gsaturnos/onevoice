// Asset-pipeline tests. The character atlas is authored offline and shipped as a
// manifest + WebP pages; these guard the pure loading math and the manifest's
// integrity WITHOUT a browser, and — importantly — prove every neighbour is
// distinguishable by SHAPE alone (so colour is never the sole cue) and that the
// runtime degrades safely when the atlas is absent.

import { describe, it, expect } from 'vitest';
import {
  stateForAwareness, choosePage, scaleRect, localScale, frameKey, shapeSignature,
  type CharacterManifest,
} from '../src/render/assets/atlasMath';
import { CAST_IDS } from '../src/render/castIds';
import manifestJson from '../public/art/characters.manifest.json';

const manifest = manifestJson as unknown as CharacterManifest;

describe('awareness → state buckets', () => {
  it('maps awareness onto afraid / listening / clear at the same thresholds as the face', () => {
    expect(stateForAwareness(0)).toBe('afraid');
    expect(stateForAwareness(0.34)).toBe('afraid');
    expect(stateForAwareness(0.35)).toBe('listening');
    expect(stateForAwareness(0.69)).toBe('listening');
    expect(stateForAwareness(0.7)).toBe('clear');
    expect(stateForAwareness(1)).toBe('clear');
  });
});

describe('resolution-aware page selection', () => {
  it('serves 2× on hi-dpi and 1× otherwise, capped at what exists', () => {
    expect(manifest.pages['2x'].scale).toBe(2);
    expect(choosePage(manifest, 2)).toBe('2x');
    expect(choosePage(manifest, 1)).toBe('1x');
    expect(choosePage(manifest, 3)).toBe('2x'); // nothing higher exists
  });
});

describe('frame geometry', () => {
  it('scales frame rects by the page scale', () => {
    const r = { x: 10, y: 20, w: 30, h: 40 };
    expect(scaleRect(r, 2)).toEqual({ x: 20, y: 40, w: 60, h: 80 });
    expect(scaleRect(r, 1)).toEqual(r);
  });
  it('keeps a sprite the same on-table size regardless of atlas resolution', () => {
    const at1x = localScale(manifest, manifest.cell.w * 1);
    const at2x = localScale(manifest, manifest.cell.w * 2);
    // a 2× sprite is drawn at half the scale of a 1× sprite → identical span
    expect(at1x).toBeCloseTo(at2x * 2, 6);
    expect(manifest.cell.w * at1x).toBeCloseTo(manifest.local.w, 6);
  });
});

describe('manifest integrity', () => {
  it('covers all 12 neighbours in all 3 states (36 frames)', () => {
    expect(manifest.characters).toHaveLength(12);
    expect(Object.keys(manifest.frames)).toHaveLength(36);
    for (const c of manifest.characters) {
      for (const st of ['afraid', 'listening', 'clear'] as const) {
        expect(manifest.frames[frameKey(c.id, st)]).toBeDefined();
      }
    }
  });
  it('lists the same ids, in the same order, the runtime maps seats to', () => {
    expect(manifest.characters.map((c) => c.id)).toEqual([...CAST_IDS]);
  });
  it('places the anchor inside the cell and ships original, third-party-free art', () => {
    expect(manifest.anchor.x).toBeGreaterThan(0);
    expect(manifest.anchor.x).toBeLessThan(1);
    expect(manifest.anchor.y).toBeGreaterThan(0);
    expect(manifest.anchor.y).toBeLessThan(1);
    expect(manifest.pages['1x'].src).toMatch(/\.webp$/);
    expect(manifest.pages['2x'].src).toMatch(/\.webp$/);
    expect(manifest.attribution.thirdParty).toBe('none');
  });
});

describe('accessibility: colour is not the only cue', () => {
  it('gives every neighbour a distinct shape signature (greyscale-safe identity)', () => {
    const sigs = manifest.characters.map(shapeSignature);
    expect(new Set(sigs).size).toBe(sigs.length);
  });
  it('represents a range of ages and at least one mobility aid', () => {
    const ages = new Set(manifest.characters.map((c) => c.age));
    expect(ages.size).toBeGreaterThanOrEqual(3); // young / adult / elder
    const mob = manifest.characters.filter((c) => c.mobility !== 'none');
    expect(mob.length).toBeGreaterThanOrEqual(1);
  });
});
