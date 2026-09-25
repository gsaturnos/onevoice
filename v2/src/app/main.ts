// Composition root. The ONLY module that wires core + render + ui together.
// It holds the single mutable reference to the current immutable snapshot,
// routes input through the pure reducers, and drives the render loop.

import { createGame } from '@core/state';
import { applyAction } from '@core/simulation';
import type { Action, GameState } from '@core/types';
import { KITCHEN_TABLE } from '@content/levels';
import { PixiStage } from '@render/PixiStage';
import { Hud } from '@ui/Hud';

async function boot(): Promise<void> {
  const stageHost = document.getElementById('stage')!;
  const hudHost = document.getElementById('hud')!;

  // one source of truth: the current snapshot. Reducers return the next one.
  let state: GameState = createGame(KITCHEN_TABLE, 0x51ee7 /* fixed seed */);

  const stage = new PixiStage();
  await stage.init(stageHost);

  const dispatch = (a: Action): void => {
    state = applyAction(state, a);
    hud.refresh(state);
  };
  const hud = new Hud(hudHost, dispatch);
  hud.refresh(state);

  // render loop only reads; it never advances the game.
  stage.app.ticker.add(() => stage.update(state));
}

boot().catch((err) => {
  document.getElementById('hud')!.textContent = 'Failed to start: ' + String(err);
  // eslint-disable-next-line no-console
  console.error(err);
});
