// Architecture validation gate: the simulation core must run in Node with NO
// DOM and NO PixiJS, be deterministic from a seed, and behave sensibly. If this
// passes under vitest (node env), the core/render separation is real.

import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/state';
import { applyAction, tick } from '../src/core/simulation';
import { averageAwareness, talkableTargets } from '../src/core/selectors';
import { KITCHEN_TABLE } from '../src/content/levels';

describe('core simulation (headless, no DOM/Pixi)', () => {
  it('is deterministic: same seed → identical initial state', () => {
    const a = createGame(KITCHEN_TABLE, 123);
    const b = createGame(KITCHEN_TABLE, 123);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds diverge', () => {
    const a = createGame(KITCHEN_TABLE, 1);
    const b = createGame(KITCHEN_TABLE, 2);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('talk raises a reachable neighbour and spends energy, immutably', () => {
    const s0 = createGame(KITCHEN_TABLE, 7);
    const target = talkableTargets(s0)[0];
    const before = s0.agents[target].aw;
    const s1 = applyAction(s0, { kind: 'talk', target });
    expect(s1.agents[target].aw).toBeGreaterThan(before);
    expect(s1.energy).toBe(s0.energy - 1);
    expect(s0.agents[target].aw).toBe(before); // input state untouched
  });

  it('talk cannot reach a non-neighbour', () => {
    const s0 = createGame(KITCHEN_TABLE, 7);
    const reachable = new Set(talkableTargets(s0));
    const far = s0.agents.findIndex((_, i) => i !== s0.player && !reachable.has(i));
    if (far >= 0) {
      const s1 = applyAction(s0, { kind: 'talk', target: far });
      expect(s1.energy).toBe(s0.energy); // rejected, no cost
    }
  });

  it('a turn diffuses awareness upward on average and is reproducible', () => {
    const s0 = createGame(KITCHEN_TABLE, 42);
    const avg0 = averageAwareness(s0);
    const s1 = tick(s0);
    const s1b = tick(createGame(KITCHEN_TABLE, 42));
    expect(averageAwareness(s1)).toBeGreaterThanOrEqual(avg0);
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s1b));
    expect(s1.turn).toBe(s0.turn + 1);
  });

  it('reaches a terminal state within the turn limit', () => {
    let s = createGame(KITCHEN_TABLE, 5);
    for (let i = 0; i < KITCHEN_TABLE.maxT + 2 && !s.over; i++) {
      const ts = talkableTargets(s);
      for (const t of ts) if (s.energy > 0) s = applyAction(s, { kind: 'talk', target: t });
      s = tick(s);
    }
    expect(s.over).toBe(true);
  });
});
