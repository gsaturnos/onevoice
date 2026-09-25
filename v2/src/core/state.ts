// createGame: build an initial GameState. A faithful port of the production
// initGame/mkPerson (staging index.html) — the numeric setup only, no DOM.
//
// Determinism note: production seeds initial layout with
// mulberry32(1000 + lvlIdx*7919) and consumes that stream in a specific order
// (spies first, then per-agent x, y, trait, aw, then the player index). This
// port reproduces that order exactly so createGame parity holds field-for-field
// against the golden oracle. See docs/v2/ARCHITECTURE.md §7.3.

import { makeRng, type Rng } from './rng';
import type {
  Agent,
  GameState,
  LegacyState,
  LevelDef,
  Link,
  RawLevel,
} from './types';
import { NAMES, ROLES, STAKES, TRAITS } from '@content/people';
import { LEVELS, PRO_DEFAULTS } from '@content/levels';

const W = 720;
const H = 440;

const NO_LEGACY: LegacyState = { embers: 0, owned: [] };

/** D = { ...PRO_DEFAULTS, ...LEVELS[i] } — defaults merged under the raw level. */
export function resolveLevel(lvlIdx: number): LevelDef {
  const raw: RawLevel = LEVELS[lvlIdx];
  return { ...PRO_DEFAULTS, ...raw };
}

function buildNeighbors(n: number, links: Link[]): number[][] {
  const nbr: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of links) {
    nbr[a].push(b);
    nbr[b].push(a);
  }
  return nbr;
}

/**
 * Build the initial state for campaign level `lvlIdx`. `legacy` supplies the
 * meta-progression flags (owned upgrades) that alter setup; the default is a
 * clean slate, matching a first-time player and the parity baseline.
 */
export function createGame(lvlIdx = 0, legacy: LegacyState = NO_LEGACY): GameState {
  const D = resolveLevel(lvlIdx);
  const NN = D.N;
  const has = (id: string): boolean => legacy.owned.includes(id);

  const rng: Rng = makeRng(1000 + lvlIdx * 7919);
  const srand = (): number => rng.next();
  const sr = (a: number, b: number): number => a + srand() * (b - a);

  const floor = has('stories') && !D.pro ? 0.1 : 0.05;
  const rig = D.rig;
  let inf = 0;

  // spies are placed BEFORE the cast — they consume the rng stream first.
  const spies: Array<{ x: number; y: number }> = [];
  for (let s = 0; s < (D.spies || 0); s++) spies.push({ x: sr(60, W - 60), y: sr(60, H - 60) });

  const reinfThresholds = [0.55, 0.4, 0.28].slice(0, D.reinforce || 0);

  const agents: Agent[] = [];
  const mkPerson = (idx: number, x: number, y: number): Agent => {
    const nm = NAMES[(lvlIdx * 17 + idx * 3) % NAMES.length];
    const role = ROLES[(lvlIdx * 7 + idx * 5) % ROLES.length];
    const stake = STAKES[(lvlIdx * 11 + idx * 13) % STAKES.length];
    const trait = TRAITS[Math.floor(srand() * TRAITS.length)];
    return {
      x,
      y,
      aw: sr(0.05, 0.18),
      inc: false,
      gone: false,
      waver: false,
      def: false,
      doubt: false,
      nm,
      role,
      stake,
      trait,
      met: false,
      betrayed: false,
      sheltered: false,
      press: 0,
      events: [],
    };
  };

  if (D.clusterCenter) {
    for (let i = 0; i < NN; i++) {
      const ang = sr(0, Math.PI * 2);
      const rad = i === 0 ? 0 : sr(55, 185);
      agents.push(mkPerson(i, W / 2 + Math.cos(ang) * rad, H / 2 + Math.sin(ang) * rad * 0.75));
    }
  } else if (D.twoClusters) {
    for (let i = 0; i < NN; i++) {
      const left = i < NN * 0.55;
      agents.push(mkPerson(i, left ? sr(40, 290) : sr(440, 680), sr(50, H - 50)));
    }
  } else {
    for (let i = 0; i < NN; i++) agents.push(mkPerson(i, sr(30, W - 30), sr(30, H - 30)));
  }

  for (let i = 0; i < (D.nInc || 0); i++) {
    agents[i].inc = true;
    agents[i].aw = 0;
    if (D.clusterCenter) {
      agents[i].x = W / 2;
      agents[i].y = H / 2;
    }
  }

  // k-nearest links (k=4), skipping cross-cluster edges in twoClusters levels.
  const links: Link[] = [];
  for (let i = 0; i < NN; i++) {
    const d: Array<[number, number]> = [];
    for (let j = 0; j < NN; j++) {
      if (i !== j) d.push([j, Math.hypot(agents[i].x - agents[j].x, agents[i].y - agents[j].y)]);
    }
    d.sort((a, b) => a[1] - b[1]);
    const k0 = Math.min(4, NN - 1);
    for (let k = 0; k < k0; k++) {
      const j = d[k][0];
      if (D.twoClusters && (agents[i].x < 360) !== (agents[j].x < 360)) continue;
      if (!links.some((l) => (l[0] === i && l[1] === j) || (l[0] === j && l[1] === i))) {
        links.push([i, j, 1]);
      }
    }
  }
  let neighbors = buildNeighbors(NN, links);

  // choose a player: a civilian (never an incumbent, never the far cluster).
  let pi = Math.floor(sr(D.nInc || 0, NN));
  while (agents[pi].inc || (D.twoClusters && agents[pi].x >= 360)) {
    pi = (pi + 1) % NN;
    if (pi < (D.nInc || 0)) pi = D.nInc || 0;
  }
  const player = pi;
  agents[player].aw = 0.75;

  const built: Array<[number, number]> = [];

  // friends legacy: pre-wire the player to a nearby stranger and seed trust.
  if (!D.pro && has('friends')) {
    inf = 10;
    let bestJ = -1;
    let bd = 1e9;
    for (let j = 0; j < NN; j++) {
      if (j === player || agents[j].inc || neighbors[player].includes(j)) continue;
      const dd = Math.hypot(agents[j].x - agents[player].x, agents[j].y - agents[player].y);
      if (dd < bd) {
        bd = dd;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      links.push([player, bestJ, 1]);
      built.push([player, bestJ]);
      neighbors = buildNeighbors(NN, links);
    }
  }

  return {
    level: D,
    lvlIdx,
    legacy,
    rngState: rng.state(),
    agents,
    links,
    built,
    weak: [],
    murals: [],
    neighbors,
    pulseCount: 0,
    heirMul: { talk: 1, org: 1, muralTick: 1, postAdd: 0, risk: 1 },
    turn: 1,
    energy: 3,
    rig,
    floor,
    inf,
    risk: 0,
    wins: 0,
    defected: 0,
    player,
    spies,
    reinfThresholds,
    reinfPending: false,
    crackIn: -1,
    crackZone: null,
    postTrail: 0,
    docActive: false,
    shelterTurns: 0,
    shelterIdx: -1,
    boostTurns: 0,
    freeLink: false,
    lastCrackTurn: -99,
    lastWinTurn: -99,
    interrogated: false,
    witnessedOnce: false,
    lives: 0,
    opp: null,
    oppExpired: 0,
    firedDilemmas: [],
    pendingDilemma: null,
    over: false,
    won: false,
  };
}
