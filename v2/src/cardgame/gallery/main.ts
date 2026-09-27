// "Lamplit Table" component gallery — Phase 1 visual-approval step only.
// Renders static examples of each card family using the approved assets and
// CSS-only state treatments from docs/v2/card-assets/. Does NOT wire into the
// existing game loop (card.html) yet, per the implementation brief.
import './styles.css';

// Single source of truth for these PNGs: docs/v2/card-assets/ (see vite.config.ts
// server.fs.allow). Vite bundles these as hashed assets; the originals are untouched.
import juliaPortrait from '../../../../docs/v2/card-assets/portraits/julia-portrait-v1.png';
import rosaPortrait from '../../../../docs/v2/card-assets/portraits/rosa-portrait-v1.png';
import cardBack from '../../../../docs/v2/card-assets/card-backs/one-voice-card-back-v1.png';
import actionPaper from '../../../../docs/v2/card-assets/textures/action-paper-v1.png';
import dilemmaPaper from '../../../../docs/v2/card-assets/textures/dilemma-paper-v1.png';

type CharState = 'guarded' | 'listening' | 'clear';
const STATE_LABEL: Record<CharState, string> = { guarded: 'Guarded', listening: 'Listening', clear: 'Clear' };
const STATE_VALUE: Record<CharState, number> = { guarded: 22, listening: 55, clear: 82 };

const root = document.getElementById('gallery')!;
root.style.setProperty('--action-paper-texture', `url(${actionPaper})`);
root.style.setProperty('--dilemma-paper-texture', `url(${dilemmaPaper})`);

function section(title: string): HTMLElement {
  const s = document.createElement('section');
  s.className = 'gallery-section';
  const h = document.createElement('h2');
  h.textContent = title;
  s.appendChild(h);
  const table = document.createElement('div');
  table.className = 'tabletop';
  s.appendChild(table);
  return s;
}

function leaderCard(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card-shell leader-card';
  el.tabIndex = 0;
  el.innerHTML = `
    <span class="player-marker">You</span>
    <div class="portrait-frame"><img src="${juliaPortrait}" alt="Julia" /></div>
    <h3>Julia</h3>
    <div class="role">the teacher — Leader</div>
    <div class="ability"><b>Set the Tone</b> — once per Evening, free: name a neighbour. The next card that affects them this Evening is stronger.</div>
  `;
  return el;
}

function neighbourCard(state: CharState): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card-shell neighbour-card';
  el.dataset.state = state;
  el.tabIndex = 0;
  const value = STATE_VALUE[state];
  el.innerHTML = `
    <div class="portrait-frame">
      <img src="${rosaPortrait}" alt="Rosa" />
      <span class="state-badge">${STATE_LABEL[state]}</span>
    </div>
    <div class="body">
      <h3>Rosa</h3>
      <div class="role">the nurse</div>
      <div class="stake">She knows exactly what the clinic closing will cost people.</div>
      <span class="trait-tag">Online</span>
      <div class="meter"><span style="width:${value}%"></span></div>
      <div class="meter-label">${STATE_LABEL[state]} — ${value}%</div>
    </div>
  `;
  return el;
}

function actionCard(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card-shell action-card';
  el.tabIndex = 0;
  el.innerHTML = `
    <span class="stamp">Talk</span>
    <span class="cost">1</span>
    <h3>Ask Directly</h3>
    <div class="effect">Sit down with one neighbour, one on one. They understand a little more. Trust grows.</div>
    <div class="flavor">Some things are easier said across a kitchen table.</div>
  `;
  return el;
}

function dilemmaCard(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card-shell dilemma-card';
  el.innerHTML = `
    <h3>Rosa has the numbers.</h3>
    <div class="body-text">She wants to read the real consequences of the closure aloud, tonight.</div>
    <div class="choices">
      <button class="choice" type="button"><b>Push forward now</b> — Trust +5, but tomorrow starts with only 2 Moments.</button>
      <button class="choice" type="button"><b>Hold it for later</b> — Rosa's growth is cut tonight, but she gets a certain +10 tomorrow.</button>
    </div>
  `;
  return el;
}

function cardBackEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card-shell card-back';
  el.innerHTML = `<img src="${cardBack}" alt="" />`;
  return el;
}

root.innerHTML = '';
const header = document.createElement('div');
header.className = 'gallery-header';
header.innerHTML = `
  <h1>Lamplit Table — component gallery</h1>
  <p>Static, visual-approval-only components using the approved portraits and textures. Not yet wired into the game loop.</p>
`;
root.appendChild(header);

const leaderSection = section('Leader card');
leaderSection.querySelector('.tabletop')!.appendChild(leaderCard());
root.appendChild(leaderSection);

const neighbourSection = section('Neighbour card — Rosa, all three states (CSS treatment only, same portrait)');
const nTable = neighbourSection.querySelector('.tabletop')!;
(['guarded', 'listening', 'clear'] as CharState[]).forEach((s) => nTable.appendChild(neighbourCard(s)));
root.appendChild(neighbourSection);

const actionSection = section('Action card');
actionSection.querySelector('.tabletop')!.appendChild(actionCard());
root.appendChild(actionSection);

const dilemmaSection = section('Dilemma card');
dilemmaSection.querySelector('.tabletop')!.appendChild(dilemmaCard());
root.appendChild(dilemmaSection);

const backSection = section('Card back');
backSection.querySelector('.tabletop')!.appendChild(cardBackEl());
root.appendChild(backSection);
