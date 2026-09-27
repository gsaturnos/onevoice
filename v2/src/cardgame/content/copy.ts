import type { CardId, NeighbourId } from '../engine/types';

export const NEIGHBOUR_COPY: Record<NeighbourId, { name: string; role: string; trait: string; initial: string }> = {
  rosa: { name: 'Rosa', role: 'the nurse', trait: 'Online', initial: 'R' },
  ines: { name: 'Inés', role: 'the shopkeeper', trait: 'Talker', initial: 'I' },
  hugo: { name: 'Hugo', role: 'the bus driver', trait: 'Wary', initial: 'H' },
};

export const CARD_FLAVOR: Record<CardId, string> = {
  ask_directly: 'Sit down with them, one on one.',
  open_circle: 'Bring the whole table into it at once.',
  spread_word: 'Let it travel beyond this room.',
  build_on_known: "Pick up where they're already listening.",
  press_point: 'Push, even if it costs some goodwill.',
  hold_space: 'Just listen. Trust grows slowly.',
  bring_together: 'The room is ready to move as one.',
  quiet_confidence: 'Say the thing plainly, and mean it.',
  second_thoughts: 'Think it through before you commit.',
  think_it_over: 'Hold onto what you meant to say.',
  speak_your_piece: 'The moment the whole evening was for.',
};

export const DILEMMA_COPY: Record<string, { title: string; body: string; a: string; b: string }> = {
  rosas_numbers: {
    title: "Rosa has the numbers.",
    body: 'She wants to read the real consequences of the closure aloud, tonight.',
    a: 'Push forward now — Trust +5, but tomorrow starts with only 2 Moments.',
    b: "Hold it for later — Rosa's growth is cut tonight, but she gets a certain +10 tomorrow.",
  },
  hugos_question: {
    title: 'Hugo asks why nobody told him sooner.',
    body: "He's not backing down from the question.",
    a: 'Answer him straight — discard a card, Hugo +20 Understanding, Trust +3.',
    b: "Let Inés smooth it over — Hugo's growth is halved tonight, Trust +4.",
  },
  room_decides: {
    title: 'The room has to decide.',
    body: 'Last evening, last chance.',
    a: 'Push for a unified stand — spend 2 Moments now; if everyone is already at 55+, +10 to all.',
    b: 'Let it rest, end calmly — no cost, no bonus.',
  },
};
