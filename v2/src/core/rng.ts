// Deterministic PRNG — the same mulberry32 the production game uses, so a
// seeded V2 run can be compared field-for-field against production output.
// Pure: no globals, no Math.random. Callers thread an Rng instance explicitly.

export interface Rng {
  /** next float in [0, 1) */
  next(): number;
  /** float in [a, b) */
  range(a: number, b: number): number;
  /** current internal state (for snapshotting/parity) */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    state: () => s >>> 0,
  };
}
