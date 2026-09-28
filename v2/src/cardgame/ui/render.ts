import { CARDS } from '../engine/content';
import type { CardDef, CardGameState, CardId, MultiplierClass, NeighbourId } from '../engine/types';
import { NEIGHBOURS } from '../engine/types';
import type { CardPreview } from '../engine/engine';
import { CLEAR_THRESHOLD, LISTENING_THRESHOLD } from '../engine/engine';
import { NEIGHBOUR_COPY, CARD_FLAVOR, CARD_EFFECT, JULIA_ABILITY } from '../content/copy';
import { TRAIT_EXPLANATION } from '../content/traitCopy';
import { glossaryTerm, glossaryize } from '../content/glossary';
import { CARD_CATEGORY } from '../content/cardCategory';
import { THREE_STEP, OBJECTIVE } from '../content/onboardingCopy';
import type { ThreeStepStage } from '../onboarding/tutorialState';

// Single source of truth for these PNGs: docs/v2/card-assets/ (see vite.config.ts
// server.fs.allow). Same approved assets the standalone gallery uses, no
// regeneration or face-swapping.
import juliaPortrait from '../../../../docs/v2/card-assets/portraits/julia-portrait-v1.png';
import rosaPortrait from '../../../../docs/v2/card-assets/portraits/rosa-portrait-v1.png';
import inesPortrait from '../../../../docs/v2/card-assets/portraits/ines-portrait-v1.png';
import hugoPortrait from '../../../../docs/v2/card-assets/portraits/hugo-portrait-v1.png';
import cardBack from '../../../../docs/v2/card-assets/card-backs/one-voice-card-back-v1.png';
import actionPaper from '../../../../docs/v2/card-assets/textures/action-paper-v1.png';
import dilemmaPaper from '../../../../docs/v2/card-assets/textures/dilemma-paper-v1.png';

document.documentElement.style.setProperty('--action-paper-texture', `url(${actionPaper})`);
document.documentElement.style.setProperty('--dilemma-paper-texture', `url(${dilemmaPaper})`);

export const CARD_BACK_SRC = cardBack;

const PORTRAIT: Record<NeighbourId, string> = {
  rosa: rosaPortrait,
  ines: inesPortrait,
  hugo: hugoPortrait,
};

export const JULIA_PORTRAIT_SRC = juliaPortrait;

export function bandFor(u: number): 'guarded' | 'listening' | 'clear' {
  if (u >= CLEAR_THRESHOLD) return 'clear';
  if (u >= LISTENING_THRESHOLD) return 'listening';
  return 'guarded';
}

export function bandLabel(u: number): string {
  const b = bandFor(u);
  return b === 'clear' ? 'Clear' : b === 'listening' ? 'Listening' : 'Guarded';
}

/** The distance-to-next-threshold fragment Giorgio specified, e.g.
 * "18/35 to Listening" or "52/70 to Clear" — always paired with the band
 * word by callers (`${bandLabel} · ${nextThresholdText}`). */
export function nextThresholdText(u: number): string {
  const band = bandFor(u);
  if (band === 'guarded') return `${Math.round(u)}/${LISTENING_THRESHOLD} to Listening`;
  if (band === 'listening') return `${Math.round(u)}/${CLEAR_THRESHOLD} to Clear`;
  return `${Math.round(u)}/100`;
}

/** Exact reason a hand card can't be played right now, or null if it can.
 * Never relies on dimmed opacity alone (Giorgio: item 6). */
function lockText(def: CardDef, state: CardGameState): string | null {
  if (state.moments < def.cost) {
    return `Needs ${def.cost} Moment${def.cost === 1 ? '' : 's'} · you have ${state.moments}`;
  }
  if (def.requiresTrust !== undefined && state.trust < def.requiresTrust) {
    const short = Math.ceil(def.requiresTrust - state.trust);
    return `Locked · needs ${def.requiresTrust} Trust · currently ${Math.round(state.trust)} · ${short} more Trust required`;
  }
  return null;
}

/** Speak Your Piece's visible expiry window (item 9). Only meaningful while
 * the card is actually in hand. */
function speakYourPieceTiming(state: CardGameState): string | null {
  if (state.speakYourPieceState === 'in_hand') return 'Available now · may be retained through Evening 4';
  if (state.speakYourPieceState === 'retained_once') return 'Last Evening to play this card';
  return null;
}

/** Whether the most recent meeting-log entry concerns this neighbour, shown
 * as a brief confirmation near their card (item 7). */
function lastChangeFor(state: CardGameState, n: NeighbourId): string | null {
  const last = state.log[state.log.length - 1];
  if (!last || !last.includes(NEIGHBOUR_COPY[n].name)) return null;
  return last;
}

function stampFor(cardId: CardId, multiplierClass: MultiplierClass): string | null {
  if (multiplierClass === 'talk') return glossaryTerm('Talk-style', 'Talk');
  if (multiplierClass === 'broadcast') return glossaryTerm('Online', 'Broadcast');
  if (CARD_CATEGORY[cardId] === 'Group') return glossaryTerm('All neighbours');
  return null;
}

export interface RenderCallbacks {
  onPlayCard: (handIndex: number, target?: NeighbourId) => void;
  onSetTone: (target: NeighbourId) => void;
  onEndEvening: () => void;
  /** Fired the instant the player arms ANY affordable hand card (selects it,
   * before targeting/preview/confirm) — used only to drive the first-game
   * tutorial's step transitions. Never changes game state. */
  onCardChosen?: (cardId: CardId, needsTarget: boolean) => void;
  onSkipTutorial?: () => void;
  /** Reads the CURRENT tutorial stage fresh — used only by render.ts's own
   * self-triggered re-renders (pendingCard/tone toggles), which otherwise
   * would re-render with the stale stage captured by their enclosing
   * render() call's closure, one step behind onCardChosen's mutation. */
  getTutorialStage?: () => ThreeStepStage;
  /** Non-mutating outcome preview for the armed hand card, using the
   * engine's own math (Giorgio: "must use the engine's real calculation,
   * not duplicated UI formulas"). */
  getPreview?: (handIndex: number, target?: NeighbourId) => CardPreview | null;
  /** One-line reminder of a dilemma consequence still active this Evening. */
  getActiveConsequence?: () => string | null;
}

let pendingCard: { handIndex: number; card: CardId } | null = null;
let armedTarget: NeighbourId | null = null;
let toneMode = false;

export function resetInteractionMode() {
  pendingCard = null;
  armedTarget = null;
  toneMode = false;
}

function tutorialCalloutHtml(stage: Exclude<ThreeStepStage, null>): string {
  const step = THREE_STEP[stage];
  const stateKey = 'stateKey' in step ? `<p class="tutorial-state-key">${step.stateKey}</p>` : '';
  return `
    <div class="tutorial-callout" role="region" aria-label="Tutorial">
      <h3>${step.heading}</h3>
      <p>${step.body}</p>
      ${stateKey}
      <div class="tutorial-callout-footer">
        <span class="tutorial-prompt">${step.prompt}</span>
        <button type="button" class="btn secondary tutorial-skip" id="tutorial-skip">Skip tutorial</button>
      </div>
    </div>
  `;
}

export function render(
  root: HTMLElement,
  state: CardGameState,
  toneAvailable: boolean,
  cb: RenderCallbacks,
  tutorialStage: ThreeStepStage = null,
) {
  root.innerHTML = '';
  root.dataset.tutorialStage = tutorialStage ?? '';

  const rerender = () => render(root, state, toneAvailable, cb, cb.getTutorialStage ? cb.getTutorialStage() : tutorialStage);

  // --- Persistent objective banner (item 1): never depends on the opening
  // screen or tutorial memory, always visible. ---
  const clearCount = NEIGHBOURS.filter((n) => bandFor(state.u[n]) === 'clear').length;
  const consequence = cb.getActiveConsequence?.() ?? null;
  const objective = document.createElement('div');
  objective.className = 'objective-banner';
  objective.innerHTML = `
    <span class="objective-text">${OBJECTIVE.text}</span>
    <span class="objective-progress">${clearCount}/3 Clear</span>
    ${consequence ? `<span class="consequence-reminder">${consequence}</span>` : ''}
  `;
  root.appendChild(objective);

  const header = document.createElement('div');
  header.className = 'scene-header';
  header.innerHTML = `
    <div class="leader-card card-shell" tabindex="0">
      <span class="player-marker">You</span>
      <div class="portrait-frame"><img src="${juliaPortrait}" alt="Julia" /></div>
      <div class="leader-body">
        <div class="leader-name-row">
          <h3>Julia</h3>
          <div class="role">the teacher — Leader</div>
        </div>
        <div class="tone-status">${toneMode ? 'Choose a neighbour…' : toneAvailable ? 'Tone ready' : 'Tone used'}</div>
        <div class="ability"><b>${glossaryTerm('Set the Tone')}</b> — ${JULIA_ABILITY}</div>
        <button class="btn secondary" id="tone-btn" ${!toneAvailable ? 'disabled' : ''}>
          ${toneMode ? 'Choose who to focus on…' : 'Set the Tone'}
        </button>
      </div>
    </div>
    <div class="status-strip">
      <span>Evening <b>${state.evening}</b> / 6</span>
      <span>${glossaryTerm('Trust')} <b>${Math.round(state.trust)}</b></span>
      <span>${glossaryTerm('Moments')} <b>${state.moments}</b></span>
      <div class="deck-indicator" title="${state.deck.length} left in deck, ${state.discard.length} discarded">
        <img src="${cardBack}" alt="" />
        <span>${state.deck.length}</span>
      </div>
      <button class="btn end-evening-rail">End Evening</button>
    </div>
  `;
  root.appendChild(header);

  if (tutorialStage === 'trust') {
    header.insertAdjacentHTML('afterend', tutorialCalloutHtml('trust'));
  }

  const neighbourRow = document.createElement('div');
  neighbourRow.className = 'neighbours';
  const inTargetingMode = toneMode || (pendingCard !== null && CARDS[pendingCard.card].needsTarget);
  for (const n of NEIGHBOURS) {
    const u = state.u[n];
    const copy = NEIGHBOUR_COPY[n];
    const band = bandFor(u);
    // Every needsTarget card can legally hit any of the 3 neighbours — there
    // is currently no "illegal" neighbour, but the highlight/dim split below
    // is written generically so a future card with restricted targeting only
    // needs to change `targetable`, not this rendering.
    const targetable = inTargetingMode;
    const armed = pendingCard !== null && armedTarget === n;
    const note = lastChangeFor(state, n);
    const card = document.createElement('div');
    card.className = `neighbour-card card-shell ${targetable ? 'targetable' : inTargetingMode ? 'dimmed' : ''} ${armed ? 'armed' : ''}`;
    card.dataset.state = band;
    card.tabIndex = targetable ? 0 : -1;
    card.innerHTML = `
      <div class="portrait-frame">
        <img src="${PORTRAIT[n]}" alt="${copy.name}" />
        <span class="state-badge">${bandLabel(u)}</span>
      </div>
      <div class="body">
        <h3>${copy.name}</h3>
        <div class="role">${copy.role}</div>
        <span class="trait-tag">${TRAIT_EXPLANATION[n]}</span>
        <div class="meter"><span style="width:${Math.min(100, u)}%"></span></div>
        <div class="meter-label">${glossaryTerm(bandLabel(u) as 'Guarded' | 'Listening' | 'Clear')} · ${nextThresholdText(u)}</div>
        ${note ? `<div class="resolution-note">${note}</div>` : ''}
      </div>
    `;
    if (targetable) {
      const activate = () => {
        if (toneMode) {
          cb.onSetTone(n);
          toneMode = false;
        } else if (pendingCard) {
          if (armedTarget !== n) {
            armedTarget = n;
            rerender();
          } else {
            cb.onPlayCard(pendingCard.handIndex, n);
            pendingCard = null;
            armedTarget = null;
          }
        }
      };
      card.addEventListener('click', activate);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    }
    neighbourRow.appendChild(card);
  }
  root.appendChild(neighbourRow);

  if (tutorialStage === 'targeting') {
    neighbourRow.insertAdjacentHTML('afterend', tutorialCalloutHtml('targeting'));
  }

  const handArea = document.createElement('div');
  handArea.className = 'hand-area';

  if (tutorialStage === 'moments') {
    handArea.insertAdjacentHTML('beforeend', tutorialCalloutHtml('moments'));
  }

  const handRow = document.createElement('div');
  handRow.className = 'hand-row';
  state.hand.forEach((cardId, idx) => {
    const def = CARDS[cardId];
    const lock = lockText(def, state);
    const affordable = lock === null;
    const stamp = stampFor(cardId, def.multiplierClass);
    const effect = CARD_EFFECT[cardId];
    const sypTiming = cardId === 'speak_your_piece' ? speakYourPieceTiming(state) : null;
    const el = document.createElement('div');
    el.className = `card card-shell ${affordable ? '' : 'unaffordable'} ${pendingCard?.handIndex === idx ? 'selected' : ''} ${def.exhausts ? 'exhausts' : ''}`;
    el.tabIndex = affordable ? 0 : -1;
    el.innerHTML = `
      ${stamp ? `<span class="stamp">${stamp}</span>` : ''}
      <span class="cost">${def.cost}</span>
      <h3>${def.name}</h3>
      ${lock ? `<div class="requirement lock-text">${lock}</div>` : ''}
      ${sypTiming ? `<div class="requirement syp-timing">${sypTiming}</div>` : ''}
      ${effect ? `<div class="effect">${glossaryize(effect)}</div><div class="flavor">${CARD_FLAVOR[cardId]}</div>` : `<div class="flavor primary">${glossaryize(CARD_FLAVOR[cardId])}</div>`}
    `;
    if (affordable) {
      const activate = () => {
        toneMode = false;
        if (pendingCard?.handIndex === idx) {
          if (!def.needsTarget) {
            // Second activation on an already-armed no-target card commits it.
            cb.onPlayCard(idx);
            pendingCard = null;
            armedTarget = null;
          } else {
            // Re-selecting the source card (rather than a neighbour) cancels
            // the in-progress targeting.
            pendingCard = null;
            armedTarget = null;
            rerender();
          }
        } else {
          cb.onCardChosen?.(cardId, def.needsTarget);
          pendingCard = { handIndex: idx, card: cardId };
          armedTarget = null;
          rerender();
        }
      };
      el.addEventListener('click', activate);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    }
    handRow.appendChild(el);
  });
  handArea.appendChild(handRow);

  // --- Outcome preview + confirm bar (item 3): nothing plays until the
  // player explicitly confirms, using the engine's own preview math. ---
  if (pendingCard) {
    const def = CARDS[pendingCard.card];
    const target = def.needsTarget ? armedTarget ?? undefined : undefined;
    const ready = !def.needsTarget || armedTarget !== null;
    const preview = ready ? cb.getPreview?.(pendingCard.handIndex, target) ?? null : null;
    const instruction = def.needsTarget
      ? armedTarget
        ? 'Tap the neighbour again, or Play card, to confirm.'
        : 'Choose one highlighted neighbour.'
      : 'No target required.';
    const bar = document.createElement('div');
    bar.className = 'play-action-bar';
    bar.innerHTML = `
      <div class="play-instruction">${instruction}</div>
      ${preview ? `<div class="play-preview">${preview.summary}</div>` : ''}
      ${preview && target ? `<div class="play-trait-note">${TRAIT_EXPLANATION[target]}</div>` : ''}
      <div class="play-action-buttons">
        <button type="button" class="btn" id="confirm-play" ${ready ? '' : 'disabled'}>Play card</button>
        <button type="button" class="btn secondary" id="cancel-play">Cancel</button>
      </div>
    `;
    handArea.appendChild(bar);
    bar.querySelector('#confirm-play')?.addEventListener('click', () => {
      if (!ready) return;
      cb.onPlayCard(pendingCard!.handIndex, target);
      pendingCard = null;
      armedTarget = null;
    });
    bar.querySelector('#cancel-play')?.addEventListener('click', () => {
      pendingCard = null;
      armedTarget = null;
      rerender();
    });
  }

  const endBtn = document.createElement('button');
  endBtn.className = 'btn end-evening-bottom';
  endBtn.textContent = 'End Evening';
  endBtn.addEventListener('click', () => cb.onEndEvening());
  handArea.appendChild(endBtn);

  // --- Meeting log (item 7): the latest three engine-authored entries, kept
  // visible without opening a developer-style console. ---
  const recentLog = state.log.slice(-3).reverse();
  if (recentLog.length) {
    const log = document.createElement('div');
    log.className = 'meeting-log';
    log.innerHTML = `
      <h4>Meeting log</h4>
      <ul>${recentLog.map((entry) => `<li>${entry}</li>`).join('')}</ul>
    `;
    handArea.appendChild(log);
  }

  root.appendChild(handArea);

  const endBtnRail = header.querySelector('.end-evening-rail');
  endBtnRail?.addEventListener('click', () => cb.onEndEvening());

  const toneBtn = header.querySelector('#tone-btn');
  toneBtn?.addEventListener('click', () => {
    if (!toneAvailable) return;
    pendingCard = null;
    armedTarget = null;
    toneMode = !toneMode;
    rerender();
  });

  root.querySelectorAll<HTMLButtonElement>('.tutorial-skip').forEach((btn) => {
    btn.addEventListener('click', () => cb.onSkipTutorial?.());
  });
}
