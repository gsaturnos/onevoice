// Pure scene view-model. Turns a read-only game Snapshot into a hand-composed
// "kitchen table" layout: who sits where, how near/far (depth), and what
// environmental phase the room is in. It never mutates state and never touches
// the DOM or Pixi — so the renderer and unit tests share exactly this logic.
//
// The core's simulation coordinates drive TOPOLOGY (who is linked to whom). For
// level 0 we deliberately re-seat people around an authored table instead of a
// scatter field, ordering seats by link-proximity to the player so relationships
// read as "who is sitting near me". This is a view choice only; mechanics are
// untouched (the renderer never writes back).

import type { Snapshot } from '@core/types';
import { awareCountAt, averageAwareness } from '@core/selectors';
import { clearThreshold } from '@core/insight';

export const STAGE_W = 720;
export const STAGE_H = 440;

// The table ellipse the cast is seated around.
const TABLE = { cx: 360, cy: 292, rx: 250, ry: 104 };

/** How close (below the clarity threshold) counts as "near ready" for the turn-end beat. */
export const NEAR_BAND = 0.12;

export type Phase = 'silent' | 'awakening' | 'acting';

export interface SceneAgent {
  idx: number;
  x: number;
  y: number;
  /** 0 = far side of the table (small, dim), 1 = nearest the viewer (large). */
  depth: number;
  scale: number;
  isPlayer: boolean;
  seat: number; // 0..N-1 placement slot, 0 = front-centre
}

export interface SceneModel {
  agents: SceneAgent[];
  /** index → SceneAgent, for quick lookup by agent id. */
  byIdx: Map<number, SceneAgent>;
  table: typeof TABLE;
}

/**
 * Breadth-first ordering from the player through the link graph, so that people
 * closely connected to the player are seated nearest. Civilians only; any not
 * reachable are appended by index so everyone gets a seat.
 */
export function orderAroundPlayer(s: Snapshot): number[] {
  const p = s.player;
  const seen = new Set<number>([p]);
  const order: number[] = [p];
  const queue: number[] = [p];
  while (queue.length) {
    const cur = queue.shift() as number;
    const nbrs = [...s.neighbors[cur]]
      .filter((j) => !s.agents[j].inc && !s.agents[j].gone)
      .sort((a, b) => a - b);
    for (const j of nbrs) {
      if (!seen.has(j)) {
        seen.add(j);
        order.push(j);
        queue.push(j);
      }
    }
  }
  for (let i = 0; i < s.agents.length; i++) {
    if (!seen.has(i) && !s.agents[i].inc && !s.agents[i].gone) {
      seen.add(i);
      order.push(i);
    }
  }
  return order;
}

/**
 * Priority slot pattern: 0 (front centre), then alternating right/left and
 * working toward the back, so BFS-nearest people flank the player and distant
 * acquaintances recede to the far edge.
 */
function slotAngles(n: number): number[] {
  const base = Math.PI / 2; // bottom of the ellipse, nearest the viewer
  const step = (Math.PI * 2) / n;
  const out: number[] = [];
  let k = 0;
  let side = 1;
  for (let placed = 0; placed < n; placed++) {
    out.push(base + k * step * side);
    if (placed === 0) {
      k = 1;
      side = 1;
    } else if (side === 1) {
      side = -1;
    } else {
      side = 1;
      k++;
    }
  }
  return out;
}

/** Compose the full seating layout (stable across turns in level 0). */
export function buildScene(s: Snapshot): SceneModel {
  const order = orderAroundPlayer(s);
  const n = order.length;
  const angles = slotAngles(n);
  const agents: SceneAgent[] = order.map((idx, seat) => {
    const theta = angles[seat];
    const x = TABLE.cx + TABLE.rx * Math.cos(theta);
    const y = TABLE.cy + TABLE.ry * Math.sin(theta);
    const depth = (y - (TABLE.cy - TABLE.ry)) / (2 * TABLE.ry); // 0 far .. 1 near
    const scale = 0.74 + 0.52 * depth;
    return { idx, x, y, depth, scale, isPlayer: idx === s.player, seat };
  });
  const byIdx = new Map<number, SceneAgent>();
  for (const a of agents) byIdx.set(a.idx, a);
  return { agents, byIdx, table: TABLE };
}

/** How warm/awake the room is, as a phase plus a smooth 0..1 for transitions. */
export function envState(s: Snapshot): { phase: Phase; t: number } {
  const need = objectiveNeed(s);
  const clear = awareCountAt(s, clearThreshold(s));
  const avg = averageAwareness(s);
  // A blend of overall warmth and concrete progress toward the objective.
  const t = clamp01(avg * 0.9 + (need ? (clear / need) * 0.45 : 0));
  let phase: Phase = 'silent';
  if ((s.over && s.won) || (need && clear >= need)) phase = 'acting';
  else if (clear >= 1 || avg >= 0.3) phase = 'awakening';
  return { phase, t };
}

/** Civilians who are close to (but not yet at) clarity — the "near ready" beat. */
export function nearReady(s: Snapshot): number[] {
  const th = clearThreshold(s);
  const out: number[] = [];
  s.agents.forEach((a, i) => {
    if (i === s.player || a.inc || a.gone) return;
    if (a.aw >= th - NEAR_BAND && a.aw < th) out.push(i);
  });
  return out;
}

/** The objective's target count, or 0 if the level has no counted objective. */
export function objectiveNeed(s: Snapshot): number {
  const o = s.level.obj;
  if (!o) return 0;
  if (o.type === 'aware' || o.type === 'muralaware' || o.type === 'survive') return o.count;
  if (o.type === 'wins') return o.count;
  if (o.type === 'defect' || o.type === 'witness') return 1;
  return 0;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
