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

// The near "kitchen table" is a low foreground element the cast sits behind, so
// figures can be drawn large without the table covering faces, hands or props.
// (Room draws it from these numbers; scene only needs it for lookups.)
export const TABLE = { cx: 360, cy: 366, rx: 336, ry: 52 };

// Staged two-row seating tuned so all twelve neighbours read at gameplay scale.
// The nearest people (BFS-closest to the player) sit big in the front row; the
// player anchors front-centre. Edges sit slightly farther (higher, a touch
// smaller) so the group reads with depth without shrinking anyone.
const ROW = {
  front: { y: 344, lift: 24, xL: 54, xR: 666, sMid: 1.72, sEdge: 1.48 },
  back: { y: 232, lift: 12, xL: 148, xR: 572, sMid: 1.36, sEdge: 1.24 },
};
const S_MIN = ROW.back.sEdge;
const S_MAX = ROW.front.sMid;

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
 * Physical slot order for a row, centre-first: rank 0 → centre seat, then it
 * radiates outward (…, centre-1, centre+1, …). Feeding BFS-nearest people in
 * rank order seats the player dead centre and their closest neighbours beside
 * them, with distant acquaintances at the edges.
 */
function centreOut(count: number): number[] {
  const mid = (count - 1) / 2;
  return [...Array(count).keys()].sort(
    (a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b,
  );
}

interface Row { y: number; lift: number; xL: number; xR: number; sMid: number; sEdge: number; }

/** Place `members` (nearness order) along one arced row; returns per-idx seats. */
function seatRow(members: number[], row: Row, player: number, out: SceneAgent[]): void {
  const c = members.length;
  const slots = centreOut(c);
  const bySlot: number[] = [];
  members.forEach((idx, rank) => { bySlot[slots[rank]] = idx; });
  for (let slot = 0; slot < c; slot++) {
    const idx = bySlot[slot];
    const t = c > 1 ? slot / (c - 1) : 0.5; // 0 left … 1 right
    const dc = Math.abs(t - 0.5) * 2; // 0 centre … 1 edge
    const x = row.xL + t * (row.xR - row.xL);
    const y = row.y - row.lift * dc;
    const scale = row.sMid - (row.sMid - row.sEdge) * dc;
    const depth = (scale - S_MIN) / (S_MAX - S_MIN || 1);
    out.push({ idx, x, y, depth, scale, isPlayer: idx === player, seat: out.length });
  }
}

/** Compose the full staged layout (stable across turns in level 0). */
export function buildScene(s: Snapshot): SceneModel {
  const order = orderAroundPlayer(s);
  const n = order.length;
  // Roughly 40% of the (non-player) cast sit in the back row; the player and the
  // closest neighbours fill the larger front row.
  const backN = n <= 1 ? 0 : Math.min(n - 1, Math.round((n - 1) * 0.42));
  const frontN = n - backN;
  const front = order.slice(0, frontN);
  const back = order.slice(frontN);
  const agents: SceneAgent[] = [];
  seatRow(front, ROW.front, s.player, agents);
  if (back.length) seatRow(back, ROW.back, s.player, agents);
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
