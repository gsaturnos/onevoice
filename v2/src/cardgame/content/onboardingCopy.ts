// Verbatim copy from onboarding-and-outcomes.md — the authoritative spec for
// this phase. Do not paraphrase; Giorgio's exact narrative wording is load-bearing.

export const SCENARIO = {
  title: 'The Kitchen Table',
  body:
    "The clinic on the corner is closing. Tonight, Rosa, Inés, and Hugo have come to Inés's kitchen table—the one place in the building where people still speak freely.\n\n" +
    'You have six Evenings to help the room move from guarded silence to shared clarity.',
  primary: 'Begin the meeting',
  secondary: 'How to play',
};

export const THREE_STEP = {
  moments: {
    heading: 'Choose what to spend this Evening.',
    body: 'You begin each Evening with 3 Moments. The number on a card is its cost. You may play any cards you can afford.',
    prompt: 'Choose a 1-Moment card.',
  },
  targeting: {
    heading: 'Choose who needs to hear it.',
    body: 'A glowing edge marks every legal target. Some cards affect one neighbour; cards marked All neighbours affect the whole table.',
    prompt: 'Choose a neighbour.',
  },
  trust: {
    heading: 'Progress has two parts.',
    body: 'Understanding belongs to each neighbour. Trust belongs to the whole table. Trust strengthens some cards and unlocks others.',
    stateKey: 'Guarded 0–34 · Listening 35–69 · Clear 70–100',
    prompt: 'Continue the Evening.',
  },
};

export const RETENTION_INTRO = {
  heading: 'Save one thought for tomorrow.',
  body: 'Choose one unplayed card to retain. Everything else is discarded before the next hand is drawn.',
  prompt: 'Retain a card—or continue without one.',
};

export const DILEMMA_INTRO = {
  heading: 'The room will not wait for a perfect answer.',
  body: 'A dilemma changes what this Evening—or the next—will cost. Both choices have consequences. Choose the one your plan can carry.',
  button: 'I understand',
};

export const SPEAK_YOUR_PIECE_INTRO = {
  heading: 'You may speak plainly—once.',
  body:
    'Speak Your Piece uses all 3 Moments and affects everyone. You may keep it through Evening 4; if it remains unplayed after that, it leaves the game.',
  button: 'Add it to my hand',
};

export const VICTORY = {
  eyebrow: (evening: number) => `The kitchen table · Evening ${evening}`,
  heading: 'The room finds its voice.',
  body:
    'Rosa has the facts. Inés knows how to bring people together. Hugo still has questions—and now the room is strong enough to answer them. ' +
    'The clinic is not saved tonight, but no one leaves believing they have to face its closure alone.',
  primary: 'Play again',
  secondary: 'Review the meeting',
};

export const FAILURE = {
  eyebrow: 'The kitchen table · Evening 6',
  heading: 'The moment passes—for now.',
  body:
    'The conversation mattered, but the room did not reach shared clarity tonight. Some people leave ready to act; others are still protecting themselves. ' +
    'Nothing has been lost permanently. Next time, listen for who needs Trust before they need another argument.',
  primary: 'Try the meeting again',
  secondary: 'Review the meeting',
};
