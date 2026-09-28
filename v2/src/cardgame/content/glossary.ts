// Glossary copy, verbatim from onboarding-and-outcomes.md's "Contextual
// explanations" table. Rendered as keyboard- and touch-accessible tap
// disclosures (see ui/glossary.ts for the interactive wiring) — never as
// hover-only tooltips, and never as a permanent paragraph of rules text.
export const GLOSSARY: Record<string, string> = {
  Moments: 'What you can spend this Evening. Refreshes to 3 unless a dilemma changes it.',
  Trust: 'Shared by the whole table. Unlocks cards and improves Trust-scaled effects.',
  Understanding: 'How clearly this neighbour sees the situation. Reach 70 to become Clear.',
  Guarded: 'Understanding 0–34. This neighbour is not ready to act yet.',
  Listening: 'Understanding 35–69. This neighbour is open, but not yet Clear.',
  Clear: 'Understanding 70–100. This neighbour is ready to act with the group.',
  'Talk-style': "Applies the target's Talker or Wary multiplier.",
  Online: 'Applies the Online multiplier. No other trait multiplier applies.',
  'All neighbours': 'Affects Rosa, Inés, and Hugo. Group cards use no trait multiplier.',
  Retain: 'Keep an unplayed card for the next Evening. Normally limited to one.',
  Exhaust: 'Remove this card after play. It never enters the discard pile or reshuffle.',
  Draw: 'Add cards from the draw pile to your hand.',
  Discard: 'Place a card in the discard pile. It may return after a reshuffle.',
  'Set the Tone':
    "Once per Evening, before your first card: name one neighbour. After that card's trait multiplier, add a flat +5 Understanding to them.",
};

export type GlossaryTermName = keyof typeof GLOSSARY;

let glossaryUid = 0;

/** Renders a term as a tap/keyboard-focus disclosure button + hidden tip,
 * wired up generically by ui/glossary.ts's delegated listeners. */
export function glossaryTerm(term: GlossaryTermName, label: string = term): string {
  const copy = GLOSSARY[term];
  const id = `glossary-tip-${glossaryUid++}`;
  return (
    `<span class="glossary">` +
    `<button type="button" class="glossary-term" aria-describedby="${id}" aria-expanded="false">${label}</button>` +
    `<span class="glossary-tip" id="${id}" role="tooltip" hidden>${copy}</span>` +
    `</span>`
  );
}

// Wraps the FIRST occurrence of each known glossary term found in `text`
// with an accessible disclosure, leaving the rest of the prose untouched.
// Used for card-effect/flavor and dilemma copy, which are plain strings.
const TERMS_BY_LENGTH_DESC = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

export function glossaryize(text: string): string {
  let result = text;
  for (const term of TERMS_BY_LENGTH_DESC) {
    const idx = result.indexOf(term);
    if (idx === -1) continue;
    // Skip if already inside a tag (rough guard: no '<' between a preceding '<' and this index without a closing '>').
    const before = result.slice(0, idx);
    if ((before.match(/</g)?.length ?? 0) !== (before.match(/>/g)?.length ?? 0)) continue;
    result = before + glossaryTerm(term as GlossaryTermName, term) + result.slice(idx + term.length);
  }
  return result;
}
