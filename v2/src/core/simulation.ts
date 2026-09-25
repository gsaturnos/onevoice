// Pure reducers. applyAction handles a player move; tick resolves a turn's
// awareness diffusion. Faithful minimal subset of production act()/endTurn():
// talk raises one neighbor's awareness; the turn spreads awareness along links,
// slowed by fear (rig). No DOM, no rendering, no randomness beyond the seeded
// rng carried in state — so runs are reproducible and parity-testable.

import { makeRng } from './rng';
import type { Action, GameState } from './types';
import { objectiveMet } from './selectors';

const TALK_COST = 1;
const TALK_GAIN = 0.26;

/** Return a new state with one action applied. Never mutates the input. */
export function applyAction(prev: GameState, action: Action): GameState {
  const s = clone(prev);
  if (s.over) return s;

  switch (action.kind) {
    case 'talk': {
      const t = action.target;
      if (s.energy < TALK_COST) return s;
      if (t < 0 || t >= s.agents.length) return s;
      if (!s.neighbors[s.player].includes(t)) return s; // words travel links only
      const p = s.agents[t];
      if (p.inc || p.gone) return s;
      s.energy -= TALK_COST;
      p.aw = Math.min(1, p.aw + TALK_GAIN * p.trait.talkMul);
      p.met = true;
      s.inf = Math.min(100, s.inf + 2);
      return s;
    }
    case 'endTurn':
      return tick(s);
  }
}

/** Resolve a turn: awareness diffuses along links, damped by fear. */
export function tick(prev: GameState): GameState {
  const s = clone(prev);
  if (s.over) return s;

  const spread = 0.12 * (1 - s.rig); // fear slows how fast awareness travels
  const before = s.agents.map((a) => a.aw);
  for (let i = 0; i < s.agents.length; i++) {
    const a = s.agents[i];
    if (a.inc || a.gone) continue;
    let pull = 0;
    for (const j of s.neighbors[i]) {
      const nb = s.agents[j];
      if (nb.gone) continue;
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

  // advance the carried rng deterministically so future stochastic steps
  // (Phase 2: crackdowns, opps) stay reproducible from the snapshot.
  s.rngState = makeRng(s.rngState).state();
  return s;
}

function clone(s: GameState): GameState {
  return {
    ...s,
    agents: s.agents.map((a) => ({ ...a })),
    links: s.links.map((l) => [...l] as [number, number, number]),
    neighbors: s.neighbors.map((n) => [...n]),
  };
}
