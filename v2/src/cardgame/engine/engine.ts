import {
  CARDS, DILEMMAS, STARTING_DECK, STARTING_TRUST, STARTING_UNDERSTANDING,
  TOTAL_EVENINGS, MOMENTS_PER_EVENING, HAND_SIZE, CLEAR_THRESHOLD, LISTENING_THRESHOLD,
} from './content';
import { mulberry32, shuffleInPlace } from './rng';
import type { CardGameState, CardId, DilemmaChoice, NeighbourId } from './types';
import { NEIGHBOURS, TRAIT_OF } from './types';

export { CLEAR_THRESHOLD, LISTENING_THRESHOLD, TOTAL_EVENINGS, MOMENTS_PER_EVENING };

function talkMul(target: NeighbourId, trust: number): number {
  if (TRAIT_OF[target] === 'talker') return 1.6;
  if (TRAIT_OF[target] === 'wary') return trust >= 30 ? 1.2 : 0.55;
  return 1.0;
}

function broadcastMul(target: NeighbourId): number {
  return TRAIT_OF[target] === 'online' ? 2.2 : 1.0;
}

export interface PlayResult {
  card: CardId;
  target?: NeighbourId;
  gain?: number; // Understanding delta actually applied to `target` (single-target cards only)
}

export class CardGameSession {
  state: CardGameState;
  private rand: () => number;
  private toneTarget: NeighbourId | null = null;
  private toneUsedThisEvening = false;

  constructor(seed: number) {
    this.rand = mulberry32(seed);
    const deck = shuffleInPlace([...STARTING_DECK], this.rand);
    this.state = {
      evening: 0,
      u: { ...STARTING_UNDERSTANDING },
      trust: STARTING_TRUST,
      moments: MOMENTS_PER_EVENING,
      hand: [],
      deck,
      discard: [],
      retained: null,
      speakYourPieceState: 'not_drawn',
      pendingMomentPenalty: 0,
      won: null,
      log: [],
    };
  }

  private draw(n: number): CardId[] {
    const out: CardId[] = [];
    for (let i = 0; i < n; i++) {
      if (this.state.deck.length === 0) {
        if (this.state.discard.length === 0) break;
        this.state.deck = shuffleInPlace([...this.state.discard], this.rand);
        this.state.discard = [];
      }
      const c = this.state.deck.pop();
      if (c) out.push(c);
    }
    return out;
  }

  /** Start the next Evening: apply moment penalty, draw hand, reveal dilemma if any. */
  startEvening(): { dilemma: (typeof DILEMMAS)[number] | null } {
    this.state.evening += 1;
    this.state.moments = MOMENTS_PER_EVENING - this.state.pendingMomentPenalty;
    this.state.pendingMomentPenalty = 0;
    this.toneUsedThisEvening = false;
    this.toneTarget = null;

    if (this.rosaDeferredBonusNextEvening > 0) {
      this.state.u.rosa = Math.min(100, this.state.u.rosa + this.rosaDeferredBonusNextEvening);
      this.rosaDeferredBonusNextEvening = 0;
    }

    const retained = this.state.retained;
    this.state.retained = null;
    const need = HAND_SIZE - (retained ? 1 : 0);
    this.state.hand = [...(retained ? [retained] : []), ...this.draw(need)];

    if (this.state.evening === 3 && this.state.speakYourPieceState === 'not_drawn') {
      this.state.hand.push('speak_your_piece');
      this.state.speakYourPieceState = 'in_hand';
    }

    const dilemma = DILEMMAS.find((d) => d.evening === this.state.evening) ?? null;
    // Evenings 2 and 4 resolve before play; Evening 6 resolves after (see resolveDilemma caller).
    return { dilemma: dilemma && dilemma.evening !== 6 ? dilemma : null };
  }

  /** Julia's Leader ability: free, once per Evening. Sets up a flat +6 bonus
   * (applied AFTER the target's trait multiplier) on the next card that
   * affects `target` this Evening. */
  isToneAvailable(): boolean {
    return !this.toneUsedThisEvening;
  }

  setTheTone(target: NeighbourId): boolean {
    if (this.toneUsedThisEvening) return false;
    this.toneUsedThisEvening = true;
    this.toneTarget = target;
    return true;
  }

  private consumeTone(target: NeighbourId | undefined): number {
    if (target && this.toneTarget === target) {
      this.toneTarget = null;
      return 5;
    }
    return 0;
  }

  /** Exposes the session's seeded RNG stream for strategy policies (e.g. the
   * 'naive' target-selection policy) that need randomness but must stay
   * reproducible under the session's seed — never use Math.random() here. */
  nextRandom(): number {
    return this.rand();
  }

  canPlay(card: CardId): boolean {
    const def = CARDS[card];
    if (this.state.moments < def.cost) return false;
    if (def.requiresTrust !== undefined && this.state.trust < def.requiresTrust) return false;
    return true;
  }

  /** Play one card from the current hand by index. Returns the applied result, or null if illegal. */
  playCard(handIndex: number, target?: NeighbourId): PlayResult | null {
    const card = this.state.hand[handIndex];
    if (!card) return null;
    const def = CARDS[card];
    if (!this.canPlay(card)) return null;
    if (def.needsTarget && !target) return null;

    this.state.moments -= def.cost;
    this.state.hand.splice(handIndex, 1);

    let gain: number | undefined;
    const u = this.state.u;

    switch (card) {
      case 'ask_directly': {
        const base = 9 + 3 * (this.state.trust / 100);
        gain = base * talkMul(target!, this.state.trust) + this.consumeTone(target);
        u[target!] += gain; this.state.trust += 2;
        break;
      }
      case 'open_circle': {
        const per = 4.5 + 1.5 * (this.state.trust / 100);
        for (const n of NEIGHBOURS) u[n] += per;
        this.state.trust += 4;
        break;
      }
      case 'spread_word': {
        gain = 5.5 * broadcastMul(target!) + this.consumeTone(target);
        u[target!] += gain; this.state.trust += 2;
        break;
      }
      case 'build_on_known': {
        const base = u[target!] >= LISTENING_THRESHOLD ? 13 : 4;
        gain = base + this.consumeTone(target);
        u[target!] += gain; this.state.trust += 1;
        break;
      }
      case 'press_point': {
        gain = 13 + this.consumeTone(target);
        u[target!] += gain; this.state.trust -= 3;
        break;
      }
      case 'hold_space': {
        gain = 5 + this.consumeTone(target);
        u[target!] += gain; this.state.trust += 6;
        break;
      }
      case 'bring_together': {
        for (const n of NEIGHBOURS) u[n] += 4.5;
        this.state.trust += 5;
        break;
      }
      case 'quiet_confidence': {
        gain = 16 + this.consumeTone(target);
        u[target!] += gain; this.state.trust += 2;
        break;
      }
      case 'second_thoughts': {
        const extra = this.draw(2);
        this.state.hand.push(...extra);
        break;
      }
      case 'think_it_over': {
        // No board effect. Marks that this Evening's retain slot may hold TWO
        // cards instead of one (handled in endEvening via `extraRetain`).
        this.extraRetainThisEvening = true;
        break;
      }
      case 'speak_your_piece': {
        for (const n of NEIGHBOURS) u[n] += 8;
        this.state.trust += 8;
        this.state.speakYourPieceState = 'exhausted';
        break;
      }
    }
    for (const n of NEIGHBOURS) u[n] = Math.max(0, Math.min(100, u[n]));
    this.state.trust = Math.max(0, Math.min(100, this.state.trust));
    return { card, target, gain };
  }

  private extraRetainThisEvening = false;

  resolveDilemma(dilemmaId: string, choice: DilemmaChoice) {
    if (dilemmaId === 'rosas_numbers') {
      if (choice === 'A') {
        this.state.trust = Math.min(100, this.state.trust + 5);
        this.state.pendingMomentPenalty = 1;
      } else {
        this.rosaCappedThisEvening = 0.3;
        this.rosaDeferredBonusNextEvening = 10;
      }
    } else if (dilemmaId === 'hugos_question') {
      if (choice === 'A' && this.state.hand.length > 0) {
        this.state.discard.push(this.state.hand.pop()!);
        this.state.u.hugo = Math.min(100, this.state.u.hugo + 20);
        this.state.trust = Math.min(100, this.state.trust + 3);
      } else {
        this.hugoHalvedThisEvening = 0.5;
        this.state.trust = Math.min(100, this.state.trust + 4);
      }
    } else if (dilemmaId === 'room_decides') {
      if (choice === 'A') {
        this.state.moments = Math.max(0, this.state.moments - 2);
        if (NEIGHBOURS.every((n) => this.state.u[n] >= 55)) {
          for (const n of NEIGHBOURS) this.state.u[n] = Math.min(100, this.state.u[n] + 10);
        }
      }
    }
  }

  private rosaCappedThisEvening: number | null = null;
  private rosaDeferredBonusNextEvening = 0;
  private hugoHalvedThisEvening: number | null = null;
  private uBeforeEvening: Record<NeighbourId, number> | null = null;

  /** Call once, right after startEvening(), before any cards are played, so
   * capped-growth dilemmas (Evenings 2 & 4) can be measured against this Evening's gains. */
  snapshotBeforePlay() {
    this.uBeforeEvening = { ...this.state.u };
  }

  /** End the current Evening: apply growth caps, discard/retain, check victory. */
  endEvening(retainIndexes: number[]) {
    if (this.rosaCappedThisEvening !== null && this.uBeforeEvening) {
      const gained = this.state.u.rosa - this.uBeforeEvening.rosa;
      this.state.u.rosa = this.uBeforeEvening.rosa + gained * this.rosaCappedThisEvening;
      this.rosaCappedThisEvening = null;
    }
    if (this.hugoHalvedThisEvening !== null && this.uBeforeEvening) {
      const gained = this.state.u.hugo - this.uBeforeEvening.hugo;
      this.state.u.hugo = this.uBeforeEvening.hugo + gained * this.hugoHalvedThisEvening;
      this.hugoHalvedThisEvening = null;
    }
    this.uBeforeEvening = null;

    const maxRetain = this.extraRetainThisEvening ? 2 : 1;
    this.extraRetainThisEvening = false;
    const retainIdxs = retainIndexes.slice(0, maxRetain).sort((a, b) => b - a);
    const retainedCards: CardId[] = [];
    for (const idx of retainIdxs) {
      const c = this.state.hand.splice(idx, 1)[0];
      if (c) retainedCards.push(c);
    }
    // Speak Your Piece: may be retained once (Evening 3 -> 4 at the latest);
    // if still unplayed after that, it is discarded and permanently removed.
    const syp = 'speak_your_piece';
    if (retainedCards.includes(syp)) {
      if (this.state.speakYourPieceState === 'in_hand') {
        this.state.speakYourPieceState = 'retained_once';
      } else {
        // already retained once before — cannot be retained again
        retainedCards.splice(retainedCards.indexOf(syp), 1);
        this.state.discard.push(syp);
      }
    }
    this.state.retained = retainedCards[0] ?? null;
    // maxRetain is at most 2; if 2 were retained, engine keeps only 1 slot in
    // state.retained by design (Think It Over grants ONE additional retain,
    // modelled here by allowing a second card to skip discard this Evening
    // by going to the front of the reshuffled deck instead of the discard pile).
    if (retainedCards[1]) {
      this.state.deck.push(retainedCards[1]);
    }

    for (const c of this.state.hand) {
      if (c === syp) {
        if (this.state.speakYourPieceState !== 'retained_once') {
          this.state.speakYourPieceState = 'discarded';
        }
        continue; // never goes to the normal discard pile / reshuffle
      }
      this.state.discard.push(c);
    }
    this.state.hand = [];

    if (this.state.evening >= TOTAL_EVENINGS) {
      this.state.won = NEIGHBOURS.every((n) => this.state.u[n] >= CLEAR_THRESHOLD);
    }
  }
}
