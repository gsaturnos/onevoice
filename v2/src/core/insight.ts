// Read-only "what would happen / what just happened" helpers, derived purely
// from GameState via the authoritative reducer. The renderer, HUD, and the app
// orchestrator all read these so previews and turn summaries can never drift
// from the real mechanics: a preview is literally the reducer run on a copy and
// thrown away. No DOM, no Pixi, no mutation of the input.

import type { GameState, Snapshot } from './types';
import { applyAction } from './simulation';

/** The awareness level a civilian must reach to "see clearly", per objective. */
export function clearThreshold(s: Snapshot): number {
  const o = s.level.obj;
  if (o && (o.type === 'aware' || o.type === 'muralaware' || o.type === 'survive')) return o.lvl;
  return 0.5;
}

export interface TalkPreview {
  target: number;
  before: number;
  after: number;
  delta: number;
  willClear: boolean; // this single talk lifts the target across the threshold
  /** civil neighbours of the target who will carry the awareness onward at turn end */
  carriers: number[];
}

/**
 * Project a talk without committing: run the pure reducer on the current state
 * and diff. Because applyAction never mutates its input, this is side-effect free
 * and exactly matches what dispatching the same action will do.
 */
export function previewTalk(s: Snapshot, target: number): TalkPreview {
  const before = s.agents[target]?.aw ?? 0;
  const next = applyAction(s as GameState, { kind: 'talk', target });
  const after = next.agents[target]?.aw ?? before;
  const th = clearThreshold(s);
  const carriers = (s.neighbors[target] || []).filter(
    (j) => j !== s.player && !s.agents[j].inc && !s.agents[j].gone && s.agents[j].aw < after,
  );
  return {
    target,
    before,
    after,
    delta: after - before,
    willClear: before < th && after >= th,
    carriers,
  };
}

/** Per-agent awareness change between two snapshots (next − prev). */
export function awarenessDelta(prev: Snapshot, next: Snapshot): number[] {
  return next.agents.map((a, i) => a.aw - (prev.agents[i]?.aw ?? 0));
}

/** Civilians who crossed the clarity threshold going prev → next. */
export function newlyClear(prev: Snapshot, next: Snapshot): number[] {
  const th = clearThreshold(next);
  const out: number[] = [];
  next.agents.forEach((a, i) => {
    if (i === next.player || a.inc || a.gone) return;
    const b = prev.agents[i]?.aw ?? 0;
    if (b < th && a.aw >= th) out.push(i);
  });
  return out;
}

/** Directed link "flows" (from higher awareness to lower) that gained at turn end. */
export function propagationFlows(
  prev: Snapshot,
  next: Snapshot,
  minGain = 0.004,
): Array<{ from: number; to: number; amount: number }> {
  const flows: Array<{ from: number; to: number; amount: number }> = [];
  const delta = awarenessDelta(prev, next);
  for (const [i, j] of next.links) {
    const ai = next.agents[i];
    const aj = next.agents[j];
    if (ai.inc || aj.inc || ai.gone || aj.gone) continue;
    // whoever was more aware before is the source of the overnight flow
    const bi = prev.agents[i]?.aw ?? 0;
    const bj = prev.agents[j]?.aw ?? 0;
    if (bi > bj && delta[j] > minGain) flows.push({ from: i, to: j, amount: delta[j] });
    else if (bj > bi && delta[i] > minGain) flows.push({ from: j, to: i, amount: delta[i] });
  }
  return flows;
}
