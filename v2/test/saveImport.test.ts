// Stage D gate: the read-only save importer must clone production saves into the
// versioned V2 dev namespace, idempotently, tolerating missing/malformed data,
// while NEVER writing or removing a production key, and rollback must remove only
// the namespace. See docs/v2/ARCHITECTURE.md §7.4 (Decision 4).

import { describe, it, expect } from 'vitest';
import {
  importSaves,
  rollbackImport,
  readImported,
  listImported,
  readImportedLegacy,
  readImportedProgress,
  isProductionSaveKey,
  namespacedKey,
  NAMESPACE,
  MANIFEST_KEY,
  type KeyValueStore,
} from '../src/persistence/saveImport';

/** An in-memory Web-Storage stand-in with deterministic key ordering. */
class MemoryStore implements KeyValueStore {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  /** test helper: snapshot the namespace only */
  nsSnapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.m) if (k.startsWith(NAMESPACE)) out[k] = v;
    return out;
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.m);
  }
}

/** Wraps a store and throws if anything ever writes/removes a production key. */
function guardProduction(store: MemoryStore): KeyValueStore {
  return {
    get length() {
      return store.length;
    },
    key: (i) => store.key(i),
    getItem: (k) => store.getItem(k),
    setItem: (k, v) => {
      if (isProductionSaveKey(k)) throw new Error(`production write attempted: ${k}`);
      store.setItem(k, v);
    },
    removeItem: (k) => {
      if (isProductionSaveKey(k)) throw new Error(`production remove attempted: ${k}`);
      store.removeItem(k);
    },
  };
}

function seedProduction(s: MemoryStore): void {
  s.setItem('ov8_pro', JSON.stringify([true, true, false]));
  s.setItem('ov8_camp', '2');
  s.setItem('ov8_fallen_6', JSON.stringify(['Mara', 'Ilya']));
  s.setItem('ov8_att_6', '3');
  s.setItem('ov11_legacy', JSON.stringify({ embers: 12, owned: ['friends', 'press'] }));
  s.setItem('ov11_snd', 'off');
  s.setItem('ov15_intro', '1');
  s.setItem('ov17_hints', JSON.stringify({ spread: true }));
  // unrelated keys that must be ignored
  s.setItem('some_other_app', 'x');
  s.setItem('theme', 'dark');
}

describe('Stage D — read-only save importer', () => {
  it('clones every recognised production key into the namespace, verbatim', () => {
    const s = new MemoryStore();
    seedProduction(s);
    const before = s.snapshot();

    const res = importSaves(guardProduction(s));

    expect(res.namespace).toBe(NAMESPACE);
    expect(res.imported).toEqual(
      ['ov8_pro', 'ov8_camp', 'ov8_fallen_6', 'ov8_att_6', 'ov11_legacy', 'ov11_snd', 'ov15_intro', 'ov17_hints'].sort(),
    );
    // clones are byte-identical to production
    for (const k of res.imported) {
      expect(readImported(s, k)).toBe(before[k]);
    }
    // unrelated keys were not cloned
    expect(s.getItem(namespacedKey('some_other_app'))).toBeNull();
    expect(s.getItem(namespacedKey('theme'))).toBeNull();
  });

  it('never writes or removes a production key (originals preserved)', () => {
    const s = new MemoryStore();
    seedProduction(s);
    const before = s.snapshot();

    // guardProduction throws on any production write/remove — so this passing
    // proves the importer only ever touched the namespace.
    expect(() => importSaves(guardProduction(s))).not.toThrow();

    for (const k of Object.keys(before)) {
      expect(s.getItem(k), `production key ${k} unchanged`).toBe(before[k]);
    }
  });

  it('is idempotent — re-running converges to the same namespace state', () => {
    const s = new MemoryStore();
    seedProduction(s);
    importSaves(guardProduction(s));
    const first = s.nsSnapshot();
    importSaves(guardProduction(s));
    const second = s.nsSnapshot();
    expect(second).toEqual(first);
  });

  it('mirrors production on re-import: updates changed values and drops stale clones', () => {
    const s = new MemoryStore();
    seedProduction(s);
    importSaves(guardProduction(s));
    expect(readImported(s, 'ov8_camp')).toBe('2');

    // production advances and one key disappears
    s.setItem('ov8_camp', '4');
    s.removeItem('ov8_att_6');
    importSaves(guardProduction(s));

    expect(readImported(s, 'ov8_camp')).toBe('4');
    expect(readImported(s, 'ov8_att_6')).toBeNull(); // stale clone dropped
    expect(listImported(s)).not.toContain('ov8_att_6');
  });

  it('tolerates missing data (empty store) — no throw, empty manifest', () => {
    const s = new MemoryStore();
    const res = importSaves(guardProduction(s));
    expect(res.imported).toEqual([]);
    expect(s.getItem(MANIFEST_KEY)).not.toBeNull();
    expect(listImported(s)).toEqual([]);
    expect(readImportedLegacy(s)).toEqual({ embers: 0, owned: [] });
    expect(readImportedProgress(s)).toEqual({ proDone: [], campProgress: 0 });
  });

  it('tolerates malformed data — copies verbatim and readers fall back', () => {
    const s = new MemoryStore();
    s.setItem('ov11_legacy', '{ this is not: json');
    s.setItem('ov8_pro', 'not-an-array');
    s.setItem('ov8_camp', 'NaNish');
    expect(() => importSaves(guardProduction(s))).not.toThrow();

    // raw clone preserves the malformed bytes exactly
    expect(readImported(s, 'ov11_legacy')).toBe('{ this is not: json');
    // typed readers degrade gracefully
    expect(readImportedLegacy(s)).toEqual({ embers: 0, owned: [] });
    expect(readImportedProgress(s)).toEqual({ proDone: [], campProgress: 0 });
  });

  it('typed readers parse well-formed imported data', () => {
    const s = new MemoryStore();
    seedProduction(s);
    importSaves(guardProduction(s));
    expect(readImportedLegacy(s)).toEqual({ embers: 12, owned: ['friends', 'press'] });
    expect(readImportedProgress(s)).toEqual({ proDone: [true, true, false], campProgress: 2 });
  });

  it('rollback removes only the namespace, leaving production intact', () => {
    const s = new MemoryStore();
    seedProduction(s);
    const before = s.snapshot();
    importSaves(guardProduction(s));

    const removed = rollbackImport(guardProduction(s));
    expect(removed.length).toBeGreaterThan(0);
    for (const k of removed) expect(k.startsWith(NAMESPACE)).toBe(true);

    // namespace gone
    expect(s.nsSnapshot()).toEqual({});
    // production identical to before the whole cycle
    for (const k of Object.keys(before)) expect(s.getItem(k)).toBe(before[k]);
    // a second rollback is a harmless no-op
    expect(rollbackImport(guardProduction(s))).toEqual([]);
  });

  it('classifies keys correctly (production vs namespace vs unrelated)', () => {
    expect(isProductionSaveKey('ov8_pro')).toBe(true);
    expect(isProductionSaveKey('ov23_anything')).toBe(true);
    expect(isProductionSaveKey(namespacedKey('ov8_pro'))).toBe(false);
    expect(isProductionSaveKey('ov_v2dev_v1_ov8_pro')).toBe(false);
    expect(isProductionSaveKey('theme')).toBe(false);
  });
});
