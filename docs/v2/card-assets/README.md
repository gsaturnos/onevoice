# One Voice card-art handoff

This folder is the visual source of truth for the first playable card prototype. It is intended to be handed to the implementation agent together with the card-design proposal.

## What is approved

- `portraits/`: canonical portrait crops for Julia, Rosa, Inés, and Hugo. These are crops of the approved masters, not regenerated likenesses.
- `card-backs/one-voice-card-back-v1.png`: the approved starting card-back direction.
- `textures/action-paper-v1.png`: quiet ivory paper for action cards.
- `textures/dilemma-paper-v1.png`: muted rust paper for dilemmas and civic notices.
- `visual-style-spec.md`: layout, color, state, motion, and accessibility rules.
- `asset-manifest.json`: stable asset identifiers and implementation metadata.

## Non-negotiable implementation rules

1. Do not redraw, regenerate, face-swap, or chroma-key the four portraits.
2. Use the supplied files as immutable source art. Derived WebP/AVIF copies are allowed, but retain these PNG originals.
3. State changes are UI treatments, not new character generations. Pair every visual state with a written label and a meter.
4. Use the portraits inside cards. Do not return to a full-body stage or mix these portraits with the old SVG cast in the primary composition.
5. Keep textures subtle. They must never reduce text contrast or compete with character faces.
6. Show a desktop and mobile component screenshot for approval before wiring the cards into game logic.

## Suggested implementation order

1. Build one static Julia neighbour card, one action card, one dilemma card, and one card back.
2. Verify hierarchy and mobile readability.
3. Add Guarded, Listening, and Clear treatments with CSS only.
4. Add the other three portraits.
5. Wire gameplay after the visual system is approved.

The original generated decorative assets remain in the Codex generation archive. The project copies here are the files to use.
