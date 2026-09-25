// Read-only derived views over GameState. Render and UI use these instead of
// recomputing from raw state, and never mutate.

import type { GameState, Snapshot } from './types';

/** Civilians (not the player, not incumbents, not gone) at/above a threshold. */
export function awareCountAt(s: Snapshot, lvl: number): number {
  return s.agents.filter((a, i) => i !== s.player && !a.inc && !a.gone && a.aw >= lvl).length;
}

export function averageAwareness(s: Snapshot): number {
  const civ = s.agents.filter((a) => !a.inc && !a.gone);
  return civ.length ? civ.reduce((t, a) => t + a.aw, 0) / civ.length : 0;
}

/**
 * Guided-objective check. Full campaign win/loss (thresh/winP mechanics) and
 * mural/witness objectives arrive with the endTurn port (Stage C); this covers
 * the deterministic objective types the demo needs today.
 */
export function objectiveMet(s: GameState): boolean {
  const o = s.level.obj;
  if (!o) return false;
  switch (o.type) {
    case 'aware':
      return awareCountAt(s, o.lvl) >= o.count;
    case 'wins':
      return s.wins >= o.count;
    case 'muralaware':
      return awareCountAt(s, o.lvl) >= o.count; // TODO(Stage C): require >=1 mural
    case 'defect':
      return s.defected >= 1;
    case 'survive':
      return s.turn > o.turn && awareCountAt(s, o.lvl) >= o.count && !s.agents[s.player].gone;
    case 'witness':
      return false; // TODO(Stage C): witnessed crackdown
  }
}

export function objectiveProgress(s: Snapshot): { have: number; need: number; text: string } {
  const o = s.level.obj;
  if (!o) return { have: 0, need: 1, text: 'Spread awareness' };
  switch (o.type) {
    case 'aware':
    case 'muralaware':
    case 'survive':
      return { have: awareCountAt(s, o.lvl), need: o.count, text: o.text };
    case 'wins':
      return { have: s.wins, need: o.count, text: o.text };
    case 'defect':
      return { have: s.defected, need: 1, text: o.text };
    case 'witness':
      return { have: 0, need: 1, text: o.text };
  }
}

/** neighbors of the player who can currently be talked to */
export function talkableTargets(s: Snapshot): number[] {
  return s.neighbors[s.player].filter((j) => !s.agents[j].inc && !s.agents[j].gone);
}
