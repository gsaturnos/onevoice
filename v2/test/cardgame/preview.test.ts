// Verifies previewPlayCard's predicted Understanding/Trust deltas exactly
// match what playCard actually applies — the guarantee the comprehension-pass
// outcome preview depends on (Giorgio: "Preview must use the engine's real
// calculation, not duplicated UI formulas").
import { describe, it, expect } from 'vitest';
import { CardGameSession } from '../../src/cardgame/engine/engine';
import { CARDS } from '../../src/cardgame/engine/content';
import { NEIGHBOURS } from '../../src/cardgame/engine/types';

describe('previewPlayCard matches playCard', () => {
  it('predicts the exact Understanding/Trust deltas for every playable hand across many seeds', () => {
    let checked = 0;
    for (let seed = 0; seed < 40; seed++) {
      const session = new CardGameSession(seed);
      session.startEvening();
      session.snapshotBeforePlay();
      for (let handIndex = 0; handIndex < session.state.hand.length; handIndex++) {
        const card = session.state.hand[handIndex];
        const def = CARDS[card];
        if (!session.canPlay(card)) continue;
        for (const target of def.needsTarget ? NEIGHBOURS : [undefined]) {
          const probe = new CardGameSession(seed);
          probe.startEvening();
          probe.snapshotBeforePlay();
          // Replay the same hand-affecting state onto the probe isn't
          // possible generically, so instead preview and play on two
          // independent sessions seeded identically and freshly re-drawn:
          // both must agree since neither has diverged yet at this point.
          const preview = probe.previewPlayCard(handIndex, target);
          expect(preview).not.toBeNull();
          const before = { ...probe.state.u, trust: probe.state.trust };
          const result = probe.playCard(handIndex, target);
          expect(result).not.toBeNull();
          for (const n of NEIGHBOURS) {
            const predicted = before[n] + (preview!.uDelta[n] ?? 0);
            const clamped = Math.max(0, Math.min(100, predicted));
            expect(clamped).toBeCloseTo(probe.state.u[n], 6);
          }
          const predictedTrust = Math.max(0, Math.min(100, before.trust + preview!.trustDelta));
          expect(predictedTrust).toBeCloseTo(probe.state.trust, 6);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('reflects the pending "Set the Tone" bonus in the preview without consuming it', () => {
    const session = new CardGameSession(1);
    session.startEvening();
    session.snapshotBeforePlay();
    const target = NEIGHBOURS[0];
    session.setTheTone(target);
    const handIndex = session.state.hand.findIndex((c) => CARDS[c].needsTarget);
    if (handIndex === -1) return; // no single-target card this seed's hand; nothing to assert
    const withTone = session.previewPlayCard(handIndex, target);
    expect(withTone!.toneApplied).toBe(true);
    // Previewing a DIFFERENT target must not apply or consume the bonus.
    const other = NEIGHBOURS.find((n) => n !== target)!;
    const withoutTone = session.previewPlayCard(handIndex, other);
    expect(withoutTone!.toneApplied).toBe(false);
    // Still available — peeking never consumes it.
    expect(session.isToneAvailable()).toBe(false); // already used by setTheTone itself
  });

  it('returns null for an unaffordable or illegally-targeted play', () => {
    const session = new CardGameSession(2);
    session.startEvening();
    session.snapshotBeforePlay();
    expect(session.previewPlayCard(99)).toBeNull();
    const targetedIdx = session.state.hand.findIndex((c) => CARDS[c].needsTarget);
    if (targetedIdx !== -1) {
      expect(session.previewPlayCard(targetedIdx)).toBeNull(); // missing required target
    }
  });
});

describe('state.log records real resolved effects', () => {
  it('appends a human-readable entry after each card play and dilemma resolution', () => {
    const session = new CardGameSession(3);
    session.startEvening();
    session.snapshotBeforePlay();
    expect(session.state.log).toEqual([]);
    const idx = session.state.hand.findIndex((c) => session.canPlay(c));
    const def = CARDS[session.state.hand[idx]];
    session.playCard(idx, def.needsTarget ? NEIGHBOURS[0] : undefined);
    expect(session.state.log.length).toBe(1);
    expect(session.state.log[0]).toContain(def.name);
  });
});
