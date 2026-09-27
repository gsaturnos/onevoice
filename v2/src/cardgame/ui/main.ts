import { CardGameSession } from '../engine/engine';
import { CARDS, TOTAL_EVENINGS } from '../engine/content';
import type { NeighbourId } from '../engine/types';
import { NEIGHBOURS } from '../engine/types';
import { DILEMMA_COPY } from '../content/copy';
import { render, resetInteractionMode, bandLabel } from './render';
import './styles.css';

const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) : Date.now() % 1_000_000;

const root = document.getElementById('cardgame')!;
let session = new CardGameSession(seed);
let extraRetainThisEvening = false; // mirrors engine's internal Think It Over flag, for the retain-picker UI

// Returns the INNER .overlay-panel element (not the .overlay backdrop), so
// callers that later do `panel.parentElement!.remove()` remove just the
// backdrop, never `document.body` itself.
function showOverlay(html: string, mount: (panel: HTMLElement) => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="overlay-panel">${html}</div>`;
  document.body.appendChild(overlay);
  const panel = overlay.querySelector('.overlay-panel') as HTMLElement;
  mount(panel);
  return panel;
}

function renderScene() {
  resetInteractionMode();
  render(root, session.state, session.isToneAvailable(), {
    onPlayCard: (handIndex, target) => {
      const card = session.state.hand[handIndex];
      if (card === 'think_it_over') extraRetainThisEvening = true;
      session.playCard(handIndex, target);
      renderScene();
    },
    onSetTone: (target: NeighbourId) => {
      session.setTheTone(target);
      renderScene();
    },
    onEndEvening: () => {
      if (session.state.evening === TOTAL_EVENINGS) {
        showDilemma('room_decides', () => afterFinalDilemma());
      } else {
        startRetain();
      }
    },
  });
}

function afterFinalDilemma() {
  startRetain();
}

function startRetain() {
  const hand = session.state.hand;
  if (hand.length === 0 || session.state.evening === TOTAL_EVENINGS) {
    finishEvening([]);
    return;
  }
  const maxRetain = extraRetainThisEvening ? 2 : 1;
  const chosen: number[] = [];
  const panel = showOverlay(
    `<h2>Anything you meant to save for next time?</h2>
     <p>You may keep up to ${maxRetain} card${maxRetain > 1 ? 's' : ''} for next Evening. Everything else is discarded.</p>
     <div class="choices" id="retain-list"></div>
     <button class="btn" id="retain-done">Continue</button>`,
    () => {},
  );
  const list = panel.querySelector('#retain-list')!;
  hand.forEach((cardId, idx) => {
    const def = CARDS[cardId];
    const b = document.createElement('button');
    b.className = 'btn secondary';
    b.textContent = `Keep: ${def.name}`;
    b.addEventListener('click', () => {
      if (chosen.includes(idx)) {
        chosen.splice(chosen.indexOf(idx), 1);
        b.style.borderColor = '';
      } else if (chosen.length < maxRetain) {
        chosen.push(idx);
        b.style.borderColor = 'var(--accent)';
      }
    });
    list.appendChild(b);
  });
  panel.querySelector('#retain-done')!.addEventListener('click', () => {
    panel.parentElement!.remove();
    finishEvening(chosen);
  });
}

function finishEvening(retain: number[]) {
  session.endEvening(retain);
  extraRetainThisEvening = false;
  if (session.state.won !== null) {
    showResult();
    return;
  }
  advanceEvening();
}

function advanceEvening() {
  const { dilemma } = session.startEvening();
  if (dilemma) {
    showDilemma(dilemma.id, () => {
      session.snapshotBeforePlay();
      renderScene();
    });
  } else {
    session.snapshotBeforePlay();
    renderScene();
  }
}

function showDilemma(id: string, onDone: () => void) {
  const copy = DILEMMA_COPY[id];
  const overlay = showOverlay(
    `<div class="dilemma-card">
       <h2>${copy.title}</h2>
       <p>${copy.body}</p>
       <div class="choices">
         <button class="choice" id="opt-a">${copy.a}</button>
         <button class="choice" id="opt-b">${copy.b}</button>
       </div>
     </div>`,
    () => {},
  );
  const choose = (choice: 'A' | 'B') => {
    session.resolveDilemma(id, choice);
    overlay.parentElement!.remove();
    onDone();
  };
  overlay.querySelector('#opt-a')!.addEventListener('click', () => choose('A'));
  overlay.querySelector('#opt-b')!.addEventListener('click', () => choose('B'));
}

function showResult() {
  const won = session.state.won;
  const rows = NEIGHBOURS.map((n) => `${n}: ${Math.round(session.state.u[n])}% (${bandLabel(session.state.u[n])})`).join('<br>');
  showOverlay(
    `<h2>${won ? 'The room sees it clearly.' : 'The moment passed.'}</h2>
     <p>${rows}</p>
     <button class="btn" id="restart">Play again</button>`,
    (panel) => {
      panel.querySelector('#restart')!.addEventListener('click', () => {
        panel.parentElement!.remove();
        session = new CardGameSession(Date.now() % 1_000_000);
        advanceEvening();
      });
    },
  );
}

advanceEvening();
