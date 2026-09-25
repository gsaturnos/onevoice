# One Voice V2 (frontend architecture prototype)

Isolated TypeScript + Vite + PixiJS frontend. **This does not replace the
production game.** The shipped build is the root `../index.html`; V2 lives here
under `/v2` and is developed in parallel until it reaches feature + save parity.

See `../docs/v2/ARCHITECTURE.md` for the full audit, module boundaries, and the
migration + asset strategy.

## Layout

```
src/
  core/       pure simulation — no DOM, no Pixi (unit-testable in Node)
    rng.ts          seeded mulberry32 (matches production)
    types.ts        domain types
    state.ts        createGame()  (initial state)
    simulation.ts   applyAction() / tick()  (pure reducers)
    selectors.ts    read-only derived views
  content/    static data (people pools, sample level)
  render/     PixiStage — observes a snapshot, draws it (owns no state)
  ui/         Hud — DOM readout + controls, dispatches Actions
  app/        main.ts — composition root + loop
test/         simulation.test.ts — architecture validation gate
```

## Dependency rule

`core/` imports nothing outside `core/` + `content/` types — no `window`,
`document`, `PIXI`, `localStorage`, or `Math.random`. `render/`, `ui/`, `audio/`,
`persistence/` may import `core/` but never each other. `app/` wires everything.
The core is advanced only by `applyAction`/`tick`; render/ui only read snapshots.

## Commands

```
npm install
npm run test        # runs the core headless in Node — the architecture gate
npm run typecheck   # tsc --noEmit
npm run dev         # Vite dev server (the Pixi prototype)
npm run build       # typecheck + production bundle
```

## Scope of this phase

A validation slice only: `talk` + awareness diffusion for one sample level,
rendered with Pixi, driven through the HUD. The full `endTurn` (crackdowns,
reinforcements, opportunities), dilemmas, campaign map, legacy, era-2, audio,
and the complete content set are **Phase 2+**, gated behind golden-master
parity tests against the production simulation.
