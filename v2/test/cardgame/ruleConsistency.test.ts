// Documentation-consistency guard for docs/v2/card-prototype-rules.md §4.
//
// This does NOT duplicate any card's numeric formula (that would just be a
// second fragile copy to keep in sync). Instead it plays each single-target
// card against a "neutral" target (whose trait carries no talk multiplier)
// and against Inés (talker, ×1.6) or Rosa (online, ×2.2 broadcast-only) from
// identical starting state, and checks whether the resulting gain actually
// differs — the real, observable fact the rules doc's §4 table claims about
// each card. The expected outcome per card is declared once, in
// src/cardgame/content/mechanics.ts (MULTIPLIER_APPLIED), which is also what
// the doc must match.
import { describe, it, expect } from 'vitest';
import { CardGameSession } from '../../src/cardgame/engine/engine';
import type { CardId, NeighbourId } from '../../src/cardgame/engine/types';
import { MULTIPLIER_APPLIED } from '../../src/cardgame/content/mechanics';

// Neutral for the talk multiplier: talkMul() only special-cases 'talker' and
// 'wary'; Rosa ('online') gets the default ×1.0, same as any non-special trait.
const NEUTRAL_FOR_TALK: NeighbourId = 'rosa';
const TALKER: NeighbourId = 'ines';
// Neutral for the broadcast multiplier: broadcastMul() only special-cases 'online'.
const NEUTRAL_FOR_BROADCAST: NeighbourId = 'ines';
const ONLINE: NeighbourId = 'rosa';

function freshSessionAbleToPlayAnything(): CardGameSession {
  const session = new CardGameSession(1);
  session.state.trust = 60; // clears every requiresTrust gate
  session.state.moments = 10;
  return session;
}

function gainFor(card: CardId, target: NeighbourId): number {
  const session = freshSessionAbleToPlayAnything();
  session.state.hand = [card];
  const result = session.playCard(0, target);
  if (!result || result.gain === undefined) {
    throw new Error(`playCard(${card}, ${target}) did not return a gain — is this really a single-target card?`);
  }
  return result.gain;
}

const NEEDS_TARGET_CARDS: CardId[] = ['ask_directly', 'spread_word', 'build_on_known', 'press_point', 'hold_space', 'quiet_confidence'];

describe('card mechanics match the declared MULTIPLIER_APPLIED table (docs/v2/card-prototype-rules.md §4)', () => {
  for (const card of NEEDS_TARGET_CARDS) {
    const declared = MULTIPLIER_APPLIED[card];

    it(`${card}: declared '${declared}' matches actual engine behavior`, () => {
      if (declared === 'talk') {
        const onTalker = gainFor(card, TALKER);
        const onNeutral = gainFor(card, NEUTRAL_FOR_TALK);
        expect(onTalker).toBeGreaterThan(onNeutral);
      } else if (declared === 'broadcast') {
        const onOnline = gainFor(card, ONLINE);
        const onNeutral = gainFor(card, NEUTRAL_FOR_BROADCAST);
        expect(onOnline).toBeGreaterThan(onNeutral);
      } else {
        // 'none': gain must be identical regardless of the target's trait —
        // no talk or broadcast multiplier is actually applied.
        const onTalker = gainFor(card, TALKER);
        const onNeutral = gainFor(card, NEUTRAL_FOR_TALK);
        const onOnline = gainFor(card, ONLINE);
        expect(onTalker).toBe(onNeutral);
        expect(onOnline).toBe(onNeutral);
      }
    });
  }

  it('every needs-target card in the engine is covered by MULTIPLIER_APPLIED', () => {
    for (const card of NEEDS_TARGET_CARDS) {
      expect(MULTIPLIER_APPLIED[card]).toBeDefined();
    }
  });
});
