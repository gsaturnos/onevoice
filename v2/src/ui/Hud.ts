// Minimal DOM HUD. Reads snapshots via selectors, renders KPIs and controls,
// and emits Actions through a dispatch callback. It never mutates game state.

import type { Action, Snapshot } from '@core/types';
import { objectiveProgress, talkableTargets, averageAwareness } from '@core/selectors';

export type Dispatch = (a: Action) => void;

export class Hud {
  constructor(private readonly host: HTMLElement, private readonly dispatch: Dispatch) {}

  refresh(s: Snapshot): void {
    const prog = objectiveProgress(s);
    const targets = talkableTargets(s);
    const avg = Math.round(averageAwareness(s) * 100);

    this.host.innerHTML = `
      <h1>One Voice <span class="tag">V2 prototype</span></h1>
      <dl class="kpi">
        <div><dt>Turn</dt><dd>${s.turn} / ${s.level.maxT}</dd></div>
        <div><dt>Energy</dt><dd>${s.energy}</dd></div>
        <div><dt>Awareness</dt><dd>${avg}%</dd></div>
        <div><dt>Trust</dt><dd>${Math.round(s.inf)}</dd></div>
      </dl>
      <p class="goal">${prog.text} — <strong>${Math.min(prog.have, prog.need)}/${prog.need}</strong></p>
      ${s.over ? `<p class="result">${s.won ? '★ The table is awake.' : '✖ The evening ended.'}</p>` : ''}
      <div class="talk" role="group" aria-label="Talk with a neighbour"></div>
      <button id="end" ${s.over ? 'disabled' : ''}>Next turn →</button>
    `;

    const talk = this.host.querySelector('.talk') as HTMLElement;
    for (const j of targets) {
      const b = document.createElement('button');
      b.className = 'tchip';
      b.textContent = `Talk with ${s.agents[j].nm}`;
      b.setAttribute('aria-label', `Talk with ${s.agents[j].nm}, ${s.agents[j].role}`);
      b.disabled = s.over || s.energy < 1;
      b.addEventListener('click', () => this.dispatch({ kind: 'talk', target: j }));
      talk.appendChild(b);
    }
    const end = this.host.querySelector('#end') as HTMLButtonElement;
    end.addEventListener('click', () => this.dispatch({ kind: 'endTurn' }));
  }
}
