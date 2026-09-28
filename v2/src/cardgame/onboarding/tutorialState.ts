// Pure UI-preference state for the first-game contextual tutorial and the
// one-time onboarding moments (retention explanation, dilemma introduction,
// Speak Your Piece introduction). Deliberately outside CardGameSession/
// engine — per onboarding-and-outcomes.md, "Tutorial state is interface
// preference only; it must never enter or alter the seeded game simulation."
// Nothing here is read by, or written into, src/cardgame/engine/*.

const STORAGE_KEY = 'onevoice_cardgame_tutorial_seen';

export type ThreeStepStage = 'moments' | 'targeting' | 'trust' | null;

export interface TutorialState {
  /** Whether tutorial content (3-step walkthrough + the three one-time
   * intros) should appear at all for the current playthrough. */
  active: boolean;
  /** Which of the first three steps is currently showing, if any. */
  stage: ThreeStepStage;
  /** True once step 3 has been dismissed — the 3-step walkthrough is done,
   * but the retention/dilemma/Speak Your Piece intros can still occur. */
  threeStepDone: boolean;
  seenRetention: boolean;
  seenDilemmaIntro: boolean;
  seenSpeakYourPieceIntro: boolean;
}

function hasCompletedTutorialBefore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode, tests, etc.) — treat as first game
  }
}

export function markTutorialCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* best-effort only; never block the game on this */
  }
}

/** `forceReplay` is the "How to play" control — always re-enables the
 * walkthrough for the next game, regardless of prior completion. */
export function createTutorialState(forceReplay: boolean): TutorialState {
  const active = forceReplay || !hasCompletedTutorialBefore();
  return {
    active,
    stage: active ? 'moments' : null,
    threeStepDone: !active,
    seenRetention: !active,
    seenDilemmaIntro: !active,
    seenSpeakYourPieceIntro: !active,
  };
}

/** Skipping never changes game state — only tutorial-display state. Marks
 * the tutorial as completed so future games default to off. */
export function skipTutorial(state: TutorialState): TutorialState {
  markTutorialCompleted();
  return {
    ...state,
    active: false,
    stage: null,
    threeStepDone: true,
    seenRetention: true,
    seenDilemmaIntro: true,
    seenSpeakYourPieceIntro: true,
  };
}

export function advanceThreeStep(state: TutorialState): TutorialState {
  if (!state.active) return state;
  if (state.stage === 'moments') return { ...state, stage: 'targeting' };
  if (state.stage === 'targeting') return { ...state, stage: 'trust' };
  if (state.stage === 'trust') {
    markTutorialCompleted();
    return { ...state, stage: null, threeStepDone: true };
  }
  return state;
}

export function shouldShowRetention(state: TutorialState, evening: number): boolean {
  return state.active && evening === 1 && !state.seenRetention;
}

export function markRetentionSeen(state: TutorialState): TutorialState {
  return { ...state, seenRetention: true };
}

export function shouldShowDilemmaIntro(state: TutorialState): boolean {
  return state.active && !state.seenDilemmaIntro;
}

export function markDilemmaIntroSeen(state: TutorialState): TutorialState {
  return { ...state, seenDilemmaIntro: true };
}

export function shouldShowSpeakYourPieceIntro(state: TutorialState): boolean {
  return state.active && !state.seenSpeakYourPieceIntro;
}

export function markSpeakYourPieceIntroSeen(state: TutorialState): TutorialState {
  return { ...state, seenSpeakYourPieceIntro: true };
}
