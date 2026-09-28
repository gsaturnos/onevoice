// Named, reproducible strategy policies used by the balance-validation test
// (test/cardgame/balance.test.ts). Each strategy is fully deterministic given
// the same seed and the same game state — no hidden randomness beyond the
// deck shuffle, which is seeded by CardGameSession itself.
import { CARDS } from './content';
import type { CardGameSession } from './engine';
import type { CardId, DilemmaChoice, NeighbourId } from './types';
import { NEIGHBOURS } from './types';

export type StrategyName = 'focus' | 'balanced' | 'combo_build' | 'naive';
export type DilemmaPolicyName = 'always_a' | 'always_b' | 'adaptive';

// Rough, fixed value estimates used ONLY to rank which affordable subset of
// the hand to play in a given Evening — not the actual card math (see engine.ts).
const VALUE_ESTIMATE: Record<CardId, number> = {
  ask_directly: 9, open_circle: 12, spread_word: 7, build_on_known: 7,
  press_point: 8, hold_space: 3, bring_together: 12, quiet_confidence: 13,
  second_thoughts: 3, think_it_over: 2, speak_your_piece: 20,
};

function pickTarget(strategy: StrategyName, session: CardGameSession, roundRobinState: { i: number }): NeighbourId {
  const u = session.state.u;
  if (strategy === 'balanced') {
    const t = NEIGHBOURS[roundRobinState.i % 3];
    roundRobinState.i += 1;
    return t;
  }
  if (strategy === 'naive') {
    // Uses the session's own seeded RNG stream so 'naive' runs stay
    // reproducible under a given seed, same as every other policy.
    return NEIGHBOURS[Math.floor(session.nextRandom() * NEIGHBOURS.length)];
  }
  if (strategy === 'combo_build') {
    // Always targets whoever is furthest behind — the difference from 'focus'
    // is in CARD choice (see estimateFor), not targeting.
    return NEIGHBOURS.slice().sort((a, b) => u[a] - u[b])[0];
  }
  // 'focus': always the neighbour furthest behind.
  return NEIGHBOURS.slice().sort((a, b) => u[a] - u[b])[0];
}

function subsets(n: number): number[][] {
  const out: number[][] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const combo: number[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) combo.push(i);
    out.push(combo);
  }
  return out;
}

/** Plays cards for one Evening using `strategy`, respecting Moments and Trust gates. */
export function playEveningWithStrategy(
  session: CardGameSession,
  strategy: StrategyName,
  rr: { i: number },
): void {
  // Leader ability first: always aim it at whoever is furthest behind.
  const behindMost = NEIGHBOURS.slice().sort((a, b) => session.state.u[a] - session.state.u[b])[0];
  session.setTheTone(behindMost);

  // combo_build values Hold Space (Trust-building) far more highly while Trust
  // is still below the Bring the Room Together / Quiet Confidence gates (40/30),
  // deliberately paying tempo now for bigger unlocked cards later.
  const estimateFor = (card: CardId): number => {
    if (strategy === 'combo_build' && card === 'hold_space' && session.state.trust < 40) {
      return 25;
    }
    if (strategy === 'combo_build' && (card === 'bring_together' || card === 'quiet_confidence')) {
      return VALUE_ESTIMATE[card] + 6;
    }
    return VALUE_ESTIMATE[card];
  };

  const hand = session.state.hand;
  let best: { combo: number[]; score: number } | null = null;
  for (const combo of subsets(hand.length)) {
    let cost = 0;
    let ok = true;
    for (const i of combo) {
      const def = CARDS[hand[i]];
      cost += def.cost;
      if (def.requiresTrust !== undefined && session.state.trust < def.requiresTrust) ok = false;
    }
    if (!ok || cost > session.state.moments) continue;
    const score = combo.reduce((s, i) => s + estimateFor(hand[i]), 0);
    if (!best || score > best.score || (score === best.score && combo.length > best.combo.length)) {
      best = { combo, score };
    }
  }
  if (!best) return;

  // Play highest-index first so earlier indexes stay valid after splice.
  const order = [...best.combo].sort((a, b) => b - a);
  for (const idx of order) {
    const card = session.state.hand[idx];
    const def = CARDS[card];
    const target = def.needsTarget ? pickTarget(strategy, session, rr) : undefined;
    session.playCard(idx, target);
  }
}

function estimate(cardId: CardId): number {
  return VALUE_ESTIMATE[cardId];
}

/** Choose one unplayed hand card to retain for next Evening (highest estimated value). */
export function chooseRetainIndex(hand: CardId[]): number[] {
  if (hand.length === 0) return [];
  let bestIdx = 0;
  for (let i = 1; i < hand.length; i++) {
    if (estimate(hand[i]) > estimate(hand[bestIdx])) bestIdx = i;
  }
  return [bestIdx];
}

export function dilemmaChoice(
  policy: DilemmaPolicyName,
  dilemmaId: string,
  session: CardGameSession,
): DilemmaChoice {
  if (policy === 'always_a') return 'A';
  if (policy === 'always_b') return 'B';
  // adaptive: state-based, documented per-dilemma heuristic
  const u = session.state.u;
  if (dilemmaId === 'rosas_numbers') {
    // Only worth the future tempo hit when Trust is still far from the 40
    // threshold that unlocks Bring the Room Together — otherwise the
    // deferred +10 to Rosa (option B) outperforms in most board states.
    return session.state.trust < 22 ? 'A' : 'B';
  }
  if (dilemmaId === 'hugos_question') {
    return u.hugo < 50 && session.state.hand.length > 2 ? 'A' : 'B';
  }
  if (dilemmaId === 'room_decides') {
    return NEIGHBOURS.every((n) => u[n] >= 55) ? 'A' : 'B';
  }
  return 'B';
}
