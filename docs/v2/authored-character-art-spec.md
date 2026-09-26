# Authored character art — asset specification

Status: **draft, for the externally-produced kitchen-table cast** (level 0 only).
This document is the contract between the game engine and whoever produces the
final character illustrations (referenced direction: the approved ensemble +
state reference sheets). It defines exactly what a delivered file must be so it
drops into the existing manifest-driven loader with no code changes.

The **procedural SVG cast atlas** (`tools/lib/cast.mjs` → `public/art/characters*.webp`)
remains in the codebase as the **fallback tier** — it is not being removed, and a
character or state that has no authored art yet keeps using it automatically.
Authored art is **additive and partial-coverage-safe**: ship one character, all
twelve, or anything in between, and the game stays fully playable throughout.

## 1. Where assets live

```
v2/public/art/authored/
  manifest.json                 # see §7
  <castId>.figure.<state>@1x.webp
  <castId>.figure.<state>@2x.webp
  <castId>.portrait.<state>@1x.webp
  <castId>.portrait.<state>@2x.webp
```

`castId` is one of the twelve fixed ids (`v2/src/render/castIds.ts`):
`nurse, postman, bookseller, baker, student, mechanic, gardener, farmer,
musician, carpenter, librarian, florist`. `state` is one of `afraid, listening,
clear` (§5). There is no requirement to supply every file for every character —
the manifest (§7) is the single source of truth for what exists, and anything
absent falls back automatically.

## 2. Two asset kinds

| Kind | Used for | Framing |
|---|---|---|
| **figure** | the in-scene gameplay sprite, seated at the table | waist-up, three-quarter or frontal, matching the reference direction |
| **portrait** | the selected-person card in the HUD | tighter head-and-shoulders crop, more expressive, larger on screen |

They are **independent images**, not crops of one another — a portrait may
recompose the same pose closer and slightly re-lit for a small card, per the
reference state sheet.

## 3. Canvas & pixel dimensions

Both kinds are authored on a fixed **logical (1×) canvas**, delivered at 1× and
2×. The aspect ratio must not vary between states or resolutions for a given
character (the engine assumes a constant frame size per kind).

| | 1× canvas | 2× canvas | Aspect |
|---|---|---|---|
| **figure** | 480 × 600 px | 960 × 1200 px | 4∶5 (matches the existing SVG-atlas frame, so figures drop into the same seat/scale math unchanged) |
| **portrait** | 440 × 560 px | 880 × 1120 px | ≈ 0.786∶1 |

A character may use a *smaller* canvas than the ceiling above if the art
doesn't need it, but must not exceed it, and the two resolutions of the same
image must be **exact 2× pixel multiples of each other** (no independent
recompositing at 2×) — this is what keeps the anchor and scale math exact (see
the retina bug this project already hit and fixed in the SVG atlas: scaling a
non-exact-multiple page produces sampling artefacts).

## 4. Anchor point

The **figure** canvas carries one anchor point, expressed as a fraction of the
canvas (`x`, `y`, both 0–1), marking where the character's seat/ground line
meets the table in the scene. Default and recommended value: **`{ x: 0.5, y:
0.6444 }`** — identical to the existing SVG-atlas anchor, so authored figures
align with the current seating/camera without retuning the scene. A character
may override this per-entry in the manifest if its pose genuinely needs a
different ground point (e.g. a noticeably taller or shorter figure), but
default to the shared value unless there's a reason not to.

The **portrait** has no anchor requirement — it fills its card slot edge to
edge (the engine treats it as `background-size: cover`-equivalent), so compose
it already cropped the way it should read in the card.

## 5. States

Exactly three, named to match the game's awareness buckets (`v2/src/render/assets/atlasMath.ts`):

| State | Awareness range | Reference sheet row |
|---|---|---|
| `afraid` | `aw < 0.35` | "worried / closed" |
| `listening` | `0.35 ≤ aw < 0.7` | "listening / considering" |
| `clear` | `aw ≥ 0.7` | "open / warm" |

Per the approved reference direction: **identity must read as the same person
across all three** (build, garment, prop, hair/headwear unchanged); only
posture, expression, and hand/arm position change. Colour is never the only
cue distinguishing a state or a character — shape must carry it too, exactly
as the existing SVG cast already guarantees (greyscale-safe).

## 6. Orientation, lighting, staging

- **Orientation:** seated at the kitchen table, waist-up, facing camera with a
  slight body turn (roughly 10–15°) toward the table's centre — consistent
  across the whole cast so the seating arc reads coherently. The portrait may
  use a slightly closer/straighter version of the same pose.
- **Lighting:** a single warm key light from the upper-left, ~45° azimuth /
  ~45° elevation, colour temperature ~2800–3200 K (matching the room's
  oil-lamp/window palette), soft shadow falloff. **Lighting direction and
  colour must be identical across every character and state** — the engine
  does not relight art; consistency here is what keeps twelve independently
  produced characters looking like one lit room.
- **Camera height:** eye-level to slightly above, looking a little down at the
  seated figure — matches the existing scene camera pitch.

## 7. Manifest schema

`v2/public/art/authored/manifest.json`:

```jsonc
{
  "version": 1,
  "figureCanvas": { "w": 480, "h": 600 },
  "portraitCanvas": { "w": 440, "h": 560 },
  "anchor": { "x": 0.5, "y": 0.6444 },
  "states": ["afraid", "listening", "clear"],
  "characters": [
    // exactly 12 entries, ALWAYS in seat order (nurse, postman, bookseller,
    // baker, student, mechanic, gardener, farmer, musician, carpenter,
    // librarian, florist) — the same fixed order as the SVG-atlas manifest,
    // so both the renderer (index-free, by id) and the ui portrait helper
    // (index-based, ui may not import render) resolve the same character.
    // An entry with no `figure`/`portrait` images yet is still present —
    // just empty — so the array stays fixed-length and fixed-order.
    {
      "id": "baker",
      "status": "placeholder",       // "authored" once it's final art; "placeholder" must never be mistaken for final (§9)
      "anchor": { "x": 0.5, "y": 0.6444 },   // optional per-character override
      "figure": {
        "afraid":    { "1x": "baker.figure.afraid@1x.webp",    "2x": "baker.figure.afraid@2x.webp" },
        "listening": { "1x": "baker.figure.listening@1x.webp", "2x": "baker.figure.listening@2x.webp" },
        "clear":     { "1x": "baker.figure.clear@1x.webp",     "2x": "baker.figure.clear@2x.webp" }
      },
      "portrait": {
        "afraid":    { "1x": "baker.portrait.afraid@1x.webp",    "2x": "baker.portrait.afraid@2x.webp" },
        "listening": { "1x": "baker.portrait.listening@1x.webp", "2x": "baker.portrait.listening@2x.webp" },
        "clear":     { "1x": "baker.portrait.clear@1x.webp",     "2x": "baker.portrait.clear@2x.webp" }
      }
    },
    { "id": "nurse", "figure": {}, "portrait": {} },
    { "id": "postman", "figure": {}, "portrait": {} }
    // … the remaining 9, likewise empty until art is supplied
  ],
  "attribution": {
    "title": "One Voice — kitchen-table cast (authored)",
    "source": "external illustration, approved reference direction",
    "thirdParty": "none"
  }
}
```

Loading rule (already implemented, §10): a character is treated as **authored**
only if it has a usable `listening` figure texture (the neutral state — used as
the fallback for any other state that's still missing); otherwise that
character falls through to the SVG atlas entirely, so a half-finished entry
never renders broken art.

## 8. File format requirements

- **Container:** WebP, lossy, **with alpha**.
- **Background:** fully transparent outside the character's silhouette. No
  baked backdrop of any kind — not the parchment/studio backdrop seen in the
  reference sheets, not a drop shadow, not a vignette. The engine draws its own
  environment; a baked background cannot be composited into the scene.
- **Alpha:** straight (non-premultiplied) alpha; avoid dark/light fringing at
  the silhouette edge (a common artefact of premultiplying before export).
- **Color profile:** sRGB, 8-bit per channel. Flatten/convert any other
  working profile before export — a mismatched embedded profile shifts colour
  per-browser.
- **Compression targets** (guidance, not a hard reject — see §9's payload
  budget for the actual ceiling):

  | | 1× target | 2× target |
  |---|---|---|
  | figure | ≤ 45 KB | ≤ 90 KB |
  | portrait | ≤ 30 KB | ≤ 60 KB |

  WebP quality ~82–90 with alpha reaches these targets for painted character
  art at these canvas sizes without visible banding.

## 9. Payload budget

Full cast at full coverage (12 × 3 states × 2 kinds × 2 resolutions = 288
files) at the §8 targets tops out around **~2.9 MB** total — reasonable for a
single level's assets, loaded once. If real art comes in heavier:

- Prioritise 2× for the **portrait of whichever character is selected** and
  the **front-row figures** (closest to camera); 1×-only is acceptable for
  back-row/rarely-selected characters.
- Or ship fewer characters as authored and leave the rest on the SVG-atlas
  fallback until budget allows — this is an explicitly supported, permanent
  state, not a stopgap.

**Hard ceiling: 4 MB** total for everything under `art/authored/`. Above that,
split delivery across more than one iteration rather than shipping it all at
once.

## 10. Atlas-packing (optional, future)

Per-character individual files (as specified above) are what the loader reads
today and what external delivery should target first — they're simplest for
an illustrator/pipeline to produce and review incrementally. If payload or
request-count later justifies packing multiple frames into a sheet, the
convention (should it be adopted) is:

- One page per resolution, dimensions a power of two, capped at 2048×2048 for
  2× / 1024×1024 for 1×.
- 2 px opaque-alpha padding between cells to prevent edge bleed when
  minified/mipmapped.
- Page files named `authored-page-<n>@<scale>x.webp`; the manifest gains a
  `pages` map (mirroring the existing SVG-atlas manifest) and each character's
  `figure`/`portrait` entries become `{ page, frame: {x,y,w,h} }` instead of a
  standalone file path.

This is **not required** for the current phase and nothing above depends on
it — noted here only so a later packing step doesn't need a new manifest
shape, just an additive one.

## 11. Safe zones

- **Face safe zone:** the top 20% of the figure canvas height, centred within
  the middle 30% of its width, must stay completely unobstructed (no prop,
  hand, or hair strand crossing it) in **every** state — the engine draws a
  small awareness "clarity halo" ring roughly at this position when the
  character reaches the `clear` state, and it must sit over open air, not a
  hat brim or a raised hand.
- **Prop safe zone:** props (tools, instruments, baskets, a cane) belong in the
  lower-right two-thirds of the frame and may bleed into the outer margin at
  the **bottom edge only** (never top or sides) — this is where the low
  foreground table rim occludes the scene, so a prop's base can safely run
  under it.
- **Canvas margin:** keep at least 4% of the canvas empty (transparent) from
  the left, right and top edges in every state, so nothing is clipped when the
  engine scales or anchors the sprite. The bottom edge may use its full height
  for the seat/base bleed described above.

## 12. Placeholder vs. final art

Any file shipped before final art is ready **must** be marked
`"status": "placeholder"` in the manifest, and the image itself must be
unmistakably a placeholder on sight (an obvious watermark/label baked into the
pixels — not just relying on the manifest flag, since anyone screenshotting
the game sees the pixels, not the JSON). The engine renders a small
placeholder indicator in the HUD portrait card in addition
(`.portrait.placeholder`) as a second, code-level signal. Placeholder art is
for proving the pipeline only and is never mistaken for a quality bar.

## 13. What this phase ships

To prove the pipeline end-to-end before any final art exists, this phase adds
**one** clearly-labelled placeholder entry (`baker`, `status: "placeholder"`)
with all three states for both figure and portrait, at 1× and 2×, generated by
`v2/tools/gen-authored-placeholder.mjs`. Every other character has an empty
manifest entry and keeps rendering from the SVG-atlas fallback. This is by
design — it demonstrates loading, scale/anchor correctness, state-swap
crossfade, portrait rendering, and per-character fallback (mixed authored +
SVG cast in the same scene) without fabricating a full low-detail cast under
time pressure, which was explicitly out of scope for this step.
