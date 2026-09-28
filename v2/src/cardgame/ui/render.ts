import { CARDS } from '../engine/content';
import type { CardGameState, CardId, MultiplierClass, NeighbourId } from '../engine/types';
import { NEIGHBOURS } from '../engine/types';
import { NEIGHBOUR_COPY, CARD_FLAVOR, CARD_EFFECT, JULIA_ABILITY } from '../content/copy';
import { glossaryTerm, glossaryize } from '../content/glossary';
import { CARD_CATEGORY } from '../content/cardCategory';
import { THREE_STEP } from '../content/onboardingCopy';
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
  if (u >= 70) return 'clear';
  if (u >= 35) return 'listening';
  return 'guarded';
}

export function bandLabel(u: number): string {
  const b = bandFor(u);
  return b === 'clear' ? 'Clear' : b === 'listening' ? 'Listening' : 'Guarded';
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
  /** Fired the instant the player chooses ANY affordable hand card, before
   * it resolves (immediately) or awaits a target — used only to drive the
   * first-game tutorial's step transitions. Never changes game state. */
  onCardChosen?: (cardId: CardId, needsTarget: boolean) => void;
  onSkipTutorial?: () => void;
  /** Reads the CURRENT tutorial stage fresh — used only by render.ts's own
   * self-triggered re-renders (pendingCard/tone toggles), which otherwise
   * would re-render with the stale stage captured by their enclosing
   * render() call's closure, one step behind onCardChosen's mutation. */
  getTutorialStage?: () => ThreeStepStage;
}

let pendingCard: { handIndex: number; card: CardId } | null = null;
let toneMode = false;

export function resetInteractionMode() {
  pendingCard = null;
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
  for (const n of NEIGHBOURS) {
    const u = state.u[n];
    const copy = NEIGHBOUR_COPY[n];
    const band = bandFor(u);
    const targetable = toneMode || (pendingCard !== null && CARDS[pendingCard.card].needsTarget);
    const card = document.createElement('div');
    card.className = `neighbour-card card-shell ${targetable ? 'targetable' : ''}`;
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
        <span class="trait-tag">${copy.trait}</span>
        <div class="meter"><span style="width:${Math.min(100, u)}%"></span></div>
        <div class="meter-label">${glossaryTerm(bandLabel(u) as 'Guarded' | 'Listening' | 'Clear')} — ${Math.round(u)}%</div>
      </div>
    `;
    if (targetable) {
      const activate = () => {
        if (toneMode) {
          cb.onSetTone(n);
          toneMode = false;
        } else if (pendingCard) {
          cb.onPlayCard(pendingCard.handIndex, n);
          pendingCard = null;
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
    const affordable = state.moments >= def.cost && (def.requiresTrust === undefined || state.trust >= def.requiresTrust);
    const stamp = stampFor(cardId, def.multiplierClass);
    const effect = CARD_EFFECT[cardId];
    const el = document.createElement('div');
    el.className = `card card-shell ${affordable ? '' : 'unaffordable'} ${pendingCard?.handIndex === idx ? 'selected' : ''} ${def.exhausts ? 'exhausts' : ''}`;
    el.tabIndex = affordable ? 0 : -1;
    el.innerHTML = `
      ${stamp ? `<span class="stamp">${stamp}</span>` : ''}
      <span class="cost">${def.cost}</span>
      <h3>${def.name}</h3>
      ${def.requiresTrust ? `<div class="requirement">needs ${glossaryTerm('Trust')} ${def.requiresTrust}</div>` : ''}
      ${effect ? `<div class="effect">${glossaryize(effect)}</div><div class="flavor">${CARD_FLAVOR[cardId]}</div>` : `<div class="flavor primary">${glossaryize(CARD_FLAVOR[cardId])}</div>`}
    `;
    if (affordable) {
      const activate = () => {
        toneMode = false;
        cb.onCardChosen?.(cardId, def.needsTarget);
        if (!def.needsTarget) {
          cb.onPlayCard(idx);
        } else {
          pendingCard = pendingCard?.handIndex === idx ? null : { handIndex: idx, card: cardId };
          render(root, state, toneAvailable, cb, cb.getTutorialStage ? cb.getTutorialStage() : tutorialStage);
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

  const endBtn = document.createElement('button');
  endBtn.className = 'btn end-evening-bottom';
  endBtn.textContent = 'End Evening';
  endBtn.addEventListener('click', () => cb.onEndEvening());
  handArea.appendChild(endBtn);

  root.appendChild(handArea);

  const endBtnRail = header.querySelector('.end-evening-rail');
  endBtnRail?.addEventListener('click', () => cb.onEndEvening());

  const toneBtn = header.querySelector('#tone-btn');
  toneBtn?.addEventListener('click', () => {
    if (!toneAvailable) return;
    pendingCard = null;
    toneMode = !toneMode;
    render(root, state, toneAvailable, cb, cb.getTutorialStage ? cb.getTutorialStage() : tutorialStage);
  });

  root.querySelectorAll<HTMLButtonElement>('.tutorial-skip').forEach((btn) => {
    btn.addEventListener('click', () => cb.onSkipTutorial?.());
  });
}
