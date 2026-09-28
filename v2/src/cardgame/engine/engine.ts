import {
  CARDS, DILEMMAS, STARTING_DECK, STARTING_TRUST, STARTING_UNDERSTANDING,
  TOTAL_EVENINGS, MOMENTS_PER_EVENING, HAND_SIZE, CLEAR_THRESHOLD, LISTENING_THRESHOLD,
} from './content';
import { mulberry32, shuffleInPlace } from './rng';
import type { CardGameState, CardId, DilemmaChoice, NeighbourId } from './types';
import { NEIGHBOURS, TRAIT_OF } from './types';

export { CLEAR_THRESHOLD, LISTENING_THRESHOLD, TOTAL_EVENINGS, MOMENTS_PER_EVENING };

// Named so the UI can state exactly what the engine will do (trait
// explanations, outcome previews) without hand-copying these numbers.
export const TALKER_MULTIPLIER = 1.6;
export const WARY_MULTIPLIER_LOW = 0.55;
export const WARY_MULTIPLIER_HIGH = 1.2;
export const WARY_TRUST_THRESHOLD = 30;
export const ONLINE_MULTIPLIER = 2.2;
export const TONE_BONUS = 5;

function talkMul(target: NeighbourId, trust: number): number {
  if (TRAIT_OF[target] === 'talker') return TALKER_MULTIPLIER;
  if (TRAIT_OF[target] === 'wary') return trust >= WARY_TRUST_THRESHOLD ? WARY_MULTIPLIER_HIGH : WARY_MULTIPLIER_LOW;
  return 1.0;
}

function broadcastMul(target: NeighbourId): number {
  return TRAIT_OF[target] === 'online' ? ONLINE_MULTIPLIER : 1.0;
}

export interface PlayResult {
  card: CardId;
  target?: NeighbourId;
  gain?: number; // Understanding delta actually applied to `target` (single-target cards only)
}

/** The Understanding/Trust delta a card would apply, computed by the exact
 * same math `playCard` uses — shared so a pre-play preview can never drift
 * from what actually happens on play. Pure: takes/returns plain values, never
 * touches session state. `toneBonus` is `TONE_BONUS` when the leader's "Set
 * the Tone" bonus would apply to `target`, else 0. */
function computeCardEffect(
  card: CardId,
  target: NeighbourId | undefined,
  trust: number,
  u: Record<NeighbourId, number>,
  toneBonus: number,
): { uDelta: Partial<Record<NeighbourId, number>>; trustDelta: number; gain?: number } {
  switch (card) {
    case 'ask_directly': {
      const base = 9 + 3 * (trust / 100);
      const gain = base * talkMul(target!, trust) + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: 2, gain };
    }
    case 'open_circle': {
      const per = 4.5 + 1.5 * (trust / 100);
      return { uDelta: { rosa: per, ines: per, hugo: per }, trustDelta: 4 };
    }
    case 'spread_word': {
      const gain = 5.5 * broadcastMul(target!) + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: 2, gain };
    }
    case 'build_on_known': {
      const base = u[target!] >= LISTENING_THRESHOLD ? 13 : 4;
      const gain = base + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: 1, gain };
    }
    case 'press_point': {
      const gain = 13 + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: -3, gain };
    }
    case 'hold_space': {
      const gain = 5 + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: 6, gain };
    }
    case 'bring_together':
      return { uDelta: { rosa: 4.5, ines: 4.5, hugo: 4.5 }, trustDelta: 5 };
    case 'quiet_confidence': {
      const gain = 16 + toneBonus;
      return { uDelta: { [target!]: gain }, trustDelta: 2, gain };
    }
    case 'speak_your_piece':
      return { uDelta: { rosa: 8, ines: 8, hugo: 8 }, trustDelta: 8 };
    case 'second_thoughts':
    case 'think_it_over':
      return { uDelta: {}, trustDelta: 0 };
  }
}

const NEIGHBOUR_LABEL: Record<NeighbourId, string> = { rosa: 'Rosa', ines: 'Inés', hugo: 'Hugo' };

function bandLabelFor(u: number): string {
  if (u >= CLEAR_THRESHOLD) return 'Clear';
  if (u >= LISTENING_THRESHOLD) return 'Listening';
  return 'Guarded';
}

export interface CardPreview {
  card: CardId;
  target?: NeighbourId;
  uDelta: Partial<Record<NeighbourId, number>>;
  trustDelta: number;
  gain?: number;
  toneApplied: boolean;
  /** Same wording `state.log` would carry if this exact play were committed. */
  summary: string;
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

  /** Non-mutating: whether playing a card targeting `target` right now would
   * consume the pending "Set the Tone" bonus, without consuming it. */
  peekTone(target: NeighbourId | undefined): number {
    return target && this.toneTarget === target ? TONE_BONUS : 0;
  }

  private consumeTone(target: NeighbourId | undefined): number {
    const bonus = this.peekTone(target);
    if (bonus) this.toneTarget = null;
    return bonus;
  }

  private effectSummary(card: CardId, target: NeighbourId | undefined, uDelta: Partial<Record<NeighbourId, number>>, trustDelta: number): string {
    const name = CARDS[card].name;
    const parts: string[] = [];
    const targets = target ? [target] : (Object.keys(uDelta) as NeighbourId[]);
    for (const n of targets) {
      const d = uDelta[n];
      if (d === undefined) continue;
      const after = this.state.u[n]; // already-updated value at call time
      parts.push(`${NEIGHBOUR_LABEL[n]} ${d >= 0 ? '+' : ''}${Math.round(d)} Understanding (now ${bandLabelFor(after)})`);
    }
    if (trustDelta !== 0) parts.push(`Trust ${trustDelta >= 0 ? '+' : ''}${trustDelta}`);
    return parts.length ? `${name} → ${parts.join(' · ')}` : `${name} played`;
  }

  private pushLog(entry: string) {
    this.state.log.push(entry);
    if (this.state.log.length > 20) this.state.log.shift();
  }

  /** Predicts exactly what `playCard(handIndex, target)` would do, using the
   * same math, without mutating state — so the UI can show an outcome
   * preview before the player commits. Returns null if the play is illegal. */
  previewPlayCard(handIndex: number, target?: NeighbourId): CardPreview | null {
    const card = this.state.hand[handIndex];
    if (!card) return null;
    const def = CARDS[card];
    if (!this.canPlay(card)) return null;
    if (def.needsTarget && !target) return null;
    const toneBonus = this.peekTone(target);
    const { uDelta, trustDelta, gain } = computeCardEffect(card, target, this.state.trust, this.state.u, toneBonus);
    const parts: string[] = [];
    for (const n of Object.keys(uDelta) as NeighbourId[]) {
      const d = uDelta[n]!;
      const before = this.state.u[n];
      const after = Math.max(0, Math.min(100, before + d));
      parts.push(`${NEIGHBOUR_LABEL[n]} ${d >= 0 ? '+' : ''}${Math.round(d)} Understanding (${Math.round(before)} → ${Math.round(after)} · ${bandLabelFor(after)})`);
    }
    if (trustDelta !== 0) {
      const after = Math.max(0, Math.min(100, this.state.trust + trustDelta));
      parts.push(`Trust ${trustDelta >= 0 ? '+' : ''}${trustDelta} (${Math.round(this.state.trust)} → ${Math.round(after)})`);
    }
    return {
      card, target, uDelta, trustDelta, gain, toneApplied: toneBonus > 0,
      summary: parts.length ? parts.join(' · ') : 'No board effect.',
    };
  }

  /** One-line reminder of a dilemma consequence still in effect this Evening,
   * or null when none is active. Wording mirrors the values actually applied
   * in `endEvening`, never a separate hand-copied number. */
  activeConsequenceText(): string | null {
    if (this.rosaCappedThisEvening !== null) {
      return `Rosa's Understanding gains are reduced to ${Math.round(this.rosaCappedThisEvening * 100)}% this Evening.`;
    }
    if (this.hugoHalvedThisEvening !== null) {
      return `Hugo's Understanding gains are reduced to ${Math.round(this.hugoHalvedThisEvening * 100)}% this Evening.`;
    }
    return null;
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

    const u = this.state.u;
    const toneBonus = this.consumeTone(target);
    const { uDelta, trustDelta, gain } = computeCardEffect(card, target, this.state.trust, u, toneBonus);
    for (const n of Object.keys(uDelta) as NeighbourId[]) u[n] += uDelta[n]!;
    this.state.trust += trustDelta;

    // Side effects with no Understanding/Trust delta of their own.
    if (card === 'second_thoughts') {
      this.state.hand.push(...this.draw(2));
    } else if (card === 'think_it_over') {
      // Marks that this Evening's retain slot may hold TWO cards instead of
      // one (handled in endEvening via `extraRetainThisEvening`).
      this.extraRetainThisEvening = true;
    } else if (card === 'speak_your_piece') {
      this.state.speakYourPieceState = 'exhausted';
    }

    for (const n of NEIGHBOURS) u[n] = Math.max(0, Math.min(100, u[n]));
    this.state.trust = Math.max(0, Math.min(100, this.state.trust));
    this.pushLog(this.effectSummary(card, target, uDelta, trustDelta));
    return { card, target, gain };
  }

  private extraRetainThisEvening = false;

  resolveDilemma(dilemmaId: string, choice: DilemmaChoice) {
    let summary: string;
    if (dilemmaId === 'rosas_numbers') {
      if (choice === 'A') {
        this.state.trust = Math.min(100, this.state.trust + 5);
        this.state.pendingMomentPenalty = 1;
        summary = 'Push forward now → Trust +5. Next Evening starts with only 2 Moments.';
      } else {
        this.rosaCappedThisEvening = 0.3;
        this.rosaDeferredBonusNextEvening = 10;
        summary = "Hold it for later → Rosa's Understanding gains reduced to 30% this Evening, then +10 to Rosa next Evening.";
      }
    } else if (dilemmaId === 'hugos_question') {
      if (choice === 'A' && this.state.hand.length > 0) {
        this.state.discard.push(this.state.hand.pop()!);
        this.state.u.hugo = Math.min(100, this.state.u.hugo + 20);
        this.state.trust = Math.min(100, this.state.trust + 3);
        summary = 'Answer him straight → discarded a card, Hugo +20 Understanding, Trust +3.';
      } else {
        this.hugoHalvedThisEvening = 0.5;
        this.state.trust = Math.min(100, this.state.trust + 4);
        summary = "Let Inés smooth it over → Hugo's Understanding gains halved this Evening, Trust +4.";
      }
    } else if (dilemmaId === 'room_decides') {
      if (choice === 'A') {
        this.state.moments = Math.max(0, this.state.moments - 2);
        const bonus = NEIGHBOURS.every((n) => this.state.u[n] >= 55);
        if (bonus) for (const n of NEIGHBOURS) this.state.u[n] = Math.min(100, this.state.u[n] + 10);
        summary = bonus
          ? 'Push for a unified stand → spent 2 Moments, everyone was ready: +10 Understanding to all.'
          : 'Push for a unified stand → spent 2 Moments, the room was not ready enough for the bonus.';
      } else {
        summary = 'Let it rest, end calmly → no cost, no bonus.';
      }
    } else {
      summary = 'Dilemma resolved.';
    }
    this.pushLog(summary);
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
          this.pushLog('Speak Your Piece expired unplayed and left the game.');
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
