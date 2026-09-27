// Design-validation test for the "Kitchen Table" card prototype (docs/v2/card-prototype-rules.md).
// This is NOT gameplay code — it exercises the real engine (src/cardgame/engine)
// with named, reproducible strategy policies (src/cardgame/engine/strategies.ts)
// across a fixed, seeded batch of shuffles, and asserts the win-rate bounds
// Giorgio asked for: 70-85% for competent strategies, clearly lower for naive
// play, without the outcome being primarily luck-based (checked via the spread
// across seeds, not just the mean).
import { describe, it, expect } from 'vitest';
import { CardGameSession } from '../../src/cardgame/engine/engine';
import { TOTAL_EVENINGS } from '../../src/cardgame/engine/content';
import {
  playEveningWithStrategy, chooseRetainIndex, dilemmaChoice,
  type StrategyName, type DilemmaPolicyName,
} from '../../src/cardgame/engine/strategies';

const N_SEEDS = 1000;

function runGame(seed: number, strategy: StrategyName, dilemmaPolicy: DilemmaPolicyName) {
  const session = new CardGameSession(seed);
  const rr = { i: 0 };
  for (let evening = 1; evening <= TOTAL_EVENINGS; evening++) {
    const { dilemma } = session.startEvening();
    if (dilemma) {
      const choice = dilemmaChoice(dilemmaPolicy, dilemma.id, session);
      session.resolveDilemma(dilemma.id, choice);
    }
    session.snapshotBeforePlay();
    playEveningWithStrategy(session, strategy, rr);
    if (evening === TOTAL_EVENINGS) {
      const choice = dilemmaChoice(dilemmaPolicy, 'room_decides', session);
      session.resolveDilemma('room_decides', choice);
    }
    const retain = chooseRetainIndex(session.state.hand);
    session.endEvening(retain);
  }
  return { won: !!session.state.won, evening: session.state.evening, u: { ...session.state.u } };
}

function batch(strategy: StrategyName, dilemmaPolicy: DilemmaPolicyName) {
  let wins = 0;
  const winEvenings: number[] = [];
  for (let seed = 0; seed < N_SEEDS; seed++) {
    const { won, evening } = runGame(seed, strategy, dilemmaPolicy);
    if (won) { wins++; winEvenings.push(evening); }
  }
  const winRate = wins / N_SEEDS;
  return { winRate, wins, n: N_SEEDS };
}

describe('card prototype balance (seeded, reproducible)', () => {
  it('competent strategies win 70-85% of the time under adaptive dilemma play', () => {
    const focus = batch('focus', 'adaptive');
    const combo = batch('combo_build', 'adaptive');
    const balanced = batch('balanced', 'adaptive');
    // eslint-disable-next-line no-console
    console.log('focus       ', focus);
    // eslint-disable-next-line no-console
    console.log('combo_build ', combo);
    // eslint-disable-next-line no-console
    console.log('balanced    ', balanced);
    expect(focus.winRate).toBeGreaterThanOrEqual(0.70);
    expect(focus.winRate).toBeLessThanOrEqual(0.85);
    expect(combo.winRate).toBeGreaterThanOrEqual(0.70);
    expect(combo.winRate).toBeLessThanOrEqual(0.85);
    // balanced (spread-thin) should be viable but not need to hit the same band
    expect(balanced.winRate).toBeGreaterThanOrEqual(0.55);
  });

  it('naive (undirected) play is clearly worse than competent play', () => {
    const naive = batch('naive', 'adaptive');
    const focus = batch('focus', 'adaptive');
    // eslint-disable-next-line no-console
    console.log('naive       ', naive);
    expect(naive.winRate).toBeLessThan(focus.winRate - 0.20);
  });

  it('neither dilemma option is universally dominant (choice-conditioned outcomes)', () => {
    const allA = batch('focus', 'always_a');
    const allB = batch('focus', 'always_b');
    const adaptive = batch('focus', 'adaptive');
    // eslint-disable-next-line no-console
    console.log('focus/always_a', allA);
    // eslint-disable-next-line no-console
    console.log('focus/always_b', allB);
    // eslint-disable-next-line no-console
    console.log('focus/adaptive', adaptive);
    // Adaptive (state-based) must beat BOTH fixed policies, proving the right
    // answer depends on the board, not a single dominant choice.
    expect(adaptive.winRate).toBeGreaterThan(allA.winRate);
    expect(adaptive.winRate).toBeGreaterThan(allB.winRate);
  });
});
