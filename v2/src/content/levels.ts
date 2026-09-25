// A single sample level for the validation slice — the first guided story.
// The full LEVELS set is Phase 2+ content work.

import type { LevelDef } from '@core/types';

export const KITCHEN_TABLE: LevelDef = {
  name: 'I · The kitchen table',
  n: 9,
  rig: 0.35,
  maxT: 12,
  linkMax: 150,
  allowed: ['talk'],
  objective: { type: 'aware', count: 3, level: 0.5, text: 'Help 3 neighbors see clearly (above 50%)' },
};
