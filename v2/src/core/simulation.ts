// Pure reducers. applyAction ports the production act() field-for-field for the
// self-contained player actions (talk, org, low, post, doc, speak); tick still
// carries the Phase-1 demo diffusion until the full endTurn port (Stage C).
//
// Parity: these mirror staging's act() exactly (same constants, same order, same
// clamps). Stochastic actions (post) draw from a seeded stream carried in
// state.rngState — the same mulberry32 the golden oracle's RNG seam uses — so
// oracle and V2 draw an identical sequence. No DOM, no Math.random, no rendering.
// reach/expose/link/letter/mural need turn-loop or click-handler state and land
// with Stage C. See docs/v2/ARCHITECTURE.md §7.3.

import { makeRng } from './rng';
import type { Action, Agent, GameState } from './types';
import { objectiveMet } from './selectors';

function infBonus(s: GameState): number {
  return s.inf / 100;
}

/** Is agent i inside any active (non-defected) incumbent's surveillance range? */
function inSurv(s: GameState, i: number): boolean {
  const a = s.agents[i];
  return s.agents.some((k) => k.inc && !k.def && Math.hypot(a.x - k.x, a.y - k.y) < s.level.surv);
}

/** The set of people an Organize meeting reaches (port of orgRingSet). */
function orgRingSet(s: GameState): Set<number> {
  const ok = (j: number): boolean => !s.agents[j].inc && !s.agents[j].gone && !s.agents[j].betrayed;
  const ring = new Set<number>(s.neighbors[s.player].filter(ok));
  for (const j of [...ring]) for (const k of s.neighbors[j]) if (ok(k)) ring.add(k);
  if (s.inf >= 40) {
    for (const j of [...ring]) for (const k of s.neighbors[j]) if (ok(k)) ring.add(k);
  }
  return ring;
}

/** Return a new state with one action applied. Never mutates the input. */
export function applyAction(prev: GameState, action: Action): GameState {
  const s = clone(prev);
  if (s.over || s.interrogated) return s;
  if (action.kind === 'endTurn') return tick(s);

  const p = s.player;
  const sp = inSurv(s, p) ? 0.08 : 0;

  switch (action.kind) {
    case 'talk': {
      const t = action.target;
      const cost = 1;
      if (s.energy < cost) return s;
      if (t < 0 || t >= s.agents.length) return s;
      const q = s.agents[t];
      if (q.betrayed) return s;
      if (!s.neighbors[p].includes(t)) return s; // words travel links only
      s.energy -= cost;
      s.risk = Math.min(1, s.risk + (0.03 + sp) * 1);
      let mul = q.trait.talkMul * 1;
      if (q.trait.id === 'wary' && s.inf >= 30) mul = 1.2;
      q.aw = Math.min(1, q.aw + (0.26 + 0.08 * infBonus(s)) * mul);
      s.inf = Math.min(100, s.inf + 2);
      return s;
    }
    case 'org': {
      if (s.energy < 2) return s;
      s.energy -= 2;
      s.risk = Math.min(1, s.risk + (0.13 + sp) * 1);
      const ring = orgRingSet(s);
      const mul2 = 1;
      ring.forEach((j) => {
        const a = s.agents[j];
        a.aw = Math.min(1, a.aw + (0.12 + 0.04 * infBonus(s)) * a.trait.orgMul * mul2);
      });
      s.inf = Math.min(100, s.inf + 4);
      return s;
    }
    case 'low': {
      if (s.energy < 1) return s;
      s.energy -= 1;
      s.risk = Math.max(0, s.risk - 0.18);
      for (const j of s.neighbors[p]) {
        const a = s.agents[j];
        if (!a.inc && !a.gone) a.aw = Math.max(s.floor, a.aw - 0.05);
      }
      return s;
    }
    case 'post': {
      if (s.energy < 1) return s;
      s.energy -= 1;
      s.postTrail = 3; // no 'paper' opportunity yet
      const reachN = 14; // (has('press')?20:14) + heirMul.postAdd, clean
      const rng = makeRng(s.rngState);
      const NN = s.agents.length;
      for (let t2 = 0; t2 < reachN; t2++) {
        const j = Math.floor(rng.next() * NN);
        const a = s.agents[j];
        if (!a.inc && !a.gone) a.aw = Math.min(1, a.aw + 0.07 * a.trait.postMul);
      }
      s.rngState = rng.state();
      s.inf = Math.min(100, s.inf + 2);
      return s;
    }
    case 'doc': {
      if (s.energy < 2) return s;
      if (s.docActive) return s;
      s.energy -= 2;
      s.docActive = true;
      s.risk = Math.min(1, s.risk + 0.05);
      return s;
    }
    case 'speak': {
      if (s.energy < 3) return s;
      s.energy -= 3;
      s.risk = Math.min(1, s.risk + 0.32 + sp * 2);
      const rad = 180 * (1 + 0.45 * infBonus(s));
      const px = s.agents[p].x;
      const py = s.agents[p].y;
      s.agents.forEach((a) => {
        if (a.inc || a.gone) return;
        const d = Math.hypot(a.x - px, a.y - py);
        if (d < rad) a.aw = Math.min(1, a.aw + 0.18 * (1 - d / rad) + 0.07);
      });
      s.inf = Math.min(100, s.inf + 8);
      return s;
    }
  }
}

/**
 * Resolve a turn — PHASE-1 DEMO diffusion only. The faithful endTurn port
 * (diffusion + floor/memory, free zones, defection auras, shelter,
 * reinforcements, crackdowns, opportunities, dilemmas, win/loss) is Stage C.
 */
export function tick(prev: GameState): GameState {
  const s = clone(prev);
  if (s.over) return s;

  const spread = 0.12 * (1 - s.rig);
  const before = s.agents.map((a) => a.aw);
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    if (a.inc || a.gone) continue;
    let pull = 0;
    for (const j of s.neighbors[i]) {
      if (s.agents[j].gone) continue;
      pull += Math.max(0, before[j] - before[i]);
    }
    a.aw = Math.min(1, a.aw + spread * pull * 0.25);
  }

  s.turn += 1;
  s.energy = 3;

  if (objectiveMet(s)) {
    s.over = true;
    s.won = true;
  } else if (s.turn > s.level.maxT) {
    s.over = true;
    s.won = false;
  }
  return s;
}

function clone(s: GameState): GameState {
  return {
    ...s,
    agents: s.agents.map((a): Agent => ({ ...a, events: [...a.events] })),
    links: s.links.map((l) => [...l] as [number, number, number]),
    built: s.built.map((b) => [...b] as [number, number]),
    neighbors: s.neighbors.map((n) => [...n]),
    spies: s.spies.map((sp) => ({ ...sp })),
    reinfThresholds: [...s.reinfThresholds],
  };
}
