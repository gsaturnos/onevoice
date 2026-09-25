// createGame: build an initial GameState. A faithful, minimal port of the
// production initGame/mkPerson for the validation slice (talk + diffusion).
// Pure given (level, seed): identical inputs → identical state.

import { makeRng, type Rng } from './rng';
import type { Agent, GameState, LevelDef, Link } from './types';
import { NAMES, ROLES, STAKES, TRAITS } from '@content/people';

function makePerson(idx: number, lvlIdx: number, x: number, y: number, rng: Rng): Agent {
  const nm = NAMES[(lvlIdx * 17 + idx * 3) % NAMES.length];
  const role = ROLES[(lvlIdx * 7 + idx * 5) % ROLES.length];
  const stake = STAKES[(lvlIdx * 11 + idx * 13) % STAKES.length];
  const trait = TRAITS[Math.floor(rng.next() * TRAITS.length)];
  return { x, y, aw: rng.range(0.05, 0.18), inc: false, gone: false, nm, role, stake, trait, met: false };
}

function buildNeighbors(n: number, links: Link[]): number[][] {
  const nbr: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of links) {
    nbr[a].push(b);
    nbr[b].push(a);
  }
  return nbr;
}

export function createGame(level: LevelDef, seed: number, lvlIdx = 0): GameState {
  const rng = makeRng(seed);
  const n = level.n;
  const W = 720;
  const H = 440;

  const agents: Agent[] = [];
  for (let i = 0; i < n; i++) {
    agents.push(makePerson(i, lvlIdx, rng.range(30, W - 30), rng.range(30, H - 30), rng));
  }

  // k-nearest links (k=4), mirroring production's distance-based connection.
  const links: Link[] = [];
  for (let i = 0; i < n; i++) {
    const d: Array<[number, number]> = [];
    for (let j = 0; j < n; j++) {
      if (i !== j) d.push([j, Math.hypot(agents[i].x - agents[j].x, agents[i].y - agents[j].y)]);
    }
    d.sort((p, q) => p[1] - q[1]);
    for (let k = 0; k < Math.min(4, n - 1); k++) {
      const j = d[k][0];
      if (!links.some((l) => (l[0] === i && l[1] === j) || (l[0] === j && l[1] === i))) {
        links.push([i, j, 1]);
      }
    }
  }

  // choose a player and wake them a little
  const player = Math.floor(rng.range(0, n));
  agents[player].aw = 0.75;

  return {
    level,
    seed,
    rngState: rng.state(),
    agents,
    links,
    neighbors: buildNeighbors(n, links),
    turn: 1,
    energy: 3,
    rig: level.rig,
    inf: 0,
    player,
    over: false,
    won: false,
  };
}
