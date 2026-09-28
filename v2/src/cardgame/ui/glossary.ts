// Delegated, DOM-stable wiring for `.glossary-term` disclosure buttons
// rendered anywhere inside `root` by content/glossary.ts's glossaryTerm().
// Attached once at app start (root is emptied and rebuilt on every render(),
// so per-instance listeners would leak/duplicate) — opens on click AND on
// keyboard focus, never on hover alone, per onboarding-and-outcomes.md.
export function installGlossaryDisclosures(root: HTMLElement) {
  function tipFor(btn: Element): HTMLElement | null {
    const id = btn.getAttribute('aria-describedby');
    return id ? document.getElementById(id) : null;
  }
  function open(btn: HTMLElement) {
    const tip = tipFor(btn);
    if (!tip) return;
    tip.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }
  function close(btn: HTMLElement) {
    const tip = tipFor(btn);
    if (!tip) return;
    tip.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  root.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.glossary-term') as HTMLElement | null;
    if (!btn) return;
    e.stopPropagation();
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) close(btn); else open(btn);
  });

  root.addEventListener(
    'focusin',
    (e) => {
      const btn = (e.target as HTMLElement).closest('.glossary-term') as HTMLElement | null;
      if (btn) open(btn);
    },
  );

  root.addEventListener(
    'focusout',
    (e) => {
      const btn = (e.target as HTMLElement).closest('.glossary-term') as HTMLElement | null;
      if (btn) close(btn);
    },
  );
}
