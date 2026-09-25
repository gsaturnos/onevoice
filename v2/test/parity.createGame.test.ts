// Stage A parity gate: V2 createGame must reproduce production initGame
// field-for-field, for every campaign level, against the golden oracle that
// runs real staging code. Exact equality for integer / boolean / enum /
// action-order / structure; a documented 1e-9 epsilon only for genuine floats
// (positions and awareness derived from mulberry32). See ARCHITECTURE §7.3.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain-JS oracle harness, intentionally untyped
import { makeOracle } from './oracle/production.mjs';
import { createGame } from '../src/core/state';
import { LEVELS } from '../src/content/levels';

const EPS = 1e-9;

const oracle = makeOracle();

function approx(a: number, b: number, path: string): void {
  expect(Math.abs(a - b), `${path}: ${a} vs ${b}`).toBeLessThanOrEqual(EPS);
}

function compareAgent(v: any, o: any, path: string): void {
  approx(v.x, o.x, `${path}.x`);
  approx(v.y, o.y, `${path}.y`);
  approx(v.aw, o.aw, `${path}.aw`);
  expect(v.inc, `${path}.inc`).toBe(o.inc);
  expect(v.gone, `${path}.gone`).toBe(o.gone);
  expect(v.waver, `${path}.waver`).toBe(o.waver);
  expect(v.def, `${path}.def`).toBe(o.def);
  expect(v.doubt, `${path}.doubt`).toBe(o.doubt);
  expect(v.nm, `${path}.nm`).toBe(o.nm);
  expect(v.role, `${path}.role`).toBe(o.role);
  expect(v.stake, `${path}.stake`).toBe(o.stake);
  expect(v.trait.id, `${path}.trait.id`).toBe(o.trait.id);
  expect(v.met, `${path}.met`).toBe(o.met);
}

describe('Stage A — createGame parity vs production initGame (all levels)', () => {
  LEVELS.forEach((lvl, idx) => {
    it(`level ${idx} (${lvl.name}) matches the oracle`, () => {
      const o = oracle.newGame(idx, { owned: [] });
      const v = createGame(idx);

      // structure
      expect(v.agents.length, 'agent count').toBe(o.ag.length);
      expect(v.links.length, 'link count').toBe(o.links.length);
      expect(v.player, 'player index').toBe(o.player);
      expect(v.turn, 'turn').toBe(o.turn);
      expect(v.energy, 'energy').toBe(o.energy);
      expect(v.inf, 'inf').toBe(o.inf);
      expect(v.wins, 'wins').toBe(o.wins);
      expect(v.defected, 'defected').toBe(o.defected);
      expect(v.over, 'over').toBe(o.over);
      approx(v.rig, o.rig, 'rig');
      approx(v.floor, o.floor, 'floor');

      // agents
      for (let i = 0; i < o.ag.length; i++) compareAgent(v.agents[i], o.ag[i], `ag[${i}]`);

      // links — same order, same endpoints and weight (exact)
      for (let i = 0; i < o.links.length; i++) {
        expect(v.links[i], `link[${i}]`).toEqual(o.links[i]);
      }

      // adjacency — same order per node (exact)
      expect(v.neighbors.length, 'nbr length').toBe(o.nbr.length);
      for (let i = 0; i < o.nbr.length; i++) {
        expect(v.neighbors[i], `nbr[${i}]`).toEqual(o.nbr[i]);
      }

      // spies placement (float)
      expect(v.spies.length, 'spies count').toBe(o.spies.length);
      for (let i = 0; i < o.spies.length; i++) {
        approx(v.spies[i].x, o.spies[i].x, `spies[${i}].x`);
        approx(v.spies[i].y, o.spies[i].y, `spies[${i}].y`);
      }

      // reinforcement thresholds
      expect(v.reinfThresholds, 'reinfThresholds').toEqual(o.reinfThresholds);
    });
  });

  it('is deterministic: two builds of the same level are identical', () => {
    expect(JSON.stringify(createGame(6))).toBe(JSON.stringify(createGame(6)));
  });
});
