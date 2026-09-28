import type { CardId } from '../engine/types';

// Display-only grouping for the Review the Meeting panel's "cards played by
// category" breakdown (onboarding-and-outcomes.md). Purely presentational —
// derived from, but not read by, the engine; changing it cannot affect any
// game number.
export type CardCategory = 'Talk-style' | 'Online' | 'Group' | 'Utility';

export const CARD_CATEGORY: Record<CardId, CardCategory> = {
  ask_directly: 'Talk-style',
  build_on_known: 'Talk-style',
  press_point: 'Talk-style',
  hold_space: 'Talk-style',
  quiet_confidence: 'Talk-style',
  spread_word: 'Online',
  open_circle: 'Group',
  bring_together: 'Group',
  speak_your_piece: 'Group',
  second_thoughts: 'Utility',
  think_it_over: 'Utility',
};

export const CARD_CATEGORIES: CardCategory[] = ['Talk-style', 'Online', 'Group', 'Utility'];
