// Read-only save importer (Phase 2, Decision 4 — see docs/v2/ARCHITECTURE.md §7.4).
//
// V2 treats existing production save data as READ-ONLY input. This module clones
// recognised production keys into a versioned V2 development namespace
// (`ov_v2dev_v1_*`) and writes ONLY there. It is idempotent, preserves the
// originals byte-for-byte, tolerates missing/malformed values, and ships with a
// rollback that removes the namespace without touching production. It never
// writes or removes a production key — a guard enforces this at runtime — so it
// cannot corrupt a player's real progress before cutover is separately approved.

/** The minimal Web-Storage surface this importer needs (inject for testing). */
export interface KeyValueStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Namespace version. Bump to migrate the dev namespace without touching prod. */
export const IMPORT_VERSION = 'v1';

/** Every cloned/meta key lives under this prefix and nowhere else. */
export const NAMESPACE = `ov_v2dev_${IMPORT_VERSION}_`;

/** The manifest key (double underscore avoids any clash with a cloned key). */
export const MANIFEST_KEY = `${NAMESPACE}__manifest`;

/**
 * Recognised production key prefixes (staging emits ov8/ov11/ov15/ov17; ov22/
 * ov23 are recognised for forward compatibility per §7.4). A key must NOT be in
 * the V2 namespace to count as production.
 */
export const PRODUCTION_PREFIXES = ['ov8_', 'ov11_', 'ov15_', 'ov17_', 'ov22_', 'ov23_'] as const;

/** True for a real production save key (never for a V2-namespaced key). */
export function isProductionSaveKey(key: string): boolean {
  if (key.startsWith(NAMESPACE) || key.startsWith('ov_v2dev')) return false;
  return PRODUCTION_PREFIXES.some((p) => key.startsWith(p));
}

/** The namespaced key a production key is cloned to. */
export function namespacedKey(productionKey: string): string {
  return NAMESPACE + productionKey;
}

/** Snapshot all keys (collected up front so we never enumerate while mutating). */
function allKeys(store: KeyValueStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

/** Write guard: refuse any write outside the V2 namespace. */
function writeNs(store: KeyValueStore, key: string, value: string): void {
  if (!key.startsWith(NAMESPACE)) {
    throw new Error(`saveImport refused to write outside its namespace: ${key}`);
  }
  store.setItem(key, value);
}

function removeNs(store: KeyValueStore, key: string): void {
  if (!key.startsWith(NAMESPACE)) {
    throw new Error(`saveImport refused to remove outside its namespace: ${key}`);
  }
  store.removeItem(key);
}

export interface ImportResult {
  namespace: string;
  version: string;
  /** production keys cloned this run, sorted */
  imported: string[];
}

interface Manifest {
  version: string;
  keys: string[];
}

/**
 * Clone every recognised production key into the V2 namespace. Idempotent: the
 * namespace is rebuilt to mirror production exactly (stale clones are dropped),
 * so repeated runs converge to the same state. Values are copied verbatim, so
 * malformed data round-trips untouched and missing keys are simply skipped.
 * Reads production; writes only the namespace.
 */
export function importSaves(store: KeyValueStore): ImportResult {
  const present = allKeys(store);

  // rebuild the namespace from scratch (mirror semantics → idempotent, no stale)
  for (const k of present) {
    if (k.startsWith(NAMESPACE)) removeNs(store, k);
  }

  const imported: string[] = [];
  for (const k of present) {
    if (!isProductionSaveKey(k)) continue;
    const value = store.getItem(k);
    if (value === null) continue; // tolerate a key that vanished mid-scan
    writeNs(store, namespacedKey(k), value); // verbatim copy — malformed is fine
    imported.push(k);
  }
  imported.sort();

  const manifest: Manifest = { version: IMPORT_VERSION, keys: imported };
  writeNs(store, MANIFEST_KEY, JSON.stringify(manifest));

  return { namespace: NAMESPACE, version: IMPORT_VERSION, imported };
}

/**
 * Remove the entire V2 namespace (all clones + manifest), leaving production
 * untouched. Returns the namespaced keys removed. Safe to call when nothing was
 * imported.
 */
export function rollbackImport(store: KeyValueStore): string[] {
  const removed: string[] = [];
  for (const k of allKeys(store)) {
    if (k.startsWith(NAMESPACE)) {
      removeNs(store, k);
      removed.push(k);
    }
  }
  removed.sort();
  return removed;
}

/** Read a cloned value from the namespace by its ORIGINAL production key. */
export function readImported(store: KeyValueStore, productionKey: string): string | null {
  return store.getItem(namespacedKey(productionKey));
}

/** The production keys currently mirrored in the namespace (from the manifest). */
export function listImported(store: KeyValueStore): string[] {
  const raw = store.getItem(MANIFEST_KEY);
  if (raw === null) return [];
  try {
    const m = JSON.parse(raw) as Manifest;
    return Array.isArray(m.keys) ? [...m.keys].sort() : [];
  } catch {
    return [];
  }
}

// --- typed, tolerant readers over the imported (namespaced) values ---

export interface ImportedLegacy {
  embers: number;
  owned: string[];
}

/** Imported ov11_legacy → {embers, owned}, tolerating missing/malformed data. */
export function readImportedLegacy(store: KeyValueStore): ImportedLegacy {
  const fallback: ImportedLegacy = { embers: 0, owned: [] };
  const raw = readImported(store, 'ov11_legacy');
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<ImportedLegacy>;
    return {
      embers: typeof v.embers === 'number' && Number.isFinite(v.embers) ? v.embers : 0,
      owned: Array.isArray(v.owned) ? v.owned.filter((x): x is string => typeof x === 'string') : [],
    };
  } catch {
    return fallback;
  }
}

export interface ImportedProgress {
  proDone: boolean[];
  campProgress: number;
}

/** Imported ov8_pro / ov8_camp → progress, tolerating missing/malformed data. */
export function readImportedProgress(store: KeyValueStore): ImportedProgress {
  let proDone: boolean[] = [];
  const proRaw = readImported(store, 'ov8_pro');
  if (proRaw !== null) {
    try {
      const v = JSON.parse(proRaw);
      if (Array.isArray(v)) proDone = v.map((x) => !!x);
    } catch {
      proDone = [];
    }
  }
  let campProgress = 0;
  const campRaw = readImported(store, 'ov8_camp');
  if (campRaw !== null) {
    const n = parseInt(campRaw, 10);
    if (Number.isFinite(n)) campProgress = n;
  }
  return { proDone, campProgress };
}

/**
 * The browser localStorage as a KeyValueStore, or null when unavailable (SSR,
 * private mode, blocked storage). Callers pass the result into the functions
 * above; nothing here touches localStorage implicitly.
 */
export function browserStore(): KeyValueStore | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage as unknown as KeyValueStore;
  } catch {
    return null;
  }
}
