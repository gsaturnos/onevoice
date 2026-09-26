// The 12 kitchen-table neighbours, in seat order (index 0 is the player). Mirrors
// tools/lib/cast.mjs, which authors the sprite atlas. Kept as a tiny static list so
// a character's identity — and its procedural fallback — is fixed before the atlas
// (which carries the same ids) finishes loading. Level 0 has exactly 12 agents.

export const CAST_IDS = [
  'nurse', 'postman', 'bookseller', 'baker', 'student', 'mechanic',
  'gardener', 'farmer', 'musician', 'carpenter', 'librarian', 'florist',
] as const;

export type CastId = (typeof CAST_IDS)[number];

/** Deterministic, stable mapping from a seat index to a cast identity. */
export function castIdFor(idx: number): CastId {
  return CAST_IDS[((idx % CAST_IDS.length) + CAST_IDS.length) % CAST_IDS.length];
}
