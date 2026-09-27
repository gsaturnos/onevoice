// Pure card-game engine for the "Kitchen Table" card prototype.
// No DOM, no Pixi, no core/ dependency — an isolated vertical slice.
// See docs/v2/card-prototype-rules.md for the full rules text this implements.

export type NeighbourId = 'rosa' | 'ines' | 'hugo';

export const NEIGHBOURS: NeighbourId[] = ['rosa', 'ines', 'hugo'];

export type Trait = 'talker' | 'online' | 'wary';

export const TRAIT_OF: Record<NeighbourId, Trait> = {
  rosa: 'online',
  ines: 'talker',
  hugo: 'wary',
};

export type MultiplierClass = 'talk' | 'broadcast' | 'none';

export type CardId =
  | 'ask_directly'
  | 'open_circle'
  | 'spread_word'
  | 'build_on_known'
  | 'press_point'
  | 'hold_space'
  | 'bring_together'
  | 'quiet_confidence'
  | 'second_thoughts'
  | 'think_it_over'
  | 'speak_your_piece';

export interface CardDef {
  id: CardId;
  name: string;
  cost: number;
  needsTarget: boolean;
  multiplierClass: MultiplierClass;
  requiresTrust?: number;
  exhausts?: boolean;
}

export type DilemmaChoice = 'A' | 'B';

export interface Dilemma {
  evening: number;
  id: string;
  name: string;
  optionA: string;
  optionB: string;
}

export interface CardGameState {
  evening: number;
  u: Record<NeighbourId, number>;
  trust: number;
  moments: number;
  hand: CardId[];
  deck: CardId[];
  discard: CardId[];
  retained: CardId | null;
  speakYourPieceState: 'not_drawn' | 'in_hand' | 'retained_once' | 'exhausted' | 'discarded';
  pendingMomentPenalty: number;
  won: boolean | null; // null until evening 6 resolves
  log: string[];
}
