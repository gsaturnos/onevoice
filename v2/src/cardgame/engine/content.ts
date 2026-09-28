import type { CardDef, CardId, Dilemma, NeighbourId } from './types';

export const STARTING_UNDERSTANDING: Record<NeighbourId, number> = {
  rosa: 18,
  ines: 15,
  hugo: 10,
};

export const STARTING_TRUST = 20;
export const CLEAR_THRESHOLD = 70;
export const LISTENING_THRESHOLD = 35;
export const TOTAL_EVENINGS = 6;
export const MOMENTS_PER_EVENING = 3;
export const HAND_SIZE = 5;

export const CARDS: Record<CardId, CardDef> = {
  ask_directly: { id: 'ask_directly', name: 'Ask Directly', cost: 1, needsTarget: true, multiplierClass: 'talk' },
  open_circle: { id: 'open_circle', name: 'Open the Circle', cost: 2, needsTarget: false, multiplierClass: 'none' },
  spread_word: { id: 'spread_word', name: 'Spread the Word', cost: 1, needsTarget: true, multiplierClass: 'broadcast' },
  build_on_known: { id: 'build_on_known', name: 'Build on What You Know', cost: 1, needsTarget: true, multiplierClass: 'talk' },
  press_point: { id: 'press_point', name: 'Press the Point', cost: 2, needsTarget: true, multiplierClass: 'talk' },
  hold_space: { id: 'hold_space', name: 'Hold Space', cost: 1, needsTarget: true, multiplierClass: 'talk' },
  bring_together: { id: 'bring_together', name: 'Bring the Room Together', cost: 2, needsTarget: false, multiplierClass: 'none', requiresTrust: 40 },
  quiet_confidence: { id: 'quiet_confidence', name: 'Quiet Confidence', cost: 1, needsTarget: true, multiplierClass: 'talk', requiresTrust: 30 },
  second_thoughts: { id: 'second_thoughts', name: 'Second Thoughts', cost: 1, needsTarget: false, multiplierClass: 'none' },
  think_it_over: { id: 'think_it_over', name: 'Think It Over', cost: 0, needsTarget: false, multiplierClass: 'none' },
  speak_your_piece: { id: 'speak_your_piece', name: 'Speak Your Piece', cost: 3, needsTarget: false, multiplierClass: 'none', exhausts: true },
};

// The exact physical starting deck: 12 cards. speak_your_piece is NOT in this
// list — it is added to the hand on Evening 3 per the rules amendment.
export const STARTING_DECK: CardId[] = [
  'ask_directly', 'ask_directly',
  'open_circle',
  'spread_word', 'spread_word',
  'build_on_known',
  'press_point',
  'hold_space',
  'bring_together',
  'quiet_confidence',
  'second_thoughts',
  'think_it_over',
];

export const DILEMMAS: Dilemma[] = [
  {
    evening: 2, id: 'rosas_numbers', name: "Rosa has the numbers.",
    optionA: 'Push forward now', optionB: 'Hold it for later',
  },
  {
    evening: 4, id: 'hugos_question', name: 'Hugo asks why nobody told him sooner.',
    optionA: 'Answer him straight', optionB: 'Let Inés smooth it over',
  },
  {
    evening: 6, id: 'room_decides', name: 'The room has to decide.',
    optionA: 'Push for a unified stand now', optionB: 'Let it rest, end calmly',
  },
];
