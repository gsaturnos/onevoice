// Renderer view-model tests: the seating layout and environmental phase are pure
// functions of a snapshot, so they can be checked without a canvas. These guard
// the composition (everyone gets a distinct seat, the player sits front-centre)
// and the silent → awakening → acting progression the scene is built around.

import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/state';
import { buildScene, orderAroundPlayer, envState, nearReady, objectiveNeed, STAGE_W, STAGE_H } from '../src/render/scene';
import { clearThreshold } from '../src/core/insight';
import type { GameState } from '../src/core/types';

function raise(s: GameState, idxs: number[], to: number): GameState {
  const c: GameState = structuredClone(s);
  for (const i of idxs) c.agents[i].aw = to;
  return c;
}

/** civilians (not player) ordered by seat, to pick real targets to raise */
function civilians(s: GameState): number[] {
  return s.agents.map((_, i) => i).filter((i) => i !== s.player && !s.agents[i].inc && !s.agents[i].gone);
}

describe('scene view-model — kitchen table layout', () => {
  const s = createGame(0);

  it('seats every civilian exactly once, the player at the front-centre seat', () => {
    const scene = buildScene(s);
    expect(scene.agents.length).toBe(s.agents.length); // level 0 has no incumbents
    const player = scene.agents.find((a) => a.isPlayer)!;
    expect(player.seat).toBe(0);
    expect(player.depth).toBeGreaterThan(0.9); // nearest the viewer
    const idxs = new Set(scene.agents.map((a) => a.idx));
    expect(idxs.size).toBe(scene.agents.length);
    const seats = new Set(scene.agents.map((a) => a.seat));
    expect(seats.size).toBe(scene.agents.length);
  });

  it('places everyone inside the stage with sane depth/scale', () => {
    for (const a of buildScene(s).agents) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(STAGE_W);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(STAGE_H);
      expect(a.depth).toBeGreaterThanOrEqual(0);
      expect(a.depth).toBeLessThanOrEqual(1);
      expect(a.scale).toBeGreaterThan(0.6);
      expect(a.scale).toBeLessThan(1.4);
    }
  });

  it('orders from the player through the link graph, player first, all reached', () => {
    const order = orderAroundPlayer(s);
    expect(order[0]).toBe(s.player);
    expect(new Set(order).size).toBe(order.length);
    expect(order.length).toBe(civilians(s).length + 1);
  });
});

describe('scene view-model — environmental phase', () => {
  const s = createGame(0);
  const need = objectiveNeed(s);
  const th = clearThreshold(s);

  it('a fresh evening reads as silent', () => {
    expect(envState(s).phase).toBe('silent');
  });

  it('some awareness moves it to awakening', () => {
    const civ = civilians(s);
    const woken = raise(s, civ.slice(0, 1), th + 0.05);
    expect(envState(woken).phase).toBe('awakening');
  });

  it('reaching the objective count reads as acting together', () => {
    const civ = civilians(s);
    const acting = raise(s, civ.slice(0, need), th + 0.1);
    expect(envState(acting).phase).toBe('acting');
    expect(envState(acting).t).toBeGreaterThan(0.3);
  });

  it('nearReady flags civilians just below the clarity threshold', () => {
    const civ = civilians(s);
    const near = raise(s, [civ[0]], th - 0.05);
    expect(nearReady(near)).toContain(civ[0]);
    const clear = raise(s, [civ[0]], th + 0.05);
    expect(nearReady(clear)).not.toContain(civ[0]);
  });
});
