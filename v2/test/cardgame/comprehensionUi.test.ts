// @vitest-environment jsdom
//
// DOM-level tests for the comprehension pass Giorgio requested after the
// first genuine playtest exposed major comprehension blockers: objective
// visibility, explicit state progression, outcome preview before commit,
// legal-target highlighting, trait/lock explanations, resolution feedback,
// dilemma clarity, and the causal outcome summary. Driven through real
// click/keydown events, same harness as onboardingUi.test.ts.
import { describe, it, expect, vi } from 'vitest';
import { OBJECTIVE, VICTORY, FAILURE } from '../../src/cardgame/content/onboardingCopy';
import { TRAIT_EXPLANATION } from '../../src/cardgame/content/traitCopy';

function setUrl(query: string) {
  window.history.pushState({}, '', `/card.html${query}`);
}

async function freshImport(query: string) {
  vi.resetModules();
  document.documentElement.replaceChild(document.createElement('body'), document.body);
  document.body.innerHTML = '<div id="cardgame"></div>';
  setUrl(query);
  await import('../../src/cardgame/ui/main');
}

function q<T extends Element = Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}
function qAll<T extends Element = Element>(sel: string): T[] {
  return Array.from(document.querySelectorAll<T>(sel));
}
function click(el: Element | null) {
  if (!el) throw new Error('tried to click a missing element');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('persistent objective banner (item 1)', () => {
  it('is visible immediately on the board, independent of the tutorial or opening screen', async () => {
    await freshImport('?seed=100&skiptutorial=1');
    const banner = q('.objective-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain(OBJECTIVE.text);
    expect(banner!.textContent).toContain('0/3 Clear');
  });
});

describe('explicit state progression (item 2)', () => {
  it('shows the next threshold near each neighbour\'s current value', async () => {
    await freshImport('?seed=101&skiptutorial=1');
    const labels = qAll('.neighbour-card .meter-label').map((el) => el.textContent);
    expect(labels.some((t) => /to Listening/.test(t!))).toBe(true);
  });
});

describe('trait meaning on neighbour cards (item 5)', () => {
  it('shows the concrete multiplier text, not just the bare trait word', async () => {
    await freshImport('?seed=102&skiptutorial=1');
    const traitTags = qAll('.neighbour-card .trait-tag').map((el) => el.textContent);
    expect(traitTags).toContain(TRAIT_EXPLANATION.rosa);
    expect(traitTags).toContain(TRAIT_EXPLANATION.ines);
    expect(traitTags).toContain(TRAIT_EXPLANATION.hugo);
  });
});

describe('outcome preview before committing a targeted card (item 3)', () => {
  it('shows nothing changes until Play card is pressed, and the preview matches the actual resolution', async () => {
    await freshImport('?seed=103&skiptutorial=1');
    const card = qAll('.hand-row .card:not(.unaffordable)')[0];
    expect(card).toBeTruthy();
    const trustBefore = q('.status-strip')!.textContent;

    click(card);
    const target = q('.neighbour-card.targetable');
    if (target) click(target);

    // Armed but not yet confirmed: preview panel visible, game state unchanged.
    expect(q('.play-action-bar')).not.toBeNull();
    const preview = q('.play-preview');
    expect(preview).not.toBeNull();
    expect(preview!.textContent!.length).toBeGreaterThan(0);
    expect(q('.status-strip')!.textContent).toBe(trustBefore);

    const confirmBtn = q<HTMLButtonElement>('#confirm-play')!;
    expect(confirmBtn.disabled).toBe(false);
    click(confirmBtn);

    // Committed: action bar gone, state actually changed, and a meeting-log
    // entry recorded the resolution.
    expect(q('.play-action-bar')).toBeNull();
    expect(q('.status-strip')!.textContent).not.toBe(trustBefore);
    expect(q('.meeting-log')).not.toBeNull();
  });

  it('requires a second activation (or Play card) before a card resolves — selecting alone never plays it', async () => {
    await freshImport('?seed=104&skiptutorial=1');
    const handBefore = qAll('.hand-row .card').length;
    const card = qAll('.hand-row .card:not(.unaffordable)')[0];
    click(card);
    const target = q('.neighbour-card.targetable');
    if (target) click(target);
    // Still armed, not committed — hand size unchanged.
    expect(qAll('.hand-row .card').length).toBe(handBefore);
  });
});

describe('visible legal targets (item 4)', () => {
  it('marks legal neighbours as targetable while a targeted card is armed, and shows a choose-a-neighbour instruction', async () => {
    await freshImport('?seed=105&skiptutorial=1');
    for (const card of qAll('.hand-row .card:not(.unaffordable)')) {
      click(card);
      const targetable = qAll('.neighbour-card.targetable');
      if (targetable.length > 0) {
        expect(q('.play-instruction')!.textContent).toMatch(/highlighted neighbour/i);
        return;
      }
      // untargeted card: instruction says so explicitly instead.
      if (q('.play-action-bar')) {
        expect(q('.play-instruction')!.textContent).toMatch(/No target required/i);
        return;
      }
    }
    throw new Error('no hand card produced a play-action-bar');
  });
});

describe('locked-card explanations (item 6)', () => {
  it('states the exact Trust shortfall for a Trust-gated card, not just reduced opacity', async () => {
    // Trust starts at 20, well below both Trust-gated cards' requirements
    // (30/40), so search seeds for the first opening hand that actually
    // draws one, rather than asserting on a single seed that might not.
    let found: Element | null = null;
    for (let seed = 200; seed < 260 && !found; seed++) {
      await freshImport(`?seed=${seed}&skiptutorial=1`);
      found = qAll('.card .lock-text').find((el) => /needs \d+ Trust/.test(el.textContent ?? '')) ?? null;
    }
    expect(found).not.toBeNull();
    expect(found!.textContent).toMatch(/Locked · needs \d+ Trust · currently \d+ · \d+ more Trust required/);
  });
});

describe('dilemma clarity (item 8)', () => {
  it('shows immediate, delayed and sacrifice for each option before the player chooses', async () => {
    await freshImport('?seed=107&skiptutorial=1');
    // Play through Evening 1 to reach the Evening-2 dilemma.
    for (let i = 0; i < 30 && !q('.dilemma-card'); i++) {
      const card = qAll('.hand-row .card:not(.unaffordable)')[0];
      if (card) {
        click(card);
        const target = q('.neighbour-card.targetable');
        if (target) click(target);
        const confirmBtn = q<HTMLButtonElement>('#confirm-play');
        if (confirmBtn && !confirmBtn.disabled) click(confirmBtn);
        continue;
      }
      if (q('#retention-continue')) { click(q('#retention-continue')); continue; }
      if (q('#dilemma-intro-ok')) { click(q('#dilemma-intro-ok')); continue; }
      if (q('#retain-done')) { click(q('#retain-done')); continue; }
      click(q('.end-evening-btn'));
    }
    const dilemma = q('.dilemma-card');
    expect(dilemma).not.toBeNull();
    const optA = q('#opt-a')!;
    expect(optA.textContent).toMatch(/Immediate:/);
    expect(optA.textContent).toMatch(/Delayed:/);
    expect(optA.textContent).toMatch(/Sacrifice:/);

    click(optA);
    // An active consequence (if this option caused one) must show as a
    // persistent one-line reminder on the board.
    const reminder = q('.consequence-reminder');
    if (reminder) expect(reminder.textContent!.length).toBeGreaterThan(0);
  });
});

/** Drives a full 6-Evening game through real DOM events using the new
 * arm-then-confirm interaction, making the same deterministic choices as
 * onboardingUi.test.ts's autoplayToResult. */
function autoplayToResult(maxSteps = 500) {
  for (let i = 0; i < maxSteps; i++) {
    const overlay = q('.overlay');
    if (overlay) {
      if (q('.result-eyebrow')) return;
      if (q('#begin-meeting')) { click(q('#begin-meeting')); continue; }
      if (q('#retention-continue')) { click(q('#retention-continue')); continue; }
      if (q('#dilemma-intro-ok')) { click(q('#dilemma-intro-ok')); continue; }
      if (q('#syp-intro-ok')) { click(q('#syp-intro-ok')); continue; }
      if (q('#opt-a')) { click(q('#opt-a')); continue; }
      if (q('#retain-done')) { click(q('#retain-done')); continue; }
      throw new Error('autoplay hit an unrecognised overlay: ' + overlay.innerHTML.slice(0, 200));
    }
    const card = qAll('.hand-row .card:not(.unaffordable)')[0];
    if (card) {
      click(card);
      const target = q('.neighbour-card.targetable');
      if (target) click(target);
      const confirmBtn = q<HTMLButtonElement>('#confirm-play');
      if (confirmBtn && !confirmBtn.disabled) click(confirmBtn);
      continue;
    }
    click(q('.end-evening-btn'));
  }
  throw new Error('autoplay did not reach a result screen within the step budget');
}

describe('outcome explanation (item 10)', () => {
  it('gives a concise causal summary built from real session data, not a grade', async () => {
    await freshImport('?seed=108&skiptutorial=1');
    autoplayToResult();
    expect([VICTORY.heading, FAILURE.heading]).toContain(q('h2')!.textContent);
    const summary = qAll('.result-summary li').map((li) => li.textContent).join(' | ');
    expect(summary).toMatch(/Final Trust: \d+/);
    expect(summary).toMatch(/Speak Your Piece:/);
    expect(summary).toMatch(/short of Clear|reached Clear/);
    // Never a numeric grade or score — Giorgio's narrative-only requirement,
    // extended to the new causal summary.
    expect(summary).not.toMatch(/\bgrade\b|\bscore\b/i);
  });
});
