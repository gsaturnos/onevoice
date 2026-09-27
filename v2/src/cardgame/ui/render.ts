import { CARDS } from '../engine/content';
import type { CardGameState, CardId, MultiplierClass, NeighbourId } from '../engine/types';
import { NEIGHBOURS } from '../engine/types';
import { NEIGHBOUR_COPY, CARD_FLAVOR, CARD_EFFECT, JULIA_ABILITY } from '../content/copy';

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

function stampFor(multiplierClass: MultiplierClass): string | null {
  if (multiplierClass === 'talk') return 'Talk';
  if (multiplierClass === 'broadcast') return 'Broadcast';
  return null;
}

export interface RenderCallbacks {
  onPlayCard: (handIndex: number, target?: NeighbourId) => void;
  onSetTone: (target: NeighbourId) => void;
  onEndEvening: () => void;
}

let pendingCard: { handIndex: number; card: CardId } | null = null;
let toneMode = false;

export function resetInteractionMode() {
  pendingCard = null;
  toneMode = false;
}

export function render(root: HTMLElement, state: CardGameState, toneAvailable: boolean, cb: RenderCallbacks) {
  root.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'scene-header';
  header.innerHTML = `
    <div class="leader-card card-shell" tabindex="0">
      <span class="player-marker">You</span>
      <div class="portrait-frame"><img src="${juliaPortrait}" alt="Julia" /></div>
      <div class="leader-body">
        <h3>Julia</h3>
        <div class="role">the teacher — Leader</div>
        <div class="ability"><b>Set the Tone</b> — ${JULIA_ABILITY}</div>
        <button class="btn secondary" id="tone-btn" ${!toneAvailable ? 'disabled' : ''}>
          ${toneMode ? 'Choose who to focus on…' : 'Set the Tone'}
        </button>
      </div>
    </div>
    <div class="status-strip">
      <span>Evening <b>${state.evening}</b> / 6</span>
      <span>Trust <b>${Math.round(state.trust)}</b></span>
      <span>Moments <b>${state.moments}</b></span>
      <div class="deck-indicator" title="${state.deck.length} left in deck, ${state.discard.length} discarded">
        <img src="${cardBack}" alt="" />
        <span>${state.deck.length}</span>
      </div>
    </div>
  `;
  root.appendChild(header);

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
        <div class="meter-label">${bandLabel(u)} — ${Math.round(u)}%</div>
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

  const handArea = document.createElement('div');
  handArea.className = 'hand-area';
  const handRow = document.createElement('div');
  handRow.className = 'hand-row';
  state.hand.forEach((cardId, idx) => {
    const def = CARDS[cardId];
    const affordable = state.moments >= def.cost && (def.requiresTrust === undefined || state.trust >= def.requiresTrust);
    const stamp = stampFor(def.multiplierClass);
    const effect = CARD_EFFECT[cardId];
    const el = document.createElement('div');
    el.className = `card card-shell ${affordable ? '' : 'unaffordable'} ${pendingCard?.handIndex === idx ? 'selected' : ''} ${def.exhausts ? 'exhausts' : ''}`;
    el.tabIndex = affordable ? 0 : -1;
    el.innerHTML = `
      ${stamp ? `<span class="stamp">${stamp}</span>` : ''}
      <span class="cost">${def.cost}</span>
      <h3>${def.name}</h3>
      ${def.requiresTrust ? `<div class="requirement">needs Trust ${def.requiresTrust}</div>` : ''}
      ${effect ? `<div class="effect">${effect}</div><div class="flavor">${CARD_FLAVOR[cardId]}</div>` : `<div class="flavor primary">${CARD_FLAVOR[cardId]}</div>`}
    `;
    if (affordable) {
      const activate = () => {
        toneMode = false;
        if (!def.needsTarget) {
          cb.onPlayCard(idx);
        } else {
          pendingCard = pendingCard?.handIndex === idx ? null : { handIndex: idx, card: cardId };
          render(root, state, toneAvailable, cb);
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
  endBtn.className = 'btn';
  endBtn.textContent = 'End Evening';
  endBtn.addEventListener('click', () => cb.onEndEvening());
  handArea.appendChild(endBtn);

  root.appendChild(handArea);

  const toneBtn = header.querySelector('#tone-btn');
  toneBtn?.addEventListener('click', () => {
    if (!toneAvailable) return;
    pendingCard = null;
    toneMode = !toneMode;
    render(root, state, toneAvailable, cb);
  });
}
