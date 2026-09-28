// A single, persistent polite live region for announcing resolved card and
// dilemma effects once (never decorative meter-animation frames), per
// onboarding-and-outcomes.md's "Motion and accessibility" section. Created
// once and reused — screen readers announce a live region's text only when
// it changes, so this must never be recreated by render()'s full rebuilds.
let region: HTMLElement | null = null;

export function getLiveRegion(): HTMLElement {
  if (region && region.isConnected) return region;
  region = document.createElement('div');
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('role', 'status');
  document.body.appendChild(region);
  return region;
}

export function announce(text: string) {
  const el = getLiveRegion();
  // Force a change even if the text is identical to the last announcement,
  // so a repeated effect (e.g. the same card played twice) is still read.
  el.textContent = '';
  // eslint-disable-next-line no-void
  void el.offsetWidth;
  el.textContent = text;
}

export function neighbourName(id: 'rosa' | 'ines' | 'hugo'): string {
  return id === 'rosa' ? 'Rosa' : id === 'ines' ? 'Inés' : 'Hugo';
}

/** Builds "Rosa gained 15 Understanding. Trust increased by 2." from a
 * before/after snapshot of the three neighbours' Understanding and Trust.
 * Returns null when nothing actually changed (nothing to announce). */
export function describeDelta(
  before: { u: Record<'rosa' | 'ines' | 'hugo', number>; trust: number },
  after: { u: Record<'rosa' | 'ines' | 'hugo', number>; trust: number },
): string | null {
  const parts: string[] = [];
  for (const n of ['rosa', 'ines', 'hugo'] as const) {
    const delta = Math.round(after.u[n]) - Math.round(before.u[n]);
    if (delta > 0) parts.push(`${neighbourName(n)} gained ${delta} Understanding.`);
    else if (delta < 0) parts.push(`${neighbourName(n)} lost ${-delta} Understanding.`);
  }
  const trustDelta = Math.round(after.trust) - Math.round(before.trust);
  if (trustDelta > 0) parts.push(`Trust increased by ${trustDelta}.`);
  else if (trustDelta < 0) parts.push(`Trust decreased by ${-trustDelta}.`);
  return parts.length ? parts.join(' ') : null;
}
