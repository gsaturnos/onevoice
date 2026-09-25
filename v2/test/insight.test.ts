// Insight tests: previews and turn-diffs feed the HUD's influence preview, the
// "what changed" summary, and the propagation/cascade animations. They must match
// the authoritative reducer exactly (a preview IS the reducer on a copy) and never
// mutate the input. These guard the numbers the player is shown before acting.

import { describe, it, expect } from 'vitest';
import { createGame } from '../src/core/state';
import { applyAction } from '../src/core/simulation';
import { talkableTargets } from '../src/core/selectors';
import { previewTalk, awarenessDelta, newlyClear, propagationFlows, clearThreshold } from '../src/core/insight';
import type { GameState } from '../src/core/types';

describe('insight — talk preview', () => {
  const s = createGame(0);
  const target = talkableTargets(s)[0];

  it('matches the reducer and never mutates the input', () => {
    const before = structuredClone(s);
    const pv = previewTalk(s, target);
    const committed = applyAction(s, { kind: 'talk', target });
    expect(pv.after).toBeCloseTo(committed.agents[target].aw, 12);
    expect(pv.before).toBeCloseTo(s.agents[target].aw, 12);
    expect(pv.delta).toBeGreaterThan(0);
    // input untouched
    expect(s).toEqual(before);
  });

  it('flags a talk that lifts the target across the clarity threshold', () => {
    const th = clearThreshold(s);
    const pv = previewTalk(s, target);
    expect(pv.willClear).toBe(pv.before < th && pv.after >= th);
  });

  it('lists only civil carriers who could receive the awareness onward', () => {
    const pv = previewTalk(s, target);
    for (const j of pv.carriers) {
      expect(j).not.toBe(s.player);
      expect(s.agents[j].inc).toBe(false);
      expect(s.agents[j].gone).toBe(false);
    }
  });
});

describe('insight — turn diffs', () => {
  const s = createGame(0);

  it('awarenessDelta reports per-agent change between snapshots', () => {
    const target = talkableTargets(s)[0];
    const next = applyAction(s, { kind: 'talk', target });
    const d = awarenessDelta(s, next);
    expect(d.length).toBe(s.agents.length);
    expect(d[target]).toBeGreaterThan(0);
  });

  it('newlyClear only reports civilians crossing the threshold', () => {
    const th = clearThreshold(s);
    const c: GameState = structuredClone(s);
    const civ = c.agents.findIndex((a, i) => i !== c.player && !a.inc);
    c.agents[civ].aw = th - 0.1;
    const next: GameState = structuredClone(c);
    next.agents[civ].aw = th + 0.1;
    expect(newlyClear(c, next)).toContain(civ);
    // player never counts
    expect(newlyClear(c, next)).not.toContain(c.player);
  });

  it('propagationFlows point from the more-aware source to the gainer', () => {
    // one talk then an end-turn should produce overnight flows out of the target
    const target = talkableTargets(s)[0];
    const afterTalk = applyAction(s, { kind: 'talk', target });
    const afterTurn = applyAction(afterTalk, { kind: 'endTurn' });
    const flows = propagationFlows(afterTalk, afterTurn);
    for (const f of flows) {
      expect(afterTalk.agents[f.from].aw).toBeGreaterThanOrEqual(afterTalk.agents[f.to].aw);
      expect(f.amount).toBeGreaterThan(0);
    }
  });
});
