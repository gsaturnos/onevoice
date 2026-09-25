// Read-only derived views over GameState. Render and UI use these instead of
// recomputing from raw state, and never mutate.

import type { GameState, Snapshot } from './types';

export function awareCount(s: Snapshot): number {
  return s.agents.filter((a, i) => i !== s.player && !a.inc && !a.gone && a.aw >= s.level.objective.level).length;
}

export function averageAwareness(s: Snapshot): number {
  const civ = s.agents.filter((a) => !a.inc && !a.gone);
  return civ.length ? civ.reduce((t, a) => t + a.aw, 0) / civ.length : 0;
}

export function objectiveMet(s: GameState): boolean {
  const o = s.level.objective;
  return o.type === 'aware' && awareCount(s) >= o.count;
}

export function objectiveProgress(s: Snapshot): { have: number; need: number; text: string } {
  return { have: awareCount(s), need: s.level.objective.count, text: s.level.objective.text };
}

/** neighbors of the player who can currently be talked to */
export function talkableTargets(s: Snapshot): number[] {
  return s.neighbors[s.player].filter((j) => !s.agents[j].inc && !s.agents[j].gone);
}
