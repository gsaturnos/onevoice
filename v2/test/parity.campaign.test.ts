// Stage C2/C3 parity gate: the campaign systems — opportunities (gathering /
// market / visitor / paper) and dilemmas (name / shelter / journalist / money /
// traitor) — must reproduce production field-for-field across long multi-turn
// runs, on top of the endTurn mechanics proven in Stage C1.
//
// The per-turn policy deliberately exercises each opportunity effect (post for a
// sympathetic printer, organize on market day, talk the elder's host, free talks
// at a gathering) and arms the camera when a crackdown looms. When a dilemma
// fires it blocks play on both sides; the test resolves it with the same choice
// (alternating a/b so both branches, including the traitor's seeded coin-flip,
// are covered) and continues. One shared seeded stream drives both sides.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain-JS oracle harness, intentionally untyped
import { makeOracle } from './oracle/production.mjs';
import { createGame } from '../src/core/state';
import { applyAction, tick, resolveDilemma } from '../src/core/simulation';
import { makeRng } from '../src/core/rng';
import type { Action, GameState } from '../src/core/types';

const EPS = 1e-9;

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
  expect(v.freeLink, `${label}.freeLink`).toBe(o.freeLink ?? v.freeLink);
  expect(v.witnessedOnce, `${label}.witnessedOnce`).toBe(o.witnessedOnce);
  expect(v.interrogated, `${label}.interrogated`).toBe(o.interrogated);
  expect(v.lives, `${label}.lives`).toBe(o.lives);
  expect(v.player, `${label}.player`).toBe(o.player);
  expect(v.pulseCount, `${label}.pulseCount`).toBe(o.pulses);
  expect(v.oppExpired, `${label}.oppExpired`).toBe(o.oppExpired);
  expect(v.opp?.id ?? null, `${label}.opp.id`).toBe(o.opp?.id ?? null);
  expect(v.opp?.targetIdx ?? null, `${label}.opp.targetIdx`).toBe(o.opp?.targetIdx ?? null);
  expect(!!v.pendingDilemma, `${label}.pending`).toBe(o.pending);
  expect([...v.firedDilemmas].sort(), `${label}.firedDilemmas`).toEqual([...o.firedDilemmas].sort());
  expect(v.heirMul, `${label}.heirMul`).toEqual(o.heirMul);
  expect([...v.reinfThresholds], `${label}.reinfThresholds`).toEqual([...o.reinfThresholds]);
  approx(v.risk, o.risk, `${label}.risk`);
  approx(v.floor, o.floor, `${label}.floor`);
  approx(v.rig, o.rig, `${label}.rig`);
  expect(v.murals.length, `${label}.murals.length`).toBe(o.murals.length);
  expect(v.links.length, `${label}.links.length`).toBe(o.links.length);
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
    expect(a.betrayed, `${label}.ag[${i}].betrayed`).toBe(b.betrayed);
    expect(a.sheltered, `${label}.ag[${i}].sheltered`).toBe(b.sheltered);
    expect(a.met, `${label}.ag[${i}].met`).toBe(b.met);
  }
}

function talkable(s: GameState): number[] {
  return s.neighbors[s.player].filter((j) => !s.agents[j].inc && !s.agents[j].gone && !s.agents[j].betrayed);
}

describe('Stage C2/C3 — campaign parity (opportunities + dilemmas)', () => {
  // a couple of seeds per level, to shake out different opp/dilemma orderings
  for (const idx of [6, 7, 8, 9, 10]) {
    for (const seed of [0x0badf00d, 0x1234abcd]) {
      it(`level ${idx} seed ${seed.toString(16)}: campaign run tracks the oracle`, () => {
        const oStream = makeRng(seed);
        const o = makeOracle();
        o.newGame(idx, { owned: [], rng: () => oStream.next() });

        let v = createGame(idx);
        v = { ...v, rngState: seed };

        let step = 0;
        let resolves = 0;
        for (let guard = 0; guard < 120 && !v.over; guard++) {
          if (v.pendingDilemma) {
            const which: 'a' | 'b' = resolves % 2 === 0 ? 'a' : 'b';
            resolves++;
            v = resolveDilemma(v, which);
            const os = o.resolveDilemma(which);
            compareFull(v, os, `L${idx}/${seed.toString(16)}.s${step++}(resolve ${which})`);
            continue;
          }

          const apply = (a: Action, tag: string): void => {
            v = applyAction(v, a);
            const os = a.kind === 'talk' ? (o.setTarget(a.target), o.act('talk')) : o.act(a.kind);
            compareFull(v, os, `L${idx}/${seed.toString(16)}.s${step++}(${tag})`);
          };

          // arm the camera when a crackdown is one turn away
          if (v.crackIn === 1 && !v.docActive && v.energy >= 2) apply({ kind: 'doc' }, 'doc');
          // exploit whatever opportunity is open
          if (v.opp?.id === 'paper' && v.energy >= 1) apply({ kind: 'post' }, 'post-paper');
          else if (v.opp?.id === 'market' && v.energy >= 2) apply({ kind: 'org' }, 'org-market');
          else if (
            v.opp?.id === 'visitor' &&
            v.opp.targetIdx != null &&
            talkable(v).includes(v.opp.targetIdx)
          )
            apply({ kind: 'talk', target: v.opp.targetIdx }, 'talk-visitor');
          // spend the rest on reachable neighbours
          for (const t of talkable(v)) {
            if (v.energy < 1) break;
            apply({ kind: 'talk', target: t }, `talk ${t}`);
          }

          v = tick(v);
          const os = o.endTurn();
          compareFull(v, os, `L${idx}/${seed.toString(16)}.s${step++}(endTurn t=${v.turn})`);
        }
        expect(v.turn, `level ${idx} advanced`).toBeGreaterThan(3);
      });
    }
  }

  // The traitor dilemma is the only choice whose resolution draws entropy (a
  // seeded coin-flip decides guilt), and it is rare under natural play. Force it
  // by marking every neighbour met, then resolve choice 'a' (the drawing branch)
  // and confirm the seeded outcome matches the oracle field-for-field.
  it('traitor dilemma coin-flip resolves identically to the oracle', () => {
    const seed = 0x9e3779b1;
    const oStream = makeRng(seed);
    const o = makeOracle();
    o.newGame(6, { owned: [], rng: () => oStream.next() });
    o.markAllMet();

    let v = createGame(6);
    v = { ...v, rngState: seed, agents: v.agents.map((a) => ({ ...a, met: true })) };

    let resolvedTraitor = false;
    for (let guard = 0; guard < 80 && !v.over && !resolvedTraitor; guard++) {
      if (v.pendingDilemma) {
        const which: 'a' | 'b' = v.pendingDilemma.id === 'traitor' ? 'a' : 'b';
        if (which === 'a') resolvedTraitor = true;
        v = resolveDilemma(v, which);
        const os = o.resolveDilemma(which);
        compareFull(v, os, `traitor.resolve(${which})`);
        continue;
      }
      v = tick(v);
      const os = o.endTurn();
      compareFull(v, os, `traitor.endTurn(t=${v.turn})`);
    }
    expect(resolvedTraitor, 'the traitor dilemma fired and was resolved').toBe(true);
  });
});
