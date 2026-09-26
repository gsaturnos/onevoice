# Principal-character art handoff — kitchen table (level 0)

Supersedes, for the four characters below only, the "one full raster per
state" requirement in [`authored-character-art-spec.md`](./authored-character-art-spec.md).
Those base rules (canvas sizes, alpha, color profile, compression, safe
zones, payload budget, file location) still apply; this document adds the
**layered master + overlay** structure Giorgio asked for, so state changes
don't require independently drawing a full character three times.

The other eight neighbours are unaffected — they stay on the current SVG
atlas until further notice.

Deterministic source: level 0 (`createGame(0)`, `v2/src/content/{levels,people}.ts`
+ `v2/src/core/state.ts`). These four are the actual, current in-game people
for this level — names/roles/stakes/traits are read from the live data, not
invented.

## The four

### 1 · The player — Julia
- **Role / stake:** a teacher · "their father built this neighborhood"
- **Trait:** *online* — "never off their phone" (talk ×1, post ×2.2)
- **Emotional role:** the player's own avatar; the one seat everyone else's awareness radiates toward.
- **Current visual identifier:** `castId: librarian` in the SVG atlas — elder, curly grey hair, glasses, plum `cardiganElder`, books+satchel prop, soft/rounded build.
- **⚠️ Flag for the illustrator brief, not a decision made here:** the SVG atlas's `librarian` look (retired, elder, grandmotherly) doesn't match Julia's narrative age or role (teacher). Separately, the *one* archetype the SVG source data itself marks `player: true` is `nurse` — but level 0's deterministic player index (10) lands on `librarian`, not `nurse`, so that flag was never actually load-bearing for this level. Recommend the master design for the player start from Julia's narrative (teacher, present-day, invested in her father's neighborhood) rather than copying either SVG look.

### 2 · Rosa — the clinic nurse
- **Role / stake:** a nurse · "the clinic lost its funding last winter"
- **Trait:** *online* — "never off their phone" (talk ×1, post ×2.2)
- **Emotional role:** the institutional-care thread — what's at stake when a public service is starved.
- **Current visual identifier:** `castId: nurse` — adult, curly short dark hair, round head, teal `scrubs`, stethoscope prop, no headwear/glasses. (This is the one archetype where the SVG look already matches the narrative role.)

### 3 · Inés — the conversation that carries the tutorial
- **Role / stake:** a shopkeeper · "they remember when the square had another name"
- **Trait:** *talker* — "listens best over coffee" (talk ×1.6, the fastest-to-open trait in the roster)
- **Emotional role:** she is literally the game's own first move — `bestTarget()` picks her at turn 1, and one conversation crosses her from 16% to 57% awareness (past the 50% clarity threshold), which is what "Talk with Inés — one conversation could make it land" in the current opening suggestion refers to. She's the tutorial's proof that talking works.
- **Current visual identifier:** `castId: gardener` — adult, headscarf, olive/plum `apronMarket`, produce-crate prop, round head, widest hips/shoulders in the cast (girth 1.18).

### 4 · Hugo — the skeptical neighbour
- **Role / stake:** a bus driver · "they lost their job for asking questions"
- **Trait:** *wary* — "trusts slowly, holds firmly" (talk ×0.55, the single most resistant multiplier in the roster — direct contrast to Inés's *talker*)
- **Emotional role:** the guarded counterweight to Inés's warmth; retaliation for speaking up made concrete in one person.
- **Current visual identifier:** `castId: mechanic` — adult (not elder-tagged), square head, shaggy beard, cap, navy `overalls`, wrench prop, sturdiest build in the cast (girth 1.12).
- **⚠️ Flag:** the brief asked for "older or skeptical" — Hugo is the clearest *skeptical* match (his trait is literally distrust), and reads as a grounded, weathered workman, but he isn't elder-tagged. If an elder look specifically is preferred over the trait match, the elder-tagged alternative already talkable in this level's early game would be a different neighbour with the *artist* trait, not *wary* — i.e., you'd trade the skepticism match for the age match. Recommend keeping Hugo (trait match) unless you say otherwise.

## Layered structure (replaces "one full image per state")

**One master illustration per character, per crop (figure + portrait), at
one canonical neutral pose ("listening").** State changes are built from
that master plus small, swappable overlay parts and Pixi-level transforms —
never a second full-body redraw.

**Overlay parts (transparent, small crops, positioned by anchor offset
against the master canvas):**
| part | what it covers | varies by state? |
|---|---|---|
| `brows` | eyebrow shape/position | yes — afraid / listening / clear |
| `eyes` | eye shape/gaze (optional; omit to keep the master's eyes for all states) | optional |
| `mouth` | mouth shape | yes — afraid / listening / clear |
| `arms` (figure crop only) | hand/arm posture (crossed, raised, open) | yes — afraid / listening / clear |

**Pixi-level transforms (no art required):** a slight uniform scale-down +
inward lean for *afraid*, neutral for *listening*, a slight scale-up +
opened shoulder line for *clear*. Applied to the whole figure sprite (or an
`arms` sub-layer only, if the overlay artist prefers arms to stay crisp
under scale). This is the "restrained animation" Giorgio asked for — it's a
rendering behavior, not an asset.

**Anchor points**, in canvas-fraction coordinates (same convention as the
existing spec, origin top-left):
- Master canvas anchor (where the sprite's `(0,0)` sits on the table/HUD): figure `{x:0.5, y:0.6444}`, portrait `{x:0.5, y:1.0}` (bottom-anchored, head-and-shoulders crop).
- Each overlay part additionally declares its own `{x,y}` offset *from the master's own top-left*, in canvas-fraction units of the master canvas — e.g. `brows: {x:0.42, y:0.18}` means the overlay's own top-left lands at 42%/18% into the master image. The overlay image itself is cropped tight to its part (no full-canvas transparent padding) to keep file size down.

**Lighting / palette / proportions — must stay identical across all three
states and across figure/portrait for one character** (this was already
true in the base spec, restated because it matters more now that parts are
swapped independently): single warm key light, upper-left, 45° azimuth /
45° elevation, 2800–3200K. Palette is fixed per character to that
character's own `garment`/`skin`/`hair` colors above — no per-state
recoloring.

## Dimensions (unchanged from the base spec)
- Figure master: 480×600 @1x, 960×1200 @2x (4:5).
- Portrait master: 440×560 @1x, 880×1120 @2x.
- Overlay parts: cropped tight to content, same @1x/@2x pairing, no fixed size — declare `w`/`h` per part in the manifest.

## File naming
```
<castId>.figure.master@1x.webp / @2x.webp
<castId>.figure.arms.<state>@1x.webp / @2x.webp        (afraid | listening | clear)
<castId>.portrait.master@1x.webp / @2x.webp
<castId>.portrait.brows.<state>@1x.webp / @2x.webp
<castId>.portrait.mouth.<state>@1x.webp / @2x.webp
```
Omit any file the illustrator doesn't need for a given character (e.g. no
`arms` overlay if the master's default posture already reads fine for all
three states — degrade gracefully to the master alone, same as any other
missing part).

## Example manifest entry (one character)
```json
{
  "id": "gardener",
  "status": "authored",
  "figure": {
    "master": { "1x": "gardener.figure.master@1x.webp", "2x": "gardener.figure.master@2x.webp" },
    "arms": {
      "afraid":    { "1x": "gardener.figure.arms.afraid@1x.webp",    "2x": "gardener.figure.arms.afraid@2x.webp",    "anchor": { "x": 0.30, "y": 0.55 } },
      "clear":     { "1x": "gardener.figure.arms.clear@1x.webp",     "2x": "gardener.figure.arms.clear@2x.webp",     "anchor": { "x": 0.28, "y": 0.52 } }
    }
  },
  "portrait": {
    "master": { "1x": "gardener.portrait.master@1x.webp", "2x": "gardener.portrait.master@2x.webp" },
    "brows": {
      "afraid": { "1x": "gardener.portrait.brows.afraid@1x.webp", "2x": "gardener.portrait.brows.afraid@2x.webp", "anchor": { "x": 0.38, "y": 0.30 } },
      "clear":  { "1x": "gardener.portrait.brows.clear@1x.webp",  "2x": "gardener.portrait.brows.clear@2x.webp",  "anchor": { "x": 0.38, "y": 0.28 } }
    },
    "mouth": {
      "afraid":    { "1x": "gardener.portrait.mouth.afraid@1x.webp",    "2x": "gardener.portrait.mouth.afraid@2x.webp",    "anchor": { "x": 0.42, "y": 0.52 } },
      "listening": { "1x": "gardener.portrait.mouth.listening@1x.webp", "2x": "gardener.portrait.mouth.listening@2x.webp", "anchor": { "x": 0.42, "y": 0.52 } },
      "clear":     { "1x": "gardener.portrait.mouth.clear@1x.webp",     "2x": "gardener.portrait.mouth.clear@2x.webp",     "anchor": { "x": 0.41, "y": 0.51 } }
    }
  }
}
```
A part missing for a given state simply isn't rendered on top of the
master for that state — the master's own baked-in neutral expression shows
through, same graceful-degradation contract as the rest of the pipeline.

## Asset checklist (per principal character)
- [ ] Character biography / emotional role (above — confirm or amend)
- [ ] Canonical master pose — seated, three-quarter turn toward table center, figure crop (480×600@1x / 960×1200@2x)
- [ ] Canonical master pose — head-and-shoulders portrait crop (440×560@1x / 880×1120@2x)
- [ ] `arms` overlay × up to 3 states (figure only) — or confirm master posture covers all states without one
- [ ] `brows` overlay × up to 3 states (portrait; figure only if brows are visible at figure scale)
- [ ] `mouth` overlay × up to 3 states (portrait; figure only if mouth is visible at figure scale)
- [ ] Anchor point declared for the master (figure `{0.5, 0.6444}`, portrait `{0.5, 1.0}` unless the illustrator has a reason to deviate — say so if it does)
- [ ] Anchor offset declared for every overlay part
- [ ] Lighting confirmed: single warm key, upper-left 45°/45°, 2800–3200K — identical across master + every overlay
- [ ] Palette confirmed against this character's existing garment/skin/hair colors (table above)
- [ ] Alpha: straight alpha, no baked background, sRGB
- [ ] Compression: figure ≤45KB/1x, ≤90KB/2x; portrait ≤30KB/1x, ≤60KB/2x; overlays are small crops and should land well under those (no fixed ceiling — flag if any single overlay exceeds 20KB)
- [ ] File names follow the convention above exactly
- [ ] Until real art lands: **no full or partial character ships without the existing "PLACEHOLDER" watermark + `status: "placeholder"` convention** (see `authored-character-art-spec.md` §12) — this applies to masters and every overlay part alike.

No visual implementation (code, generated placeholders, or otherwise) has
been done against this document. It's a handoff spec only, pending the
externally authored masters for these four characters.
