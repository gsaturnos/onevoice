// Stage B parity gate: V2 applyAction must reproduce production act()
// field-for-field for the ported self-contained actions, across scripted
// sequences, against the golden oracle (real staging code) with the RNG seam.
//
// Energy and the turn-RNG seed are set identically on both sides so multi-action
// scripts are a fair comparison; `post` exercises the seam (14 seeded draws).

import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain-JS oracle harness, intentionally untyped
import { makeOracle } from './oracle/production.mjs';
import { createGame } from '../src/core/state';
import { applyAction } from '../src/core/simulation';
import { makeRng } from '../src/core/rng';
import type { Action, GameState } from '../src/core/types';

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
  expect(v.docActive, `${label}.docActive`).toBe(o.docActive);
  expect(v.postTrail, `${label}.postTrail`).toBe(o.postTrail);
  approx(v.risk, o.risk, `${label}.risk`);
  approx(v.floor, o.floor, `${label}.floor`);
  for (let i = 0; i < o.ag.length; i++) {
    const a = v.agents[i];
    const b = o.ag[i];
    approx(a.aw, b.aw, `${label}.ag[${i}].aw`);
    approx(a.x, b.x, `${label}.ag[${i}].x`);
    approx(a.y, b.y, `${label}.ag[${i}].y`);
    expect(a.inc, `${label}.ag[${i}].inc`).toBe(b.inc);
    expect(a.gone, `${label}.ag[${i}].gone`).toBe(b.gone);
    expect(a.def, `${label}.ag[${i}].def`).toBe(b.def);
    expect(a.waver, `${label}.ag[${i}].waver`).toBe(b.waver);
    expect(a.betrayed, `${label}.ag[${i}].betrayed`).toBe(b.betrayed);
  }
}

/** Talk targets: the first two talkable neighbours of the player. */
function firstNeighbours(s: GameState, n: number): number[] {
  return s.neighbors[s.player].filter((j) => !s.agents[j].inc && !s.agents[j].gone).slice(0, n);
}

describe('Stage B — applyAction parity vs production act()', () => {
  // levels chosen to vary N, incumbents, and layout
  for (const idx of [0, 3, 9]) {
    it(`level ${idx}: scripted action sequence matches the oracle`, () => {
      // identical initial state (proven in Stage A) + identical turn-RNG + energy
      const oStream = makeRng(SEED);
      const o = makeOracle();
      o.newGame(idx, { owned: [], rng: () => oStream.next() });
      o.setEnergy(60);

      let v = createGame(idx);
      v = { ...v, energy: 60, rngState: SEED };

      const nb = firstNeighbours(v, 2);
      const script: Action[] = [
        { kind: 'talk', target: nb[0] },
        { kind: 'talk', target: nb[1] },
        { kind: 'org' },
        { kind: 'post' },
        { kind: 'low' },
        { kind: 'doc' },
        { kind: 'speak' },
        { kind: 'post' },
        { kind: 'org' },
      ];

      for (let step = 0; step < script.length; step++) {
        const a = script[step];
        v = applyAction(v, a);
        const os =
          a.kind === 'talk' ? (o.setTarget(a.target), o.act('talk')) : o.act(a.kind);
        compareState(v, os, `L${idx} step${step}(${a.kind})`);
      }
    });
  }

  it('rejects a talk to a non-neighbour with no state change (matches oracle)', () => {
    const o = makeOracle();
    o.newGame(0, { owned: [] });
    o.setEnergy(5);
    let v = createGame(0);
    v = { ...v, energy: 5 };
    const reachable = new Set(v.neighbors[v.player]);
    const far = v.agents.findIndex((_, i) => i !== v.player && !reachable.has(i) && !v.agents[i].inc);
    if (far >= 0) {
      const v1 = applyAction(v, { kind: 'talk', target: far });
      o.setTarget(far);
      const o1 = o.act('talk');
      compareState(v1, o1, 'far-talk');
      expect(v1.energy).toBe(5);
    }
  });
});
