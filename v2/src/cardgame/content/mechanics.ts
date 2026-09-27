import type { CardId } from '../engine/types';

// The single structured declaration of which trait-based multiplier (if any)
// the engine actually applies to each card's Understanding gain. This is
// distinct from CARDS[card].multiplierClass in engine/content.ts, which only
// drives the UI's "Talk"/"Broadcast" stamp — several cards carry that stamp
// without the engine ever multiplying their gain (see engine.ts: only
// ask_directly and spread_word call talkMul/broadcastMul).
//
// docs/v2/card-prototype-rules.md §4 must match this table. It cannot be
// generated from the doc automatically, so test/cardgame/ruleConsistency.test.ts
// checks this declaration against the real engine's behavior instead — if a
// future engine change adds or removes a multiplier call without updating
// this file (and the doc), that test fails.
export const MULTIPLIER_APPLIED: Record<CardId, 'talk' | 'broadcast' | 'none'> = {
  ask_directly: 'talk',
  open_circle: 'none',
  spread_word: 'broadcast',
  build_on_known: 'none',
  press_point: 'none',
  hold_space: 'none',
  bring_together: 'none',
  quiet_confidence: 'none',
  second_thoughts: 'none',
  think_it_over: 'none',
  speak_your_piece: 'none',
};
