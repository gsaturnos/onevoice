// Stage B+ parity gate: the two-step UI actions (link / letter / mural) and the
// spy/defector actions (expose / reach) must reproduce production field-for-field.
//
// link/letter/mural complete in the production canvas click handler, not in
// act(); the oracle exercises the REAL handler via clickAt(mode,x,y). V2 models
// them as parameterized actions carrying the resolved target/coordinate the UI
// picked. Because a click placed exactly on a candidate's coords always resolves
// to that candidate (distance 0 < the 26px snap radius), target selection is
// unambiguous and the two sides are directly comparable.
//
// reach draws its success roll then chains defections from the seeded stream, so
// it exercises the RNG seam; with no wavering incumbent yet (those appear only in
// endTurn, Stage C) it takes the guarded no-op path here — parity still holds.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain-JS oracle harness, intentionally untyped
import { makeOracle } from './oracle/production.mjs';
import { createGame } from '../src/core/state';
import { applyAction } from '../src/core/simulation';
import { makeRng } from '../src/core/rng';
import type { GameState } from '../src/core/types';

const EPS = 1e-9;
const SEED = 0x1234abcd;

function approx(a: number, b: number, path: string): void {
  expect(Math.abs(a - b), `${path}: ${a} vs ${b}`).toBeLessThanOrEqual(EPS);
}

function compareState(v: GameState, o: any, label: string): void {
  expect(v.energy, `${label}.energy`).toBe(o.energy);
  expect(v.inf, `${label}.inf`).toBe(o.inf);
  expect(v.turn, `${label}.turn`).toBe(o.turn);
  expect(v.over, `${label}.over`).toBe(o.over);
  expect(v.defected, `${label}.defected`).toBe(o.defected);
  expect(v.wins, `${label}.wins`).toBe(o.wins);
  approx(v.risk, o.risk, `${label}.risk`);
  approx(v.floor, o.floor, `${label}.floor`);
  // links / built / weak / murals — the structures Stage B+ touches
  expect(v.links.length, `${label}.links.length`).toBe(o.links.length);
  for (let i = 0; i < o.links.length; i++) {
    expect([...v.links[i]], `${label}.links[${i}]`).toEqual([...o.links[i]]);
  }
  expect(v.built.map((b) => [...b]), `${label}.built`).toEqual(o.built.map((b: number[]) => [...b]));
  expect([...v.weak].sort(), `${label}.weak`).toEqual([...o.weak].sort());
  expect(v.murals.map((m) => ({ x: m.x, y: m.y })), `${label}.murals`).toEqual(
    o.murals.map((m: any) => ({ x: m.x, y: m.y })),
  );
  expect(v.spies.length, `${label}.spies.length`).toBe(o.spies.length);
  for (let i = 0; i < o.ag.length; i++) {
    const a = v.agents[i];
    const b = o.ag[i];
    approx(a.aw, b.aw, `${label}.ag[${i}].aw`);
    expect(a.def, `${label}.ag[${i}].def`).toBe(b.def);
    expect(a.waver, `${label}.ag[${i}].waver`).toBe(b.waver);
    expect(a.doubt, `${label}.ag[${i}].doubt`).toBe(b.doubt);
    expect(a.met, `${label}.ag[${i}].met`).toBe(b.met);
  }
}

/** First non-neighbour civilian of the player, optionally within link reach. */
function firstNonNeighbour(s: GameState, withinReach: boolean): number {
  const p = s.player;
  const reach = s.level.linkMax * (1 + 0.6 * (s.inf / 100));
  const nb = new Set(s.neighbors[p]);
  return s.agents.findIndex((a, j) => {
    if (j === p || a.inc || a.gone || nb.has(j)) return false;
    if (!withinReach) return true;
    return Math.hypot(a.x - s.agents[p].x, a.y - s.agents[p].y) <= reach;
  });
}

describe('Stage B+ — link/letter/mural/expose/reach parity vs production', () => {
  for (const idx of [0, 3, 9]) {
    it(`level ${idx}: letter and mural match the oracle`, () => {
      const o = makeOracle();
      o.newGame(idx, { owned: [] });
      o.setEnergy(60);

      let v = createGame(idx);
      v = { ...v, energy: 60 };

      // letter: a non-neighbour at any distance (letter has no reach limit).
      const letterT = firstNonNeighbour(v, false);
      expect(letterT, `level ${idx} has a letter target`).toBeGreaterThanOrEqual(0);
      v = applyAction(v, { kind: 'letter', target: letterT });
      let os = o.clickAt('letter', o.snapshot().ag[letterT].x, o.snapshot().ag[letterT].y);
      compareState(v, os, `L${idx} letter`);

      // mural: a point within reach of the player (no agent snap).
      const mx = v.agents[v.player].x + 8;
      const my = v.agents[v.player].y + 8;
      v = applyAction(v, { kind: 'mural', x: mx, y: my });
      os = o.clickAt('mural', mx, my);
      compareState(v, os, `L${idx} mural`);
    });
  }

  it('link matches the oracle wherever a reachable non-neighbour exists', () => {
    let linkTested = 0;
    for (let idx = 0; idx < 13; idx++) {
      let v = createGame(idx);
      // trust extends link reach (linkMax*(1+0.6*inf/100)); raise it so a
      // reachable non-neighbour exists on more layouts.
      v = { ...v, energy: 60, inf: 60 };
      const linkT = firstNonNeighbour(v, true);
      if (linkT < 0) continue;

      const o = makeOracle();
      o.newGame(idx, { owned: [] });
      o.setEnergy(60);
      o.setInf(60);

      v = applyAction(v, { kind: 'link', target: linkT });
      const os = o.clickAt('link', o.snapshot().ag[linkT].x, o.snapshot().ag[linkT].y);
      compareState(v, os, `L${idx} link`);
      linkTested++;
    }
    expect(linkTested, 'link exercised on at least one level').toBeGreaterThan(0);
  });

  it('reach no-ops identically when no incumbent is wavering (seam guard)', () => {
    for (const idx of [0, 3, 9]) {
      const oStream = makeRng(SEED);
      const o = makeOracle();
      o.newGame(idx, { owned: [], rng: () => oStream.next() });
      o.setEnergy(60);

      let v = createGame(idx);
      v = { ...v, energy: 60, rngState: SEED };

      v = applyAction(v, { kind: 'reach' });
      const os = o.act('reach');
      compareState(v, os, `L${idx} reach`);
      // guard path: no wavering incumbent yet, so nothing is spent.
      expect(v.energy, `L${idx} reach spent nothing`).toBe(60);
    }
  });

  it('expose matches the oracle across spy levels (both branches)', () => {
    let removalSeen = false;
    // levels chosen to include spy-bearing missions
    for (let idx = 0; idx < 13; idx++) {
      let v = createGame(idx);
      if (!v.spies.length) continue;

      const o = makeOracle();
      o.newGame(idx, { owned: [] });
      o.setEnergy(60);
      o.setInf(30);

      v = { ...v, energy: 60, inf: 30 };

      const before = v.spies.length;
      v = applyAction(v, { kind: 'expose' });
      const os = o.act('expose');
      compareState(v, os, `L${idx} expose`);
      if (v.spies.length < before) removalSeen = true;
    }
    // at least one spy level should have had an informant in reach → removal path
    expect(removalSeen, 'expose removal branch exercised on some level').toBe(true);
  });
});
