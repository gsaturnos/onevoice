import { CardGameSession, CLEAR_THRESHOLD } from '../engine/engine';
import { CARDS, TOTAL_EVENINGS } from '../engine/content';
import type { CardId, NeighbourId } from '../engine/types';
import { NEIGHBOURS } from '../engine/types';
import { DILEMMA_COPY } from '../content/copy';
import { CARD_CATEGORY, CARD_CATEGORIES, type CardCategory } from '../content/cardCategory';
import { SCENARIO, THREE_STEP, RETENTION_INTRO, DILEMMA_INTRO, SPEAK_YOUR_PIECE_INTRO, VICTORY, FAILURE } from '../content/onboardingCopy';
import {
  createTutorialState, skipTutorial, advanceThreeStep,
  shouldShowRetention, markRetentionSeen,
  shouldShowDilemmaIntro, markDilemmaIntroSeen,
  shouldShowSpeakYourPieceIntro, markSpeakYourPieceIntroSeen,
  type TutorialState, type ThreeStepStage,
} from '../onboarding/tutorialState';
import { render, resetInteractionMode, bandLabel } from './render';
import { installGlossaryDisclosures } from './glossary';
import { announce, describeDelta, neighbourName } from './liveRegion';
import './styles.css';

const params = new URLSearchParams(location.search);
const initialSeed = params.has('seed') ? Number(params.get('seed')) : Date.now() % 1_000_000;

const root = document.getElementById('cardgame')!;
installGlossaryDisclosures(document.body);

let session = new CardGameSession(initialSeed);
let extraRetainThisEvening = false; // mirrors engine's internal Think It Over flag, for the retain-picker UI
let tutorial: TutorialState = createTutorialState(false);
let dilemmaChoicesMade: Partial<Record<string, 'A' | 'B'>> = {};
let cardsPlayedByCategory: Record<CardCategory, number> = { 'Talk-style': 0, Online: 0, Group: 0, Utility: 0 };
let previousTutorialStage: ThreeStepStage = null;
let restoreFocusAfterTutorial: HTMLElement | null = null;

function snapshotUT() {
  return { u: { ...session.state.u }, trust: session.state.trust };
}

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

// --- Tutorial step focus + announcement side-effects (not game state) ---
function syncTutorialUi() {
  const newStage = tutorial.stage;
  if (newStage === previousTutorialStage) return;
  if (newStage) {
    const step = THREE_STEP[newStage];
    const stateKey = 'stateKey' in step ? ` ${step.stateKey}.` : '';
    announce(`${step.heading} ${step.body}${stateKey} ${step.prompt}`);
    if (!restoreFocusAfterTutorial) {
      restoreFocusAfterTutorial = (document.activeElement as HTMLElement) ?? null;
    }
    const skipBtn = document.querySelector<HTMLButtonElement>('.tutorial-skip');
    skipBtn?.focus();
  } else if (previousTutorialStage) {
    if (restoreFocusAfterTutorial && restoreFocusAfterTutorial.isConnected) {
      restoreFocusAfterTutorial.focus();
    }
    restoreFocusAfterTutorial = null;
  }
  previousTutorialStage = newStage;
}

function renderScene() {
  resetInteractionMode();
  render(
    root,
    session.state,
    session.isToneAvailable(),
    {
      onPlayCard: (handIndex, target) => {
        const card = session.state.hand[handIndex];
        if (card === 'think_it_over') extraRetainThisEvening = true;
        const stageBefore = tutorial.stage;
        const before = snapshotUT();
        session.playCard(handIndex, target);
        const after = snapshotUT();
        const msg = describeDelta(before, after);
        if (msg) announce(msg);
        cardsPlayedByCategory[CARD_CATEGORY[card]] += 1;

        if (stageBefore === 'trust') {
          tutorial = advanceThreeStep(tutorial);
        } else if (stageBefore === 'moments') {
          // This card resolved immediately (no target step to show) — skip
          // straight past 'targeting' to 'trust'.
          tutorial = advanceThreeStep(tutorial);
          tutorial = advanceThreeStep(tutorial);
        } else if (stageBefore === 'targeting') {
          tutorial = advanceThreeStep(tutorial);
        }
        renderScene();
      },
      onSetTone: (target: NeighbourId) => {
        if (tutorial.stage === 'trust') tutorial = advanceThreeStep(tutorial);
        session.setTheTone(target);
        renderScene();
      },
      onEndEvening: () => {
        const stageBefore = tutorial.stage;
        if (stageBefore === 'trust') tutorial = advanceThreeStep(tutorial);
        if (tutorial.stage !== stageBefore) {
          // Clear the now-stale tutorial callout from the board before any
          // overlay (retention explanation, dilemma) shows on top of it.
          renderScene();
        }
        if (session.state.evening === TOTAL_EVENINGS) {
          showDilemma('room_decides', () => afterFinalDilemma());
        } else {
          startRetain();
        }
      },
      onCardChosen: (_cardId: CardId, needsTarget: boolean) => {
        if (tutorial.stage === 'trust') {
          tutorial = advanceThreeStep(tutorial);
        } else if (tutorial.stage === 'moments' && needsTarget) {
          tutorial = advanceThreeStep(tutorial);
        }
      },
      onSkipTutorial: () => {
        tutorial = skipTutorial(tutorial);
        renderScene();
      },
      getTutorialStage: () => tutorial.stage,
      getPreview: (handIndex, target) => session.previewPlayCard(handIndex, target),
      getActiveConsequence: () => session.activeConsequenceText(),
    },
    tutorial.stage,
  );
  syncTutorialUi();
}

function afterFinalDilemma() {
  startRetain();
}

function startRetain() {
  if (shouldShowRetention(tutorial, session.state.evening)) {
    showRetentionIntro(() => {
      tutorial = markRetentionSeen(tutorial);
      doStartRetain();
    });
  } else {
    doStartRetain();
  }
}

function showRetentionIntro(onDone: () => void) {
  announce(`${RETENTION_INTRO.heading} ${RETENTION_INTRO.body}`);
  showOverlay(
    `<h2>${RETENTION_INTRO.heading}</h2>
     <p>${RETENTION_INTRO.body}</p>
     <p class="tutorial-prompt">${RETENTION_INTRO.prompt}</p>
     <div class="choices">
       <button class="btn" id="retention-continue">Continue</button>
       <button class="btn secondary tutorial-skip" id="retention-skip">Skip tutorial</button>
     </div>`,
    (panel) => {
      const finish = () => {
        panel.parentElement!.remove();
        onDone();
      };
      panel.querySelector('#retention-continue')!.addEventListener('click', finish);
      panel.querySelector('#retention-skip')!.addEventListener('click', () => {
        tutorial = skipTutorial(tutorial);
        finish();
      });
    },
  );
}

function doStartRetain() {
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

  const speakYourPieceJustEntered =
    session.state.evening === 3 &&
    session.state.speakYourPieceState === 'in_hand' &&
    session.state.hand.includes('speak_your_piece');

  const proceed = () => {
    if (dilemma) {
      const afterIntro = () => showDilemma(dilemma.id, () => {
        session.snapshotBeforePlay();
        renderScene();
      });
      if (shouldShowDilemmaIntro(tutorial)) {
        showDilemmaIntro(() => {
          tutorial = markDilemmaIntroSeen(tutorial);
          afterIntro();
        });
      } else {
        afterIntro();
      }
    } else {
      session.snapshotBeforePlay();
      renderScene();
    }
  };

  if (speakYourPieceJustEntered && shouldShowSpeakYourPieceIntro(tutorial)) {
    showSpeakYourPieceIntro(() => {
      tutorial = markSpeakYourPieceIntroSeen(tutorial);
      proceed();
    });
  } else {
    proceed();
  }
}

function showDilemmaIntro(onDone: () => void) {
  announce(`${DILEMMA_INTRO.heading} ${DILEMMA_INTRO.body}`);
  showOverlay(
    `<h2>${DILEMMA_INTRO.heading}</h2>
     <p>${DILEMMA_INTRO.body}</p>
     <div class="choices">
       <button class="btn" id="dilemma-intro-ok">${DILEMMA_INTRO.button}</button>
       <button class="btn secondary tutorial-skip" id="dilemma-intro-skip">Skip tutorial</button>
     </div>`,
    (panel) => {
      const finish = () => {
        panel.parentElement!.remove();
        onDone();
      };
      panel.querySelector('#dilemma-intro-ok')!.addEventListener('click', finish);
      panel.querySelector('#dilemma-intro-skip')!.addEventListener('click', () => {
        tutorial = skipTutorial(tutorial);
        finish();
      });
    },
  );
}

function showSpeakYourPieceIntro(onDone: () => void) {
  announce(`${SPEAK_YOUR_PIECE_INTRO.heading} ${SPEAK_YOUR_PIECE_INTRO.body}`);
  showOverlay(
    `<h2>${SPEAK_YOUR_PIECE_INTRO.heading}</h2>
     <p>${SPEAK_YOUR_PIECE_INTRO.body}</p>
     <div class="choices">
       <button class="btn" id="syp-intro-ok">${SPEAK_YOUR_PIECE_INTRO.button}</button>
       <button class="btn secondary tutorial-skip" id="syp-intro-skip">Skip tutorial</button>
     </div>`,
    (panel) => {
      const finish = () => {
        panel.parentElement!.remove();
        onDone();
      };
      panel.querySelector('#syp-intro-ok')!.addEventListener('click', finish);
      panel.querySelector('#syp-intro-skip')!.addEventListener('click', () => {
        tutorial = skipTutorial(tutorial);
        finish();
      });
    },
  );
}

function dilemmaOptionHtml(opt: { label: string; immediate: string; delayed: string; sacrifice: string }): string {
  return `
    <div class="choice-label">${opt.label}</div>
    <div class="choice-detail"><b>Immediate:</b> ${opt.immediate}</div>
    <div class="choice-detail"><b>Delayed:</b> ${opt.delayed}</div>
    <div class="choice-detail"><b>Sacrifice:</b> ${opt.sacrifice}</div>
  `;
}

function showDilemma(id: string, onDone: () => void) {
  const copy = DILEMMA_COPY[id];
  const overlay = showOverlay(
    `<div class="dilemma-card">
       <h2>${copy.title}</h2>
       <p>${copy.body}</p>
       <div class="choices">
         <button class="choice" id="opt-a">${dilemmaOptionHtml(copy.a)}</button>
         <button class="choice" id="opt-b">${dilemmaOptionHtml(copy.b)}</button>
       </div>
     </div>`,
    () => {},
  );
  const choose = (choice: 'A' | 'B') => {
    dilemmaChoicesMade[id] = choice;
    const before = snapshotUT();
    session.resolveDilemma(id, choice);
    const after = snapshotUT();
    const msg = describeDelta(before, after);
    if (msg) announce(msg);
    overlay.parentElement!.remove();
    onDone();
  };
  overlay.querySelector('#opt-a')!.addEventListener('click', () => choose('A'));
  overlay.querySelector('#opt-b')!.addEventListener('click', () => choose('B'));
}

function speakYourPieceStatusLabel(): string {
  switch (session.state.speakYourPieceState) {
    case 'exhausted': return 'Played';
    case 'discarded': return 'Expired unplayed';
    case 'retained_once': return 'Expired unplayed';
    case 'in_hand': return 'Unplayed';
    default: return 'Not yet introduced';
  }
}

function showReview() {
  const rows = NEIGHBOURS.map((n) => {
    const u = session.state.u[n];
    return `<tr><td>${neighbourName(n)}</td><td>${bandLabel(u)}</td><td>${Math.round(u)}%</td></tr>`;
  }).join('');

  const categoryRows = CARD_CATEGORIES.map((cat) => `<tr><td>${cat}</td><td>${cardsPlayedByCategory[cat]}</td></tr>`).join('');

  const dilemmaRows = Object.entries(dilemmaChoicesMade).map(([id, choice]) => {
    const copy = DILEMMA_COPY[id];
    const chosenText = (choice === 'A' ? copy.a : copy.b).label;
    return `<tr><td>${copy.title}</td><td>${chosenText}</td></tr>`;
  }).join('') || '<tr><td colspan="2">None reached</td></tr>';

  showOverlay(
    `<h2>Review the meeting</h2>
     <table class="review-table">
       <thead><tr><th>Neighbour</th><th>State</th><th>Understanding</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <p><b>Shared Trust:</b> ${Math.round(session.state.trust)} &nbsp; <b>Evening reached:</b> ${session.state.evening} of ${TOTAL_EVENINGS}</p>
     <table class="review-table">
       <thead><tr><th>Cards played</th><th>Count</th></tr></thead>
       <tbody>${categoryRows}</tbody>
     </table>
     <table class="review-table">
       <thead><tr><th>Dilemma</th><th>Choice made</th></tr></thead>
       <tbody>${dilemmaRows}</tbody>
     </table>
     <p><b>Speak Your Piece:</b> ${speakYourPieceStatusLabel()}</p>
     <button class="btn" id="review-close">Close</button>`,
    (panel) => {
      panel.querySelector('#review-close')!.addEventListener('click', () => {
        panel.parentElement!.remove();
      });
    },
  );
}

// A concise, neutral causal explanation of how the session actually ended
// (item 10) — built entirely from real session data (session.state,
// dilemmaChoicesMade, cardsPlayedByCategory), never a grade or a guess.
function buildCausalSummary(): string[] {
  const lines: string[] = [];
  for (const n of NEIGHBOURS) {
    const u = session.state.u[n];
    if (u >= CLEAR_THRESHOLD) {
      lines.push(`${neighbourName(n)} reached Clear (${Math.round(u)}%).`);
    } else {
      const short = Math.ceil(CLEAR_THRESHOLD - u);
      lines.push(`${neighbourName(n)} finished ${short} Understanding short of Clear (${Math.round(u)}%).`);
    }
  }
  lines.push(`Final Trust: ${Math.round(session.state.trust)}.`);

  const neverUnlocked = Object.values(CARDS).filter(
    (def) => def.requiresTrust !== undefined && session.state.trust < def.requiresTrust,
  );
  if (neverUnlocked.length) {
    lines.push(
      `Never unlocked: ${neverUnlocked.map((def) => `${def.name} (needs ${def.requiresTrust} Trust)`).join(', ')}.`,
    );
  }

  lines.push(`Speak Your Piece: ${speakYourPieceStatusLabel()}.`);

  for (const [id, choice] of Object.entries(dilemmaChoicesMade)) {
    const copy = DILEMMA_COPY[id];
    const opt = choice === 'A' ? copy.a : copy.b;
    const consequence = opt.sacrifice !== 'None.' ? opt.sacrifice : opt.delayed !== 'None.' ? opt.delayed : null;
    lines.push(`${copy.title} → chose "${opt.label}"${consequence ? `: ${consequence}` : ''}`);
  }

  const totalCards = Object.values(cardsPlayedByCategory).reduce((a, b) => a + b, 0);
  if (totalCards > 0) {
    const [dominantCategory, dominantCount] = (Object.entries(cardsPlayedByCategory) as [CardCategory, number][])
      .sort((a, b) => b[1] - a[1])[0];
    lines.push(`Most-played card type this session: ${dominantCategory} (${dominantCount} of ${totalCards} cards) — an observation about how you played, not a verdict.`);
  }

  return lines;
}

function showResult() {
  const won = session.state.won;
  const copy = won ? VICTORY : FAILURE;
  const eyebrow = won ? VICTORY.eyebrow(session.state.evening) : FAILURE.eyebrow;
  const summaryLines = buildCausalSummary();

  showOverlay(
    `<p class="result-eyebrow">${eyebrow}</p>
     <h2>${copy.heading}</h2>
     <p>${copy.body}</p>
     <ul class="result-summary">${summaryLines.map((l) => `<li>${l}</li>`).join('')}</ul>
     <div class="choices">
       <button class="btn" id="restart">${copy.primary}</button>
       <button class="btn secondary" id="review">${copy.secondary}</button>
     </div>`,
    (panel) => {
      panel.querySelector('#restart')!.addEventListener('click', () => {
        panel.parentElement!.remove();
        newGame(Date.now() % 1_000_000, false);
      });
      panel.querySelector('#review')!.addEventListener('click', () => showReview());
    },
  );
}

function showScenario() {
  showOverlay(
    `<h2>${SCENARIO.title}</h2>
     ${SCENARIO.body.split('\n\n').map((p) => `<p>${p}</p>`).join('')}
     <div class="choices">
       <button class="btn" id="begin-meeting">${SCENARIO.primary}</button>
       <button class="btn secondary" id="how-to-play">${SCENARIO.secondary}</button>
     </div>`,
    (panel) => {
      panel.querySelector('#begin-meeting')!.addEventListener('click', () => {
        panel.parentElement!.remove();
        newGame(initialSeed, false);
      });
      panel.querySelector('#how-to-play')!.addEventListener('click', () => {
        panel.parentElement!.remove();
        newGame(initialSeed, true);
      });
    },
  );
}

function newGame(gameSeed: number, forceTutorialReplay: boolean) {
  session = new CardGameSession(gameSeed);
  extraRetainThisEvening = false;
  tutorial = createTutorialState(forceTutorialReplay);
  dilemmaChoicesMade = {};
  cardsPlayedByCategory = { 'Talk-style': 0, Online: 0, Group: 0, Utility: 0 };
  previousTutorialStage = null;
  restoreFocusAfterTutorial = null;
  advanceEvening();
}

// Skipping the opening scenario entirely (e.g. an automated/e2e run passing
// ?skiptutorial=1) starts the game immediately with the tutorial off, for
// deterministic non-interactive testing without touching game state.
if (params.get('skiptutorial') === '1') {
  newGame(initialSeed, false);
  tutorial = skipTutorial(tutorial);
  renderScene();
} else {
  showScenario();
}
