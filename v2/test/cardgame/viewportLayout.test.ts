// @vitest-environment jsdom
//
// Regression test for the viewport/layout bug Giorgio found in the second
// playtest: the End Evening control (and content below the cards) could
// scroll off-screen. jsdom does not perform real layout, so this test
// cannot measure pixels — instead it asserts the DOM invariant the CSS fix
// depends on: the action footer is a direct sibling of the scrollable card
// region (never inside it), is rendered exactly once, and is never removed
// or duplicated at any point across a full game — including while cards,
// the preview bar, and the meeting log are present, which is exactly the
// content that used to push it off-screen.
import { describe, it, expect, vi } from 'vitest';

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

/** Asserts the structural invariant that keeps the progression control from
 * ever being scrolled off-screen: it must exist exactly once, as the LAST
 * direct child of #cardgame, never nested inside the scrollable region. */
function expectFooterStructurallySafe() {
  const cardgame = q('#cardgame')!;
  const children = Array.from(cardgame.children);
  expect(children.length).toBe(2);
  expect(children[0].className).toBe('game-scroll-wrap');
  expect(children[1].className).toBe('action-footer');

  const footers = qAll('.action-footer');
  expect(footers.length).toBe(1);
  const endButtons = qAll('.end-evening-btn');
  expect(endButtons.length).toBe(1);
  expect(footers[0].contains(endButtons[0])).toBe(true);

  // The button must not live inside the scrollable card region, or scrolling
  // the cards would carry it off-screen again.
  expect(q('.game-scroll .end-evening-btn')).toBeNull();
  expect(q('.game-scroll-wrap .end-evening-btn')).toBeNull();
}

describe('persistent progression control (viewport/layout fix)', () => {
  it('stays outside the scrollable region on the initial board', async () => {
    await freshImport('?seed=300&skiptutorial=1');
    expectFooterStructurallySafe();
  });

  it('stays outside the scrollable region while a card is armed and its preview bar is showing', async () => {
    await freshImport('?seed=301&skiptutorial=1');
    const card = qAll('.hand-row .card:not(.unaffordable)')[0];
    click(card);
    expect(q('.play-action-bar')).not.toBeNull();
    expectFooterStructurallySafe();

    const target = q('.neighbour-card.targetable');
    if (target) click(target);
    expectFooterStructurallySafe();
  });

  it('stays outside the scrollable region once the meeting log has entries', async () => {
    await freshImport('?seed=302&skiptutorial=1');
    const card = qAll('.hand-row .card:not(.unaffordable)')[0];
    click(card);
    const target = q('.neighbour-card.targetable');
    if (target) click(target);
    click(q('#confirm-play'));
    expect(q('.meeting-log')).not.toBeNull();
    expectFooterStructurallySafe();
  });

  it('is checked at every non-overlay step across a full 6-Evening game (cards, retain/discard, dilemmas, End Evening)', async () => {
    await freshImport('?seed=303');
    let checks = 0;
    for (let i = 0; i < 500; i++) {
      const overlay = q('.overlay');
      if (overlay) {
        if (q('.result-eyebrow')) break;
        if (q('#begin-meeting')) { click(q('#begin-meeting')); continue; }
        if (q('#retention-continue')) { click(q('#retention-continue')); continue; }
        if (q('#dilemma-intro-ok')) { click(q('#dilemma-intro-ok')); continue; }
        if (q('#syp-intro-ok')) { click(q('#syp-intro-ok')); continue; }
        if (q('#opt-a')) { click(q('#opt-a')); continue; }
        if (q('#retain-done')) { click(q('#retain-done')); continue; }
        throw new Error('autoplay hit an unrecognised overlay: ' + overlay.innerHTML.slice(0, 200));
      }
      // No overlay covering the board: the control must be actionable and
      // structurally safe right now.
      expectFooterStructurallySafe();
      checks++;

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
    // Sanity: the loop actually exercised many board states, not just the
    // opening screen.
    expect(checks).toBeGreaterThan(10);
    expect(q('.result-eyebrow')).not.toBeNull();
  });
});
