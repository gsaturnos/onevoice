# One Voice V2 — Frontend Architecture (Phase 1)

Status: **architecture + validation slice**. This phase does not migrate the
campaign. It establishes the target structure, the module boundaries, the
migration and asset strategy, and a small running slice that proves the
separation of **simulation ↔ rendering ↔ interface**.

Source of truth for the game being preserved: `index.html` on `staging`
(`353d9b3`), the stable production build.

---

## 1. Audit of the production game (`/index.html`, staging)

A single ~2.4k-line HTML file: inline `<style>`, a set of DOM screens, one
`<canvas id="game" width="720" height="440">`, and one large IIFE `<script>`
(~85 functions). It is **fully self-contained and offline**: no external
scripts, fonts, images, or audio files. All art is drawn procedurally on the
canvas; all sound is synthesised with the Web Audio API.

### 1.1 Responsibilities currently interleaved in the one closure

| Concern | Representative functions / data | Notes |
|---|---|---|
| **Content / config** | `NAMES`, `ROLES`, `STAKES`, `TRAITS`, `CORE`, `LEVELS`, `PRO_DEFAULTS`, `LEGACIES`, `OPPS`, `DILEMMAS` | Pure static data. |
| **Simulation state** | module-level `let`: `D, lvlIdx, ag[], links, built, weak, nbr, murals, turn, energy, rig, floor, wins, inf, player, risk, crackIn, crackZone, spies, reinfThresholds, …` | ~40 mutable globals shared by everything. |
| **Simulation logic** | `initGame`/`mkPerson`, `act`, `endTurn` (~360 lines: diffusion, crackdowns, reinforcements, opps, win/loss), `triggerDefection`, `maybeSpawnOpp`/`tickOpp`, `maybeFireDilemma`/`resolveDilemma`, `checkObjective`, `freeZones`, `localAwAround`, `rebuildNbr` | Reads/writes the globals directly. Deterministic given `mulberry32` seed + player input. |
| **Rendering** | `drawFigure`, `draw` (~250 lines), `loop` (rAF), transient FX (`floaters`, `rippleAnims`, `nearMisses`, `pops`, `shake`, `vignette`) | Canvas 2D; reads sim globals directly. |
| **Interface (DOM)** | `ui`, `updateGoal`, `updateActionLabels`, `fxSet`, `renderCampaign`, `startLevel`, `backToCampaign`, `setButtons`, `renderLegacy`, `renderRoster`, `coachShow`/`coachEvent`, `hintOnce`, `showEnd`, `showEpilogue`, `stageStats`, KPI popovers, dilemma overlay | Reads globals, writes DOM. |
| **Audio** | `initAudio`, `tone`, `s*` cues, `padNote`/`musicStep`, `updateMurmur`, `setMusic` | Web Audio side-effects. |
| **Persistence** | `savePrefs`, `saveProgress`, `saveLegacy`, `getFallen`/`setFallen`, `getAttempts`/`setAttempts` | localStorage. |
| **Glue** | DOM event listeners, `mulberry32`, `nowMs` | — |

### 1.2 Coupling assessment

- Simulation, rendering, and UI all read and mutate the **same module-level
  globals** in one lexical scope. There is no data boundary; `draw()` reads
  `ag`, `endTurn()` writes `ag`, `ui()` reads `ag`, all directly.
- Determinism is good: state evolves from a seeded PRNG (`mulberry32`) plus
  player actions. This is the key asset — it makes **golden-master parity
  testing** between production and V2 feasible.
- No build step, no types, no tests. Refactors are risky because everything is
  reachable from everything.

### 1.3 Save-data schema (must be preserved by V2)

| Key | Meaning |
|---|---|
| `ov8_pro` | JSON bool[]: guided stories completed |
| `ov8_camp` | int: campaign district progress |
| `ov8_fallen_<lvl>` | JSON string[]: names lost in a level (legacy/memory) |
| `ov8_att_<lvl>` | int: attempts at a level |
| `ov11_legacy` | JSON `{embers, owned[]}` |
| `ov11_snd`, `ov11_mus` | `'on'`/`'off'` |
| `ov15_intro` | `'1'` once the intro comic is seen |
| `ov17_hints` | JSON map of one-time hints seen |

(The experimental redesign branch adds `ov22_tips`, `ov23_speed`; V2 will
recognise them too so a player who touched either build keeps their settings.)

---

## 2. Target architecture

**Principle: a pure, deterministic simulation core with no knowledge of the
DOM, the canvas, PixiJS, audio, or storage.** Rendering, interface, audio, and
persistence are *adapters* that observe the core and feed it input. This is the
separation the brief asks for and the precondition for parity testing.

```
                 ┌───────────────────────────────────────────────┐
   input(action) │                    app/                        │
        ───────► │   composition root · game loop · orchestration │
                 └───────┬───────────────┬───────────────┬────────┘
                         │ reads snapshot │ reads snapshot │ dispatch
             ┌───────────▼──┐   ┌─────────▼───────┐   ┌────▼──────────┐
             │   render/    │   │      ui/        │   │    audio/     │
             │  (PixiJS)    │   │   (DOM/HUD)     │   │ (Web Audio)   │
             └───────┬──────┘   └────────┬────────┘   └───────────────┘
                     │ import types only │ import types only
                     └─────────┬─────────┘
                          ┌────▼────────────────────────┐
                          │           core/             │  ← depends on NOTHING
                          │  rng · state · simulation   │     (pure, testable)
                          │  actions · selectors        │
                          └────┬────────────────────────┘
                          ┌────▼──────┐   ┌──────────────┐
                          │ content/  │   │ persistence/ │
                          │ (data)    │   │ (localStorage)│
                          └───────────┘   └──────────────┘
```

### 2.1 Dependency rule (enforced, not just aspirational)

- `core/` imports **nothing** outside `core/` and `content/` types. No `window`,
  `document`, `PIXI`, `localStorage`, `performance`, `Math.random`.
- `content/` is data + config, typed against `core/` types.
- `render/`, `ui/`, `audio/`, `persistence/` may import from `core/` (types +
  read-only selectors) but **never** from each other.
- `app/` is the only module that imports everything and wires it together.
- Enforced by an ESLint `no-restricted-imports` boundary rule + `tsconfig`
  path layering (documented in `v2/README.md`); CI-checkable later.

### 2.2 Module boundaries

| Module | Responsibility | May import |
|---|---|---|
| `core/rng.ts` | `mulberry32` PRNG, seeded, injectable — replaces all `Math.random` in sim | — |
| `core/types.ts` | `Agent`, `Link`, `GameState`, `Action`, `LevelDef`, `Trait`, … | — |
| `core/state.ts` | `createGame(level, seed)` → initial `GameState` (port of `initGame`/`mkPerson`) | rng, types, content types |
| `core/simulation.ts` | `applyAction(state, action)` and `tick(state)` — pure reducers (port of `act`/`endTurn` diffusion) | rng, types |
| `core/selectors.ts` | read-only derived views: `awareCount`, `neighbors`, `objectiveProgress`, `freeZones` | types |
| `content/*` | `levels.ts`, `traits.ts`, `dilemmas.ts`, `opps.ts`, `legacies.ts`, names/roles/stakes | core types |
| `render/PixiStage.ts` | build & update a Pixi scene from a `GameState` snapshot each frame; owns no game state | core (types/selectors), pixi.js |
| `render/*` | figures, links, FX, environment — the "scene system" from the redesign, as data-driven modules | core, pixi.js |
| `ui/Hud.ts` | DOM HUD: KPIs, goal, action cards, roster, coach; emits `Action`s via a dispatcher | core (types/selectors) |
| `audio/AudioEngine.ts` | Web Audio wrapper; `cue(name)`, `setMurmur(level)`, music | — (browser Web Audio only) |
| `persistence/Store.ts` | typed read/write of the exact legacy localStorage keys | core types |
| `app/main.ts` | composition root: create core, attach render/ui/audio/persistence, run loop, route input | everything |

### 2.3 The loop (app)

```
on frame(dt):
    render.update(core.snapshot(), dt)     // pure read
on user action(a):
    core = simulation.applyAction(core, a) // pure reducer → new snapshot
    audio.cue(a.sound); ui.refresh(core)
on end-turn:
    core = simulation.tick(core)           // diffusion/resolution
    persistence.save(core.progress)
```

Rendering reads snapshots; it never advances state. The core is advanced only
by `applyAction`/`tick`. `dt`-based animation lives entirely in `render/`
(transient FX are view state, not game state) — matching the redesign's
`animSpeed`/reduced-motion handling.

---

## 3. Migration strategy — parallel build ("strangler fig")

1. **Isolation.** V2 lives entirely under `/v2` (its own Vite app). The root
   `index.html` production game is **never touched** and remains the shipped
   build throughout. Deploy config can serve `/v2` at a preview path until
   cutover.
2. **Core first, with parity gates.** Port `core/` (state + simulation) as pure
   TS. Because both builds are deterministic from a seed, we validate with a
   **golden-master harness**: run the production `endTurn`/`act` and the V2
   `tick`/`applyAction` from identical seeds + scripted inputs and assert the
   state sequences match field-by-field. No visual guesswork — parity is proven
   numerically before any rendering is trusted.
3. **Adapters next.** Once the core matches, build `render/` (Pixi) and `ui/`
   against snapshots, then `audio/` and `persistence/`. Each adapter is
   swappable and independently testable.
4. **Content port.** Move `LEVELS`/`TRAITS`/`DILEMMAS`/`OPPS`/`LEGACIES` into
   typed `content/` modules — data only, so parity is a structural diff.
5. **Screens & campaign.** Rebuild campaign map, legacy shop, epilogues,
   coach/tutorial last, on top of a proven core.
6. **Cutover.** Only when V2 reaches feature + save parity does it replace the
   root build. Until then production ships unchanged.

**Non-negotiables carried by this strategy:** identical mechanics/balance (same
constants, same PRNG, parity-tested), identical save keys, offline operation,
mobile support, narrative/dilemmas/legacies/endings intact, no silent rebalance.

---

## 4. Asset strategy

The production game has **zero binary assets** — all art is procedural canvas
drawing and all audio is Web Audio synthesis. V2 keeps this ethos:

- **Art.** Procedural generators (figures, links, environment, the redesign's
  "scene/palette/motif" system) become typed `render/` modules that draw with
  **PixiJS `Graphics`** (vector, resolution-independent) — or, for repeated
  marks, are **baked once to a `RenderTexture`** at load and reused (the same
  optimisation the production `bgCanvas`/`grainCanvas` prerender uses). No
  image files are introduced; the bundle stays asset-light and offline-capable
  after first load.
- **Palette / design tokens.** The redesign's palette + scene descriptors move
  into `content/theme.ts` as plain data consumed by `render/` — the single
  reusable idea worth carrying from the experimental branch.
- **Fonts.** Keep the system monospace stack; no web-font downloads (offline).
- **Audio.** No files; `audio/AudioEngine.ts` wraps the existing oscillator
  cues and pad-based music. Assets = code.
- **Runtime dependency.** The only new runtime dependency is **PixiJS**, bundled
  by Vite into a self-contained build so the game still runs offline once
  loaded. No CDN, no network at runtime.

If future art ever needs raster assets, they land in `v2/public/` and are
referenced by hashed URL through Vite — but Phase 1 introduces none.

---

## 5. What Phase 1 scaffolds (validation only)

Enough to prove the boundary compiles, runs headless, and renders:

- `v2/` Vite + TS + PixiJS project (isolated; root game untouched).
- `core/`: `rng`, `types`, a minimal `state.createGame`, and a
  `simulation.applyAction`/`tick` implementing **awareness diffusion + a
  `talk` action** faithfully (subset of `endTurn`) — pure, no DOM.
- `render/PixiStage`: draws agents (posture/warmth by awareness) and links
  from a read-only snapshot.
- `ui/Hud`: minimal turn/energy/awareness readout + a Talk/Next-turn control
  that dispatches actions.
- `app/main`: wires them and runs the loop.
- `test/simulation.test.ts`: runs the core **in Node** (proving zero DOM
  coupling) and asserts diffusion is deterministic and monotonic under the
  seed — the architectural validation gate.

Explicitly **out of scope** for Phase 1: full `endTurn` (crackdowns,
reinforcements, opps), dilemmas, campaign map, legacy, era-2, audio, and the
complete content set. Those are Phase 2+.

---

## 6. Reusable ideas carried from the experimental redesign

The redesign PR remains an experimental reference; from it V2 reuses **ideas**,
not code: the scene-descriptor/palette system (→ `content/theme.ts` +
`render/`), the unified `selectPerson` selection path, an accessible cast list
over the canvas, procedural portrait/label primitives, the conversation-action
card, and the "environment transforms as awareness spreads" feedback — all
re-expressed against the clean core/render boundary rather than ported verbatim.

---

## 7. Phase 2 — approved decisions (2026-09-25)

These six decisions were reviewed and approved before Phase 2 began. They are
binding for the parity phase; any change to them, or to mechanics, content, save
behavior, or the architecture above, requires separate approval.

### 7.1 Renderer
**PixiJS**, accepting one bundled runtime dependency. Pixi is bundled by Vite
into the offline build (no CDN, no runtime network). The renderer stays an
adapter behind the snapshot boundary and can be swapped without touching
`core/`.

### 7.2 Build strategy & preview deploy
**Parallel build with eventual cutover.** V2 lives under `/v2`; `v2/dist` is
served through a **separate Vercel preview** while parity is established. The
production entry point (`/index.html`) is **not** replaced or modified, and
**no cutover happens without separate approval**.

### 7.3 Parity oracle & tolerance
**Stable `staging` is the reference implementation** — never experimental PR
#10. Parity requires **exact equality** for integer, Boolean, enum,
action-order, and seeded-RNG behavior, and a **documented small epsilon** only
for genuine floating-point calculations. Deterministic **action transcripts**
and **golden-master outputs** are captured in version control (under
`v2/test/golden/`).

> **Determinism finding (must be read with 7.3).** Production `index.html` is
> only *partially* seed-deterministic. Initial layout is seeded
> (`initGame` uses `mulberry32(1000 + lvlIdx*7919)`), but every stochastic
> **turn-level** event — crackdown spawn, reinforcement placement, informant
> guilt, wavering, opportunity/dilemma firing, `post`/`reach` outcomes — calls
> **unseeded `Math.random()`** directly. Exact golden-master parity is
> therefore impossible against production *as shipped*.
>
> **Method:** the parity harness runs the production simulation with a single
> **RNG seam** — every `Math.random()`/`rand()` call is routed through the same
> `mulberry32` stream V2 uses — so the oracle and V2 draw an identical entropy
> sequence and can be compared field-for-field. This changes **only the test
> oracle**; the shipped production game keeps `Math.random()` and is untouched.
> The seam is the definition of "seeded-RNG behavior" in 7.3.
>
> **Stage C parity note (endTurn view-effect draws).** Inside `endTurn`,
> production draws **animation** entropy (diffusion "pulse" timing,
> `Math.random()*400`) from the *same* stream as its mechanics, and *before* the
> win-pressure and crackdown rolls. To stay in lockstep the pure core `tick()`
> must consume those draws too, so `GameState` carries a `pulseCount` (0–12,
> matching production's `pulses.length` cap) solely to reproduce the draw
> sequence — it is not a gameplay value. This is the one place the pure core
> mirrors a production view artifact, and it is required by 7.3's
> "action-order + seeded-RNG" equality.

### 7.4 Save data (read-only in Phase 2)
Preserve compatibility with the existing save formats/keys (`ov8_*`, `ov11_*`,
`ov15_*`, `ov17_*`; plus `ov22_*`/`ov23_*` recognised). **During Phase 2, V2
treats production save data as read-only input:** it imports/clones production
saves into a **versioned V2 development namespace** (`ov_v2dev_*`) and writes
**only** there. The importer is **idempotent**, preserves original values,
tolerates missing/malformed data, and ships with **rollback tests**. V2 does
**not** write to or overwrite production keys until cutover is separately
approved.

Implemented in `v2/src/persistence/saveImport.ts` (recognised prefixes: `ov8_`,
`ov11_`, `ov15_`, `ov17_`, `ov22_`, `ov23_`). A runtime write-guard refuses any
write outside the `ov_v2dev_v1_*` namespace, so the importer cannot touch
production data even by mistake; `rollbackImport` removes only the namespace.
Verified in `v2/test/saveImport.test.ts`.

### 7.5 Content source (transitional)
**Stable `staging` is the content source of truth during Phase 2** — never
experimental PR #10. To avoid parallel manual editing of duplicate content, V2
content is **extracted from the staging baseline through a documented,
repeatable process** (`v2/tools/extract-content` reads the constants from
`staging:index.html` and emits typed `content/` modules). Any parity-phase
content change is made once in the baseline and propagated through that process.
Moving the canonical source to typed V2 content is reconsidered **only after
parity is proven**.

### 7.6 Toolchain & CI
Add **typecheck, Vitest, dependency-boundary enforcement, and the production
build** to **push-triggered CI** for the V2 branch. **No scheduled routines.**
