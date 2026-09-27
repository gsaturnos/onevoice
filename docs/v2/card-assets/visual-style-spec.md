# Lamplit Table visual style

## Direction

The game should feel like a private conversation becoming a shared civic act: intimate portrait cards on a warm, dark tabletop, with pale paper actions and document-like dilemmas. It is a narrative card game, not a fantasy-combat interface.

## Color tokens

| Token | Value | Use |
|---|---:|---|
| Night | `#120f0d` | page background |
| Table | `#211712` | play surface |
| Panel | `#2a211b` | dark card surfaces |
| Paper | `#f5ecd9` | action cards and light text panels |
| Ink | `#2e241c` | text on paper |
| Lamplight | `#d69b3e` | focus, costs, active borders |
| Community teal | `#5d9b8c` | links and supportive actions |
| Dilemma rust | `#9d5741` | dilemma cards and warnings |
| Guarded | `#726b70` | guarded state accent |
| Listening | `#c6954b` | listening state accent |
| Clear | `#72aa8d` | clear state accent |
| Warm white | `#f7ead5` | primary text on dark surfaces |

Use color as reinforcement, never as the only state cue.

## Typography

- Character names, card titles, and narrative quotations: a humane book serif such as Georgia.
- Rules, labels, costs, meters, and buttons: the system sans-serif stack.
- Avoid fantasy display fonts and distressed all-caps body copy.
- Mobile minimums: 18 px card titles, 16 px rules text, 13 px short labels.

## Card families

### Leader

Smaller and visibly pinned near the player area. Includes portrait, name, role, passive ability, and a clear player marker. It must not look identical to a neighbour card.

### Neighbour

Portrait-led, roughly 4:5. The portrait owns about 58% of the face. Below it: name, role, one human stake, one readable trait, and the awareness meter. Keep rules short enough to scan without opening a modal.

### Action

Light paper with dark ink. Show cost in the upper-right, category as a small stamp, title, concise effect, and one optional flavor line. Apply `action-paper-v1.png` at approximately 4–8% visible texture strength.

### Dilemma

Wider, document-like, and unmistakably different from hand cards. Use the rust texture under a dark translucent wash. Present exactly two explicit choices with immediate consequences. Never hide the choice in prose.

### Card back

Use the supplied back without text. Preserve its safe border and central ripple motif. Crop with `object-fit: cover`; do not stretch it.

## Character states

Character identity and base portrait pixels stay unchanged.

| State | Image treatment | Frame treatment | Required text |
|---|---|---|---|
| Guarded | `saturate(.55) brightness(.72)` | low-contrast grey-violet edge | `Guarded` |
| Listening | `saturate(.88) brightness(.92)` | warm amber edge | `Listening` |
| Clear | `saturate(1.08) brightness(1.04)` | restrained teal-gold rim and soft glow | `Clear` |

Transitions should change the frame, label, and meter together. Do not alter facial anatomy or generate state-specific faces for the first prototype.

## Texture and depth

- Use paper fibers as a quiet surface layer, not as content.
- Dark cards: subtle inner border plus one soft table shadow.
- Paper cards: slightly brighter edge and minimal lift.
- Avoid glassmorphism, neon glow, metallic fantasy ornament, and dense particle effects.

## Motion

- Hover/focus lift: 4–8 px over 140–180 ms.
- Draw/reveal: 180–220 ms.
- State pulse: one restrained pass, never looping.
- Respect `prefers-reduced-motion`; replace travel and pulse with an immediate opacity change.

## Accessibility and responsive behavior

- Keep body text contrast at WCAG AA or better.
- Keyboard focus must be clearly visible and distinct from hover.
- Minimum interactive target: 44×44 px.
- At narrow widths, use a horizontal hand rail inside its own region; the page itself must not overflow horizontally.
- Do not place essential copy over faces.
- State remains understandable in greyscale through label, meter position, and border pattern/weight.
