# One Voice — Card Prototype Rules (Revision 3, locked)

Branch: `claude/onevoice-v2-card-prototype`. Implementation lives in `v2/src/cardgame/` (isolated, does not import from `v2/src/core`, `render`, `ui`, or touch PR #12). Playable at `card.html` (a second Vite entry point, alongside the untouched `index.html`).

This is the exact-numbers amendment to the Revision 2 design proposal, resolving the 10 specification gaps Giorgio flagged before Phase 1. Source of truth for every number here is `v2/src/cardgame/engine/` — where §4's own summary table contradicted §7 and the code, §4 has been corrected to match (2026-09-27); see §4 for detail. `test/cardgame/ruleConsistency.test.ts` guards against this happening silently again.

## 1. The starting deck — exactly 12 cards

| Card | Copies |
|---|---|
| Ask Directly | 2 |
| Open the Circle | 1 |
| Spread the Word | 2 |
| Build on What You Know | 1 |
| Press the Point | 1 |
| Hold Space | 1 |
| Bring the Room Together | 1 |
| Quiet Confidence | 1 |
| Second Thoughts | 1 |
| Think It Over | 1 |
| **Total** | **12** |

`Speak Your Piece` is NOT in this list — it is added to the hand at the start of Evening 3 only (see §6).

## 2. Starting Understanding

Rosa: 18. Inés: 15. Hugo: 10. (All Guarded.) Starting Trust: 20.

## 3. Julia's "Set the Tone" ability

Free, once per Evening, no target cost. Effect: **+5, flat, applied AFTER the target's trait multiplier** — it adds to the card's already-multiplied result, it is never itself multiplied. Example: Ask Directly on Inés (Talker ×1.6) with Trust 20 → base (9 + 3×0.20) = 9.6 → ×1.6 = 15.36 → +5 flat from Set the Tone = 20.36.

## 4. Trait multipliers, per card — explicit, not implicit

**"UI stamp" and "multiplier actually applied" are two different things.** Every card's `multiplierClass` in `content.ts` drives the Talk/Broadcast stamp shown on its face, but the engine (`engine.ts`) only actually calls the multiplier function for two cards: Ask Directly (talk) and Spread the Word (broadcast). Hold Space, Build on What You Know, Press the Point, and Quiet Confidence carry the "Talk" stamp but resolve to a flat, trait-independent number — this was a real contradiction in an earlier revision of this table (corrected here 2026-09-27) and is now guarded by `test/cardgame/ruleConsistency.test.ts`, which plays each card against a talker/online vs. a neutral-trait target and fails if the observed behavior ever stops matching the `MULTIPLIER_APPLIED` declaration in `src/cardgame/content/mechanics.ts`.

| Card | UI stamp (`multiplierClass`) | Multiplier actually applied in effect? |
|---|---|---|
| Ask Directly | talk | Talk (×1.6 Talker / ×0.55–1.2 Wary) |
| Open the Circle | none | None |
| Spread the Word | broadcast | Broadcast (×2.2 Online) |
| Build on What You Know | talk | **None** — flat +13 / +4 regardless of trait |
| Press the Point | talk | **None** — flat +13 regardless of trait |
| Hold Space | talk | **None** — flat +5 regardless of trait |
| Bring the Room Together | none | None |
| Quiet Confidence | talk | **None** — flat +16 regardless of trait |
| Second Thoughts | none (draws 2 cards) | — |
| Think It Over | none (utility) | — |
| Speak Your Piece | none (one-time) | None |

Talker (Inés): ×1.6. Wary (Hugo): ×0.55, rising to ×1.2 once shared Trust ≥ 30. Online (Rosa): ×2.2, broadcast-class only. These only ever apply where the "Multiplier actually applied" column above says so — the numbers in §7 below are exact and already reflect this.

## 5. Think It Over (replaces "A Moment to Breathe")

Cost 0. **Discard it to retain up to 2 cards into next Evening instead of the usual 1.** No Understanding or Trust effect of any kind — pure card-economy, never free numerical progress.

## 6. Speak Your Piece — lifecycle

- Added to hand at the start of Evening 3 (once).
- If unplayed at the end of Evening 3, it **may be retained once** into Evening 4 (competing for the normal 1-card retain slot, same as any other card).
- If still unplayed after Evening 4, it is discarded and **permanently removed from the game** — it never re-enters the deck or discard/reshuffle pool.
- Once played (whenever that happens), it **exhausts**: removed from the game, never reshuffled.
- Effect: costs 3 Moments (the whole Evening). All three neighbours +8 Understanding. Trust +8.

## 7. Card effects — full numbers

Trust-scaled cards read as "+X at Trust 0, scaling toward +Y at Trust 100."

| Card | Cost | Effect |
|---|---|---|
| Ask Directly | 1 | Target one: `(9 + 3×Trust/100) × trait mult`. Trust +2. |
| Open the Circle | 2 | All three: `+(4.5 + 1.5×Trust/100)` each. Trust +4. |
| Spread the Word | 1 | Target one: `5.5 × broadcast mult`. Trust +2. |
| Build on What You Know | 1 | Target one: +13 if already Listening (≥35), else +4. Trust +1. |
| Press the Point | 2 | Target one: +13. Trust −3. |
| Hold Space | 1 | Target one: +5. Trust +6. |
| Bring the Room Together | 2 (needs Trust ≥40) | All three: +4.5 each. Trust +5. |
| Quiet Confidence | 1 (needs Trust ≥30) | Target one: +16. Trust +2. |
| Second Thoughts | 1 | Draw 2 cards. No board effect. |
| Think It Over | 0 | Discard for +1 retain slot this Evening (max 2 total). No board effect. |
| Speak Your Piece | 3 (one-time) | All three: +8. Trust +8. |

## 8. Dilemmas — exact numbers

1. **Evening 2 — "Rosa has the numbers."**
   - A) Trust +5 now; next Evening's Moments reduced to 2 (from 3).
   - B) Rosa's Understanding gain THIS Evening is cut to 30%; she gets a guaranteed +10 Understanding at the start of Evening 3 (delayed, certain, vs. A's immediate, probabilistic value).
2. **Evening 4 — "Hugo asks why nobody told him sooner."**
   - A) Discard one card from hand; Hugo +20 Understanding, Trust +3.
   - B) No card cost; Hugo's Understanding gain THIS Evening is cut to 50%; Trust +4.
3. **Evening 6 — "The room has to decide."** (resolves AFTER that Evening's play, as the last act)
   - A) Spend 2 of this Evening's 3 Moments immediately; if all three neighbours are already at Understanding ≥55, everyone gets +10.
   - B) No cost, no bonus.

## 9. Victory / failure

All three neighbours (Rosa, Inés, Hugo) at Understanding ≥70 by the end of Evening 6 = victory. Otherwise, failure.

## 10. Balance validation — committed, seeded, reproducible

Test: `v2/test/cardgame/balance.test.ts`, run via `npm test` (part of CI). Named strategy policies are defined in `v2/src/cardgame/engine/strategies.ts` — reproducible, not just prose:

- **focus** — always targets whoever is furthest behind; brute-force search over the hand to maximize a fixed value-estimate per Evening within the Moments budget.
- **balanced** — same search, but round-robins targets across the three neighbours.
- **combo_build** — same search, but weights Hold Space far more highly while Trust is below 40 (the Bring the Room Together gate), deliberately paying tempo now for bigger unlocks later.
- **naive** — same search, but picks a *random* target (via the session's own seeded RNG, so it stays reproducible) instead of a deliberate one.
- Dilemma policies: **always_a**, **always_b**, and **adaptive** (a documented, state-based rule per dilemma — see `dilemmaChoice()` in `strategies.ts`).

1000 seeds (0–999) per configuration:

| Strategy | Win rate (adaptive dilemma play) |
|---|---|
| Focus | 83.6% |
| Combo-build | 84.1% |
| Balanced (spread-thin) | 88.8% |
| Naive (undirected) | 28.1% |

All within the requested 70–85% band for competent play (balanced runs a bit hot but is not required to sit in the band); naive is clearly, and reproducibly, worse — not a photo-finish, a real gap.

**Choice-conditioned dilemma outcomes** (same seed, only the named dilemma's choice varied, other two resolved adaptively; `focus` strategy):

| Dilemma | A-only wins | B-only wins | Both win | Neither wins |
|---|---|---|---|---|
| Rosa's Numbers (Evening 2) | 110 | 181 | 662 | 47 |
| Hugo's Question (Evening 4) | 496 | 0 | 370 | 134 |
| The Room Decides (Evening 6) | 650 | 0 | 186 | 164 |

Rosa's Numbers is genuinely bidirectional under the reference bots — B wins outright *more often* than A in this data. Hugo's Question and The Room Decides are A-favoring under these specific (non-forward-planning) bots; the honest reading is that a bot that always targets "whoever's furthest behind" every single Evening rarely reaches a board state where B's cheaper-but-smaller option pays off. Representative states where a human would still prefer B:

- **Hugo's Question, prefer B:** Evening 4, hand holds exactly the two cards needed to close out Rosa and Inés this Evening (e.g., two Quiet Confidence-eligible plays) and Hugo is already at 45 (near Listening) — discarding either needed card to answer Hugo directly would cost the double-finish; halved growth on someone already trending fine, plus the extra Trust, is the better trade.
- **The Room Decides, prefer B:** Evening 6, two neighbours are past 70 but the third is stuck at 40 — spending 2 of 3 Moments on a flat "if everyone's ≥55" push (which won't trigger) wastes the exact Moments a precise, single targeted card could have spent finishing the one person who actually needs it.

## 11. Art

Hugo now has an approved canonical master — no placeholder needed. **Note:** the approved portrait image assets (Julia/Rosa/Inés/Hugo) live only on the `claude/onevoice-v2-phase3-kitchen-table` branch (PR #12) and are not present on this branch's tree. Phase 1 ships with clearly-labeled colored-circle placeholders in their place; wiring in the real approved images is a follow-up (copying image files across branches, not touching PR #12 itself, requires your go-ahead on how you'd like that done).

## 12. `docs/v2/card-game-character-roster.md`

Not present in this branch's tree — noted as future planning context per your instruction; no supporting characters were added to this prototype regardless.
