// Pure reducers. applyAction ports the production act() (and the mural/link/
// letter completion handlers) field-for-field; tick still carries the Phase-1
// demo diffusion until the full endTurn port (Stage C).
//
// Parity: these mirror staging exactly (same constants, order, clamps).
// Stochastic actions (post, reach) draw from a seeded stream carried in
// state.rngState — the same mulberry32 the golden oracle's RNG seam uses — so
// oracle and V2 draw an identical sequence. No DOM, no Math.random, no rendering.
// Two-step UI actions (mural/link/letter) take the resolved target/coordinate
// the UI picked, since the coordinate→nearest resolution is a view concern.
// See docs/v2/ARCHITECTURE.md §7.3.

import { makeRng, type Rng } from './rng';
import type { Action, Agent, GameState } from './types';
import { objectiveMet } from './selectors';

function infBonus(s: GameState): number {
  return s.inf / 100;
}

function linkReach(s: GameState): number {
  return s.level.linkMax * (1 + 0.6 * infBonus(s));
}

function lkey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Is agent i inside any active (non-defected) incumbent's surveillance range? */
function inSurv(s: GameState, i: number): boolean {
  const a = s.agents[i];
  return s.agents.some((k) => k.inc && !k.def && Math.hypot(a.x - k.x, a.y - k.y) < s.level.surv);
}

function localAwAround(s: GameState, k: number, radius: number): number {
  let sum = 0;
  let c = 0;
  const ak = s.agents[k];
  s.agents.forEach((a) => {
    if (a.inc || a.gone) return;
    if (Math.hypot(a.x - ak.x, a.y - ak.y) < radius) {
      sum += a.aw;
      c++;
    }
  });
  return c ? sum / c : 0;
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

function rebuildNeighbors(s: GameState): void {
  const nbr: number[][] = Array.from({ length: s.agents.length }, () => []);
  for (const [a, b] of s.links) {
    nbr[a].push(b);
    nbr[b].push(a);
  }
  s.neighbors = nbr;
}

/**
 * Port of triggerDefection: an incumbent takes off the uniform, seeding doubt
 * in nearby incumbents; wavering ones may chain (a seeded 0.4 draw each).
 * Mutates s in place and returns the number of immediate chained defections.
 */
function triggerDefection(s: GameState, idx: number, chained: boolean, rng: Rng): number {
  const a = s.agents[idx];
  a.def = true;
  a.waver = false;
  s.defected++;
  a.met = true;
  s.rig = Math.max(0.1, s.rig - (chained ? 0.04 : 0.05));
  s.floor = Math.min(0.5, s.floor + 0.02);
  s.inf = Math.min(100, s.inf + (chained ? 5 : 10));
  const chainNames: number[] = [];
  s.agents.forEach((b, j) => {
    if (!b.inc || b.def || j === idx) return;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 170) {
      b.doubt = true;
      if (b.waver && rng.next() < 0.4) chainNames.push(j);
    }
  });
  chainNames.forEach((j) => {
    if (!s.agents[j].def) triggerDefection(s, j, true, rng);
  });
  return chainNames.length;
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
      s.risk = Math.min(1, s.risk + (0.03 + sp) * s.heirMul.risk);
      let mul = q.trait.talkMul * s.heirMul.talk;
      if (q.trait.id === 'wary' && s.inf >= 30) mul = 1.2;
      q.aw = Math.min(1, q.aw + (0.26 + 0.08 * infBonus(s)) * mul);
      s.inf = Math.min(100, s.inf + 2);
      return s;
    }
    case 'org': {
      if (s.energy < 2) return s;
      s.energy -= 2;
      s.risk = Math.min(1, s.risk + (0.13 + sp) * s.heirMul.risk);
      const ring = orgRingSet(s);
      const mul2 = s.heirMul.org; // (market ? 1.5 : 1) * (has('deep') ? 1.3 : 1) — Stage C2/legacy
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
      s.postTrail = 3; // no 'paper' opportunity yet (Stage C2)
      const reachN = 14 + s.heirMul.postAdd; // (has('press') ? 20 : 14) + postAdd
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
    case 'link': {
      // needs energy>=2 (unless a free-link legacy is active)
      if (s.energy < 2 && !s.freeLink) return s;
      const t = action.target;
      const a = s.agents[t];
      if (t === p || !a || a.inc || a.gone) return s;
      if (s.neighbors[p].includes(t)) return s;
      if (Math.hypot(a.x - s.agents[p].x, a.y - s.agents[p].y) > linkReach(s)) return s;
      const cost = s.freeLink ? 0 : 2;
      s.energy -= cost;
      if (s.freeLink) s.freeLink = false;
      s.risk = Math.min(1, s.risk + 0.06 + (inSurv(s, p) ? 0.05 : 0));
      s.links.push([p, t, 1]);
      s.built.push([p, t]);
      rebuildNeighbors(s);
      s.inf = Math.min(100, s.inf + 3);
      return s;
    }
    case 'letter': {
      if (s.energy < 2) return s;
      const t = action.target;
      const a = s.agents[t];
      if (t === p || !a || a.inc || a.gone) return s;
      if (s.neighbors[p].includes(t)) return s;
      s.energy -= 2;
      s.risk = Math.min(1, s.risk + 0.08);
      s.links.push([p, t, 0.5]);
      s.built.push([p, t]);
      s.weak.push(lkey(p, t));
      rebuildNeighbors(s);
      s.inf = Math.min(100, s.inf + 3);
      return s;
    }
    case 'mural': {
      const cost = 2; // muralCost() with no 'artist' legacy
      if (s.energy < cost) return s;
      if (Math.hypot(action.x - s.agents[p].x, action.y - s.agents[p].y) > linkReach(s)) return s;
      s.energy -= cost;
      s.risk = Math.min(1, s.risk + 0.1 + (inSurv(s, p) ? 0.05 : 0));
      s.murals.push({ x: action.x, y: action.y });
      s.inf = Math.min(100, s.inf + 3);
      return s;
    }
    case 'reach': {
      if (s.energy < 2) return s;
      const cand = s.agents
        .map((a, i) => ({ a, i }))
        .filter(
          (o) =>
            o.a.inc &&
            !o.a.def &&
            o.a.waver &&
            Math.hypot(o.a.x - s.agents[p].x, o.a.y - s.agents[p].y) < linkReach(s) * 1.3,
        );
      if (!cand.length) return s;
      s.energy -= 2;
      const t = cand[0];
      const chance = 0.25 + localAwAround(s, t.i, 110) * 0.5 + 0.3 * infBonus(s);
      const rng = makeRng(s.rngState);
      if (rng.next() < chance) {
        triggerDefection(s, t.i, false, rng);
        s.energy += 1;
      } else {
        s.risk = Math.min(1, s.risk + 0.22);
      }
      s.rngState = rng.state();
      return s;
    }
    case 'expose': {
      if (!s.spies.length) return s;
      if (s.energy < 2) return s;
      if (s.inf < 30) return s;
      const idx = s.spies.findIndex(
        (sp2) => Math.hypot(sp2.x - s.agents[p].x, sp2.y - s.agents[p].y) <= linkReach(s),
      );
      if (idx < 0) return s;
      s.energy -= 2;
      s.spies.splice(idx, 1);
      s.floor = Math.min(0.5, s.floor + 0.025);
      s.inf = Math.min(100, s.inf + 8);
      const px = s.agents[p].x;
      const py = s.agents[p].y;
      s.agents.forEach((a) => {
        if (!a.inc && !a.gone && Math.hypot(a.x - px, a.y - py) < 150) {
          a.aw = Math.min(1, a.aw + 0.1);
        }
      });
      return s;
    }
  }
}

// --- geometry helpers for mural free zones (ports of production) ---

/** All mural triangles whose three vertices are pairwise within 210px. */
function freeZones(s: GameState): Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> {
  const m = s.murals;
  const zones: Array<[{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]> = [];
  for (let a = 0; a < m.length; a++)
    for (let b = a + 1; b < m.length; b++)
      for (let c = b + 1; c < m.length; c++) {
        const A = m[a];
        const B = m[b];
        const C = m[c];
        if (
          Math.hypot(A.x - B.x, A.y - B.y) <= 210 &&
          Math.hypot(B.x - C.x, B.y - C.y) <= 210 &&
          Math.hypot(A.x - C.x, A.y - C.y) <= 210
        )
          zones.push([A, B, C]);
      }
  return zones;
}

function inTriangle(
  p: { x: number; y: number },
  A: { x: number; y: number },
  B: { x: number; y: number },
  C: { x: number; y: number },
): boolean {
  const sgn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): number =>
    (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
  const d1 = sgn(p, A, B);
  const d2 = sgn(p, B, C);
  const d3 = sgn(p, C, A);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function inAnyZone(p: { x: number; y: number }, zones: ReturnType<typeof freeZones>): boolean {
  return zones.some((z) => inTriangle(p, z[0], z[1], z[2]));
}

/** Derive heir-boon multipliers from the successor's trait (port of setHeirBoon). */
function setHeirBoon(s: GameState, trait: Agent['trait']): void {
  s.heirMul = { talk: 1, org: 1, muralTick: 1, postAdd: 0, risk: 1 };
  if (trait.id === 'talker') s.heirMul.talk = 1.25;
  else if (trait.id === 'gatherer') s.heirMul.org = 1.25;
  else if (trait.id === 'artist') s.heirMul.muralTick = 1.4;
  else if (trait.id === 'online') s.heirMul.postAdd = 6;
  else if (trait.id === 'wary') {
    s.heirMul.risk = 0.8;
    s.heirMul.talk = 0.85;
  }
}

/** Decrement an active opportunity window (port of tickOpp; no RNG). */
function tickOpp(s: GameState): void {
  if (!s.opp) return;
  s.opp.turnsLeft--;
  if (s.opp.turnsLeft <= 0) {
    s.oppExpired++;
    s.opp = null;
  }
}

/**
 * Stage C1 covers the guided ("pro") levels, where production returns early
 * (D.pro) from both of these, so they draw nothing. The campaign bodies — which
 * DO consume the turn-entropy stream — arrive in Stage C2 (opportunities) and
 * Stage C3 (dilemmas). Guarded so a premature campaign call is a visible no-op
 * rather than a silent parity drift.
 */
function maybeSpawnOpp(s: GameState, _rng: Rng): void {
  if (s.level.pro || s.opp || s.over) return;
  // TODO(Stage C2): turn>=3 gate draw, pick OPPS, make() — campaign only.
}
function maybeFireDilemma(s: GameState, _rng: Rng): void {
  if (s.level.pro || s.over || s.pendingDilemma) return;
  // TODO(Stage C3): 0.30 gate draw, pick DILEMMAS, build() — campaign only.
}

/**
 * Resolve a turn — a faithful port of production endTurn. All stochastic draws
 * (reinforcement placement, diffusion pulse timing, win-pressure jitter,
 * spontaneous crackdowns) come from the shared turn-entropy stream in
 * s.rngState, in the exact production order, so oracle and V2 stay in lockstep.
 * View-only side effects (floats, ripples, sound, coach, end screens) are
 * dropped; every mechanic mutation is preserved. See docs/v2/ARCHITECTURE.md §7.3.
 */
export function tick(prev: GameState): GameState {
  const s = clone(prev);
  if (s.over || s.pendingDilemma) return s;

  const D = s.level;
  const NN = s.agents.length;
  const ag = s.agents;
  const p = s.player;
  s.interrogated = false;

  const rng = makeRng(s.rngState);
  const rand = (a: number, b: number): number => a + rng.next() * (b - a);

  // A. a pending reinforcement drops in as a fresh incumbent.
  if (s.reinfPending) {
    s.reinfPending = false;
    for (let tries = 0; tries < 25; tries++) {
      const idx = Math.floor(rand(0, NN));
      if (!ag[idx].inc && !ag[idx].gone && idx !== p) {
        ag[idx].inc = true;
        ag[idx].aw = 0;
        ag[idx].waver = false;
        ag[idx].def = false;
        ag[idx].doubt = false;
        break;
      }
    }
  }

  const zones = freeZones(s);

  // B. overnight diffusion along links (simultaneous), then floor + memory decay.
  let spreadCount = 0;
  let memHeld = 0;
  const next = ag.map((a) => a.aw);
  s.links.forEach((l) => {
    const i = l[0];
    const j = l[1];
    const w = l[2] || 1;
    const d = 1 - s.rig * 0.5;
    const r = 0.08 * d * w;
    if (!ag[i].inc && !ag[i].gone && !ag[j].inc && !ag[j].gone) {
      if (ag[i].aw > ag[j].aw) {
        const t2 = (ag[i].aw - ag[j].aw) * r;
        next[j] = Math.min(1, next[j] + t2);
        if (t2 > 0.004) {
          spreadCount++;
          if (s.pulseCount < 12) {
            rng.next(); // pulse timing draw (nowMs()+Math.random()*400)
            s.pulseCount++;
          }
        }
      }
      if (ag[j].aw > ag[i].aw) {
        const t2 = (ag[j].aw - ag[i].aw) * r;
        next[i] = Math.min(1, next[i] + t2);
        if (t2 > 0.004) {
          spreadCount++;
          if (s.pulseCount < 12) {
            rng.next();
            s.pulseCount++;
          }
        }
      }
    }
  });
  ag.forEach((a, i) => {
    if (!a.inc && !a.gone) {
      if (next[i] - 0.004 < s.floor && a.aw > s.floor - 0.001) memHeld++;
      a.aw = Math.max(s.floor, next[i] - 0.004);
    }
  });

  // C. free-zone growth.
  if (zones.length) {
    ag.forEach((a) => {
      if (a.inc || a.gone) return;
      if (inAnyZone(a, zones)) a.aw = Math.min(1, a.aw + 0.015);
    });
  }

  // D. defectors radiate awareness.
  ag.forEach((a) => {
    if (!a.def) return;
    ag.forEach((b) => {
      if (b.inc || b.gone) return;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 110) b.aw = Math.min(1, b.aw + 0.015);
    });
  });

  // E. sheltering someone: eyes rise, the circle warms; the guest slips out on t0.
  if (s.shelterTurns > 0) {
    s.shelterTurns--;
    s.risk = Math.min(1, s.risk + 0.08);
    const sh = ag[s.shelterIdx];
    if (sh && !sh.gone) {
      s.neighbors[p].forEach((j) => {
        if (!ag[j].inc && !ag[j].gone) ag[j].aw = Math.min(1, ag[j].aw + 0.03);
      });
    }
  }

  // F. murals keep speaking.
  s.murals.forEach((m) => {
    ag.forEach((a) => {
      if (a.inc || a.gone) return;
      if (Math.hypot(a.x - m.x, a.y - m.y) < 90)
        a.aw = Math.min(1, a.aw + 0.02 * a.trait.muralMul * s.heirMul.muralTick);
    });
  });

  // G. a fading post trail keeps eyes on you.
  if (s.postTrail > 0) {
    s.postTrail--;
    s.risk = Math.min(1, s.risk + 0.03);
  }

  // H. informants hunt the hottest un-sheltered person, chilling awareness nearby.
  s.spies.forEach((spy) => {
    let hot: Agent | null = null;
    let hv = -1;
    ag.forEach((a) => {
      if (a.inc || a.gone) return;
      if (ag.some((d2) => d2.def && Math.hypot(d2.x - a.x, d2.y - a.y) < 110)) return;
      if (a.aw > hv) {
        hv = a.aw;
        hot = a;
      }
    });
    if (hot) {
      const h = hot as Agent;
      const dx = h.x - spy.x;
      const dy = h.y - spy.y;
      const dd = Math.hypot(dx, dy) || 1;
      const speed = s.lvlIdx >= 11 ? 62 : 52;
      spy.x += (dx / dd) * speed;
      spy.y += (dy / dd) * speed;
    }
    ag.forEach((a) => {
      if (a.inc || a.gone) return;
      if (Math.hypot(a.x - spy.x, a.y - spy.y) < 70) a.aw = Math.max(s.floor, a.aw - 0.06);
    });
    if (Math.hypot(ag[p].x - spy.x, ag[p].y - spy.y) < 70) s.risk = Math.min(1, s.risk + 0.07);
  });

  // I. incumbents waver when their neighbourhood wakes up.
  ag.forEach((a, i) => {
    if (!a.inc || a.def) return;
    const th = D.waverAt - (a.doubt ? 0.12 : 0);
    a.waver = localAwAround(s, i, 110) > th;
  });

  // J. collective pressure — structural wins fire when a circle stays ready.
  let winNear = false;
  let winsFiredThisTurn = 0;
  for (let i = 0; i < NN; i++) {
    const a = ag[i];
    if (a.inc || a.gone) continue;
    const nb = s.neighbors[i].filter((j) => !ag[j].gone && !ag[j].inc);
    if (!nb.length) {
      a.press = Math.max(0, a.press * 0.8);
      continue;
    }
    const loc = (a.aw + nb.reduce((sum, j) => sum + ag[j].aw, 0)) / (nb.length + 1);
    if (loc > D.thresh && s.rig > 0.12) {
      a.press = Math.min(1, a.press + 0.2 + D.winP * 1.6 + rand(0, 0.06));
      if (a.press >= 1 && winsFiredThisTurn === 0) {
        a.press = 0;
        winsFiredThisTurn++;
        s.rig = Math.max(0.1, s.rig - 0.065);
        s.floor = Math.min(0.5, s.floor + D.floorGain);
        s.wins++;
        s.lastWinTurn = s.turn;
        if (Math.hypot(a.x - ag[p].x, a.y - ag[p].y) < 150) winNear = true;
      } else if (a.press >= 1) {
        a.press = 0.96;
      }
    } else {
      a.press = Math.max(0, a.press * 0.85 - 0.01);
    }
  }
  let hopeBonus = 0;
  if (winNear) hopeBonus = 1;

  // reinforcement thresholds: gains alarm the regime.
  if (s.reinfThresholds.length && s.rig < s.reinfThresholds[0]) {
    s.reinfThresholds.shift();
    s.reinfPending = true;
  }

  const nIncNow = Math.max(1, ag.filter((a) => a.inc).length);
  const activeInc = ag.filter((a) => a.inc && !a.def).length;

  // K. crackdowns — scripted (fixed turn) or spontaneous (seeded roll).
  if (D.scriptedCrack && s.turn === D.scriptedCrack - 1 && s.crackIn < 0) {
    s.crackIn = 1;
    s.crackZone = { x: ag[p].x, y: ag[p].y, r: 155 };
  } else if (s.crackIn === 1 && D.scriptedCrack && s.turn === D.scriptedCrack) {
    s.crackIn = -1;
    s.lastCrackTurn = s.turn;
    const witnessed = s.docActive;
    s.docActive = false;
    const cz = s.crackZone as { x: number; y: number };
    s.crackZone = null;
    const suppress = witnessed ? 0.9 : 0.6;
    ag.forEach((a) => {
      if (a.inc || a.gone) return;
      if (Math.hypot(a.x - cz.x, a.y - cz.y) < 155) {
        a.aw = Math.max(s.floor, a.aw * suppress);
        if (witnessed) a.aw = Math.min(1, a.aw + 0.1);
      }
    });
    if (witnessed) s.witnessedOnce = true;
    const inZone = Math.hypot(ag[p].x - cz.x, ag[p].y - cz.y) < 155;
    if (inZone && s.risk > 0.4 && !witnessed) {
      s.over = true;
      s.won = false;
    }
  } else if (s.crackIn === 1 && s.crackZone) {
    tickGenericCrackdown(s, nIncNow, activeInc);
  } else if (
    s.crackIn < 0 &&
    !D.scriptedCrack &&
    D.cracks !== false &&
    rng.next() < (D.crackP + s.rig * 0.12) * (activeInc / nIncNow)
  ) {
    s.crackIn = 1;
    const hot = ag
      .map((a, i) => ({ a, i }))
      .filter((o) => !o.a.inc && !o.a.gone)
      .sort((x, y) => y.a.aw - x.a.aw)[0];
    s.crackZone = { x: hot.a.x, y: hot.a.y, r: 155 };
  }

  // L. opportunities (campaign only — no draw on pro levels).
  tickOpp(s);
  maybeSpawnOpp(s, rng);

  // M. turn rolls over; energy resets with any boost/hope.
  s.turn++;
  s.energy = (s.boostTurns > 0 ? 4 : 3) + hopeBonus;
  if (s.boostTurns > 0) s.boostTurns--;

  // N. win / loss / timeout.
  if (!s.over && D.pro && objectiveMet(s)) {
    s.over = true;
    s.won = true;
  } else if (!s.over && !D.pro && (s.floor >= 0.35 || s.rig <= 0.15)) {
    s.over = true;
    s.won = true;
  } else if (!s.over && s.turn > D.maxT) {
    s.over = true;
    s.won = false;
  }

  // O. a dilemma may present (campaign only — no draw on pro levels).
  if (!s.over) maybeFireDilemma(s, rng);

  s.rngState = rng.state();
  return s;
}

/**
 * The spontaneous/mural-hit crackdown branch, including heir succession when the
 * player is taken. Ported from production endTurn's third crack branch.
 */
function tickGenericCrackdown(s: GameState, nIncNow: number, activeInc: number): void {
  const D = s.level;
  const ag = s.agents;
  const p = s.player;
  s.crackIn = -1;
  s.lastCrackTurn = s.turn;
  const witnessed = s.docActive;
  s.docActive = false;
  const cz = s.crackZone as { x: number; y: number };
  const muralHit = s.murals.findIndex((m) => Math.hypot(m.x - cz.x, m.y - cz.y) < 155);
  let suppress = 0.55;
  if (muralHit >= 0) {
    s.murals.splice(muralHit, 1);
    suppress = 0.75;
  }
  if (witnessed) suppress = Math.max(suppress, 0.85);
  s.rig = Math.min(0.94, s.rig + D.crackR * (1 - s.floor) * (activeInc / nIncNow) * (witnessed ? 0.4 : 1));
  const zonesNow = freeZones(s);
  ag.forEach((a) => {
    if (a.inc || a.gone) return;
    if (Math.hypot(a.x - cz.x, a.y - cz.y) < 155) {
      let sEff = suppress;
      if (zonesNow.length && inAnyZone(a, zonesNow)) sEff = Math.max(sEff, 0.85);
      a.aw = Math.max(s.floor, a.aw * sEff);
      if (witnessed) a.aw = Math.min(1, a.aw + 0.08);
    }
  });
  if (witnessed) {
    s.witnessedOnce = true;
    if (s.turn - s.lastWinTurn <= 2 && s.lastWinTurn > 0) {
      s.floor = Math.min(0.5, s.floor + 0.02);
      ag.forEach((a) => {
        if (!a.inc && !a.gone) a.aw = Math.min(1, a.aw + 0.04);
      });
    }
  }
  const inZone = Math.hypot(ag[p].x - cz.x, ag[p].y - cz.y) < 155;
  if (s.shelterTurns > 0 && inZone) s.risk = Math.min(1, s.risk + 0.15);
  if (inZone && s.risk > 0.4) {
    if (s.risk > 0.7) {
      ag[p].gone = true;
      s.lives++;
      if (s.shelterTurns > 0 && s.shelterIdx >= 0 && !ag[s.shelterIdx].gone) {
        ag[s.shelterIdx].gone = true;
        s.shelterTurns = 0;
        s.shelterIdx = -1;
      }
      const heirs = ag
        .map((a, i) => ({
          a,
          i,
          score:
            a.aw +
            (s.neighbors[i] && s.neighbors[i].includes(p) ? 0.25 : 0) +
            (s.built.some((b) => (b[0] === p && b[1] === i) || (b[1] === p && b[0] === i)) ? 0.2 : 0),
        }))
        .filter((o) => !o.a.inc && !o.a.gone && o.i !== p && o.a.aw > 0.45)
        .sort((x, y) => y.score - x.score);
      if (heirs.length) {
        const h = heirs[0].i;
        const hp = ag[h];
        s.player = h;
        s.risk = 0;
        s.inf = Math.max(0, s.inf - 25);
        setHeirBoon(s, hp.trait);
      } else {
        s.over = true;
        s.won = false;
      }
    } else {
      s.interrogated = true;
      s.risk = Math.min(1, s.risk + 0.15);
    }
  }
  s.crackZone = null;
}

function clone(s: GameState): GameState {
  return {
    ...s,
    agents: s.agents.map((a): Agent => ({ ...a, events: [...a.events] })),
    links: s.links.map((l) => [...l] as [number, number, number]),
    built: s.built.map((b) => [...b] as [number, number]),
    weak: [...s.weak],
    murals: s.murals.map((m) => ({ ...m })),
    neighbors: s.neighbors.map((n) => [...n]),
    spies: s.spies.map((sp) => ({ ...sp })),
    reinfThresholds: [...s.reinfThresholds],
    heirMul: { ...s.heirMul },
    opp: s.opp ? { ...s.opp } : null,
    firedDilemmas: [...s.firedDilemmas],
    // pendingDilemma carries pure fx closures; the reference is safe to share.
  };
}
