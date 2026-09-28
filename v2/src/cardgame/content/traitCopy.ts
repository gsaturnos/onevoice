// Trait explanations shown on each neighbour card. Every number here is
// imported from the engine, never re-typed, so this text can't drift from
// what playing a card actually does (Giorgio: "Only state effects that match
// the engine and mechanics declaration").
import {
  TALKER_MULTIPLIER, WARY_MULTIPLIER_LOW, WARY_MULTIPLIER_HIGH, WARY_TRUST_THRESHOLD, ONLINE_MULTIPLIER,
} from '../engine/engine';
import type { NeighbourId } from '../engine/types';

export const TRAIT_EXPLANATION: Record<NeighbourId, string> = {
  rosa: `Online: Spread the Word ×${ONLINE_MULTIPLIER}`,
  ines: `Talker: Ask Directly ×${TALKER_MULTIPLIER}`,
  hugo: `Wary: Ask Directly ×${WARY_MULTIPLIER_LOW} until Trust ${WARY_TRUST_THRESHOLD}; then ×${WARY_MULTIPLIER_HIGH}`,
};
