// @vitest-environment jsdom
// Pure unit tests for the UI-only onboarding state machine
// (src/cardgame/onboarding/tutorialState.ts). No DOM, no engine — verifies
// the timing rules from onboarding-and-outcomes.md directly against the
// exported functions, independent of how main.ts happens to wire them up.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTutorialState, skipTutorial, advanceThreeStep,
  markTutorialCompleted,
  shouldShowRetention, markRetentionSeen,
  shouldShowDilemmaIntro, markDilemmaIntroSeen,
  shouldShowSpeakYourPieceIntro, markSpeakYourPieceIntroSeen,
} from '../../src/cardgame/onboarding/tutorialState';

const STORAGE_KEY = 'onevoice_cardgame_tutorial_seen';

beforeEach(() => {
  localStorage.clear();
});

describe('createTutorialState', () => {
  it('is active on a first game (nothing in storage)', () => {
    const t = createTutorialState(false);
    expect(t.active).toBe(true);
    expect(t.stage).toBe('moments');
    expect(t.threeStepDone).toBe(false);
  });

  it('is inactive once the tutorial was previously completed', () => {
    markTutorialCompleted();
    const t = createTutorialState(false);
    expect(t.active).toBe(false);
    expect(t.stage).toBeNull();
    expect(t.threeStepDone).toBe(true);
    expect(t.seenRetention).toBe(true);
    expect(t.seenDilemmaIntro).toBe(true);
    expect(t.seenSpeakYourPieceIntro).toBe(true);
  });

  it('"How to play" (forceReplay) re-activates it even after completion', () => {
    markTutorialCompleted();
    const t = createTutorialState(true);
    expect(t.active).toBe(true);
    expect(t.stage).toBe('moments');
  });
});

describe('advanceThreeStep', () => {
  it('progresses moments -> targeting -> trust -> done, marking storage only at the end', () => {
    let t = createTutorialState(false);
    expect(t.stage).toBe('moments');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    t = advanceThreeStep(t);
    expect(t.stage).toBe('targeting');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    t = advanceThreeStep(t);
    expect(t.stage).toBe('trust');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    t = advanceThreeStep(t);
    expect(t.stage).toBeNull();
    expect(t.threeStepDone).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('is a no-op once the tutorial is inactive', () => {
    const t = createTutorialState(false);
    const skipped = skipTutorial(t);
    expect(advanceThreeStep(skipped)).toEqual(skipped);
  });
});

describe('skipTutorial', () => {
  it('turns off every remaining onboarding moment at once and persists completion', () => {
    const t = createTutorialState(false);
    const skipped = skipTutorial(t);
    expect(skipped.active).toBe(false);
    expect(skipped.stage).toBeNull();
    expect(skipped.threeStepDone).toBe(true);
    expect(skipped.seenRetention).toBe(true);
    expect(skipped.seenDilemmaIntro).toBe(true);
    expect(skipped.seenSpeakYourPieceIntro).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });
});

describe('one-time onboarding moments', () => {
  it('the retention explanation is offered only on Evening 1, and only until seen', () => {
    const t = createTutorialState(false);
    expect(shouldShowRetention(t, 1)).toBe(true);
    expect(shouldShowRetention(t, 2)).toBe(false);
    expect(shouldShowRetention(t, 3)).toBe(false);

    const seen = markRetentionSeen(t);
    expect(shouldShowRetention(seen, 1)).toBe(false);
  });

  it('never offers the retention explanation once tutorial is inactive', () => {
    const t = skipTutorial(createTutorialState(false));
    expect(shouldShowRetention(t, 1)).toBe(false);
  });

  it('the dilemma introduction shows exactly once, however many dilemmas follow', () => {
    let t = createTutorialState(false);
    expect(shouldShowDilemmaIntro(t)).toBe(true);
    t = markDilemmaIntroSeen(t);
    expect(shouldShowDilemmaIntro(t)).toBe(false);
    // A later dilemma (Evening 6's "room_decides", or any other) must not
    // bring it back.
    expect(shouldShowDilemmaIntro(t)).toBe(false);
  });

  it('the Speak Your Piece introduction shows exactly once', () => {
    let t = createTutorialState(false);
    expect(shouldShowSpeakYourPieceIntro(t)).toBe(true);
    t = markSpeakYourPieceIntroSeen(t);
    expect(shouldShowSpeakYourPieceIntro(t)).toBe(false);
  });

  it('a returning player (tutorial already completed) sees none of the one-time moments', () => {
    markTutorialCompleted();
    const t = createTutorialState(false);
    expect(shouldShowRetention(t, 1)).toBe(false);
    expect(shouldShowDilemmaIntro(t)).toBe(false);
    expect(shouldShowSpeakYourPieceIntro(t)).toBe(false);
  });
});
