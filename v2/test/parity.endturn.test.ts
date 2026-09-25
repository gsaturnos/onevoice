// Stage C1 parity gate: the full endTurn port must reproduce production
// field-for-field across multi-turn play on the guided ("pro") levels, where
// production skips the campaign-only opportunity/dilemma systems (Stage C2/C3).
//
// This exercises overnight diffusion + floor/memory, free-zone growth, defector
// auras, sheltering, mural ticks, post-trail decay, informant movement, incumbent
// wavering, collective-pressure structural wins, scripted crackdowns (levels 2/4,
// including the witnessed-camera path), and win/loss/timeout resolution.
//
// Every stochastic draw (diffusion pulse timing, win-pressure jitter) comes from
// one shared seeded stream: the oracle's injected __rng and V2's rngState start
// from the same seed and advance in lockstep, turn after turn.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain-JS oracle harness, intentionally untyped
import { makeOracle } from './oracle/production.mjs';
import { createGame } from '../src/core/state';
import { applyAction, tick } from '../src/core/simulation';
import { makeRng } from '../src/core/rng';
import type { GameState } from '../src/core/types';

const EPS = 1e-9;
const SEED = 0x51a7c0de;

function approx(a: number, b: number, path: string): void {
  expect(Math.abs(a - b), `${path}: ${a} vs ${b}`).toBeLessThanOrEqual(EPS);
}

function compareFull(v: GameState, o: any, label: string): void {
  expect(v.turn, `${label}.turn`).toBe(o.turn);
  expect(v.energy, `${label}.energy`).toBe(o.energy);
  expect(v.inf, `${label}.inf`).toBe(o.inf);
  expect(v.over, `${label}.over`).toBe(o.over);
  expect(v.wins, `${label}.wins`).toBe(o.wins);
  expect(v.defected, `${label}.defected`).toBe(o.defected);
  expect(v.docActive, `${label}.docActive`).toBe(o.docActive);
  expect(v.postTrail, `${label}.postTrail`).toBe(o.postTrail);
  expect(v.crackIn, `${label}.crackIn`).toBe(o.crackIn);
  expect(v.reinfPending, `${label}.reinfPending`).toBe(o.reinfPending);
  expect(v.shelterTurns, `${label}.shelterTurns`).toBe(o.shelterTurns);
  expect(v.shelterIdx, `${label}.shelterIdx`).toBe(o.shelterIdx);
  expect(v.boostTurns, `${label}.boostTurns`).toBe(o.boostTurns);
  expect(v.witnessedOnce, `${label}.witnessedOnce`).toBe(o.witnessedOnce);
  expect(v.interrogated, `${label}.interrogated`).toBe(o.interrogated);
  expect(v.lastCrackTurn, `${label}.lastCrackTurn`).toBe(o.lastCrackTurn);
  expect(v.lastWinTurn, `${label}.lastWinTurn`).toBe(o.lastWinTurn);
  expect(v.lives, `${label}.lives`).toBe(o.lives);
  expect(v.player, `${label}.player`).toBe(o.player);
  expect(v.pulseCount, `${label}.pulseCount`).toBe(o.pulses);
  expect([...v.reinfThresholds], `${label}.reinfThresholds`).toEqual([...o.reinfThresholds]);
  approx(v.risk, o.risk, `${label}.risk`);
  approx(v.floor, o.floor, `${label}.floor`);
  approx(v.rig, o.rig, `${label}.rig`);
  if (v.crackZone && o.crackZone) {
    approx(v.crackZone.x, o.crackZone.x, `${label}.crackZone.x`);
    approx(v.crackZone.y, o.crackZone.y, `${label}.crackZone.y`);
  } else {
    expect(!!v.crackZone, `${label}.crackZone present`).toBe(!!o.crackZone);
  }
  expect(v.murals.length, `${label}.murals.length`).toBe(o.murals.length);
  expect(v.spies.length, `${label}.spies.length`).toBe(o.spies.length);
  for (let i = 0; i < o.spies.length; i++) {
    approx(v.spies[i].x, o.spies[i].x, `${label}.spies[${i}].x`);
    approx(v.spies[i].y, o.spies[i].y, `${label}.spies[${i}].y`);
  }
  for (let i = 0; i < o.ag.length; i++) {
    const a = v.agents[i];
    const b = o.ag[i];
    approx(a.aw, b.aw, `${label}.ag[${i}].aw`);
    approx(a.press, b.press, `${label}.ag[${i}].press`);
    approx(a.x, b.x, `${label}.ag[${i}].x`);
    approx(a.y, b.y, `${label}.ag[${i}].y`);
    expect(a.inc, `${label}.ag[${i}].inc`).toBe(b.inc);
    expect(a.gone, `${label}.ag[${i}].gone`).toBe(b.gone);
    expect(a.def, `${label}.ag[${i}].def`).toBe(b.def);
    expect(a.waver, `${label}.ag[${i}].waver`).toBe(b.waver);
    expect(a.doubt, `${label}.ag[${i}].doubt`).toBe(b.doubt);
  }
}

/** Player neighbours that can currently be talked to. */
function talkable(s: GameState): number[] {
  return s.neighbors[s.player].filter((j) => !s.agents[j].inc && !s.agents[j].gone && !s.agents[j].betrayed);
}

describe('Stage C1 — endTurn parity vs production (guided levels)', () => {
  for (let idx = 0; idx < 6; idx++) {
    it(`level ${idx}: multi-turn play (talk + Next turn) tracks the oracle`, () => {
      const oStream = makeRng(SEED);
      const o = makeOracle();
      o.newGame(idx, { owned: [], rng: () => oStream.next() });

      let v = createGame(idx);
      v = { ...v, rngState: SEED };

      const allowed = new Set(v.level.allowed ?? ['talk']);
      let step = 0;
      // play until the mission resolves or a turn cap, whichever comes first
      for (let guard = 0; guard < 40 && !v.over; guard++) {
        // arm the camera where the scripted crackdown looms and it's allowed
        if (allowed.has('doc') && !v.docActive && v.energy >= 2 && v.level.scriptedCrack) {
          v = applyAction(v, { kind: 'doc' });
          const os = o.act('doc');
          compareFull(v, os, `L${idx}.s${step++}(doc)`);
        }
        // spend remaining energy talking to reachable neighbours
        for (const t of talkable(v)) {
          if (v.energy < 1) break;
          v = applyAction(v, { kind: 'talk', target: t });
          o.setTarget(t);
          const os = o.act('talk');
          compareFull(v, os, `L${idx}.s${step++}(talk ${t})`);
        }
        v = tick(v);
        const os = o.endTurn();
        compareFull(v, os, `L${idx}.s${step++}(endTurn t=${v.turn})`);
      }
      // the run should have advanced past turn 1 (sanity: the loop did work)
      expect(v.turn, `level ${idx} advanced`).toBeGreaterThan(1);
    });
  }
});
